import React, { useState, useRef } from 'react'
import { Upload, Grid3x3, Download, Settings, Eye, AlertCircle, RefreshCw } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { useJobsStore } from '../../state/jobs'
import { workerManager } from '../../lib/workerManager'

interface NUpOptions {
  layout: '2up' | '4up' | '6up' | '8up' | '9up' | '16up' | 'custom'
  customRows: number
  customCols: number
  pageOrder: 'horizontal' | 'vertical'
  spacing: number
  margin: number
  orientation: 'portrait' | 'landscape' | 'auto'
  scaling: 'fit' | 'fill' | 'custom'
  customScale: number
  borderWidth: number
  borderColor: string
  backgroundColor: string
  addPageNumbers: boolean
  centerPages: boolean
}

const layoutConfigs = {
  '2up': { rows: 1, cols: 2, name: '2-Up (1×2)' },
  '4up': { rows: 2, cols: 2, name: '4-Up (2×2)' },
  '6up': { rows: 2, cols: 3, name: '6-Up (2×3)' },
  '8up': { rows: 2, cols: 4, name: '8-Up (2×4)' },
  '9up': { rows: 3, cols: 3, name: '9-Up (3×3)' },
  '16up': { rows: 4, cols: 4, name: '16-Up (4×4)' },
  'custom': { rows: 2, cols: 2, name: 'Custom' }
}

const NUpTool: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [options, setOptions] = useState<NUpOptions>({
    layout: '2up',
    customRows: 2,
    customCols: 2,
    pageOrder: 'horizontal',
    spacing: 10,
    margin: 20,
    orientation: 'auto',
    scaling: 'fit',
    customScale: 100,
    borderWidth: 0,
    borderColor: '#000000',
    backgroundColor: '#ffffff',
    addPageNumbers: false,
    centerPages: true
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
      // Use the PDF library to generate thumbnail
      const { loadPDFDocument, getPageThumbnail } = await import('../../lib/pdf')
      const doc = await loadPDFDocument(uint8Array)
      const page = await doc.getPage(1)
      const thumbnail = await getPageThumbnail(page, 150)
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

  const getLayoutConfig = () => {
    if (options.layout === 'custom') {
      return { rows: options.customRows, cols: options.customCols }
    }
    return layoutConfigs[options.layout]
  }

  const calculateOutputPages = () => {
    if (!totalPages) return 0
    const config = getLayoutConfig()
    const pagesPerSheet = config.rows * config.cols
    return Math.ceil(totalPages / pagesPerSheet)
  }

  const handleCreateNUp = async () => {
    if (!selectedFile) return

    setIsProcessing(true)
    
    try {
      const arrayBuffer = await selectedFile.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      
      const jobId = `nup-${Date.now()}`
      addJob({
        id: jobId,
        type: 'nup',
        name: 'N-Up Layout',
        status: 'running',
        progress: { current: 0, total: 100, message: 'Creating N-Up layout...' },
        startTime: Date.now(),
        cancellable: true,
        fileIds: [selectedFile.name]
      })

      const config = getLayoutConfig()
      const nUpOptions = {
        rows: config.rows,
        cols: config.cols,
        pageOrder: options.pageOrder,
        spacing: options.spacing,
        margin: options.margin,
        orientation: options.orientation,
        scaling: options.scaling,
        customScale: options.customScale / 100,
        border: {
          width: options.borderWidth,
          color: options.borderColor
        },
        backgroundColor: options.backgroundColor,
        addPageNumbers: options.addPageNumbers,
        centerPages: options.centerPages
      }

      const result = await workerManager.nUpLayout([uint8Array], nUpOptions)
      
      // Create new file with N-Up layout
      const blob = new Blob([new Uint8Array(result)], { type: 'application/pdf' })
      const fileName = selectedFile.name.replace(/\.pdf$/i, `_${options.layout}_layout.pdf`)
      
      addFile({
        id: `nup-${Date.now()}`,
        name: fileName,
        size: blob.size,
        pageCount: calculateOutputPages(),
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
        progress: { current: 100, total: 100, message: 'N-Up layout completed' },
        endTime: Date.now()
      })

    } catch (error) {
      console.error('Error creating N-Up layout:', error)
      updateJob(`nup-error-${Date.now()}`, {
        status: 'failed',
        progress: { current: 0, total: 100, message: 'N-Up layout failed' },
        endTime: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const renderLayoutPreview = () => {
    const config = getLayoutConfig()
    const { rows, cols } = config
    
    return (
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
        <div 
          className="grid gap-1 mx-auto"
          style={{
            gridTemplateRows: `repeat(${rows}, 1fr)`,
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            maxWidth: '200px',
            aspectRatio: options.orientation === 'landscape' ? '4/3' : '3/4'
          }}
        >
          {Array.from({ length: rows * cols }, (_, index) => (
            <div
              key={index}
              className="bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded flex items-center justify-center text-xs font-medium text-gray-500 dark:text-gray-400"
              style={{ aspectRatio: '3/4' }}
            >
              {index < totalPages ? index + 1 : ''}
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">
          {cols}×{rows} layout ({calculateOutputPages()} output pages)
        </p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
            <Grid3x3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">N-Up Layout</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Arrange multiple pages on a single sheet</p>
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
                        <Grid3x3 className="w-5 h-5 text-red-600 dark:text-red-400" />
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

              {/* Layout Options */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  Layout Options
                </h3>
                
                <div className="space-y-6">
                  {/* Layout Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Layout Type
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(layoutConfigs).map(([key, config]) => (
                        <button
                          key={key}
                          onClick={() => setOptions({ ...options, layout: key as any })}
                          className={`p-3 border rounded-lg text-left transition-colors ${
                            options.layout === key
                              ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                              : 'border-gray-300 dark:border-gray-600 hover:border-purple-300 dark:hover:border-purple-500'
                          }`}
                        >
                          <div className="font-medium">{config.name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {config.rows}×{config.cols} grid
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Layout */}
                  {options.layout === 'custom' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Rows
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={options.customRows}
                          onChange={(e) => setOptions({ ...options, customRows: parseInt(e.target.value) || 1 })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                          value={options.customCols}
                          onChange={(e) => setOptions({ ...options, customCols: parseInt(e.target.value) || 1 })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Page Order */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Page Order
                    </label>
                    <div className="flex space-x-3">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="pageOrder"
                          value="horizontal"
                          checked={options.pageOrder === 'horizontal'}
                          onChange={(e) => setOptions({ ...options, pageOrder: e.target.value as any })}
                          className="mr-2"
                        />
                        <span className="text-sm">Horizontal (left to right)</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="pageOrder"
                          value="vertical"
                          checked={options.pageOrder === 'vertical'}
                          onChange={(e) => setOptions({ ...options, pageOrder: e.target.value as any })}
                          className="mr-2"
                        />
                        <span className="text-sm">Vertical (top to bottom)</span>
                      </label>
                    </div>
                  </div>

                  {/* Spacing & Margins */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Spacing (pt)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={options.spacing}
                        onChange={(e) => setOptions({ ...options, spacing: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Margin (pt)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={options.margin}
                        onChange={(e) => setOptions({ ...options, margin: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  {/* Additional Options */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Orientation
                      </label>
                      <select
                        value={options.orientation}
                        onChange={(e) => setOptions({ ...options, orientation: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="auto">Auto</option>
                        <option value="portrait">Portrait</option>
                        <option value="landscape">Landscape</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Scaling
                      </label>
                      <select
                        value={options.scaling}
                        onChange={(e) => setOptions({ ...options, scaling: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="fit">Fit to cell</option>
                        <option value="fill">Fill cell</option>
                        <option value="custom">Custom scale</option>
                      </select>
                    </div>

                    {options.scaling === 'custom' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Scale (%)
                        </label>
                        <input
                          type="number"
                          min="10"
                          max="200"
                          value={options.customScale}
                          onChange={(e) => setOptions({ ...options, customScale: parseInt(e.target.value) || 100 })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={options.addPageNumbers}
                          onChange={(e) => setOptions({ ...options, addPageNumbers: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Add page numbers
                        </span>
                      </label>
                      
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={options.centerPages}
                          onChange={(e) => setOptions({ ...options, centerPages: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Center pages in cells
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview & Actions */}
            <div className="space-y-6">
              {/* Preview */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                  <Eye className="w-5 h-5 mr-2" />
                  Layout Preview
                </h3>
                
                <div className="space-y-4">
                  {/* Layout Grid Preview */}
                  {renderLayoutPreview()}

                  {/* Original Page Preview */}
                  {preview && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Original page preview:</p>
                      <div className="flex justify-center">
                        <img 
                          src={preview} 
                          alt="PDF Preview" 
                          className="max-w-32 border border-gray-200 dark:border-gray-600 rounded"
                        />
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  {totalPages > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">Output Summary</h4>
                      <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <li>• Input pages: {totalPages}</li>
                        <li>• Output pages: {calculateOutputPages()}</li>
                        <li>• Pages per sheet: {getLayoutConfig().rows * getLayoutConfig().cols}</li>
                        <li>• Layout: {getLayoutConfig().rows}×{getLayoutConfig().cols}</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Process Button */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <button
                  onClick={handleCreateNUp}
                  disabled={!selectedFile || isProcessing}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-md transition-colors flex items-center justify-center"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      Creating Layout...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5 mr-2" />
                      Create N-Up Layout
                    </>
                  )}
                </button>

                {!selectedFile && (
                  <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md">
                    <div className="flex">
                      <AlertCircle className="w-5 h-5 text-yellow-400 mr-2 flex-shrink-0" />
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        Please select a PDF file to create N-Up layout.
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

export default NUpTool