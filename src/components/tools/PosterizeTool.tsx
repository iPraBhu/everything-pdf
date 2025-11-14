import React, { useState, useRef } from 'react'
import { Upload, Layers, Download, Settings, Eye, AlertCircle, RefreshCw } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { useJobsStore } from '../../state/jobs'
import { workerManager } from '../../lib/workerManager'

interface PosterizeOptions {
  scaleMode: 'fit' | 'custom'
  customScale: number
  tileSize: 'a4' | 'letter' | 'legal' | 'custom'
  customWidth: number
  customHeight: number
  overlap: number
  margin: number
  orientation: 'portrait' | 'landscape' | 'auto'
  addCutLines: boolean
  cutLineStyle: 'solid' | 'dashed' | 'dotted'
  cutLineColor: string
  addLabels: boolean
  labelPosition: 'corner' | 'outside'
  outputFormat: 'separate' | 'combined'
}

const tileSizes = {
  'a4': { width: 595, height: 842, name: 'A4 (210×297mm)' },
  'letter': { width: 612, height: 792, name: 'Letter (8.5×11")' },
  'legal': { width: 612, height: 1008, name: 'Legal (8.5×14")' },
  'custom': { width: 612, height: 792, name: 'Custom Size' }
}

const PosterizeTool: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [options, setOptions] = useState<PosterizeOptions>({
    scaleMode: 'fit',
    customScale: 200,
    tileSize: 'a4',
    customWidth: 595,
    customHeight: 842,
    overlap: 20,
    margin: 20,
    orientation: 'auto',
    addCutLines: true,
    cutLineStyle: 'dashed',
    cutLineColor: '#cccccc',
    addLabels: true,
    labelPosition: 'corner',
    outputFormat: 'separate'
  })
  const [preview, setPreview] = useState<string | null>(null)
  const [totalPages, setTotalPages] = useState<number>(0)
  const [estimatedTiles, setEstimatedTiles] = useState<number>(0)
  
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
      // Calculate estimated tiles based on scale and tile size
      calculateEstimatedTiles(info.pageCount)
    } catch (error) {
      console.error('Error getting PDF info:', error)
    }
  }

  const calculateEstimatedTiles = (pageCount: number) => {
    // This is a simplified calculation - actual implementation would analyze page dimensions
    const scale = options.scaleMode === 'custom' ? options.customScale / 100 : 2
    const tilesPerPage = Math.ceil(scale * scale)
    setEstimatedTiles(pageCount * tilesPerPage)
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

  const getTileSize = () => {
    if (options.tileSize === 'custom') {
      return { width: options.customWidth, height: options.customHeight, name: 'Custom Size' }
    }
    return tileSizes[options.tileSize]
  }

  const handlePosterize = async () => {
    if (!selectedFile) return

    setIsProcessing(true)
    
    try {
      const arrayBuffer = await selectedFile.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      
      const jobId = `posterize-${Date.now()}`
      addJob({
        id: jobId,
        type: 'posterize',
        name: 'Posterize PDF',
        status: 'running',
        progress: { current: 0, total: 100, message: 'Creating poster tiles...' },
        startTime: Date.now(),
        cancellable: true,
        fileIds: [selectedFile.name]
      })

      const tileSize = getTileSize()
      const posterizeOptions = {
        scaleMode: options.scaleMode,
        customScale: options.customScale / 100,
        tileSize: {
          width: tileSize.width,
          height: tileSize.height
        },
        overlap: options.overlap,
        margin: options.margin,
        orientation: options.orientation,
        addCutLines: options.addCutLines,
        cutLineStyle: options.cutLineStyle,
        cutLineColor: options.cutLineColor,
        addLabels: options.addLabels,
        labelPosition: options.labelPosition,
        outputFormat: options.outputFormat
      }

      const result = await workerManager.posterize(uint8Array, posterizeOptions)
      
      // Create new file with posterized content
      const blob = new Blob([new Uint8Array(result)], { type: 'application/pdf' })
      const fileName = selectedFile.name.replace(/\.pdf$/i, '_posterized.pdf')
      
      addFile({
        id: `posterize-${Date.now()}`,
        name: fileName,
        size: blob.size,
        pageCount: estimatedTiles,
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
        progress: { current: 100, total: 100, message: 'Posterize completed' },
        endTime: Date.now()
      })

    } catch (error) {
      console.error('Error posterizing PDF:', error)
      updateJob(`posterize-error-${Date.now()}`, {
        status: 'failed',
        progress: { current: 0, total: 100, message: 'Posterize failed' },
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
          <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center">
            <Layers className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Posterize</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Split large pages into printable tiles</p>
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
                        <Layers className="w-5 h-5 text-red-600 dark:text-red-400" />
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

              {/* Scaling Options */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  Scaling Options
                </h3>
                
                <div className="space-y-4">
                  {/* Scale Mode */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Scale Mode
                    </label>
                    <div className="flex space-x-3">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="scaleMode"
                          value="fit"
                          checked={options.scaleMode === 'fit'}
                          onChange={(e) => setOptions({ ...options, scaleMode: e.target.value as any })}
                          className="mr-2"
                        />
                        <span className="text-sm">Auto-fit to tiles</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="scaleMode"
                          value="custom"
                          checked={options.scaleMode === 'custom'}
                          onChange={(e) => setOptions({ ...options, scaleMode: e.target.value as any })}
                          className="mr-2"
                        />
                        <span className="text-sm">Custom scale</span>
                      </label>
                    </div>
                  </div>

                  {/* Custom Scale */}
                  {options.scaleMode === 'custom' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Scale (%)
                      </label>
                      <input
                        type="number"
                        min="100"
                        max="1000"
                        value={options.customScale}
                        onChange={(e) => {
                          setOptions({ ...options, customScale: parseInt(e.target.value) || 100 })
                          calculateEstimatedTiles(totalPages)
                        }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Tile Options */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Tile Options</h3>
                
                <div className="space-y-4">
                  {/* Tile Size */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Tile Size
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(tileSizes).map(([key, size]) => (
                        <button
                          key={key}
                          onClick={() => setOptions({ ...options, tileSize: key as any })}
                          className={`p-3 border rounded-lg text-left transition-colors ${
                            options.tileSize === key
                              ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300'
                              : 'border-gray-300 dark:border-gray-600 hover:border-orange-300 dark:hover:border-orange-500'
                          }`}
                        >
                          <div className="font-medium">{size.name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {size.width}×{size.height}pt
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Tile Size */}
                  {options.tileSize === 'custom' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Width (pt)
                        </label>
                        <input
                          type="number"
                          min="100"
                          max="2000"
                          value={options.customWidth}
                          onChange={(e) => setOptions({ ...options, customWidth: parseInt(e.target.value) || 595 })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Height (pt)
                        </label>
                        <input
                          type="number"
                          min="100"
                          max="2000"
                          value={options.customHeight}
                          onChange={(e) => setOptions({ ...options, customHeight: parseInt(e.target.value) || 842 })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Overlap & Margin */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Overlap (pt)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={options.overlap}
                        onChange={(e) => setOptions({ ...options, overlap: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
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
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>

                  {/* Additional Options */}
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={options.addCutLines}
                          onChange={(e) => setOptions({ ...options, addCutLines: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Add cut lines
                        </span>
                      </label>
                      
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={options.addLabels}
                          onChange={(e) => setOptions({ ...options, addLabels: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Add tile labels
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
                  Preview
                </h3>
                
                <div className="space-y-4">
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

                  {/* Tile Grid Preview */}
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Tile arrangement:</p>
                    <div className="grid grid-cols-3 gap-1 max-w-24 mx-auto">
                      {Array.from({ length: 9 }, (_, index) => (
                        <div
                          key={index}
                          className="bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded flex items-center justify-center text-xs font-medium text-gray-500 dark:text-gray-400 aspect-[3/4]"
                        >
                          {String.fromCharCode(65 + Math.floor(index / 3))}{(index % 3) + 1}
                        </div>
                      ))}
                    </div>
                    <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Example 3×3 grid
                    </p>
                  </div>

                  {/* Summary */}
                  {totalPages > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">Output Summary</h4>
                      <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <li>• Input pages: {totalPages}</li>
                        <li>• Estimated output tiles: ~{estimatedTiles}</li>
                        <li>• Tile size: {getTileSize().name}</li>
                        <li>• Output format: {options.outputFormat === 'separate' ? 'Separate PDFs' : 'Combined PDF'}</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Process Button */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <button
                  onClick={handlePosterize}
                  disabled={!selectedFile || isProcessing}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-md transition-colors flex items-center justify-center"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      Creating Poster...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5 mr-2" />
                      Create Poster Tiles
                    </>
                  )}
                </button>

                {!selectedFile && (
                  <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md">
                    <div className="flex">
                      <AlertCircle className="w-5 h-5 text-yellow-400 mr-2 flex-shrink-0" />
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        Please select a PDF file to create poster tiles.
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

export default PosterizeTool