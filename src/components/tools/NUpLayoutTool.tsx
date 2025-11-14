import React, { useState, useRef, useCallback } from 'react'
import { Upload, Grid3X3, RefreshCw, AlertCircle, Eye, Download, Settings, Layout, BookOpen, Printer, Maximize, RotateCw, Trash2, Copy, Layers, Move } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { useJobsStore } from '../../state/jobs'
import { workerManager } from '../../lib/workerManager'

interface NUpLayoutOptions {
  layout: {
    preset: '2up' | '4up' | '6up' | '8up' | '9up' | '12up' | '16up' | 'booklet' | 'custom'
    customRows: number
    customCols: number
    orientation: 'portrait' | 'landscape' | 'auto'
  }
  arrangement: {
    pageOrder: 'horizontal' | 'vertical' | 'reverse-horizontal' | 'reverse-vertical'
    startPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
    fillOrder: 'row-first' | 'column-first'
  }
  spacing: {
    margin: number // outer margin
    gutterH: number // horizontal spacing between pages
    gutterV: number // vertical spacing between pages
    units: 'mm' | 'inches' | 'points'
  }
  scaling: {
    mode: 'fit' | 'fill' | 'custom' | 'actual-size'
    customScale: number
    maintainAspectRatio: boolean
    centerInCell: boolean
  }
  styling: {
    borderWidth: number
    borderColor: string
    borderStyle: 'solid' | 'dashed' | 'dotted'
    backgroundColor: string
    shadowEnabled: boolean
    shadowOffset: number
    shadowBlur: number
  }
  pageNumbers: {
    enabled: boolean
    position: 'inside' | 'outside' | 'margin'
    format: 'original' | 'sequential' | 'none'
    fontSize: number
    color: string
  }
  advanced: {
    printMarks: boolean
    cropMarks: boolean
    colorBars: boolean
    registrationMarks: boolean
    bleedArea: number
  }
  output: {
    paperSize: 'A4' | 'Letter' | 'Legal' | 'A3' | 'A5' | 'Custom'
    customWidth: number
    customHeight: number
    dpi: number
    colorSpace: 'RGB' | 'CMYK' | 'Grayscale'
  }
}

const LAYOUT_PRESETS = {
  '2up': { rows: 1, cols: 2, name: '2-Up (1×2)', icon: '⚏' },
  '4up': { rows: 2, cols: 2, name: '4-Up (2×2)', icon: '⚏⚏' },
  '6up': { rows: 2, cols: 3, name: '6-Up (2×3)', icon: '⚏⚏⚏' },
  '8up': { rows: 2, cols: 4, name: '8-Up (2×4)', icon: '⚏⚏⚏⚏' },
  '9up': { rows: 3, cols: 3, name: '9-Up (3×3)', icon: '⚏⚏⚏' },
  '12up': { rows: 3, cols: 4, name: '12-Up (3×4)', icon: '⚏⚏⚏⚏' },
  '16up': { rows: 4, cols: 4, name: '16-Up (4×4)', icon: '⚏⚏⚏⚏' },
  'booklet': { rows: 2, cols: 2, name: 'Booklet (2×2)', icon: '📖' },
  'custom': { rows: 2, cols: 2, name: 'Custom Layout', icon: '⚙️' }
}

const PAPER_SIZES = {
  'A4': { width: 210, height: 297, name: 'A4 (210×297mm)' },
  'Letter': { width: 215.9, height: 279.4, name: 'Letter (8.5×11")' },
  'Legal': { width: 215.9, height: 355.6, name: 'Legal (8.5×14")' },
  'A3': { width: 297, height: 420, name: 'A3 (297×420mm)' },
  'A5': { width: 148, height: 210, name: 'A5 (148×210mm)' },
  'Custom': { width: 210, height: 297, name: 'Custom Size' }
}

const NUpLayoutTool: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [totalPages, setTotalPages] = useState(0)
  const [preview, setPreview] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'layout' | 'styling' | 'advanced'>('layout')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { addFile } = useAppStore()
  const { addJob, updateJob } = useJobsStore()

  const [options, setOptions] = useState<NUpLayoutOptions>({
    layout: {
      preset: '4up',
      customRows: 2,
      customCols: 2,
      orientation: 'auto'
    },
    arrangement: {
      pageOrder: 'horizontal',
      startPosition: 'top-left',
      fillOrder: 'row-first'
    },
    spacing: {
      margin: 10,
      gutterH: 5,
      gutterV: 5,
      units: 'mm'
    },
    scaling: {
      mode: 'fit',
      customScale: 100,
      maintainAspectRatio: true,
      centerInCell: true
    },
    styling: {
      borderWidth: 0.5,
      borderColor: '#cccccc',
      borderStyle: 'solid',
      backgroundColor: '#ffffff',
      shadowEnabled: false,
      shadowOffset: 2,
      shadowBlur: 4
    },
    pageNumbers: {
      enabled: true,
      position: 'inside',
      format: 'original',
      fontSize: 8,
      color: '#666666'
    },
    advanced: {
      printMarks: false,
      cropMarks: false,
      colorBars: false,
      registrationMarks: false,
      bleedArea: 3
    },
    output: {
      paperSize: 'A4',
      customWidth: 210,
      customHeight: 297,
      dpi: 300,
      colorSpace: 'RGB'
    }
  })

  const handleFileSelect = async (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file')
      return
    }

    setSelectedFile(file)
    setPreview(null)
    await generatePreview(file)
    await getTotalPages(file)
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

  const getLayoutConfig = () => {
    if (options.layout.preset === 'custom') {
      return { rows: options.layout.customRows, cols: options.layout.customCols }
    }
    return LAYOUT_PRESETS[options.layout.preset]
  }

  const calculateOutputPages = () => {
    if (!totalPages) return 0
    const { rows, cols } = getLayoutConfig()
    const pagesPerSheet = rows * cols
    return Math.ceil(totalPages / pagesPerSheet)
  }

  const renderLayoutPreview = () => {
    const { rows, cols } = getLayoutConfig()
    const pagesPerSheet = rows * cols
    
    return (
      <div className="w-32 h-40 border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-700">
        <div 
          className="w-full h-full grid gap-1"
          style={{ gridTemplateRows: `repeat(${rows}, 1fr)`, gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {Array.from({ length: pagesPerSheet }, (_, index) => (
            <div
              key={index}
              className="bg-gray-100 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded flex items-center justify-center text-xs font-medium text-gray-500 dark:text-gray-400"
              style={{ aspectRatio: '3/4' }}
            >
              {index < totalPages ? index + 1 : ''}
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">
          {cols}×{rows} layout ({calculateOutputPages()} sheets)
        </p>
      </div>
    )
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

  const handleCreateLayout = async () => {
    if (!selectedFile) return

    setIsProcessing(true)
    const jobId = `nup-layout-${Date.now()}`
    
    try {
      addJob({
        id: jobId,
        type: 'nup-layout',
        name: `Create N-Up layout for ${selectedFile.name}`,
        status: 'processing',
        fileIds: [selectedFile.name],
        progress: 0,
        startTime: Date.now(),
        cancellable: true
      })

      const arrayBuffer = await selectedFile.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      updateJob(jobId, { progress: 30 })

      const config = getLayoutConfig()
      const nUpOptions = {
        rows: config.rows,
        cols: config.cols,
        pageOrder: options.arrangement.pageOrder,
        spacing: options.spacing.gutterH,
        margin: options.spacing.margin,
        orientation: options.layout.orientation,
        scaling: options.scaling.mode,
        customScale: options.scaling.customScale / 100,
        border: {
          width: options.styling.borderWidth,
          color: options.styling.borderColor,
          style: options.styling.borderStyle
        },
        backgroundColor: options.styling.backgroundColor,
        addPageNumbers: options.pageNumbers.enabled,
        centerPages: options.scaling.centerInCell,
        paperSize: options.output.paperSize,
        dpi: options.output.dpi,
        colorSpace: options.output.colorSpace
      }

      updateJob(jobId, { progress: 70 })

      const result = await workerManager.nUpLayout([uint8Array], nUpOptions)
      
      updateJob(jobId, { progress: 90 })

      // Create new file with N-Up layout
      const layoutFileName = selectedFile.name.replace(/\.pdf$/i, `_${options.layout.preset}_layout.pdf`)
      const pdfFile = {
        id: `nup-layout-${Date.now()}`,
        name: layoutFileName,
        size: result.byteLength,
        type: 'application/pdf',
        lastModified: Date.now(),
        file: new File([new Uint8Array(result)], layoutFileName, { type: 'application/pdf' }),
        pageCount: calculateOutputPages(),
        data: result
      } as any
      
      addFile(pdfFile)

      updateJob(jobId, {
        status: 'completed',
        progress: 100,
        endTime: Date.now()
      })

      console.log('N-Up layout created successfully')

    } catch (error) {
      console.error('Error creating N-Up layout:', error)
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
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
              <Grid3X3 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Professional N-Up Layout</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Advanced page layout with professional printing features</p>
            </div>
          </div>
          {selectedFile && (
            <button
              onClick={handleCreateLayout}
              disabled={isProcessing}
              className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {isProcessing ? 'Processing...' : 'Create Layout'}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          {/* File Upload */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div
              className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
                isDragOver
                  ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20'
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
                    <span className="text-base font-medium text-purple-600 hover:text-purple-500">
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
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      {totalPages > 0 && ` • ${totalPages} pages → ${calculateOutputPages()} sheets`}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedFile(null)
                      setPreview(null)
                      setTotalPages(0)
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Configuration Tabs */}
          {selectedFile && (
            <>
              <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <button
                  onClick={() => setActiveTab('layout')}
                  className={`px-6 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'layout'
                      ? 'border-b-2 border-purple-500 text-purple-600 dark:text-purple-400 bg-white dark:bg-gray-700'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <Layout className="w-4 h-4 inline mr-2" />
                  Layout
                </button>
                <button
                  onClick={() => setActiveTab('styling')}
                  className={`px-6 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'styling'
                      ? 'border-b-2 border-purple-500 text-purple-600 dark:text-purple-400 bg-white dark:bg-gray-700'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <Layers className="w-4 h-4 inline mr-2" />
                  Styling
                </button>
                <button
                  onClick={() => setActiveTab('advanced')}
                  className={`px-6 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'advanced'
                      ? 'border-b-2 border-purple-500 text-purple-600 dark:text-purple-400 bg-white dark:bg-gray-700'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <Printer className="w-4 h-4 inline mr-2" />
                  Print Settings
                </button>
              </div>

              <div className="p-6">
                {activeTab === 'layout' && (
                  <div className="space-y-8">
                    {/* Layout Presets */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Layout Preset</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {Object.entries(LAYOUT_PRESETS).map(([key, preset]) => (
                          <button
                            key={key}
                            onClick={() => setOptions(prev => ({
                              ...prev,
                              layout: { ...prev.layout, preset: key as any }
                            }))}
                            className={`p-4 border rounded-lg text-center transition-colors ${
                              options.layout.preset === key
                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                            }`}
                          >
                            <div className="text-2xl mb-2">{preset.icon}</div>
                            <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{preset.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {preset.rows}×{preset.cols}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Layout */}
                    {options.layout.preset === 'custom' && (
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Custom Layout</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Rows
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="10"
                              value={options.layout.customRows}
                              onChange={(e) => setOptions(prev => ({
                                ...prev,
                                layout: { ...prev.layout, customRows: parseInt(e.target.value) || 2 }
                              }))}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Columns
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="10"
                              value={options.layout.customCols}
                              onChange={(e) => setOptions(prev => ({
                                ...prev,
                                layout: { ...prev.layout, customCols: parseInt(e.target.value) || 2 }
                              }))}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Page Arrangement */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Page Arrangement</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Page Order
                          </label>
                          <select
                            value={options.arrangement.pageOrder}
                            onChange={(e) => setOptions(prev => ({
                              ...prev,
                              arrangement: { ...prev.arrangement, pageOrder: e.target.value as any }
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            <option value="horizontal">Left to Right, Top to Bottom</option>
                            <option value="vertical">Top to Bottom, Left to Right</option>
                            <option value="reverse-horizontal">Right to Left, Top to Bottom</option>
                            <option value="reverse-vertical">Bottom to Top, Left to Right</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Start Position
                            </label>
                            <select
                              value={options.arrangement.startPosition}
                              onChange={(e) => setOptions(prev => ({
                                ...prev,
                                arrangement: { ...prev.arrangement, startPosition: e.target.value as any }
                              }))}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                              <option value="top-left">Top Left</option>
                              <option value="top-right">Top Right</option>
                              <option value="bottom-left">Bottom Left</option>
                              <option value="bottom-right">Bottom Right</option>
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Fill Order
                            </label>
                            <select
                              value={options.arrangement.fillOrder}
                              onChange={(e) => setOptions(prev => ({
                                ...prev,
                                arrangement: { ...prev.arrangement, fillOrder: e.target.value as any }
                              }))}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                              <option value="row-first">Fill Rows First</option>
                              <option value="column-first">Fill Columns First</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Spacing */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Spacing & Margins</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Page Margin ({options.spacing.units})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="50"
                            step="0.5"
                            value={options.spacing.margin}
                            onChange={(e) => setOptions(prev => ({
                              ...prev,
                              spacing: { ...prev.spacing, margin: parseFloat(e.target.value) || 10 }
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Horizontal Gap ({options.spacing.units})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="20"
                            step="0.5"
                            value={options.spacing.gutterH}
                            onChange={(e) => setOptions(prev => ({
                              ...prev,
                              spacing: { ...prev.spacing, gutterH: parseFloat(e.target.value) || 5 }
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Vertical Gap ({options.spacing.units})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="20"
                            step="0.5"
                            value={options.spacing.gutterV}
                            onChange={(e) => setOptions(prev => ({
                              ...prev,
                              spacing: { ...prev.spacing, gutterV: parseFloat(e.target.value) || 5 }
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Scaling */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Scaling Options</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Scaling Mode
                          </label>
                          <select
                            value={options.scaling.mode}
                            onChange={(e) => setOptions(prev => ({
                              ...prev,
                              scaling: { ...prev.scaling, mode: e.target.value as any }
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            <option value="fit">Fit to Cell (preserve aspect ratio)</option>
                            <option value="fill">Fill Cell (may crop)</option>
                            <option value="custom">Custom Scale</option>
                            <option value="actual-size">Actual Size (no scaling)</option>
                          </select>
                        </div>

                        {options.scaling.mode === 'custom' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Custom Scale (%)
                            </label>
                            <input
                              type="range"
                              min="10"
                              max="200"
                              value={options.scaling.customScale}
                              onChange={(e) => setOptions(prev => ({
                                ...prev,
                                scaling: { ...prev.scaling, customScale: parseInt(e.target.value) }
                              }))}
                              className="w-full"
                            />
                            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                              <span>10%</span>
                              <span>{options.scaling.customScale}%</span>
                              <span>200%</span>
                            </div>
                          </div>
                        )}

                        <div className="flex space-x-4">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={options.scaling.maintainAspectRatio}
                              onChange={(e) => setOptions(prev => ({
                                ...prev,
                                scaling: { ...prev.scaling, maintainAspectRatio: e.target.checked }
                              }))}
                              className="mr-2"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Maintain aspect ratio</span>
                          </label>
                          
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={options.scaling.centerInCell}
                              onChange={(e) => setOptions(prev => ({
                                ...prev,
                                scaling: { ...prev.scaling, centerInCell: e.target.checked }
                              }))}
                              className="mr-2"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Center in cell</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'styling' && (
                  <div className="space-y-8">
                    {/* Borders */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Page Borders</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Border Width (pt)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="10"
                            step="0.1"
                            value={options.styling.borderWidth}
                            onChange={(e) => setOptions(prev => ({
                              ...prev,
                              styling: { ...prev.styling, borderWidth: parseFloat(e.target.value) || 0 }
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Border Style
                          </label>
                          <select
                            value={options.styling.borderStyle}
                            onChange={(e) => setOptions(prev => ({
                              ...prev,
                              styling: { ...prev.styling, borderStyle: e.target.value as any }
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            <option value="solid">Solid</option>
                            <option value="dashed">Dashed</option>
                            <option value="dotted">Dotted</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Border Color
                          </label>
                          <input
                            type="color"
                            value={options.styling.borderColor}
                            onChange={(e) => setOptions(prev => ({
                              ...prev,
                              styling: { ...prev.styling, borderColor: e.target.value }
                            }))}
                            className="w-full h-10 border border-gray-300 dark:border-gray-600 rounded-md"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Background */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Background</h3>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Background Color
                        </label>
                        <input
                          type="color"
                          value={options.styling.backgroundColor}
                          onChange={(e) => setOptions(prev => ({
                            ...prev,
                            styling: { ...prev.styling, backgroundColor: e.target.value }
                          }))}
                          className="w-32 h-10 border border-gray-300 dark:border-gray-600 rounded-md"
                        />
                      </div>
                    </div>

                    {/* Shadow Effects */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Shadow Effects</h3>
                      <div className="space-y-4">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={options.styling.shadowEnabled}
                            onChange={(e) => setOptions(prev => ({
                              ...prev,
                              styling: { ...prev.styling, shadowEnabled: e.target.checked }
                            }))}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Enable drop shadow</span>
                        </label>

                        {options.styling.shadowEnabled && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-6">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Shadow Offset (pt)
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="10"
                                value={options.styling.shadowOffset}
                                onChange={(e) => setOptions(prev => ({
                                  ...prev,
                                  styling: { ...prev.styling, shadowOffset: parseInt(e.target.value) || 2 }
                                }))}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Shadow Blur (pt)
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="20"
                                value={options.styling.shadowBlur}
                                onChange={(e) => setOptions(prev => ({
                                  ...prev,
                                  styling: { ...prev.styling, shadowBlur: parseInt(e.target.value) || 4 }
                                }))}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Page Numbers */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Page Numbers</h3>
                      <div className="space-y-4">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={options.pageNumbers.enabled}
                            onChange={(e) => setOptions(prev => ({
                              ...prev,
                              pageNumbers: { ...prev.pageNumbers, enabled: e.target.checked }
                            }))}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Show page numbers</span>
                        </label>

                        {options.pageNumbers.enabled && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 ml-6">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Position
                              </label>
                              <select
                                value={options.pageNumbers.position}
                                onChange={(e) => setOptions(prev => ({
                                  ...prev,
                                  pageNumbers: { ...prev.pageNumbers, position: e.target.value as any }
                                }))}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              >
                                <option value="inside">Inside Page</option>
                                <option value="outside">Outside Page</option>
                                <option value="margin">In Margin</option>
                              </select>
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Format
                              </label>
                              <select
                                value={options.pageNumbers.format}
                                onChange={(e) => setOptions(prev => ({
                                  ...prev,
                                  pageNumbers: { ...prev.pageNumbers, format: e.target.value as any }
                                }))}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              >
                                <option value="original">Original Numbers</option>
                                <option value="sequential">Sequential (1,2,3...)</option>
                                <option value="none">No Numbers</option>
                              </select>
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Font Size (pt)
                              </label>
                              <input
                                type="number"
                                min="6"
                                max="24"
                                value={options.pageNumbers.fontSize}
                                onChange={(e) => setOptions(prev => ({
                                  ...prev,
                                  pageNumbers: { ...prev.pageNumbers, fontSize: parseInt(e.target.value) || 8 }
                                }))}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'advanced' && (
                  <div className="space-y-8">
                    {/* Paper Size */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Output Paper Size</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Paper Size
                          </label>
                          <select
                            value={options.output.paperSize}
                            onChange={(e) => setOptions(prev => ({
                              ...prev,
                              output: { ...prev.output, paperSize: e.target.value as any }
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            {Object.entries(PAPER_SIZES).map(([key, size]) => (
                              <option key={key} value={key}>{size.name}</option>
                            ))}
                          </select>
                        </div>

                        {options.output.paperSize === 'Custom' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Width (mm)
                              </label>
                              <input
                                type="number"
                                min="50"
                                max="1000"
                                value={options.output.customWidth}
                                onChange={(e) => setOptions(prev => ({
                                  ...prev,
                                  output: { ...prev.output, customWidth: parseInt(e.target.value) || 210 }
                                }))}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Height (mm)
                              </label>
                              <input
                                type="number"
                                min="50"
                                max="1000"
                                value={options.output.customHeight}
                                onChange={(e) => setOptions(prev => ({
                                  ...prev,
                                  output: { ...prev.output, customHeight: parseInt(e.target.value) || 297 }
                                }))}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Print Quality */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Print Quality</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Resolution (DPI)
                          </label>
                          <select
                            value={options.output.dpi}
                            onChange={(e) => setOptions(prev => ({
                              ...prev,
                              output: { ...prev.output, dpi: parseInt(e.target.value) }
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            <option value={150}>150 DPI (Draft)</option>
                            <option value={300}>300 DPI (High Quality)</option>
                            <option value={600}>600 DPI (Print Ready)</option>
                            <option value={1200}>1200 DPI (Professional)</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Color Space
                          </label>
                          <select
                            value={options.output.colorSpace}
                            onChange={(e) => setOptions(prev => ({
                              ...prev,
                              output: { ...prev.output, colorSpace: e.target.value as any }
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            <option value="RGB">RGB (Screen)</option>
                            <option value="CMYK">CMYK (Print)</option>
                            <option value="Grayscale">Grayscale</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Print Marks */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Print Marks</h3>
                      <div className="space-y-3">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={options.advanced.cropMarks}
                            onChange={(e) => setOptions(prev => ({
                              ...prev,
                              advanced: { ...prev.advanced, cropMarks: e.target.checked }
                            }))}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Crop marks</span>
                        </label>
                        
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={options.advanced.registrationMarks}
                            onChange={(e) => setOptions(prev => ({
                              ...prev,
                              advanced: { ...prev.advanced, registrationMarks: e.target.checked }
                            }))}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Registration marks</span>
                        </label>
                        
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={options.advanced.colorBars}
                            onChange={(e) => setOptions(prev => ({
                              ...prev,
                              advanced: { ...prev.advanced, colorBars: e.target.checked }
                            }))}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Color bars</span>
                        </label>
                        
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={options.advanced.printMarks}
                            onChange={(e) => setOptions(prev => ({
                              ...prev,
                              advanced: { ...prev.advanced, printMarks: e.target.checked }
                            }))}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Printer marks</span>
                        </label>
                      </div>

                      {(options.advanced.cropMarks || options.advanced.registrationMarks || options.advanced.colorBars) && (
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Bleed Area (mm)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="10"
                            step="0.5"
                            value={options.advanced.bleedArea}
                            onChange={(e) => setOptions(prev => ({
                              ...prev,
                              advanced: { ...prev.advanced, bleedArea: parseFloat(e.target.value) || 3 }
                            }))}
                            className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Preview Panel */}
        {selectedFile && (
          <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Layout Preview</h3>
            
            {/* Layout Preview */}
            <div className="flex justify-center mb-4">
              {renderLayoutPreview()}
            </div>

            {/* PDF Preview */}
            {preview && (
              <div className="mb-4">
                <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Original Page</h4>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                  <img
                    src={preview}
                    alt="PDF Preview"
                    className="w-full h-auto rounded-lg"
                  />
                </div>
              </div>
            )}

            {/* Layout Info */}
            <div className="space-y-3">
              <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Layout Info</h4>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <div>Layout: {LAYOUT_PRESETS[options.layout.preset]?.name}</div>
                  <div>Input: {totalPages} pages</div>
                  <div>Output: {calculateOutputPages()} sheets</div>
                  <div>Paper: {PAPER_SIZES[options.output.paperSize]?.name}</div>
                  <div>DPI: {options.output.dpi}</div>
                </div>
              </div>

              <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Settings</h4>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <div>Order: {options.arrangement.pageOrder.replace('-', ' ')}</div>
                  <div>Scaling: {options.scaling.mode}</div>
                  <div>Margins: {options.spacing.margin}{options.spacing.units}</div>
                  {options.pageNumbers.enabled && <div>Page numbers: {options.pageNumbers.format}</div>}
                  {options.styling.borderWidth > 0 && <div>Borders: {options.styling.borderWidth}pt</div>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default NUpLayoutTool