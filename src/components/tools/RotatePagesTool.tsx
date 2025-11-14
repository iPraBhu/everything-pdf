import React, { useState, useRef, useCallback } from 'react'
import { Upload, RotateCw, RefreshCw, AlertCircle, Eye, Download, RotateCcw, Square, Trash2 } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { useJobsStore } from '../../state/jobs'
import { workerManager } from '../../lib/workerManager'

interface RotateOptions {
  method: 'all' | 'range' | 'selection' | 'odd' | 'even'
  rotation: 90 | 180 | 270 | -90
  pageRange: string
  specificPages: string
}

const RotatePagesTool: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [totalPages, setTotalPages] = useState(0)
  const [preview, setPreview] = useState<string | null>(null)
  const [pagePreview, setPagePreview] = useState<{ [key: number]: string }>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { addFile } = useAppStore()
  const { addJob, updateJob } = useJobsStore()

  const [options, setOptions] = useState<RotateOptions>({
    method: 'all',
    rotation: 90,
    pageRange: '1-5',
    specificPages: '1,3,5'
  })

  const handleFileSelect = async (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file')
      return
    }

    setSelectedFile(file)
    setPreview(null)
    setPagePreview({})
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

      // Generate previews for first few pages to show rotation effect
      const previews: { [key: number]: string } = {}
      const maxPages = Math.min(doc.numPages, 6)
      for (let i = 1; i <= maxPages; i++) {
        const page = await doc.getPage(i)
        const thumbnail = await getPageThumbnail(page, 120)
        previews[i] = thumbnail
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
    } catch (error) {
      console.error('Error getting page count:', error)
    }
  }

  const parsePageSelection = (): number[] => {
    const pages: number[] = []

    if (options.method === 'all') {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else if (options.method === 'range') {
      const ranges = options.pageRange.split(',').map(r => r.trim())
      for (const range of ranges) {
        if (range.includes('-')) {
          const [start, end] = range.split('-').map(n => parseInt(n.trim()))
          if (start && end && start <= end) {
            for (let i = start; i <= end && i <= totalPages; i++) {
              if (!pages.includes(i)) pages.push(i)
            }
          }
        } else {
          const pageNum = parseInt(range)
          if (pageNum && pageNum <= totalPages && !pages.includes(pageNum)) {
            pages.push(pageNum)
          }
        }
      }
    } else if (options.method === 'selection') {
      const pageNums = options.specificPages.split(',').map(p => parseInt(p.trim())).filter(Boolean)
      for (const pageNum of pageNums) {
        if (pageNum <= totalPages && !pages.includes(pageNum)) {
          pages.push(pageNum)
        }
      }
    } else if (options.method === 'odd') {
      for (let i = 1; i <= totalPages; i += 2) {
        pages.push(i)
      }
    } else if (options.method === 'even') {
      for (let i = 2; i <= totalPages; i += 2) {
        pages.push(i)
      }
    }

    return pages.sort((a, b) => a - b)
  }

  const getRotationDisplay = () => {
    switch (options.rotation) {
      case 90: return '90° CW'
      case 180: return '180°'
      case 270: return '270° CW / 90° CCW'
      case -90: return '90° CCW'
      default: return `${options.rotation}°`
    }
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

  const handleRotatePages = async () => {
    if (!selectedFile) return

    const selectedPages = parsePageSelection()
    if (selectedPages.length === 0) {
      alert('No valid pages selected')
      return
    }

    setIsProcessing(true)
    const jobId = `rotate-pages-${Date.now()}`
    
    try {
      addJob({
        id: jobId,
        type: 'rotate-pages',
        name: `Rotate pages in ${selectedFile.name}`,
        status: 'processing',
        fileIds: [selectedFile.name],
        progress: 0,
        startTime: Date.now(),
        cancellable: true
      })

      const arrayBuffer = await selectedFile.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      updateJob(jobId, { progress: 30 })

      // Create rotation configuration array for worker manager
      const rotationArray = selectedPages.map(pageNum => ({
        pageIndex: pageNum - 1, // Convert to 0-based index
        degrees: options.rotation
      }))

      updateJob(jobId, { progress: 70 })

      const result = await workerManager.rotatePages(uint8Array, rotationArray)
      
      updateJob(jobId, { progress: 90 })

      // Create new file with rotated pages
      const rotatedFileName = selectedFile.name.replace(/\.pdf$/i, '_rotated.pdf')
      const pdfFile = {
        id: `rotated-${Date.now()}`,
        name: rotatedFileName,
        size: result.byteLength,
        type: 'application/pdf',
        lastModified: Date.now(),
        file: new File([new Uint8Array(result)], rotatedFileName, { type: 'application/pdf' }),
        pageCount: totalPages,
        data: result
      } as any
      
      addFile(pdfFile)

      updateJob(jobId, {
        status: 'completed',
        progress: 100,
        endTime: Date.now()
      })

      console.log(`Successfully rotated ${selectedPages.length} pages by ${options.rotation}°`)

    } catch (error) {
      console.error('Error rotating pages:', error)
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
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center">
              <RotateCw className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Rotate Pages</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Rotate PDF pages clockwise or counterclockwise</p>
            </div>
          </div>
          {selectedFile && (
            <button
              onClick={handleRotatePages}
              disabled={isProcessing}
              className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RotateCw className="w-4 h-4 mr-2" />
              )}
              {isProcessing ? 'Rotating...' : 'Rotate Pages'}
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
                ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20'
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
                  <span className="text-base font-medium text-orange-600 hover:text-orange-500">
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
                    setPagePreview({})
                    setTotalPages(0)
                  }}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Rotation Settings */}
          {selectedFile && totalPages > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Rotation Settings</h3>
              
              <div className="space-y-6">
                {/* Rotation Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Rotation Direction & Amount
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <button
                      onClick={() => setOptions({ ...options, rotation: 90 })}
                      className={`p-4 text-center border rounded-lg transition-colors ${
                        options.rotation === 90
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <RotateCw className="w-8 h-8 mx-auto mb-2 text-orange-600" />
                      <div className="font-medium text-sm text-gray-900 dark:text-gray-100">90° CW</div>
                    </button>
                    
                    <button
                      onClick={() => setOptions({ ...options, rotation: 180 })}
                      className={`p-4 text-center border rounded-lg transition-colors ${
                        options.rotation === 180
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <div className="w-8 h-8 mx-auto mb-2 flex items-center justify-center">
                        <Square className="w-6 h-6 text-orange-600 transform rotate-180" />
                      </div>
                      <div className="font-medium text-sm text-gray-900 dark:text-gray-100">180°</div>
                    </button>
                    
                    <button
                      onClick={() => setOptions({ ...options, rotation: 270 })}
                      className={`p-4 text-center border rounded-lg transition-colors ${
                        options.rotation === 270
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <RotateCw className="w-8 h-8 mx-auto mb-2 text-orange-600 transform rotate-180" />
                      <div className="font-medium text-sm text-gray-900 dark:text-gray-100">270° CW</div>
                    </button>
                    
                    <button
                      onClick={() => setOptions({ ...options, rotation: -90 })}
                      className={`p-4 text-center border rounded-lg transition-colors ${
                        options.rotation === -90
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <RotateCcw className="w-8 h-8 mx-auto mb-2 text-orange-600" />
                      <div className="font-medium text-sm text-gray-900 dark:text-gray-100">90° CCW</div>
                    </button>
                  </div>
                </div>

                {/* Page Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Pages to Rotate
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    <button
                      onClick={() => setOptions({ ...options, method: 'all' })}
                      className={`p-3 text-center border rounded-lg transition-colors ${
                        options.method === 'all'
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <div className="font-medium text-sm text-gray-900 dark:text-gray-100">All Pages</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">1-{totalPages}</div>
                    </button>
                    
                    <button
                      onClick={() => setOptions({ ...options, method: 'range' })}
                      className={`p-3 text-center border rounded-lg transition-colors ${
                        options.method === 'range'
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <div className="font-medium text-sm text-gray-900 dark:text-gray-100">Page Range</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">e.g., 1-5</div>
                    </button>
                    
                    <button
                      onClick={() => setOptions({ ...options, method: 'selection' })}
                      className={`p-3 text-center border rounded-lg transition-colors ${
                        options.method === 'selection'
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <div className="font-medium text-sm text-gray-900 dark:text-gray-100">Specific Pages</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">e.g., 1,3,5</div>
                    </button>
                    
                    <button
                      onClick={() => setOptions({ ...options, method: 'odd' })}
                      className={`p-3 text-center border rounded-lg transition-colors ${
                        options.method === 'odd'
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <div className="font-medium text-sm text-gray-900 dark:text-gray-100">Odd Pages</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">1,3,5...</div>
                    </button>
                    
                    <button
                      onClick={() => setOptions({ ...options, method: 'even' })}
                      className={`p-3 text-center border rounded-lg transition-colors ${
                        options.method === 'even'
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <div className="font-medium text-sm text-gray-900 dark:text-gray-100">Even Pages</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">2,4,6...</div>
                    </button>
                  </div>
                </div>

                {/* Range Input */}
                {options.method === 'range' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Page Range (e.g., 1-5, 10-15)
                    </label>
                    <input
                      type="text"
                      value={options.pageRange}
                      onChange={(e) => setOptions({ ...options, pageRange: e.target.value })}
                      placeholder="1-5, 10-15"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                )}

                {/* Specific Pages Input */}
                {options.method === 'selection' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Specific Pages (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={options.specificPages}
                      onChange={(e) => setOptions({ ...options, specificPages: e.target.value })}
                      placeholder="1,3,5,7"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                )}

                {/* Preview Selected Pages */}
                {(() => {
                  const selectedPages = parsePageSelection()
                  return selectedPages.length > 0 && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                      <h4 className="font-medium text-orange-900 dark:text-orange-100 mb-2">
                        Pages to Rotate: {selectedPages.length} pages • {getRotationDisplay()}
                      </h4>
                      <div className="text-sm text-orange-800 dark:text-orange-200">
                        {selectedPages.slice(0, 20).join(', ')}
                        {selectedPages.length > 20 && ` ... and ${selectedPages.length - 20} more`}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Preview Panel */}
        {selectedFile && Object.keys(pagePreview).length > 0 && (
          <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Page Previews</h3>
            
            <div className="space-y-4">
              {Object.entries(pagePreview).slice(0, 6).map(([pageNum, thumbnail]) => {
                const selectedPages = parsePageSelection()
                const isSelected = selectedPages.includes(parseInt(pageNum))
                
                return (
                  <div
                    key={pageNum}
                    className={`p-3 rounded-lg border ${
                      isSelected 
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' 
                        : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Page {pageNum}
                      </span>
                      {isSelected && (
                        <span className="text-xs text-orange-600 dark:text-orange-400">
                          {getRotationDisplay()}
                        </span>
                      )}
                    </div>
                    <div className="flex space-x-3">
                      <div className="text-center">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current</div>
                        <img
                          src={thumbnail}
                          alt={`Page ${pageNum}`}
                          className="w-16 h-20 object-cover rounded border border-gray-200 dark:border-gray-600"
                        />
                      </div>
                      {isSelected && (
                        <>
                          <div className="flex items-center">
                            <RotateCw className="w-4 h-4 text-gray-400" />
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">After</div>
                            <img
                              src={thumbnail}
                              alt={`Page ${pageNum} rotated`}
                              className={`w-16 h-20 object-cover rounded border border-orange-300 dark:border-orange-600 transition-transform ${
                                options.rotation === 90 ? 'transform rotate-90' :
                                options.rotation === 180 ? 'transform rotate-180' :
                                options.rotation === 270 ? 'transform -rotate-90' :
                                options.rotation === -90 ? 'transform -rotate-90' : ''
                              }`}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
              
              {Object.keys(pagePreview).length > 6 && (
                <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                  ... and {Object.keys(pagePreview).length - 6} more pages
                </div>
              )}
            </div>

            {(() => {
              const selectedPages = parsePageSelection()
              return selectedPages.length > 0 && (
                <div className="mt-4 p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Rotation Summary</h4>
                  <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                    <div>Total pages: {totalPages}</div>
                    <div>Pages to rotate: {selectedPages.length}</div>
                    <div>Rotation: {getRotationDisplay()}</div>
                    <div>Method: {options.method}</div>
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

export default RotatePagesTool