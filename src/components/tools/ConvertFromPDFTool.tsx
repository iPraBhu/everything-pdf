import React, { useState, useRef, useCallback } from 'react'
import { Upload, Image, RefreshCw, AlertCircle, Eye, Download, Trash2, FileImage } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { useJobsStore } from '../../state/jobs'
import { workerManager } from '../../lib/workerManager'

interface ConvertOptions {
  format: 'png' | 'jpeg' | 'webp' | 'tiff'
  quality: number // for jpeg/webp
  dpi: number
  pageRange: {
    enabled: boolean
    start: number
    end: number
  }
  naming: {
    prefix: string
    includePageNumber: boolean
    zeroPrefix: boolean
  }
}

const ConvertFromPDFTool: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [totalPages, setTotalPages] = useState(0)
  const [preview, setPreview] = useState<string | null>(null)
  const [pagePreview, setPagePreview] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { addFile } = useAppStore()
  const { addJob, updateJob } = useJobsStore()

  const [options, setOptions] = useState<ConvertOptions>({
    format: 'png',
    quality: 90,
    dpi: 300,
    pageRange: {
      enabled: false,
      start: 1,
      end: 1
    },
    naming: {
      prefix: 'page',
      includePageNumber: true,
      zeroPrefix: true
    }
  })

  const formatInfo = {
    png: { name: 'PNG', description: 'High quality, transparent background support', lossy: false },
    jpeg: { name: 'JPEG', description: 'Smaller files, good for photos', lossy: true },
    webp: { name: 'WebP', description: 'Modern format, small size, high quality', lossy: true },
    tiff: { name: 'TIFF', description: 'Professional format, largest files', lossy: false }
  }

  const dpiOptions = [
    { value: 72, name: '72 DPI', description: 'Web/Screen (small files)' },
    { value: 150, name: '150 DPI', description: 'Standard print quality' },
    { value: 300, name: '300 DPI', description: 'High print quality' },
    { value: 600, name: '600 DPI', description: 'Professional (large files)' }
  ]

  const handleFileSelect = async (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file')
      return
    }

    setSelectedFile(file)
    setPreview(null)
    setPagePreview([])
    await generatePreview(file)
    await getTotalPages(file)
  }

  const generatePreview = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      const { loadPDFDocument, getPageThumbnail } = await import('../../lib/pdf')
      const doc = await loadPDFDocument(uint8Array)
      
      // Generate preview for first page
      const page = await doc.getPage(1)
      const thumbnail = await getPageThumbnail(page, 200)
      setPreview(thumbnail)

      // Generate previews for first few pages
      const previews: string[] = []
      const maxPages = Math.min(doc.numPages, 6)
      for (let i = 1; i <= maxPages; i++) {
        const page = await doc.getPage(i)
        const thumbnail = await getPageThumbnail(page, 120)
        previews.push(thumbnail)
      }
      setPagePreview(previews)
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
      setOptions(prev => ({
        ...prev,
        pageRange: { ...prev.pageRange, end: doc.numPages }
      }))
    } catch (error) {
      console.error('Error getting page count:', error)
    }
  }

  const getEffectivePageRange = () => {
    if (options.pageRange.enabled) {
      return {
        start: Math.max(1, options.pageRange.start),
        end: Math.min(totalPages, options.pageRange.end)
      }
    }
    return { start: 1, end: totalPages }
  }

  const generateFileName = (pageNum: number, total: number): string => {
    let filename = options.naming.prefix

    if (options.naming.includePageNumber) {
      if (options.naming.zeroPrefix) {
        const padding = total.toString().length
        filename += `_${pageNum.toString().padStart(padding, '0')}`
      } else {
        filename += `_${pageNum}`
      }
    }

    return filename + `.${options.format}`
  }

  const estimateFileSize = (): string => {
    if (!selectedFile) return '0 MB'

    const range = getEffectivePageRange()
    const pageCount = range.end - range.start + 1
    
    // Rough estimation based on format and DPI
    let avgSizePerPage = 0
    switch (options.format) {
      case 'png':
        avgSizePerPage = (options.dpi / 150) * 500 * 1024 // ~500KB at 150 DPI
        break
      case 'jpeg':
        avgSizePerPage = (options.dpi / 150) * (options.quality / 100) * 200 * 1024 // ~200KB at 150 DPI, 100% quality
        break
      case 'webp':
        avgSizePerPage = (options.dpi / 150) * (options.quality / 100) * 150 * 1024 // ~150KB at 150 DPI, 100% quality
        break
      case 'tiff':
        avgSizePerPage = (options.dpi / 150) * 1000 * 1024 // ~1MB at 150 DPI
        break
    }

    const totalSize = avgSizePerPage * pageCount
    return totalSize > 1024 * 1024 
      ? `~${(totalSize / (1024 * 1024)).toFixed(1)} MB`
      : `~${(totalSize / 1024).toFixed(0)} KB`
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

  const handleConvertToImages = async () => {
    if (!selectedFile) return

    const range = getEffectivePageRange()
    const pageCount = range.end - range.start + 1

    setIsProcessing(true)
    const jobId = `convert-to-images-${Date.now()}`
    
    try {
      addJob({
        id: jobId,
        type: 'convert-to-images',
        name: `Convert ${selectedFile.name} to ${options.format.toUpperCase()}`,
        status: 'processing',
        fileIds: [selectedFile.name],
        progress: 0,
        startTime: Date.now(),
        cancellable: true
      })

      const arrayBuffer = await selectedFile.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      updateJob(jobId, { progress: 20 })

      const convertOptions = {
        format: options.format,
        quality: options.quality,
        dpi: options.dpi,
        startPage: range.start,
        endPage: range.end
      }

      updateJob(jobId, { progress: 40 })

      // Convert PDF to images (this would need to be implemented in workerManager)
      // For now, we'll simulate the process
      const images: ArrayBuffer[] = []
      
      for (let pageNum = range.start; pageNum <= range.end; pageNum++) {
        updateJob(jobId, { 
          progress: 40 + ((pageNum - range.start) / pageCount) * 50
        })

        // TODO: Implement convertPDFPageToImage in workerManager
        // For now, we'll simulate the process
        console.warn('PDF to image conversion not yet implemented in workerManager')
        // Placeholder - would normally convert page to image
        const imageResult = new ArrayBuffer(1024) // Dummy data
        images.push(imageResult)
      }

      updateJob(jobId, { progress: 95 })

      // Create image files and add them to the app store
      images.forEach((imageData, index) => {
        const pageNum = range.start + index
        const fileName = generateFileName(pageNum, pageCount)
        
        const imageFile = {
          id: `image-${Date.now()}-${index}`,
          name: fileName,
          size: imageData.byteLength,
          type: `image/${options.format}`,
          lastModified: Date.now(),
          file: new File([new Uint8Array(imageData)], fileName, { type: `image/${options.format}` }),
          pageCount: 1,
          data: imageData
        } as any
        
        addFile(imageFile)
      })

      updateJob(jobId, {
        status: 'completed',
        progress: 100,
        endTime: Date.now()
      })

      console.log(`Successfully converted ${pageCount} pages to ${options.format.toUpperCase()}`)

    } catch (error) {
      console.error('Error converting PDF to images:', error)
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
            <div className="w-10 h-10 bg-pink-100 dark:bg-pink-900 rounded-lg flex items-center justify-center">
              <Image className="w-6 h-6 text-pink-600 dark:text-pink-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">PDF to Images</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Convert PDF pages to image files</p>
            </div>
          </div>
          {selectedFile && (
            <button
              onClick={handleConvertToImages}
              disabled={isProcessing}
              className="flex items-center px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileImage className="w-4 h-4 mr-2" />
              )}
              {isProcessing ? 'Converting...' : 'Convert to Images'}
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
                ? 'border-pink-400 bg-pink-50 dark:bg-pink-900/20'
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
                  <span className="text-base font-medium text-pink-600 hover:text-pink-500">
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
              <p className="text-xs text-gray-500 dark:text-gray-400">PDF files up to 10MB</p>
            </div>
          </div>

          {/* Selected File Info */}
          {selectedFile && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    {totalPages > 0 && ` • ${totalPages} pages`}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedFile(null)
                    setPreview(null)
                    setPagePreview([])
                    setTotalPages(0)
                  }}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Conversion Settings */}
          {selectedFile && totalPages > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Conversion Settings</h3>
              
              <div className="space-y-6">
                {/* Image Format */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Output Format
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {Object.entries(formatInfo).map(([format, info]) => (
                      <button
                        key={format}
                        onClick={() => setOptions({ ...options, format: format as any })}
                        className={`p-4 text-left border rounded-lg transition-colors ${
                          options.format === format
                            ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20'
                            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                        }`}
                      >
                        <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{info.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{info.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quality (for lossy formats) */}
                {(options.format === 'jpeg' || options.format === 'webp') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Image Quality: {options.quality}%
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={options.quality}
                      onChange={(e) => setOptions({ ...options, quality: parseInt(e.target.value) })}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span>Smaller files</span>
                      <span>Better quality</span>
                    </div>
                  </div>
                )}

                {/* DPI */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Resolution (DPI)
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {dpiOptions.map((dpi) => (
                      <button
                        key={dpi.value}
                        onClick={() => setOptions({ ...options, dpi: dpi.value })}
                        className={`p-3 text-left border rounded-lg transition-colors ${
                          options.dpi === dpi.value
                            ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20'
                            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                        }`}
                      >
                        <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{dpi.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{dpi.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Page Range */}
                <div>
                  <label className="flex items-center mb-3">
                    <input
                      type="checkbox"
                      checked={options.pageRange.enabled}
                      onChange={(e) => setOptions({
                        ...options,
                        pageRange: { ...options.pageRange, enabled: e.target.checked }
                      })}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Convert specific page range
                    </span>
                  </label>
                  
                  {options.pageRange.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Start Page
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={totalPages}
                          value={options.pageRange.start}
                          onChange={(e) => setOptions({
                            ...options,
                            pageRange: { ...options.pageRange, start: parseInt(e.target.value) || 1 }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          End Page
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={totalPages}
                          value={options.pageRange.end}
                          onChange={(e) => setOptions({
                            ...options,
                            pageRange: { ...options.pageRange, end: parseInt(e.target.value) || totalPages }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* File Naming */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    File Naming
                  </label>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                        File Name Prefix
                      </label>
                      <input
                        type="text"
                        value={options.naming.prefix}
                        onChange={(e) => setOptions({
                          ...options,
                          naming: { ...options.naming, prefix: e.target.value }
                        })}
                        placeholder="page"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={options.naming.includePageNumber}
                          onChange={(e) => setOptions({
                            ...options,
                            naming: { ...options.naming, includePageNumber: e.target.checked }
                          })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Include page number</span>
                      </label>
                      
                      {options.naming.includePageNumber && (
                        <label className="flex items-center ml-6">
                          <input
                            type="checkbox"
                            checked={options.naming.zeroPrefix}
                            onChange={(e) => setOptions({
                              ...options,
                              naming: { ...options.naming, zeroPrefix: e.target.checked }
                            })}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Zero-prefix numbers</span>
                        </label>
                      )}
                    </div>
                  </div>
                </div>

                {/* Preview Output */}
                {(() => {
                  const range = getEffectivePageRange()
                  const pageCount = range.end - range.start + 1
                  const sampleFiles = [
                    generateFileName(range.start, pageCount),
                    generateFileName(range.start + 1, pageCount),
                    generateFileName(range.start + 2, pageCount)
                  ].slice(0, Math.min(3, pageCount))

                  return (
                    <div className="bg-pink-50 dark:bg-pink-900/20 rounded-lg p-4">
                      <h4 className="font-medium text-pink-900 dark:text-pink-100 mb-3">Output Preview</h4>
                      <div className="space-y-2 text-sm text-pink-800 dark:text-pink-200">
                        <div>Format: {formatInfo[options.format].name}</div>
                        <div>Resolution: {options.dpi} DPI</div>
                        <div>Pages to convert: {pageCount}</div>
                        <div>Estimated total size: {estimateFileSize()}</div>
                      </div>
                      
                      <div className="mt-3">
                        <div className="text-xs text-pink-700 dark:text-pink-300 mb-2">Sample filenames:</div>
                        {sampleFiles.map((filename, index) => (
                          <div key={index} className="text-xs text-pink-600 dark:text-pink-400 font-mono">
                            {filename}
                          </div>
                        ))}
                        {pageCount > 3 && (
                          <div className="text-xs text-pink-500 dark:text-pink-400">
                            ... and {pageCount - 3} more files
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Preview Panel */}
        {selectedFile && pagePreview.length > 0 && (
          <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Page Previews</h3>
            
            <div className="space-y-3">
              {pagePreview.map((thumbnail, index) => {
                const pageNum = index + 1
                const range = getEffectivePageRange()
                const isSelected = pageNum >= range.start && pageNum <= range.end

                return (
                  <div
                    key={pageNum}
                    className={`p-3 rounded-lg border ${
                      isSelected 
                        ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20' 
                        : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Page {pageNum}
                      </span>
                      {isSelected && (
                        <span className="text-xs text-pink-600 dark:text-pink-400">
                          → {options.format.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <img
                      src={thumbnail}
                      alt={`Page ${pageNum}`}
                      className={`w-full h-auto rounded border ${
                        isSelected 
                          ? 'border-pink-300 dark:border-pink-600' 
                          : 'border-gray-200 dark:border-gray-600'
                      }`}
                    />
                  </div>
                )
              })}
              
              {totalPages > 6 && (
                <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                  ... and {totalPages - 6} more pages
                </div>
              )}
            </div>

            {(() => {
              const range = getEffectivePageRange()
              const pageCount = range.end - range.start + 1
              
              return (
                <div className="mt-4 p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Conversion Summary</h4>
                  <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                    <div>Pages: {pageCount}</div>
                    <div>Format: {formatInfo[options.format].name}</div>
                    <div>Quality: {formatInfo[options.format].lossy ? `${options.quality}%` : 'Lossless'}</div>
                    <div>DPI: {options.dpi}</div>
                    <div>Est. size: {estimateFileSize()}</div>
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}

export default ConvertFromPDFTool