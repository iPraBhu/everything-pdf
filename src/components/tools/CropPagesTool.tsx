import React, { useState, useRef, useCallback } from 'react'
import { Upload, Crop, Download, RefreshCw, RotateCw, Move, ZoomIn, ZoomOut, Maximize2, Square, Scissors, Eye } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { useJobsStore } from '../../state/jobs'
import { workerManager } from '../../lib/workerManager'

interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

interface CropOptions {
  mode: 'manual' | 'preset' | 'auto'
  preset: 'letter' | 'a4' | 'legal' | 'square' | 'golden' | 'custom'
  units: 'inches' | 'mm' | 'points' | 'percent'
  customWidth: number
  customHeight: number
  applyToPages: 'all' | 'range' | 'odd' | 'even'
  pageRange: string
  removeWhitespace: boolean
  preserveAspectRatio: boolean
  margin: number
}

const CropPagesTool: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [preview, setPreview] = useState<string | null>(null)
  const [cropArea, setCropArea] = useState<CropArea>({ x: 0, y: 0, width: 100, height: 100 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(100)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { addFile } = useAppStore()
  const { addJob, updateJob } = useJobsStore()

  const [options, setOptions] = useState<CropOptions>({
    mode: 'manual',
    preset: 'custom',
    units: 'percent',
    customWidth: 100,
    customHeight: 100,
    applyToPages: 'all',
    pageRange: '1-',
    removeWhitespace: false,
    preserveAspectRatio: false,
    margin: 0
  })

  const presetDimensions = {
    letter: { width: 8.5, height: 11, ratio: 8.5/11 },
    a4: { width: 210, height: 297, ratio: 210/297 },
    legal: { width: 8.5, height: 14, ratio: 8.5/14 },
    square: { width: 1, height: 1, ratio: 1 },
    golden: { width: 1, height: 1.618, ratio: 1/1.618 },
    custom: { width: 100, height: 100, ratio: 1 }
  }

  const handleFileSelect = async (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file')
      return
    }

    setSelectedFile(file)
    setPreview(null)
    await generatePreview(file, 1)
    await getTotalPages(file)
  }

  const generatePreview = async (file: File, pageNumber: number) => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      const { loadPDFDocument, getPageThumbnail } = await import('../../lib/pdf')
      const doc = await loadPDFDocument(uint8Array)
      const page = await doc.getPage(pageNumber)
      const thumbnail = await getPageThumbnail(page, 400)
      setPreview(thumbnail)
      
      // Initialize crop area to full page
      setCropArea({ x: 0, y: 0, width: 100, height: 100 })
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

  const handlePageChange = async (newPage: number) => {
    if (!selectedFile || newPage < 1 || newPage > totalPages) return
    setCurrentPage(newPage)
    await generatePreview(selectedFile, newPage)
  }

  const handlePresetChange = (preset: string) => {
    setOptions(prev => ({ ...prev, preset: preset as any }))
    
    if (preset !== 'custom') {
      const dimensions = presetDimensions[preset as keyof typeof presetDimensions]
      const centerX = 50 - (dimensions.width * 10) / 2
      const centerY = 50 - (dimensions.height * 10) / 2
      
      setCropArea({
        x: Math.max(0, centerX),
        y: Math.max(0, centerY),
        width: Math.min(100, dimensions.width * 10),
        height: Math.min(100, dimensions.height * 10)
      })
    }
  }

  const handleCropAreaChange = (newArea: Partial<CropArea>) => {
    setCropArea(prev => {
      const updated = { ...prev, ...newArea }
      
      // Ensure boundaries
      updated.x = Math.max(0, Math.min(100 - updated.width, updated.x))
      updated.y = Math.max(0, Math.min(100 - updated.height, updated.y))
      updated.width = Math.max(1, Math.min(100 - updated.x, updated.width))
      updated.height = Math.max(1, Math.min(100 - updated.y, updated.height))
      
      // Apply aspect ratio if enabled
      if (options.preserveAspectRatio && options.preset !== 'custom') {
        const ratio = presetDimensions[options.preset].ratio
        updated.height = updated.width / ratio
        
        // Adjust if height exceeds bounds
        if (updated.y + updated.height > 100) {
          updated.height = 100 - updated.y
          updated.width = updated.height * ratio
        }
      }
      
      return updated
    })
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    
    setIsDragging(true)
    setDragStart({ x, y })
    
    // Start new crop area
    setCropArea({ x, y, width: 0, height: 0 })
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return
    
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    
    const width = Math.abs(x - dragStart.x)
    const height = Math.abs(y - dragStart.y)
    const startX = Math.min(x, dragStart.x)
    const startY = Math.min(y, dragStart.y)
    
    handleCropAreaChange({ x: startX, y: startY, width, height })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleAutoDetectCrop = async () => {
    // TODO: Implement automatic whitespace detection
    console.warn('Auto-detect cropping not yet implemented')
    
    // Simulate auto-detection by setting a common crop area
    setCropArea({ x: 10, y: 15, width: 80, height: 70 })
  }

  const handleResetCrop = () => {
    setCropArea({ x: 0, y: 0, width: 100, height: 100 })
  }

  const formatPageRange = (range: string): number[] => {
    const pages: number[] = []
    const parts = range.split(',')
    
    for (const part of parts) {
      const trimmed = part.trim()
      if (trimmed.includes('-')) {
        const [start, end] = trimmed.split('-').map(s => s.trim())
        const startPage = parseInt(start) || 1
        const endPage = parseInt(end) || totalPages
        for (let i = startPage; i <= Math.min(endPage, totalPages); i++) {
          if (!pages.includes(i)) pages.push(i)
        }
      } else {
        const pageNum = parseInt(trimmed)
        if (pageNum && pageNum <= totalPages && !pages.includes(pageNum)) {
          pages.push(pageNum)
        }
      }
    }
    
    return pages.sort((a, b) => a - b)
  }

  const getAffectedPages = (): number[] => {
    switch (options.applyToPages) {
      case 'all':
        return Array.from({ length: totalPages }, (_, i) => i + 1)
      case 'odd':
        return Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p % 2 === 1)
      case 'even':
        return Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p % 2 === 0)
      case 'range':
        return formatPageRange(options.pageRange)
      default:
        return [1]
    }
  }

  const handleCropPDF = async () => {
    if (!selectedFile) return

    setIsProcessing(true)
    const jobId = `crop-pages-${Date.now()}`
    
    try {
      addJob({
        id: jobId,
        type: 'crop-pages',
        name: `Crop ${selectedFile.name}`,
        status: 'processing',
        fileIds: [selectedFile.name],
        progress: 0,
        startTime: Date.now(),
        cancellable: true
      })

      const arrayBuffer = await selectedFile.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      updateJob(jobId, { progress: 30 })

      const affectedPages = getAffectedPages()
      const cropParams = {
        cropArea,
        pages: affectedPages,
        removeWhitespace: options.removeWhitespace,
        margin: options.margin
      }

      updateJob(jobId, { progress: 70 })

      // TODO: Implement cropPages in workerManager
      // For now, we'll simulate cropping
      console.warn('PDF cropping not yet implemented in workerManager')
      const result = uint8Array // Placeholder - would normally be cropped
      
      updateJob(jobId, { progress: 90 })

      // Create cropped file
      const croppedFileName = selectedFile.name.replace(/\.pdf$/i, '_cropped.pdf')
      const pdfFile = {
        id: `cropped-${Date.now()}`,
        name: croppedFileName,
        size: result.byteLength,
        type: 'application/pdf',
        lastModified: Date.now(),
        file: new File([new Uint8Array(result)], croppedFileName, { type: 'application/pdf' }),
        pageCount: totalPages,
        data: result
      } as any
      
      addFile(pdfFile)

      updateJob(jobId, {
        status: 'completed',
        progress: 100,
        endTime: Date.now()
      })

      console.log('PDF cropping completed (simulated)', { cropParams })

    } catch (error) {
      console.error('Error cropping PDF:', error)
      updateJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        endTime: Date.now()
      })
    } finally {
      setIsProcessing(false)
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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center">
              <Crop className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Crop Pages</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Trim and resize PDF pages to specific dimensions</p>
            </div>
          </div>
          {selectedFile && (
            <button
              onClick={handleCropPDF}
              disabled={isProcessing}
              className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Crop className="w-4 h-4 mr-2" />
              )}
              {isProcessing ? 'Cropping...' : 'Crop PDF'}
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

          {/* Crop Settings */}
          {selectedFile && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Crop Settings</h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Crop Mode */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Crop Mode
                  </label>
                  <select
                    value={options.mode}
                    onChange={(e) => setOptions({ ...options, mode: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="manual">Manual Selection</option>
                    <option value="preset">Preset Dimensions</option>
                    <option value="auto">Auto-detect Content</option>
                  </select>
                </div>

                {/* Preset */}
                {options.mode === 'preset' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Page Size Preset
                    </label>
                    <select
                      value={options.preset}
                      onChange={(e) => handlePresetChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="letter">Letter (8.5" × 11")</option>
                      <option value="a4">A4 (210 × 297 mm)</option>
                      <option value="legal">Legal (8.5" × 14")</option>
                      <option value="square">Square (1:1)</option>
                      <option value="golden">Golden Ratio (1:1.618)</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                )}

                {/* Units */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Units
                  </label>
                  <select
                    value={options.units}
                    onChange={(e) => setOptions({ ...options, units: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="percent">Percentage</option>
                    <option value="inches">Inches</option>
                    <option value="mm">Millimeters</option>
                    <option value="points">Points</option>
                  </select>
                </div>

                {/* Crop Coordinates */}
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Crop Area ({options.units})
                  </label>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">X</label>
                      <input
                        type="number"
                        value={cropArea.x.toFixed(1)}
                        onChange={(e) => handleCropAreaChange({ x: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        min="0"
                        max="100"
                        step="0.1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Y</label>
                      <input
                        type="number"
                        value={cropArea.y.toFixed(1)}
                        onChange={(e) => handleCropAreaChange({ y: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        min="0"
                        max="100"
                        step="0.1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Width</label>
                      <input
                        type="number"
                        value={cropArea.width.toFixed(1)}
                        onChange={(e) => handleCropAreaChange({ width: parseFloat(e.target.value) || 1 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        min="1"
                        max="100"
                        step="0.1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Height</label>
                      <input
                        type="number"
                        value={cropArea.height.toFixed(1)}
                        onChange={(e) => handleCropAreaChange({ height: parseFloat(e.target.value) || 1 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        min="1"
                        max="100"
                        step="0.1"
                      />
                    </div>
                  </div>
                </div>

                {/* Apply To Pages */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Apply to Pages
                  </label>
                  <select
                    value={options.applyToPages}
                    onChange={(e) => setOptions({ ...options, applyToPages: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="all">All pages</option>
                    <option value="range">Page range</option>
                    <option value="odd">Odd pages only</option>
                    <option value="even">Even pages only</option>
                  </select>
                </div>

                {/* Page Range */}
                {options.applyToPages === 'range' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Page Range
                    </label>
                    <input
                      type="text"
                      value={options.pageRange}
                      onChange={(e) => setOptions({ ...options, pageRange: e.target.value })}
                      placeholder="e.g., 1-5, 8, 10-12"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                )}

                {/* Options */}
                <div className="lg:col-span-2 space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={options.removeWhitespace}
                      onChange={(e) => setOptions({ ...options, removeWhitespace: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Remove whitespace automatically
                    </span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={options.preserveAspectRatio}
                      onChange={(e) => setOptions({ ...options, preserveAspectRatio: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Preserve aspect ratio
                    </span>
                  </label>
                  
                  <div>
                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                      Margin: {options.margin}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.5"
                      value={options.margin}
                      onChange={(e) => setOptions({ ...options, margin: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="lg:col-span-2 flex space-x-3">
                  <button
                    onClick={handleAutoDetectCrop}
                    className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Auto-detect
                  </button>
                  
                  <button
                    onClick={handleResetCrop}
                    className="flex items-center px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reset
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Preview Panel */}
        {selectedFile && preview && (
          <div className="w-96 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Preview</h3>
            
            {/* Page Navigation */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}

            {/* Zoom Controls */}
            <div className="flex items-center justify-center space-x-2 mb-3">
              <button
                onClick={() => setZoom(Math.max(50, zoom - 25))}
                className="p-1 bg-gray-200 dark:bg-gray-700 rounded"
              >
                <ZoomOut className="w-3 h-3" />
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">{zoom}%</span>
              <button
                onClick={() => setZoom(Math.min(200, zoom + 25))}
                className="p-1 bg-gray-200 dark:bg-gray-700 rounded"
              >
                <ZoomIn className="w-3 h-3" />
              </button>
            </div>

            {/* Preview Area */}
            <div 
              className="relative bg-white rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden cursor-crosshair"
              style={{ aspectRatio: '3/4' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <img
                src={preview}
                alt="PDF Preview"
                className="w-full h-full object-contain"
                style={{ transform: `scale(${zoom / 100})` }}
                draggable={false}
              />
              
              {/* Crop Overlay */}
              <div
                className="absolute border-2 border-orange-500 bg-orange-500 bg-opacity-20"
                style={{
                  left: `${cropArea.x}%`,
                  top: `${cropArea.y}%`,
                  width: `${cropArea.width}%`,
                  height: `${cropArea.height}%`
                }}
              >
                {/* Corner handles */}
                <div className="absolute -top-1 -left-1 w-2 h-2 bg-orange-500 border border-white"></div>
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 border border-white"></div>
                <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-orange-500 border border-white"></div>
                <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-orange-500 border border-white"></div>
              </div>

              {/* Grid overlay */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="w-full h-full grid grid-cols-3 grid-rows-3">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="border border-gray-400 border-opacity-30"></div>
                  ))}
                </div>
              </div>
            </div>

            {/* Crop Info */}
            <div className="mt-4 space-y-3">
              <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Crop Area</h4>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <div>Position: {cropArea.x.toFixed(1)}%, {cropArea.y.toFixed(1)}%</div>
                  <div>Size: {cropArea.width.toFixed(1)}% × {cropArea.height.toFixed(1)}%</div>
                  <div>Aspect Ratio: {(cropArea.width / cropArea.height).toFixed(2)}</div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Affected Pages</h4>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {(() => {
                    const pages = getAffectedPages()
                    return pages.length > 10 
                      ? `${pages.length} pages (${pages.slice(0, 5).join(', ')}, ...)`
                      : `${pages.length} pages (${pages.join(', ')})`
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CropPagesTool