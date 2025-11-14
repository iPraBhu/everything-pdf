import { wrap, Remote } from 'comlink'
import type { PDFWorkerAPI } from '../workers/pdfWorker'
import type { OCRWorkerAPI } from '../workers/ocrWorker'
import type { ImageWorkerAPI } from '../workers/imageWorker'

class WorkerManager {
  private pdfWorker: Remote<PDFWorkerAPI> | null = null
  private ocrWorker: Remote<OCRWorkerAPI> | null = null
  private imageWorker: Remote<ImageWorkerAPI> | null = null

  private pdfWorkerInstance: Worker | null = null
  private ocrWorkerInstance: Worker | null = null
  private imageWorkerInstance: Worker | null = null

  async getPDFWorker(): Promise<Remote<PDFWorkerAPI>> {
    if (!this.pdfWorker) {
      this.pdfWorkerInstance = new Worker(
        new URL('../workers/pdfWorker.ts', import.meta.url),
        { type: 'module' }
      )
      this.pdfWorker = wrap<PDFWorkerAPI>(this.pdfWorkerInstance)
    }
    return this.pdfWorker
  }

  async getOCRWorker(): Promise<Remote<OCRWorkerAPI>> {
    if (!this.ocrWorker) {
      this.ocrWorkerInstance = new Worker(
        new URL('../workers/ocrWorker.ts', import.meta.url),
        { type: 'module' }
      )
      this.ocrWorker = wrap<OCRWorkerAPI>(this.ocrWorkerInstance)
    }
    return this.ocrWorker
  }

  async getImageWorker(): Promise<Remote<ImageWorkerAPI>> {
    if (!this.imageWorker) {
      this.imageWorkerInstance = new Worker(
        new URL('../workers/imageWorker.ts', import.meta.url),
        { type: 'module' }
      )
      this.imageWorker = wrap<ImageWorkerAPI>(this.imageWorkerInstance)
    }
    return this.imageWorker
  }

  async submitJob(jobConfig: any): Promise<any> {
    // This is a simplified implementation for compatibility
    const { type } = jobConfig
    
    switch (type) {
      case 'merge':
      case 'enhanced-merge':
        const pdfWorker = await this.getPDFWorker()
        return await pdfWorker.mergePDFs(jobConfig.files)
      
      case 'split':
      case 'smart-split':
        const splitWorker = await this.getPDFWorker()
        return await splitWorker.splitPDF(jobConfig.file, jobConfig.options)
        
      default:
        throw new Error(`Unsupported job type: ${type}`)
    }
  }

  async terminateAll(): Promise<void> {
    const promises: Promise<void>[] = []

    if (this.ocrWorker) {
      promises.push(this.ocrWorker.terminate())
      this.ocrWorker = null
    }

    if (this.pdfWorkerInstance) {
      this.pdfWorkerInstance.terminate()
      this.pdfWorkerInstance = null
      this.pdfWorker = null
    }

    if (this.ocrWorkerInstance) {
      this.ocrWorkerInstance.terminate()
      this.ocrWorkerInstance = null
    }

    if (this.imageWorkerInstance) {
      this.imageWorkerInstance.terminate()
      this.imageWorkerInstance = null
      this.imageWorker = null
    }

    await Promise.all(promises)
  }

  async terminatePDFWorker(): Promise<void> {
    if (this.pdfWorkerInstance) {
      this.pdfWorkerInstance.terminate()
      this.pdfWorkerInstance = null
      this.pdfWorker = null
    }
  }

  async terminateOCRWorker(): Promise<void> {
    if (this.ocrWorker) {
      await this.ocrWorker.terminate()
      this.ocrWorker = null
    }
    
    if (this.ocrWorkerInstance) {
      this.ocrWorkerInstance.terminate()
      this.ocrWorkerInstance = null
    }
  }

  async terminateImageWorker(): Promise<void> {
    if (this.imageWorkerInstance) {
      this.imageWorkerInstance.terminate()
      this.imageWorkerInstance = null
      this.imageWorker = null
    }
  }

  // Convenience methods for common operations
  async mergePDFs(pdfDatas: Uint8Array[]): Promise<Uint8Array> {
    const worker = await this.getPDFWorker()
    return worker.mergePDFs(pdfDatas)
  }

  async splitPDF(pdfData: Uint8Array, splitPoints: number[]): Promise<Uint8Array[]> {
    const worker = await this.getPDFWorker()
    return worker.splitPDF(pdfData, splitPoints)
  }

  async extractPages(pdfData: Uint8Array, pageIndices: number[]): Promise<Uint8Array> {
    const worker = await this.getPDFWorker()
    return worker.extractPages(pdfData, pageIndices)
  }

  async rotatePages(
    pdfData: Uint8Array, 
    rotations: Array<{ pageIndex: number; degrees: number }>
  ): Promise<Uint8Array> {
    const worker = await this.getPDFWorker()
    return worker.rotatePages(pdfData, rotations)
  }

  async addWatermark(pdfData: Uint8Array, text: string, options: any = {}): Promise<Uint8Array> {
    const worker = await this.getPDFWorker()
    return worker.addWatermark(pdfData, text, options)
  }

  async addPageNumbers(pdfData: Uint8Array, options: any = {}): Promise<Uint8Array> {
    const worker = await this.getPDFWorker()
    return worker.addPageNumbers(pdfData, options)
  }

  async nUpLayout(pdfDatas: Uint8Array[], options: any = {}): Promise<Uint8Array> {
    const worker = await this.getPDFWorker()
    return worker.nUpLayout(pdfDatas, options)
  }

  async posterize(pdfData: Uint8Array, options: any = {}): Promise<Uint8Array> {
    const worker = await this.getPDFWorker()
    return worker.posterize(pdfData, options)
  }

  async interleavePages(pdfDatas: Uint8Array[], options: any = {}): Promise<Uint8Array> {
    const worker = await this.getPDFWorker()
    return worker.interleavePages(pdfDatas, options)
  }

  async performOCR(
    imageData: ImageData, 
    options: { 
      language?: string
      progressCallback?: (progress: { status: string; progress: number }) => void 
    } = {}
  ): Promise<any> {
    const worker = await this.getOCRWorker()
    return worker.performOCR(imageData, options)
  }

  async resizeImage(imageData: ImageData, width: number, height: number): Promise<ImageData> {
    const worker = await this.getImageWorker()
    return worker.resizeImage(imageData, width, height)
  }

  async convertToGrayscale(imageData: ImageData): Promise<ImageData> {
    const worker = await this.getImageWorker()
    return worker.convertToGrayscale(imageData)
  }

  async compressImage(
    imageData: ImageData, 
    quality: number, 
    format: 'jpeg' | 'png' | 'webp'
  ): Promise<Uint8Array> {
    const worker = await this.getImageWorker()
    return worker.compressImage(imageData, quality, format)
  }
}

// Export singleton instance
export const workerManager = new WorkerManager()

// Cleanup workers on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    workerManager.terminateAll()
  })
}