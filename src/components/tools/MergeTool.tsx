import React, { useState, useRef, useCallback } from 'react'
import { Upload, Merge, RefreshCw, AlertCircle, GripVertical, X, ArrowUp, ArrowDown, Settings, Zap, FileText, Maximize, Minimize } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { useJobsStore } from '../../state/jobs'
import { workerManager } from '../../lib/workerManager'
import { globalBatchProcessor } from '../../lib/batchProcessor'

interface FileWithPreview {
  file: File
  preview: string | null
  pageCount: number
  size: number
  metadata?: {
    title?: string
    author?: string
    subject?: string
    creationDate?: Date
    modificationDate?: Date
  }
}

interface MergeOptions {
  compression: {
    enabled: boolean
    quality: number
    imageCompression: boolean
  }
  optimization: {
    removeUnusedObjects: boolean
    optimizeImages: boolean
    linearize: boolean
  }
  metadata: {
    preserveOriginal: boolean
    customTitle?: string
    customAuthor?: string
    customSubject?: string
  }
  pageHandling: {
    removeBlankPages: boolean
    duplicateDetection: boolean
  }
}

const MergeTool: React.FC = () => {
  const handleMerge = async () => {
    if (selectedFiles.length < 2) return
    
    setIsProcessing(true)
    const jobId = Date.now().toString()
    
    try {
      addJob({
        id: jobId,
        type: 'merge',
        status: 'processing',
        files: selectedFiles.map(f => f.file.name),
        progress: 0,
        createdAt: new Date()
      })

      const files = await Promise.all(
        selectedFiles.map(f => f.file.arrayBuffer().then(ab => new Uint8Array(ab)))
      )
      
      // Enhanced merge with optimization options
      const result = await workerManager.submitJob({
        type: 'merge',
        files,
        options: {
          ...mergeOptions,
          onProgress: (progress: number) => {
            updateJob(jobId, { progress })
          }
        }
      })
      
      // Calculate actual size reduction
      const originalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0)
      const newSize = result.byteLength
      const reduction = Math.round(((originalSize - newSize) / originalSize) * 100)
      setSizeReduction(reduction)
      
      const mergedFile = new File([result], 'merged-optimized.pdf', { type: 'application/pdf' })
      addFile(mergedFile)
      
      updateJob(jobId, {
        status: 'completed',
        progress: 100,
        result: {
          fileName: 'merged-optimized.pdf',
          fileSize: newSize,
          sizeReduction: reduction
        }
      })
      
      setSelectedFiles([])
    } catch (error) {
      console.error('Merge failed:', error)
      updateJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsProcessing(false)
    }
  }
  const [selectedFiles, setSelectedFiles] = useState<FileWithPreview[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)
  const [mergeOptions, setMergeOptions] = useState<MergeOptions>({
    compression: {
      enabled: true,
      quality: 0.8,
      imageCompression: true
    },
    optimization: {
      removeUnusedObjects: true,
      optimizeImages: true,
      linearize: false
    },
    metadata: {
      preserveOriginal: true,
      customTitle: '',
      customAuthor: '',
      customSubject: ''
    },
    pageHandling: {
      removeBlankPages: false,
      duplicateDetection: false
    }
  })
  const [sizeReduction, setSizeReduction] = useState<number>(0)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addFile } = useAppStore()
  const { addJob, updateJob } = useJobsStore()

  const handleFileSelect = async (files: FileList) => {
    const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf')
    
    const newFilesWithPreviews: FileWithPreview[] = []
    
    for (const file of pdfFiles) {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        const { loadPDFDocument, getPageThumbnail, getPDFInfo, extractMetadata } = await import('../../lib/pdf')
        
        const doc = await loadPDFDocument(uint8Array)
        const info = await getPDFInfo(doc)
        const metadata = await extractMetadata(doc)
        const page = await doc.getPage(1)
        const thumbnail = await getPageThumbnail(page, 150) // Higher quality thumbnails
        
        newFilesWithPreviews.push({
          file,
          preview: thumbnail,
          pageCount: info.pageCount,
          size: file.size,
          metadata: {
            title: metadata.info?.Title || file.name,
            author: metadata.info?.Author || 'Unknown',
            subject: metadata.info?.Subject || '',
            creationDate: metadata.info?.CreationDate,
            modificationDate: metadata.info?.ModDate
          }
        })
      } catch (error) {
        console.error('Error processing file:', error)
        newFilesWithPreviews.push({
          file,
          preview: null,
          pageCount: 0,
          size: file.size,
          metadata: {
            title: file.name,
            author: 'Unknown'
          }
        })
      }
    }
    
    setSelectedFiles(prev => [...prev, ...newFilesWithPreviews])
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const droppedFiles = e.dataTransfer.files
    handleFileSelect(droppedFiles)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFileSelect(e.target.files)
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const moveFile = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === selectedFiles.length - 1)) {
      return
    }
    
    const newIndex = direction === 'up' ? index - 1 : index + 1
    
    setSelectedFiles(prev => {
      const newFiles = [...prev]
      const temp = newFiles[index]
      newFiles[index] = newFiles[newIndex]
      newFiles[newIndex] = temp
      return newFiles
    })
  }

  const calculateEstimatedSize = useCallback(() => {
    const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0)
    const compressionRatio = mergeOptions.compression.enabled ? mergeOptions.compression.quality : 1
    const optimizationReduction = mergeOptions.optimization.removeUnusedObjects ? 0.85 : 1
    return Math.round(totalSize * compressionRatio * optimizationReduction)
  }, [selectedFiles, mergeOptions])

  const addToBatch = () => {
    if (selectedFiles.length < 2) return

    globalBatchProcessor.addOperation({
      type: 'merge',
      files: selectedFiles.map(f => f.file),
      options: mergeOptions,
      priority: 5,
      onProgress: (progress) => {
        // Update progress in UI
      },
      onComplete: (result) => {
        const resultFile = new File([result], 'merged.pdf', { type: 'application/pdf' })
        addFile(resultFile)
      }
    })

    // Clear files after adding to batch
    setSelectedFiles([])
  }

  const getTotalPages = () => selectedFiles.reduce((total, file) => total + file.pageCount, 0)
  const getTotalSize = () => selectedFiles.reduce((total, file) => total + file.size, 0)

  const handleMerge = async () => {
    if (selectedFiles.length < 2) return

    setIsProcessing(true)
    
    try {
      const pdfDatas = await Promise.all(
        selectedFiles.map(async ({ file }) => {
          const arrayBuffer = await file.arrayBuffer()
          return new Uint8Array(arrayBuffer)
        })
      )
      
      const jobId = `merge-${Date.now()}`
      addJob({
        id: jobId,
        type: 'merge',
        name: 'Merge PDFs',
        status: 'running',
        progress: { current: 0, total: 100, message: 'Merging PDF files...' },
        startTime: Date.now(),
        cancellable: true,
        fileIds: selectedFiles.map(f => f.file.name)
      })

      const result = await workerManager.mergePDFs(pdfDatas)
      
      // Create new file with merged content
      const blob = new Blob([new Uint8Array(result)], { type: 'application/pdf' })
      const fileName = `merged_${Date.now()}.pdf`
      
      addFile({
        id: `merged-${Date.now()}`,
        name: fileName,
        size: blob.size,
        pageCount: getTotalPages(),
        data: new Uint8Array(await blob.arrayBuffer()),
        lastModified: Date.now()
      })
      
      // Download the file
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
      
      // Update job status
      updateJob(jobId, {
        status: 'completed',
        progress: { current: 100, total: 100, message: 'Merge completed' },
        endTime: Date.now()
      })

    } catch (error) {
      console.error('Error merging PDFs:', error)
      updateJob(`merge-error-${Date.now()}`, {
        status: 'failed',
        progress: { current: 0, total: 100, message: 'Merge failed' },
        endTime: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
            <Merge className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Merge PDFs</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Combine multiple PDF files into one document</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* File Upload */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Select PDF Files</h3>
                
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragOver
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400 mb-2">
                    Drop PDF files here or{' '}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      browse
                    </button>
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Select multiple PDF files to merge them in order
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </div>
              </div>

              {/* File List */}
              {selectedFiles.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Files to Merge ({selectedFiles.length})
                  </h3>
                  
                  <div className="space-y-3">
                    {selectedFiles.map((fileWithPreview, index) => (
                      <div
                        key={index}
                        className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                      >
                        <GripVertical className="w-4 h-4 text-gray-400" />
                        
                        {fileWithPreview.preview && (
                          <img 
                            src={fileWithPreview.preview} 
                            alt={`Preview ${index + 1}`}
                            className="w-10 h-12 object-cover rounded border"
                          />
                        )}
                        
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white text-sm">
                            {fileWithPreview.file.name}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {(fileWithPreview.size / (1024 * 1024)).toFixed(2)} MB • {fileWithPreview.pageCount} pages
                          </p>
                        </div>
                        
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => moveFile(index, 'up')}
                            disabled={index === 0}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => moveFile(index, 'down')}
                            disabled={index === selectedFiles.length - 1}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removeFile(index)}
                            className="p-1 text-gray-400 hover:text-red-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Summary & Actions */}
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Merge Summary</h3>
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Files:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {selectedFiles.length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total pages:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {getTotalPages()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total size:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {(getTotalSize() / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>
                </div>
                
                {selectedFiles.length > 0 && (
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Files will be merged in the order shown above. Use the arrow buttons to reorder.
                    </p>
                  </div>
                )}
              </div>

              {/* Merge Button */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <button
                  onClick={handleMerge}
                  disabled={selectedFiles.length < 2 || isProcessing}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-md transition-colors flex items-center justify-center"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      Merging...
                    </>
                  ) : (
                    <>
                      <Merge className="w-5 h-5 mr-2" />
                      Merge PDFs
                    </>
                  )}
                </button>

                {selectedFiles.length < 2 && (
                  <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md">
                    <div className="flex">
                      <AlertCircle className="w-5 h-5 text-yellow-400 mr-2 flex-shrink-0" />
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        Please select at least 2 PDF files to merge.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MergeTool