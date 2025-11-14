import React, { useState, useRef } from 'react'
import { Upload, Scissors, Download, RefreshCw, AlertCircle, Eye, Settings, Plus, X } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { useJobsStore } from '../../state/jobs'
import { workerManager } from '../../lib/workerManager'

interface SplitOptions {
  mode: 'pages' | 'size' | 'ranges'
  pagesPerFile: number
  maxFileSize: number // in MB
  customRanges: string[]
}

const SplitTool: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [options, setOptions] = useState<SplitOptions>({
    mode: 'pages',
    pagesPerFile: 1,
    maxFileSize: 10,
    customRanges: ['1-5', '6-10']
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

  const addCustomRange = () => {
    setOptions(prev => ({
      ...prev,
      customRanges: [...prev.customRanges, `${totalPages}`]
    }))
  }

  const updateCustomRange = (index: number, value: string) => {
    setOptions(prev => ({
      ...prev,
      customRanges: prev.customRanges.map((range, i) => i === index ? value : range)
    }))
  }

  const removeCustomRange = (index: number) => {
    setOptions(prev => ({
      ...prev,
      customRanges: prev.customRanges.filter((_, i) => i !== index)
    }))
  }

  const calculateSplitInfo = () => {
    if (!totalPages) return { files: 0, ranges: [] }

    switch (options.mode) {
      case 'pages':
        return {
          files: Math.ceil(totalPages / options.pagesPerFile),
          ranges: Array.from({ length: Math.ceil(totalPages / options.pagesPerFile) }, (_, i) => {
            const start = i * options.pagesPerFile + 1
            const end = Math.min((i + 1) * options.pagesPerFile, totalPages)
            return `${start}-${end}`
          })
        }
      case 'size':
        // Simplified calculation - actual implementation would analyze PDF content
        const estimatedFilesForSize = Math.ceil(totalPages / 10) // Rough estimate
        return {
          files: estimatedFilesForSize,
          ranges: Array.from({ length: estimatedFilesForSize }, (_, i) => {
            const pagesPerGroup = Math.ceil(totalPages / estimatedFilesForSize)
            const start = i * pagesPerGroup + 1
            const end = Math.min((i + 1) * pagesPerGroup, totalPages)
            return `${start}-${end}`
          })
        }
      case 'ranges':
        return {
          files: options.customRanges.length,
          ranges: options.customRanges
        }
      default:
        return { files: 0, ranges: [] }
    }
  }

  const handleSplit = async () => {
    if (!selectedFile || totalPages === 0) return

    setIsProcessing(true)
    
    try {
      const arrayBuffer = await selectedFile.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      
      const jobId = `split-${Date.now()}`
      addJob({
        id: jobId,
        type: 'split',
        name: 'Split PDF',
        status: 'running',
        progress: { current: 0, total: 100, message: 'Splitting PDF...' },
        startTime: Date.now(),
        cancellable: true,
        fileIds: [selectedFile.name]
      })

      // Calculate split points based on mode
      let splitPoints: number[] = []
      
      switch (options.mode) {
        case 'pages':
          for (let i = options.pagesPerFile; i < totalPages; i += options.pagesPerFile) {
            splitPoints.push(i)
          }
          break
        case 'size':
          // Simplified - split into equal parts
          const parts = Math.ceil(totalPages / 10)
          for (let i = 1; i < parts; i++) {
            splitPoints.push(Math.floor((totalPages * i) / parts))
          }
          break
        case 'ranges':
          // Parse custom ranges to get split points
          const ranges = options.customRanges.map(range => {
            const [start, end] = range.split('-').map(n => parseInt(n.trim()))
            return { start: start || 1, end: end || start || 1 }
          })
          ranges.sort((a, b) => a.start - b.start)
          for (let i = 0; i < ranges.length - 1; i++) {
            splitPoints.push(ranges[i].end)
          }
          break
      }

      const results = await workerManager.splitPDF(uint8Array, splitPoints)
      
      // Create new files for each split result
      const splitInfo = calculateSplitInfo()
      for (let i = 0; i < results.length; i++) {
        const blob = new Blob([new Uint8Array(results[i])], { type: 'application/pdf' })
        const fileName = selectedFile.name.replace(/\.pdf$/i, `_part_${i + 1}_${splitInfo.ranges[i] || (i + 1)}.pdf`)
        
        addFile({
          id: `split-${Date.now()}-${i}`,
          name: fileName,
          size: blob.size,
          pageCount: splitInfo.ranges[i] ? splitInfo.ranges[i].split('-').length : 1,
          data: new Uint8Array(await blob.arrayBuffer()),
          lastModified: Date.now()
        })
        
        // Download each split file
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        a.click()
        URL.revokeObjectURL(url)
      }
      
      // Update job status
      updateJob(jobId, {
        status: 'completed',
        progress: { current: 100, total: 100, message: 'Split completed' },
        endTime: Date.now()
      })

    } catch (error) {
      console.error('Error splitting PDF:', error)
      updateJob(`split-error-${Date.now()}`, {
        status: 'failed',
        progress: { current: 0, total: 100, message: 'Split failed' },
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
            <Scissors className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Split PDF</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Split PDF into multiple files</p>
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
                        <Scissors className="w-5 h-5 text-red-600 dark:text-red-400" />
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

              {/* Split Options */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  Split Options
                </h3>
                
                <div className="space-y-6">
                  {/* Split Mode */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Split Mode
                    </label>
                    <div className="space-y-3">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="splitMode"
                          value="pages"
                          checked={options.mode === 'pages'}
                          onChange={(e) => setOptions({ ...options, mode: e.target.value as any })}
                          className="mr-3"
                        />
                        <div>
                          <span className="font-medium text-gray-900 dark:text-white">By Pages</span>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Split every N pages into separate files</p>
                        </div>
                      </label>
                      
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="splitMode"
                          value="size"
                          checked={options.mode === 'size'}
                          onChange={(e) => setOptions({ ...options, mode: e.target.value as any })}
                          className="mr-3"
                        />
                        <div>
                          <span className="font-medium text-gray-900 dark:text-white">By File Size</span>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Split to keep files under a maximum size</p>
                        </div>
                      </label>
                      
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="splitMode"
                          value="ranges"
                          checked={options.mode === 'ranges'}
                          onChange={(e) => setOptions({ ...options, mode: e.target.value as any })}
                          className="mr-3"
                        />
                        <div>
                          <span className="font-medium text-gray-900 dark:text-white">Custom Ranges</span>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Define specific page ranges</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Mode-specific options */}
                  {options.mode === 'pages' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Pages per file
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={totalPages || 100}
                        value={options.pagesPerFile}
                        onChange={(e) => setOptions({ ...options, pagesPerFile: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  )}

                  {options.mode === 'size' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Max file size (MB)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={options.maxFileSize}
                        onChange={(e) => setOptions({ ...options, maxFileSize: parseInt(e.target.value) || 10 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  )}

                  {options.mode === 'ranges' && (
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Page Ranges
                        </label>
                        <button
                          onClick={addCustomRange}
                          className="text-sm text-green-600 hover:text-green-700 flex items-center"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add Range
                        </button>
                      </div>
                      <div className="space-y-2">
                        {options.customRanges.map((range, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={range}
                              onChange={(e) => updateCustomRange(index, e.target.value)}
                              placeholder="e.g., 1-5 or 10"
                              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                            <button
                              onClick={() => removeCustomRange(index)}
                              className="p-2 text-gray-400 hover:text-red-600"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Examples: "1-5", "6-10", "15" (single page)
                      </p>
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
                  Split Preview
                </h3>
                
                <div className="space-y-4">
                  {/* Original Page Preview */}
                  {preview && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Original file preview:</p>
                      <div className="flex justify-center">
                        <img 
                          src={preview} 
                          alt="PDF Preview" 
                          className="max-w-32 border border-gray-200 dark:border-gray-600 rounded"
                        />
                      </div>
                    </div>
                  )}

                  {/* Split Information */}
                  {totalPages > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">Split Results</h4>
                      {(() => {
                        const splitInfo = calculateSplitInfo()
                        return (
                          <div>
                            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 mb-3">
                              <li>• Input pages: {totalPages}</li>
                              <li>• Output files: {splitInfo.files}</li>
                              <li>• Split mode: {options.mode}</li>
                            </ul>
                            <div>
                              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">File ranges:</p>
                              <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                {splitInfo.ranges.map((range, index) => (
                                  <div key={index}>File {index + 1}: Pages {range}</div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* Process Button */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <button
                  onClick={handleSplit}
                  disabled={!selectedFile || isProcessing}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-md transition-colors flex items-center justify-center"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      Splitting...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5 mr-2" />
                      Split PDF
                    </>
                  )}
                </button>

                {!selectedFile && (
                  <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md">
                    <div className="flex">
                      <AlertCircle className="w-5 h-5 text-yellow-400 mr-2 flex-shrink-0" />
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        Please select a PDF file to split.
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

export default SplitTool