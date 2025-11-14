import React, { useState, useRef, useCallback } from 'react'
import { Upload, Merge, RefreshCw, AlertCircle, GripVertical, X, ArrowUp, ArrowDown, Settings, Zap, FileText, Minimize } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { useJobsStore } from '../../state/jobs'
import { workerManager } from '../../lib/workerManager'
import { globalBatchProcessor } from '../../lib/batchProcessor'
import type { PDFFile } from '../../state/store'

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

const EnhancedMergeTool: React.FC = () => {
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
        const { loadPDFDocument, getPageThumbnail, getPDFInfo } = await import('../../lib/pdf')
        
        const doc = await loadPDFDocument(uint8Array)
        const info = await getPDFInfo(doc)
        const page = await doc.getPage(1)
        const thumbnail = await getPageThumbnail(page, 150) // Higher quality thumbnails
        
        newFilesWithPreviews.push({
          file,
          preview: thumbnail,
          pageCount: info.pageCount,
          size: file.size,
          metadata: {
            title: file.name,
            author: 'Unknown'
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

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const handleMerge = async () => {
    if (selectedFiles.length < 2) return
    
    setIsProcessing(true)
    const jobId = Date.now().toString()
    
    try {
      addJob({
        id: jobId,
        type: 'merge',
        name: 'Enhanced PDF Merge',
        status: 'running' as const,
        fileIds: selectedFiles.map(f => f.file.name),
        progress: { current: 0, total: 100, message: 'Starting...' },
        startTime: Date.now(),
        cancellable: true
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
            updateJob(jobId, { progress: { current: progress, total: 100, message: 'Merging...' } })
          }
        }
      })
      
      // Calculate actual size reduction
      const originalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0)
      const newSize = result.byteLength
      const reduction = Math.round(((originalSize - newSize) / originalSize) * 100)
      setSizeReduction(reduction)
      
      const mergedFile = new File([result], 'merged-optimized.pdf', { type: 'application/pdf' })
      // Convert File to PDFFile
      const pdfFile: PDFFile = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: mergedFile.name,
        size: mergedFile.size,
        pageCount: 1, // Will be updated after loading
        data: new Uint8Array(await mergedFile.arrayBuffer()),
        lastModified: mergedFile.lastModified || Date.now()
      }
      addFile(pdfFile)
      
      updateJob(jobId, {
        status: 'completed',
        progress: { current: 100, total: 100, message: 'Completed' },
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

  const addToBatch = async () => {
    if (selectedFiles.length < 2) return

    globalBatchProcessor.addOperation({
      type: 'merge',
      files: selectedFiles.map(f => f.file),
      options: mergeOptions,
      priority: 5,
      onProgress: (progress) => {
        // Update progress in UI
      },
      onComplete: async (result) => {
        const resultFile = new File([result], 'merged.pdf', { type: 'application/pdf' })
        // Convert File to PDFFile
        const pdfFile: PDFFile = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          name: resultFile.name,
          size: resultFile.size,
          pageCount: 1, // Will be updated after loading
          data: new Uint8Array(await resultFile.arrayBuffer()),
          lastModified: resultFile.lastModified || Date.now()
        }
        addFile(pdfFile)
      }
    })

    // Clear files after adding to batch
    setSelectedFiles([])
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Enterprise PDF Merger</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <Settings className="w-4 h-4" />
            {showAdvancedOptions ? 'Hide' : 'Show'} Options
          </button>
          {selectedFiles.length >= 2 && (
            <button
              onClick={addToBatch}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Zap className="w-4 h-4" />
              Add to Batch
            </button>
          )}
        </div>
      </div>

      {/* Advanced Options Panel */}
      {showAdvancedOptions && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Enterprise Options</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Compression Options */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Compression</h4>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={mergeOptions.compression.enabled}
                  onChange={(e) => setMergeOptions(prev => ({
                    ...prev,
                    compression: { ...prev.compression, enabled: e.target.checked }
                  }))}
                  className="rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Enable compression</span>
              </label>
              {mergeOptions.compression.enabled && (
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                    Quality: {Math.round(mergeOptions.compression.quality * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={mergeOptions.compression.quality}
                    onChange={(e) => setMergeOptions(prev => ({
                      ...prev,
                      compression: { ...prev.compression, quality: parseFloat(e.target.value) }
                    }))}
                    className="w-full"
                  />
                </div>
              )}
            </div>

            {/* Optimization Options */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Optimization</h4>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={mergeOptions.optimization.removeUnusedObjects}
                  onChange={(e) => setMergeOptions(prev => ({
                    ...prev,
                    optimization: { ...prev.optimization, removeUnusedObjects: e.target.checked }
                  }))}
                  className="rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Remove unused objects</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={mergeOptions.optimization.optimizeImages}
                  onChange={(e) => setMergeOptions(prev => ({
                    ...prev,
                    optimization: { ...prev.optimization, optimizeImages: e.target.checked }
                  }))}
                  className="rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Optimize images</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={mergeOptions.optimization.linearize}
                  onChange={(e) => setMergeOptions(prev => ({
                    ...prev,
                    optimization: { ...prev.optimization, linearize: e.target.checked }
                  }))}
                  className="rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Fast web view</span>
              </label>
            </div>

            {/* Metadata Options */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Metadata</h4>
              <input
                type="text"
                placeholder="Custom title"
                value={mergeOptions.metadata.customTitle}
                onChange={(e) => setMergeOptions(prev => ({
                  ...prev,
                  metadata: { ...prev.metadata, customTitle: e.target.value }
                }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              <input
                type="text"
                placeholder="Custom author"
                value={mergeOptions.metadata.customAuthor}
                onChange={(e) => setMergeOptions(prev => ({
                  ...prev,
                  metadata: { ...prev.metadata, customAuthor: e.target.value }
                }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Size Estimation */}
          {selectedFiles.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-700 dark:text-blue-300">Estimated output size:</span>
                <span className="font-medium text-blue-900 dark:text-blue-100">
                  {formatFileSize(calculateEstimatedSize())}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* File Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`mb-6 border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragOver
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900'
            : 'border-gray-300 dark:border-gray-600'
        }`}
      >
        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-gray-100">
          Add PDF files to merge
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          Drag and drop PDF files here, or click to browse
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
        >
          Select Files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf"
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-gray-100">
            Selected Files ({selectedFiles.length})
          </h3>
          <div className="space-y-3">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <GripVertical className="w-5 h-5 text-gray-400 mr-3 cursor-move" />
                
                {file.preview && (
                  <img
                    src={file.preview}
                    alt={`Page 1 of ${file.file.name}`}
                    className="w-16 h-20 object-cover border border-gray-200 dark:border-gray-600 rounded"
                  />
                )}
                
                <div className="flex-1 ml-4">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">{file.metadata?.title || file.file.name}</h3>
                  <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                    <p>
                      {file.pageCount > 0 ? `${file.pageCount} pages` : 'Invalid PDF'} • {formatFileSize(file.size)}
                    </p>
                    {file.metadata?.author && (
                      <p className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        Author: {file.metadata.author}
                      </p>
                    )}
                    {file.metadata?.subject && (
                      <p className="text-xs">{file.metadata.subject}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => moveFile(index, 'up')}
                    disabled={index === 0}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => moveFile(index, 'down')}
                    disabled={index === selectedFiles.length - 1}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeFile(index)}
                    className="p-2 text-red-500 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {selectedFiles.length >= 2 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={handleMerge}
              disabled={selectedFiles.length < 2 || isProcessing}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Merge className="w-5 h-5" />
              )}
              {isProcessing ? 'Merging...' : 'Merge Now'}
            </button>
            
            <button
              onClick={addToBatch}
              disabled={selectedFiles.length < 2}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Zap className="w-5 h-5" />
              Add to Batch Queue
            </button>
          </div>

          {/* Results Display */}
          {sizeReduction > 0 && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900 rounded-lg border border-green-200 dark:border-green-700">
              <div className="flex items-center gap-2">
                <Minimize className="w-5 h-5 text-green-600" />
                <span className="text-green-800 dark:text-green-200 font-medium">
                  Size reduced by {sizeReduction}%
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {selectedFiles.length > 0 && selectedFiles.length < 2 && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <span className="text-yellow-800 dark:text-yellow-200">
              Add at least 2 PDF files to merge them together.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default EnhancedMergeTool