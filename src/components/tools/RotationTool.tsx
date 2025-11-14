import React, { useState, useRef } from 'react'
import { Upload, RotateCw, RotateCcw, Download, Settings, Eye, AlertCircle, RefreshCw } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { useJobsStore } from '../../state/jobs'
import { workerManager } from '../../lib/workerManager'

interface RotationOptions {
  angle: 90 | 180 | 270 | -90 | -180 | -270
  pages: 'all' | 'specific' | 'range'
  specificPages: string
  pageRange: { start: number; end: number }
  applyToOddPages: boolean
  applyToEvenPages: boolean
}

const RotationTool: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [options, setOptions] = useState<RotationOptions>({
    angle: 90,
    pages: 'all',
    specificPages: '',
    pageRange: { start: 1, end: 1 },
    applyToOddPages: true,
    applyToEvenPages: true
  })
  const [preview, setPreview] = useState<string | null>(null)
  const [totalPages, setTotalPages] = useState<number>(0)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addFile } = useAppStore()
  const { addJob, updateJob } = useJobsStore()

  const handleFileSelect = async (file: File) => {
    if (file.type === 'application/pdf') {
      setSelectedFile(file)
      await generatePreview(file)
      await getTotalPages(file)
    }
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
      const { loadPDFDocument, getPDFInfo } = await import('../../lib/pdf')
      const doc = await loadPDFDocument(uint8Array)
      const info = await getPDFInfo(doc)
      setTotalPages(info.pageCount)
      setOptions(prev => ({ 
        ...prev, 
        pageRange: { start: 1, end: info.pageCount }
      }))
    } catch (error) {
      console.error('Error getting PDF info:', error)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const droppedFiles = Array.from(e.dataTransfer.files)
    const pdfFile = droppedFiles.find(file => file.type === 'application/pdf')
    
    if (pdfFile) {
      handleFileSelect(pdfFile)
    }
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
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const getRotationDescription = (angle: number) => {
    const absAngle = Math.abs(angle)
    const direction = angle > 0 ? 'clockwise' : 'counterclockwise'
    return `${absAngle}° ${direction}`
  }

  const getPageSelection = () => {
    const { pages, specificPages, pageRange, applyToOddPages, applyToEvenPages } = options
    
    switch (pages) {
      case 'all':
        if (!applyToOddPages && applyToEvenPages) return 'Even pages only'
        if (applyToOddPages && !applyToEvenPages) return 'Odd pages only'
        return 'All pages'
      case 'specific':
        return `Pages: ${specificPages}`
      case 'range':
        return `Pages ${pageRange.start}-${pageRange.end}`
      default:
        return 'All pages'
    }
  }

  const handleRotatePages = async () => {
    if (!selectedFile) return

    setIsProcessing(true)
    
    try {
      const arrayBuffer = await selectedFile.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      
      const jobId = `rotate-${Date.now()}`
      addJob({
        id: jobId,
        type: 'rotate',
        name: 'Rotate Pages',
        status: 'running',
        progress: { current: 0, total: 100, message: 'Rotating pages...' },
        startTime: Date.now(),
        cancellable: true,
        fileIds: [selectedFile.name]
      })

      // Prepare rotation options for worker - convert to array of page rotations
      const rotations: Array<{ pageIndex: number; degrees: number }> = []
      
      // Determine which pages to rotate based on options
      let pagesToRotate: number[] = []
      
      if (options.pages === 'all') {
        for (let i = 1; i <= totalPages; i++) {
          const isOdd = i % 2 === 1
          const isEven = i % 2 === 0
          
          if ((isOdd && options.applyToOddPages) || (isEven && options.applyToEvenPages)) {
            pagesToRotate.push(i)
          }
        }
      } else if (options.pages === 'range') {
        for (let i = options.pageRange.start; i <= Math.min(options.pageRange.end, totalPages); i++) {
          pagesToRotate.push(i)
        }
      } else if (options.pages === 'specific') {
        // Parse specific pages string (e.g., "1,3,5-10")
        const parts = options.specificPages.split(',')
        for (const part of parts) {
          const trimmed = part.trim()
          if (trimmed.includes('-')) {
            const [start, end] = trimmed.split('-').map(n => parseInt(n.trim()))
            if (!isNaN(start) && !isNaN(end)) {
              for (let i = start; i <= Math.min(end, totalPages); i++) {
                pagesToRotate.push(i)
              }
            }
          } else {
            const pageNum = parseInt(trimmed)
            if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
              pagesToRotate.push(pageNum)
            }
          }
        }
      }
      
      // Convert to 0-based indices and create rotation array
      for (const pageNum of pagesToRotate) {
        rotations.push({
          pageIndex: pageNum - 1, // Convert to 0-based index
          degrees: options.angle
        })
      }

      const result = await workerManager.rotatePages(uint8Array, rotations)
      
      // Create new file with rotated pages
      const blob = new Blob([new Uint8Array(result)], { type: 'application/pdf' })
      const fileName = selectedFile.name.replace(/\.pdf$/i, '_rotated.pdf')
      
      addFile({
        id: `rotate-${Date.now()}`,
        name: fileName,
        size: blob.size,
        pageCount: totalPages,
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
        progress: { current: 100, total: 100, message: 'Pages rotated successfully' },
        endTime: Date.now()
      })

    } catch (error) {
      console.error('Error rotating pages:', error)
      updateJob(`rotate-error-${Date.now()}`, {
        status: 'failed',
        progress: { current: 0, total: 100, message: 'Failed to rotate pages' },
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
          <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
            <RotateCw className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Rotate Pages</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Rotate PDF pages clockwise or counterclockwise</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* File Upload & Options */}
            <div className="space-y-6">
              {/* File Upload */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Select PDF File</h3>
                
                {!selectedFile ? (
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
                      Drop your PDF file here or{' '}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        browse
                      </button>
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Supports PDF files up to 100MB
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf"
                      onChange={handleFileInput}
                      className="hidden"
                    />
                  </div>
                ) : (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
                        <RotateCw className="w-5 h-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">{selectedFile.name}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {totalPages} pages
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedFile(null)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Rotation Options */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  Rotation Options
                </h3>
                
                <div className="space-y-6">
                  {/* Rotation Angle */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Rotation Angle
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { angle: 90, label: '90° CW', icon: RotateCw },
                        { angle: 180, label: '180°', icon: RotateCw },
                        { angle: 270, label: '270° CW', icon: RotateCw },
                        { angle: -90, label: '90° CCW', icon: RotateCcw }
                      ].map(({ angle, label, icon: Icon }) => (
                        <button
                          key={angle}
                          onClick={() => setOptions({ ...options, angle: angle as any })}
                          className={`flex items-center justify-center space-x-2 p-3 border rounded-lg transition-colors ${
                            options.angle === angle
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                              : 'border-gray-300 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="text-sm font-medium">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Page Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Pages to Rotate
                    </label>
                    <div className="space-y-3">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="pages"
                          checked={options.pages === 'all'}
                          onChange={() => setOptions({ ...options, pages: 'all' })}
                          className="mr-2"
                        />
                        <span className="text-sm">All pages</span>
                      </label>
                      
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="pages"
                          checked={options.pages === 'range'}
                          onChange={() => setOptions({ ...options, pages: 'range' })}
                          className="mr-2"
                        />
                        <span className="text-sm">Page range</span>
                      </label>
                      
                      {options.pages === 'range' && (
                        <div className="ml-6 grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">From</label>
                            <input
                              type="number"
                              min="1"
                              max={totalPages || 1}
                              value={options.pageRange.start}
                              onChange={(e) => setOptions({
                                ...options,
                                pageRange: { ...options.pageRange, start: parseInt(e.target.value) || 1 }
                              })}
                              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">To</label>
                            <input
                              type="number"
                              min="1"
                              max={totalPages || 1}
                              value={options.pageRange.end}
                              onChange={(e) => setOptions({
                                ...options,
                                pageRange: { ...options.pageRange, end: parseInt(e.target.value) || 1 }
                              })}
                              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>
                        </div>
                      )}
                      
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="pages"
                          checked={options.pages === 'specific'}
                          onChange={() => setOptions({ ...options, pages: 'specific' })}
                          className="mr-2"
                        />
                        <span className="text-sm">Specific pages</span>
                      </label>
                      
                      {options.pages === 'specific' && (
                        <div className="ml-6">
                          <input
                            type="text"
                            placeholder="e.g., 1,3,5-10"
                            value={options.specificPages}
                            onChange={(e) => setOptions({ ...options, specificPages: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Separate pages with commas, use dashes for ranges
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Odd/Even Filter */}
                  {options.pages === 'all' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Apply to
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={options.applyToOddPages}
                            onChange={(e) => setOptions({ ...options, applyToOddPages: e.target.checked })}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Odd pages (1, 3, 5...)</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={options.applyToEvenPages}
                            onChange={(e) => setOptions({ ...options, applyToEvenPages: e.target.checked })}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Even pages (2, 4, 6...)</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Preview & Actions */}
            <div className="space-y-6">
              {/* Preview */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                  <Eye className="w-5 h-5 mr-2" />
                  Preview
                </h3>
                
                <div className="space-y-4">
                  {/* Rotation Preview */}
                  <div className="text-center">
                    <div 
                      className="inline-block border border-gray-200 dark:border-gray-600 rounded p-4 transition-transform duration-500"
                      style={{ transform: `rotate(${options.angle}deg)` }}
                    >
                      {preview ? (
                        <img 
                          src={preview} 
                          alt="PDF Preview" 
                          className="w-32 h-40 object-contain"
                        />
                      ) : (
                        <div className="w-32 h-40 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center">
                          <span className="text-gray-400 text-sm">Preview</span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                      Rotation: {getRotationDescription(options.angle)}
                    </p>
                  </div>

                  {/* Summary */}
                  {totalPages > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">Rotation Summary</h4>
                      <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <li>• Angle: {getRotationDescription(options.angle)}</li>
                        <li>• Pages: {getPageSelection()}</li>
                        <li>• Total pages: {totalPages}</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Process Button */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <button
                  onClick={handleRotatePages}
                  disabled={!selectedFile || isProcessing}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-md transition-colors flex items-center justify-center"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      Rotating Pages...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5 mr-2" />
                      Rotate Pages
                    </>
                  )}
                </button>

                {!selectedFile && (
                  <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md">
                    <div className="flex">
                      <AlertCircle className="w-5 h-5 text-yellow-400 mr-2 flex-shrink-0" />
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        Please select a PDF file to rotate pages.
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

export default RotationTool