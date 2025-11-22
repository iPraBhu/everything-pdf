import React, { useState, useRef, useCallback } from 'react'
import { Upload, Minimize, RefreshCw, AlertCircle, Eye, Download, Trash2, Zap } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { useJobsStore } from '../../state/jobs'
import { workerManager } from '../../lib/workerManager'

interface CompressionOptions {
  level: 'low' | 'medium' | 'high' | 'maximum'
  imageQuality: number
  removeMetadata: boolean
  optimizeFonts: boolean
  compressImages: boolean
}

const CompressPDFTool: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [totalPages, setTotalPages] = useState(0)
  const [preview, setPreview] = useState<string | null>(null)
  const [compressionEstimate, setCompressionEstimate] = useState<{
    originalSize: number
    estimatedSize: number
    savings: number
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { addFile } = useAppStore()
  const { addJob, updateJob } = useJobsStore()

  const [options, setOptions] = useState<CompressionOptions>({
    level: 'medium',
    imageQuality: 80,
    removeMetadata: true,
    optimizeFonts: true,
    compressImages: true
  })

  const compressionLevels = {
    low: { name: 'Low Compression', factor: 0.85, quality: 90 },
    medium: { name: 'Medium Compression', factor: 0.65, quality: 75 },
    high: { name: 'High Compression', factor: 0.45, quality: 60 },
    maximum: { name: 'Maximum Compression', factor: 0.25, quality: 40 }
  }

  const handleFileSelect = async (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file')
      return
    }

    setSelectedFile(file)
    setPreview(null)
    await generatePreview(file)
    await getTotalPages(file)
    calculateCompressionEstimate(file)
  }

  const generatePreview = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      const { loadPDFDocument, getPageThumbnail } = await import('../../lib/pdf')
      const doc = await loadPDFDocument(uint8Array)
      const page = await doc.getPage(1)
      const thumbnail = await getPageThumbnail(page, 200)
      setPreview(thumbnail)
    } catch (error) {
      console.error('Error generating preview:', error)
    }
  }

  const getTotalPages = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      const { loadPDFDocument } = await import('../../lib/pdf')
      const doc = await loadPDFDocument(uint8Array)
      setTotalPages(doc.numPages)
    } catch (error) {
      console.error('Error getting page count:', error)
    }
  }

  const calculateCompressionEstimate = (file: File) => {
    const level = compressionLevels[options.level]
    let estimatedSize = file.size * level.factor

    // Additional reductions based on options
    if (options.removeMetadata) estimatedSize *= 0.95
    if (options.optimizeFonts) estimatedSize *= 0.92
    if (options.compressImages) estimatedSize *= 0.85

    // Ensure minimum size (files can't compress infinitely)
    estimatedSize = Math.max(estimatedSize, file.size * 0.1)

    const savings = ((file.size - estimatedSize) / file.size) * 100

    setCompressionEstimate({
      originalSize: file.size,
      estimatedSize: Math.round(estimatedSize),
      savings: Math.round(savings)
    })
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getCompressionDescription = () => {
    const level = compressionLevels[options.level]
    const descriptions = {
      low: 'Slight compression with minimal quality loss',
      medium: 'Balanced compression for most use cases',
      high: 'Aggressive compression for smaller files',
      maximum: 'Maximum compression, may affect quality'
    }
    return descriptions[options.level]
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }, [])

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }

  // Recalculate estimates when options change
  React.useEffect(() => {
    if (selectedFile) {
      calculateCompressionEstimate(selectedFile)
    }
  }, [options, selectedFile])

  const handleCompressPDF = async () => {
    if (!selectedFile) return

    setIsProcessing(true)
    const jobId = `compress-pdf-${Date.now()}`
    
    try {
      addJob({
        id: jobId,
        type: 'compress-pdf',
        name: `Compress ${selectedFile.name}`,
        status: 'processing',
        fileIds: [selectedFile.name],
        progress: 0,
        startTime: Date.now(),
        cancellable: true
      })

      const arrayBuffer = await selectedFile.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      updateJob(jobId, { progress: 30 })

      const compressionOptions = {
        level: options.level,
        imageQuality: options.imageQuality,
        removeMetadata: options.removeMetadata,
        optimizeFonts: options.optimizeFonts,
        compressImages: options.compressImages
      }

      updateJob(jobId, { progress: 70 })

      
      updateJob(jobId, { progress: 90 })

      // Calculate actual compression ratio
      const actualSavings = ((selectedFile.size - result.byteLength) / selectedFile.size) * 100

      // Create new compressed file
      const compressedFileName = selectedFile.name.replace(/\.pdf$/i, '_compressed.pdf')
      const pdfFile = {
        id: `compressed-${Date.now()}`,
        name: compressedFileName,
        size: result.byteLength,
        type: 'application/pdf',
        lastModified: Date.now(),
        file: new File([new Uint8Array(result)], compressedFileName, { type: 'application/pdf' }),
        pageCount: totalPages,
        data: result
      } as any
      
      addFile(pdfFile)

      updateJob(jobId, {
        status: 'completed',
        progress: 100,
        endTime: Date.now()
      })

      console.log(`Successfully compressed PDF. Size reduced by ${actualSavings.toFixed(1)}%`)

    } catch (error) {
      console.error('Error compressing PDF:', error)
      updateJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        endTime: Date.now()
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
              <Minimize className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Compress PDF</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Reduce PDF file size while maintaining quality</p>
            </div>
          </div>
          {selectedFile && (
            <button
              onClick={handleCompressPDF}
              disabled={isProcessing}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              {isProcessing ? 'Compressing...' : 'Compress'}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* File Upload */}
          <div
            className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
              isDragOver
                ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="mt-4">
                <label htmlFor="file-upload" className="cursor-pointer">
                  <span className="text-base font-medium text-green-600 hover:text-green-500">
                    Upload a PDF file
                  </span>
                  <span className="text-gray-500 dark:text-gray-400"> or drag and drop</span>
                </label>
                <input
                  ref={fileInputRef}
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  className="sr-only"
                  accept=".pdf"
                  onChange={handleFileInputChange}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">PDF files up to 50MB</p>
            </div>
          </div>

          {/* Selected File Info */}
          {selectedFile && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatFileSize(selectedFile.size)}
                    {totalPages > 0 && ` • ${totalPages} pages`}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedFile(null)
                    setPreview(null)
                    setTotalPages(0)
                    setCompressionEstimate(null)
                  }}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Compression Settings */}
          {selectedFile && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Compression Settings</h3>
              
              <div className="space-y-6">
                {/* Compression Level */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Compression Level
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {Object.entries(compressionLevels).map(([key, level]) => (
                      <button
                        key={key}
                        onClick={() => setOptions({ ...options, level: key as any })}
                        className={`p-4 text-left border rounded-lg transition-colors ${
                          options.level === key
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                        }`}
                      >
                        <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{level.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          ~{Math.round((1 - level.factor) * 100)}% reduction
                        </div>
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    {getCompressionDescription()}
                  </p>
                </div>

                {/* Advanced Options */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Advanced Options
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={options.compressImages}
                        onChange={(e) => setOptions({ ...options, compressImages: e.target.checked })}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Compress images</span>
                    </label>
                    
                    {options.compressImages && (
                      <div className="ml-6">
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Image Quality: {options.imageQuality}%
                        </label>
                        <input
                          type="range"
                          min="20"
                          max="100"
                          value={options.imageQuality}
                          onChange={(e) => setOptions({ ...options, imageQuality: parseInt(e.target.value) })}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                          <span>Smaller file</span>
                          <span>Better quality</span>
                        </div>
                      </div>
                    )}
                    
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={options.optimizeFonts}
                        onChange={(e) => setOptions({ ...options, optimizeFonts: e.target.checked })}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Optimize fonts</span>
                    </label>
                    
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={options.removeMetadata}
                        onChange={(e) => setOptions({ ...options, removeMetadata: e.target.checked })}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Remove metadata</span>
                    </label>
                  </div>
                </div>

                {/* Compression Estimate */}
                {compressionEstimate && (
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                    <h4 className="font-medium text-green-900 dark:text-green-100 mb-3">Estimated Compression</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-gray-600 dark:text-gray-400">Original Size</div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {formatFileSize(compressionEstimate.originalSize)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-600 dark:text-gray-400">Estimated Size</div>
                        <div className="font-medium text-green-600 dark:text-green-400">
                          {formatFileSize(compressionEstimate.estimatedSize)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-600 dark:text-gray-400">Space Saved</div>
                        <div className="font-medium text-green-600 dark:text-green-400">
                          {compressionEstimate.savings}%
                        </div>
                      </div>
                    </div>
                    
                    {/* Visual progress bar */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                        <span>File size reduction</span>
                        <span>{compressionEstimate.savings}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 transition-all duration-300"
                          style={{ width: `${compressionEstimate.savings}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Preview Panel */}
        {selectedFile && preview && (
          <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Document Preview</h3>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
              <img
                src={preview}
                alt="PDF Preview"
                className="w-full h-auto rounded-lg"
              />
            </div>
            
            <div className="mt-4 space-y-3">
              {compressionEstimate && (
                <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Compression Summary</h4>
                  <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                    <div>Level: {compressionLevels[options.level].name}</div>
                    <div>Original: {formatFileSize(compressionEstimate.originalSize)}</div>
                    <div>Estimated: {formatFileSize(compressionEstimate.estimatedSize)}</div>
                    <div>Savings: {compressionEstimate.savings}%</div>
                  </div>
                </div>
              )}

              <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">File Info</h4>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <div>Pages: {totalPages}</div>
                  <div>Type: PDF Document</div>
                  <div>Size: {formatFileSize(selectedFile.size)}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CompressPDFTool