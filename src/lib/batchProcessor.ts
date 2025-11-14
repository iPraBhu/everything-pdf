import { workerManager } from './workerManager'

export interface BatchOperation {
  id: string
  type: 'merge' | 'split' | 'watermark' | 'rotate' | 'compress' | 'extract' | 'reorder'
  files: File[]
  options: Record<string, any>
  priority: number
  onProgress?: (progress: number, operation: BatchOperation) => void
  onComplete?: (result: any, operation: BatchOperation) => void
  onError?: (error: Error, operation: BatchOperation) => void
}

export interface BatchProcessorOptions {
  maxConcurrent: number
  retryAttempts: number
  retryDelay: number
  progressThrottle: number
}

export class BatchProcessor {
  private queue: BatchOperation[] = []
  private processing: Map<string, BatchOperation> = new Map()
  private completed: BatchOperation[] = []
  private failed: BatchOperation[] = []
  private options: BatchProcessorOptions
  private isRunning = false

  constructor(options: Partial<BatchProcessorOptions> = {}) {
    this.options = {
      maxConcurrent: 3,
      retryAttempts: 2,
      retryDelay: 1000,
      progressThrottle: 100,
      ...options
    }
  }

  /**
   * Add a new operation to the batch queue
   */
  addOperation(operation: Omit<BatchOperation, 'id'>): string {
    const id = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const batchOp: BatchOperation = {
      ...operation,
      id
    }
    
    // Insert based on priority (higher priority first)
    const insertIndex = this.queue.findIndex(op => op.priority < operation.priority)
    if (insertIndex === -1) {
      this.queue.push(batchOp)
    } else {
      this.queue.splice(insertIndex, 0, batchOp)
    }

    // Auto-start if not running
    if (!this.isRunning) {
      this.start()
    }

    return id
  }

  /**
   * Add multiple operations at once
   */
  addOperations(operations: Omit<BatchOperation, 'id'>[]): string[] {
    return operations.map(op => this.addOperation(op))
  }

  /**
   * Start processing the batch queue
   */
  async start(): Promise<void> {
    if (this.isRunning) return

    this.isRunning = true
    
    while (this.queue.length > 0 || this.processing.size > 0) {
      // Start new operations up to max concurrent limit
      while (this.processing.size < this.options.maxConcurrent && this.queue.length > 0) {
        const operation = this.queue.shift()!
        this.processing.set(operation.id, operation)
        this.processOperation(operation)
      }

      // Wait for at least one operation to complete
      if (this.processing.size > 0) {
        await this.waitForAnyCompletion()
      }
    }

    this.isRunning = false
  }

  /**
   * Pause batch processing
   */
  pause(): void {
    this.isRunning = false
  }

  /**
   * Clear all pending operations
   */
  clear(): void {
    this.queue.length = 0
  }

  /**
   * Get current batch status
   */
  getStatus() {
    return {
      queued: this.queue.length,
      processing: this.processing.size,
      completed: this.completed.length,
      failed: this.failed.length,
      total: this.queue.length + this.processing.size + this.completed.length + this.failed.length
    }
  }

  /**
   * Get overall progress percentage
   */
  getProgress(): number {
    const status = this.getStatus()
    if (status.total === 0) return 100
    return Math.round(((status.completed + status.failed) / status.total) * 100)
  }

  private async processOperation(operation: BatchOperation): Promise<void> {
    let attempts = 0
    let lastError: Error | null = null

    while (attempts <= this.options.retryAttempts) {
      try {
        const result = await this.executeOperation(operation)
        
        // Move to completed
        this.processing.delete(operation.id)
        this.completed.push(operation)
        
        // Notify success
        operation.onComplete?.(result, operation)
        return

      } catch (error) {
        lastError = error as Error
        attempts++
        
        if (attempts <= this.options.retryAttempts) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, this.options.retryDelay))
        }
      }
    }

    // All attempts failed
    this.processing.delete(operation.id)
    this.failed.push(operation)
    operation.onError?.(lastError!, operation)
  }

  private async executeOperation(operation: BatchOperation): Promise<any> {
    const { type, files, options } = operation

    // Create progress handler
    const progressHandler = (progress: number) => {
      operation.onProgress?.(progress, operation)
    }

    switch (type) {
      case 'merge':
        return await workerManager.submitJob({
          type: 'merge',
          files: await Promise.all(files.map(f => f.arrayBuffer().then(ab => new Uint8Array(ab)))),
          options: { ...options, onProgress: progressHandler }
        })

      case 'split':
        if (files.length !== 1) {
          throw new Error('Split operation requires exactly one file')
        }
        return await workerManager.submitJob({
          type: 'split',
          file: new Uint8Array(await files[0].arrayBuffer()),
          options: { ...options, onProgress: progressHandler }
        })

      case 'watermark':
        return await workerManager.submitJob({
          type: 'watermark',
          files: await Promise.all(files.map(f => f.arrayBuffer().then(ab => new Uint8Array(ab)))),
          options: { ...options, onProgress: progressHandler }
        })

      case 'rotate':
        return await workerManager.submitJob({
          type: 'rotate',
          files: await Promise.all(files.map(f => f.arrayBuffer().then(ab => new Uint8Array(ab)))),
          options: { ...options, onProgress: progressHandler }
        })

      case 'compress':
        return await workerManager.submitJob({
          type: 'compress',
          files: await Promise.all(files.map(f => f.arrayBuffer().then(ab => new Uint8Array(ab)))),
          options: { ...options, onProgress: progressHandler }
        })

      case 'extract':
        if (files.length !== 1) {
          throw new Error('Extract operation requires exactly one file')
        }
        return await workerManager.submitJob({
          type: 'extract',
          file: new Uint8Array(await files[0].arrayBuffer()),
          options: { ...options, onProgress: progressHandler }
        })

      case 'reorder':
        if (files.length !== 1) {
          throw new Error('Reorder operation requires exactly one file')
        }
        return await workerManager.submitJob({
          type: 'reorder',
          file: new Uint8Array(await files[0].arrayBuffer()),
          options: { ...options, onProgress: progressHandler }
        })

      default:
        throw new Error(`Unsupported operation type: ${type}`)
    }
  }

  private async waitForAnyCompletion(): Promise<void> {
    return new Promise(resolve => {
      const checkCompletion = () => {
        if (this.processing.size === 0) {
          resolve()
        } else {
          setTimeout(checkCompletion, this.options.progressThrottle)
        }
      }
      checkCompletion()
    })
  }
}

// Global batch processor instance
export const globalBatchProcessor = new BatchProcessor({
  maxConcurrent: 2, // Limit for better UX
  retryAttempts: 1,
  retryDelay: 500
})

/**
 * Utility functions for common batch operations
 */
export const batchUtils = {
  /**
   * Batch merge multiple sets of PDFs
   */
  batchMerge: (fileGroups: File[][], options: any = {}) => {
    return fileGroups.map(files => globalBatchProcessor.addOperation({
      type: 'merge',
      files,
      options,
      priority: 5
    }))
  },

  /**
   * Batch watermark multiple PDFs with the same settings
   */
  batchWatermark: (files: File[], watermarkOptions: any) => {
    return files.map(file => globalBatchProcessor.addOperation({
      type: 'watermark',
      files: [file],
      options: watermarkOptions,
      priority: 3
    }))
  },

  /**
   * Batch rotate multiple PDFs
   */
  batchRotate: (files: File[], rotationAngle: number) => {
    return files.map(file => globalBatchProcessor.addOperation({
      type: 'rotate',
      files: [file],
      options: { angle: rotationAngle },
      priority: 4
    }))
  },

  /**
   * Batch compress multiple PDFs
   */
  batchCompress: (files: File[], compressionLevel: number = 0.7) => {
    return files.map(file => globalBatchProcessor.addOperation({
      type: 'compress',
      files: [file],
      options: { quality: compressionLevel },
      priority: 2
    }))
  }
}