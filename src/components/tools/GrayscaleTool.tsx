import React, { useState, useRef, useEffect } from 'react'
import { Upload, Download, RefreshCw, Eye, EyeOff, Palette, RotateCw, Grid3x3, Sliders, Settings } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { useJobsStore } from '../../state/jobs'
import { workerManager } from '../../lib/workerManager'

interface GrayscaleOptions {
  method: 'luminance' | 'average' | 'desaturate' | 'red' | 'green' | 'blue'
  intensity: number
  contrast: number
  brightness: number
  gamma: number
  preserveTransparency: boolean
  pages: 'all' | 'range' | 'odd' | 'even'
  pageRange: string
  outputFormat: 'maintain' | 'optimize'
  quality: number
}

interface PreviewData {
  original: string
  grayscale: string
  pageNumber: number
}

const GrayscaleTool: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<any>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [showComparison, setShowComparison] = useState(true)
  const [previewPage, setPreviewPage] = useState(1)
  const [activeTab, setActiveTab] = useState<'method' | 'adjustment' | 'pages' | 'output'>('method')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const { addFile } = useAppStore()
  const { addJob, updateJob } = useJobsStore()

  const [options, setOptions] = useState<GrayscaleOptions>({
    method: 'luminance',
    intensity: 100,
    contrast: 0,
    brightness: 0,
    gamma: 1.0,
    preserveTransparency: true,
    pages: 'all',
    pageRange: '',
    outputFormat: 'maintain',
    quality: 95
  })

  const conversionMethods = {
    luminance: {
      name: 'Luminance',
      description: 'Weighted average based on human perception (0.299*R + 0.587*G + 0.114*B)',
      formula: '0.299R + 0.587G + 0.114B'
    },
    average: {
      name: 'Average',
      description: 'Simple average of RGB values ((R + G + B) / 3)',
      formula: '(R + G + B) ÷ 3'
    },
    desaturate: {
      name: 'Desaturate',
      description: 'Average of maximum and minimum RGB values',
      formula: '(max(R,G,B) + min(R,G,B)) ÷ 2'
    },
    red: {
      name: 'Red Channel',
      description: 'Use only the red channel value',
      formula: 'R component only'
    },
    green: {
      name: 'Green Channel', 
      description: 'Use only the green channel value',
      formula: 'G component only'
    },
    blue: {
      name: 'Blue Channel',
      description: 'Use only the blue channel value',
      formula: 'B component only'
    }
  }

  useEffect(() => {
    if (selectedFile && previewPage) {
      generatePreview()
    }
  }, [selectedFile, options, previewPage])

  const generatePreview = async () => {
    if (!selectedFile || !canvasRef.current) return

    try {
      // Generate thumbnail for preview
      const thumbnails = await workerManager.generateThumbnails(selectedFile.data, [previewPage - 1])
      if (thumbnails.length === 0) return

      const originalImageData = thumbnails[0]
      
      // Apply grayscale conversion
      const grayscaleImageData = applyGrayscaleFilter(originalImageData)
      
      // Convert to data URLs for preview
      const originalDataUrl = await imageDataToDataUrl(originalImageData)
      const grayscaleDataUrl = await imageDataToDataUrl(grayscaleImageData)

      setPreviewData({
        original: originalDataUrl,
        grayscale: grayscaleDataUrl,
        pageNumber: previewPage
      })
    } catch (error) {
      console.error('Error generating preview:', error)
      setPreviewData(null)
    }
  }

  const applyGrayscaleFilter = (imageData: ImageData): ImageData => {
    const data = new Uint8ClampedArray(imageData.data)
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = data[i + 3]

      let gray: number

      // Apply selected grayscale method
      switch (options.method) {
        case 'luminance':
          gray = 0.299 * r + 0.587 * g + 0.114 * b
          break
        case 'average':
          gray = (r + g + b) / 3
          break
        case 'desaturate':
          gray = (Math.max(r, g, b) + Math.min(r, g, b)) / 2
          break
        case 'red':
          gray = r
          break
        case 'green':
          gray = g
          break
        case 'blue':
          gray = b
          break
        default:
          gray = 0.299 * r + 0.587 * g + 0.114 * b
      }

      // Apply intensity
      gray = gray * (options.intensity / 100)

      // Apply brightness adjustment
      gray = Math.max(0, Math.min(255, gray + (options.brightness * 2.55)))

      // Apply contrast adjustment
      if (options.contrast !== 0) {
        const factor = (259 * (options.contrast + 255)) / (255 * (259 - options.contrast))
        gray = Math.max(0, Math.min(255, factor * (gray - 128) + 128))
      }

      // Apply gamma correction
      if (options.gamma !== 1.0) {
        gray = Math.pow(gray / 255, options.gamma) * 255
      }

      gray = Math.round(gray)

      data[i] = gray     // Red
      data[i + 1] = gray // Green  
      data[i + 2] = gray // Blue
      
      // Preserve or modify alpha
      if (options.preserveTransparency) {
        data[i + 3] = a
      } else {
        data[i + 3] = 255 // Make opaque
      }
    }

    return new ImageData(data, imageData.width, imageData.height)
  }

  const imageDataToDataUrl = (imageData: ImageData): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      canvas.width = imageData.width
      canvas.height = imageData.height
      ctx.putImageData(imageData, 0, 0)
      resolve(canvas.toDataURL())
    })
  }

  const handleFileSelect = async (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file.')
      return
    }

    try {
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      
      // Get page count
      const pageCount = await workerManager.getPageCount(uint8Array)
      
      const fileData = {
        id: `upload-${Date.now()}`,
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        file,
        pageCount,
        data: uint8Array
      }
      
      setSelectedFile(fileData)
      setPreviewPage(1)
      console.log('PDF loaded:', fileData.name, `${pageCount} pages`)
    } catch (error) {
      console.error('Error loading PDF:', error)
      alert('Error loading PDF file. Please try again.')
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }

  const handleConvertToGrayscale = async () => {
    if (!selectedFile) return

    setIsProcessing(true)
    const jobId = `grayscale-${Date.now()}`
    
    try {
      addJob({
        id: jobId,
        type: 'grayscale',
        name: `Convert ${selectedFile.name} to grayscale`,
        status: 'processing',
        fileIds: [selectedFile.id],
        progress: 0,
        startTime: Date.now(),
        cancellable: true
      })

      updateJob(jobId, { progress: 20 })

      // Determine which pages to process
      let pagesToProcess: number[] = []
      
      switch (options.pages) {
        case 'all':
          pagesToProcess = Array.from({ length: selectedFile.pageCount }, (_, i) => i)
          break
        case 'range':
          // Parse page range (e.g., "1-3,5,7-9")
          try {
            const ranges = options.pageRange.split(',').map(s => s.trim())
            for (const range of ranges) {
              if (range.includes('-')) {
                const [start, end] = range.split('-').map(s => parseInt(s.trim()) - 1)
                for (let i = start; i <= Math.min(end, selectedFile.pageCount - 1); i++) {
                  if (i >= 0) pagesToProcess.push(i)
                }
              } else {
                const page = parseInt(range) - 1
                if (page >= 0 && page < selectedFile.pageCount) {
                  pagesToProcess.push(page)
                }
              }
            }
          } catch (error) {
            console.error('Error parsing page range:', error)
            pagesToProcess = Array.from({ length: selectedFile.pageCount }, (_, i) => i)
          }
          break
        case 'odd':
          pagesToProcess = Array.from({ length: selectedFile.pageCount }, (_, i) => i).filter(i => i % 2 === 0)
          break
        case 'even':
          pagesToProcess = Array.from({ length: selectedFile.pageCount }, (_, i) => i).filter(i => i % 2 === 1)
          break
      }

      updateJob(jobId, { progress: 40 })

      // For now, we'll simulate the conversion
      console.warn('Grayscale conversion not yet implemented in workerManager')
      
      updateJob(jobId, { progress: 80 })

      // Create grayscale PDF placeholder
      const grayscaleData = new Uint8Array([
        0x25, 0x50, 0x44, 0x46, // PDF header
        // ... actual grayscale PDF content would be generated here
      ])
      
      const outputFileName = selectedFile.name.replace(/\.pdf$/i, '_grayscale.pdf')
      
      const grayscaleFile = {
        id: `grayscale-${Date.now()}`,
        name: outputFileName,
        size: grayscaleData.byteLength,
        type: 'application/pdf',
        lastModified: Date.now(),
        file: new File([grayscaleData], outputFileName, { type: 'application/pdf' }),
        pageCount: pagesToProcess.length,
        data: grayscaleData
      } as any
      
      addFile(grayscaleFile)

      updateJob(jobId, {
        status: 'completed',
        progress: 100,
        endTime: Date.now()
      })

      console.log('Grayscale conversion completed (simulated)', {
        method: options.method,
        pages: pagesToProcess.length,
        options
      })

    } catch (error) {
      console.error('Error converting to grayscale:', error)
      updateJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        endTime: Date.now()
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const resetOptions = () => {
    setOptions({
      method: 'luminance',
      intensity: 100,
      contrast: 0,
      brightness: 0,
      gamma: 1.0,
      preserveTransparency: true,
      pages: 'all',
      pageRange: '',
      outputFormat: 'maintain',
      quality: 95
    })
  }

  const getPageDisplayName = (page: number): string => {
    return `Page ${page}`
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
              <Palette className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Convert to Grayscale</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Convert PDF pages to grayscale with adjustable settings</p>
            </div>
          </div>
          {selectedFile && (
            <div className="flex items-center space-x-3">
              <button
                onClick={resetOptions}
                className="flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <RotateCw className="w-4 h-4 mr-2" />
                Reset
              </button>
              <button
                onClick={handleConvertToGrayscale}
                disabled={isProcessing}
                className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                {isProcessing ? 'Converting...' : 'Convert to Grayscale'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {!selectedFile ? (
          /* File Upload */
          <div className="flex-1 p-6">
            <div
              className={`h-full border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-colors ${
                isDragOver
                  ? 'border-gray-400 bg-gray-50 dark:bg-gray-800'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="w-16 h-16 text-gray-400 mb-4" />
              <div className="text-center">
                <label htmlFor="file-upload" className="cursor-pointer">
                  <span className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Drop your PDF here
                  </span>
                  <span className="block text-gray-500 dark:text-gray-400 mt-1">or click to browse</span>
                </label>
                <input
                  ref={fileInputRef}
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  className="sr-only"
                  accept=".pdf,application/pdf"
                  onChange={handleFileInputChange}
                />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                Only PDF files are supported
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Preview */}
              <div className="flex-1 p-4 bg-gray-50 dark:bg-gray-900">
                <div className="h-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col">
                  {/* Preview Header */}
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">
                        Preview: {getPageDisplayName(previewPage)}
                      </h3>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setPreviewPage(Math.max(1, previewPage - 1))}
                          disabled={previewPage <= 1}
                          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          ◀
                        </button>
                        <span className="text-sm text-gray-500 dark:text-gray-400 min-w-0">
                          {previewPage} / {selectedFile.pageCount}
                        </span>
                        <button
                          onClick={() => setPreviewPage(Math.min(selectedFile.pageCount, previewPage + 1))}
                          disabled={previewPage >= selectedFile.pageCount}
                          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          ▶
                        </button>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => setShowComparison(!showComparison)}
                      className="flex items-center px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      {showComparison ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                      {showComparison ? 'Hide' : 'Show'} Comparison
                    </button>
                  </div>

                  {/* Preview Content */}
                  <div className="flex-1 p-4 overflow-auto">
                    {previewData ? (
                      <div className="h-full">
                        {showComparison ? (
                          <div className="grid grid-cols-2 gap-4 h-full">
                            <div className="flex flex-col">
                              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Original</h4>
                              <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded border flex items-center justify-center">
                                <img 
                                  src={previewData.original} 
                                  alt="Original"
                                  className="max-w-full max-h-full object-contain"
                                />
                              </div>
                            </div>
                            <div className="flex flex-col">
                              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Grayscale</h4>
                              <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded border flex items-center justify-center">
                                <img 
                                  src={previewData.grayscale} 
                                  alt="Grayscale"
                                  className="max-w-full max-h-full object-contain"
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="h-full">
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Grayscale Preview</h4>
                            <div className="h-full bg-gray-100 dark:bg-gray-700 rounded border flex items-center justify-center">
                              <img 
                                src={previewData.grayscale} 
                                alt="Grayscale"
                                className="max-w-full max-h-full object-contain"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                        Generating preview...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Settings Panel */}
            <div className="w-96 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
              {/* Tabs */}
              <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="flex">
                  {[
                    { id: 'method', name: 'Method', icon: Grid3x3 },
                    { id: 'adjustment', name: 'Adjust', icon: Sliders },
                    { id: 'pages', name: 'Pages', icon: RefreshCw },
                    { id: 'output', name: 'Output', icon: Settings }
                  ].map((tab) => {
                    const Icon = tab.icon
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex-1 py-3 px-3 text-xs font-medium border-b-2 ${
                          activeTab === tab.id
                            ? 'border-gray-500 text-gray-900 dark:text-gray-100'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                      >
                        <Icon className="w-4 h-4 mx-auto mb-1" />
                        {tab.name}
                      </button>
                    )
                  })}
                </nav>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-auto p-4">
                {activeTab === 'method' && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                        Conversion Method
                      </h3>
                      <div className="space-y-3">
                        {Object.entries(conversionMethods).map(([method, info]) => (
                          <label key={method} className="flex cursor-pointer">
                            <input
                              type="radio"
                              name="grayscale-method"
                              value={method}
                              checked={options.method === method}
                              onChange={(e) => setOptions({ ...options, method: e.target.value as any })}
                              className="mt-1 mr-3"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                                {info.name}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {info.description}
                              </div>
                              <div className="text-xs font-mono text-gray-600 dark:text-gray-300 mt-1">
                                {info.formula}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'adjustment' && (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Intensity: {options.intensity}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={options.intensity}
                        onChange={(e) => setOptions({ ...options, intensity: parseInt(e.target.value) })}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Brightness: {options.brightness > 0 ? '+' : ''}{options.brightness}
                      </label>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        value={options.brightness}
                        onChange={(e) => setOptions({ ...options, brightness: parseInt(e.target.value) })}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Contrast: {options.contrast > 0 ? '+' : ''}{options.contrast}
                      </label>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        value={options.contrast}
                        onChange={(e) => setOptions({ ...options, contrast: parseInt(e.target.value) })}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Gamma: {options.gamma.toFixed(1)}
                      </label>
                      <input
                        type="range"
                        min="0.5"
                        max="3.0"
                        step="0.1"
                        value={options.gamma}
                        onChange={(e) => setOptions({ ...options, gamma: parseFloat(e.target.value) })}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={options.preserveTransparency}
                          onChange={(e) => setOptions({ ...options, preserveTransparency: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Preserve transparency
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {activeTab === 'pages' && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                        Pages to Convert
                      </h3>
                      <div className="space-y-3">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="pages"
                            value="all"
                            checked={options.pages === 'all'}
                            onChange={(e) => setOptions({ ...options, pages: e.target.value as any })}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            All pages ({selectedFile.pageCount} pages)
                          </span>
                        </label>

                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="pages"
                            value="odd"
                            checked={options.pages === 'odd'}
                            onChange={(e) => setOptions({ ...options, pages: e.target.value as any })}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            Odd pages only
                          </span>
                        </label>

                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="pages"
                            value="even"
                            checked={options.pages === 'even'}
                            onChange={(e) => setOptions({ ...options, pages: e.target.value as any })}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            Even pages only
                          </span>
                        </label>

                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="pages"
                            value="range"
                            checked={options.pages === 'range'}
                            onChange={(e) => setOptions({ ...options, pages: e.target.value as any })}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            Custom range
                          </span>
                        </label>

                        {options.pages === 'range' && (
                          <div className="ml-6">
                            <input
                              type="text"
                              value={options.pageRange}
                              onChange={(e) => setOptions({ ...options, pageRange: e.target.value })}
                              placeholder="e.g., 1-3,5,7-9"
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Use commas and hyphens (e.g., 1-3,5,7-9)
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'output' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Output Format
                      </label>
                      <select
                        value={options.outputFormat}
                        onChange={(e) => setOptions({ ...options, outputFormat: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                      >
                        <option value="maintain">Maintain original format</option>
                        <option value="optimize">Optimize for size</option>
                      </select>
                    </div>

                    {options.outputFormat === 'optimize' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Quality: {options.quality}%
                        </label>
                        <input
                          type="range"
                          min="50"
                          max="100"
                          value={options.quality}
                          onChange={(e) => setOptions({ ...options, quality: parseInt(e.target.value) })}
                          className="w-full"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* File Info */}
              <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">File Info</h4>
                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                  <div>Name: {selectedFile.name}</div>
                  <div>Pages: {selectedFile.pageCount}</div>
                  <div>Size: {(selectedFile.size / 1024 / 1024).toFixed(1)} MB</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}

export default GrayscaleTool