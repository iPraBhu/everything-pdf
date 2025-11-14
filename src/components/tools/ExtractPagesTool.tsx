import React, { useState, useRef } from 'react'
import { Upload, FileText, Download, Settings, Eye, AlertCircle, RefreshCw, Scissors } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { useJobsStore } from '../../state/jobs'
import { workerManager } from '../../lib/workerManager'

interface ExtractOptions {
  method: 'range' | 'specific' | 'odd' | 'even' | 'every-nth'
  pageRange: { start: number; end: number }
  specificPages: string
  everyNthPage: number
  startFromPage: number
  outputFormat: 'separate' | 'single'
}

const ExtractPagesTool: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [options, setOptions] = useState<ExtractOptions>({
    method: 'range',
    pageRange: { start: 1, end: 1 },
    specificPages: '',
    everyNthPage: 2,
    startFromPage: 1,
    outputFormat: 'separate'
  })
  const [preview, setPreview] = useState<string | null>(null)
  const [totalPages, setTotalPages] = useState<number>(0)
  const [extractedCount, setExtractedCount] = useState<number>(0)
  
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
      setOptions(prev => ({ 
        ...prev, 
        pageRange: { start: 1, end: info.pageCount }
      }))
      calculateExtractedCount(options, info.pageCount)
    } catch (error) {
      console.error('Error getting PDF info:', error)
    }
  }

  const calculateExtractedCount = (opts: ExtractOptions, total: number) => {
    let pages: number[] = []
    
    switch (opts.method) {
      case 'range':
        for (let i = opts.pageRange.start; i <= Math.min(opts.pageRange.end, total); i++) {
          pages.push(i)
        }
        break
      case 'specific':
        const parts = opts.specificPages.split(',')
        for (const part of parts) {
          const trimmed = part.trim()
          if (trimmed.includes('-')) {
            const [start, end] = trimmed.split('-').map(n => parseInt(n.trim()))
            if (!isNaN(start) && !isNaN(end)) {
              for (let i = start; i <= Math.min(end, total); i++) {
                if (i >= 1) pages.push(i)
              }
            }
          } else {
            const pageNum = parseInt(trimmed)
            if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= total) {
              pages.push(pageNum)
            }
          }
        }
        break
      case 'odd':
        for (let i = 1; i <= total; i += 2) {
          pages.push(i)
        }
        break
      case 'even':
        for (let i = 2; i <= total; i += 2) {
          pages.push(i)
        }
        break
      case 'every-nth':
        for (let i = opts.startFromPage; i <= total; i += opts.everyNthPage) {
          pages.push(i)
        }
        break
    }
    
    // Remove duplicates and sort
    pages = [...new Set(pages)].sort((a, b) => a - b)
    setExtractedCount(pages.length)
  }

  React.useEffect(() => {
    if (totalPages > 0) {
      calculateExtractedCount(options, totalPages)
    }
  }, [options, totalPages])

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

  const getExtractionDescription = () => {
    switch (options.method) {
      case 'range':
        return `Pages ${options.pageRange.start}-${options.pageRange.end}`
      case 'specific':
        return `Specific pages: ${options.specificPages}`
      case 'odd':
        return 'All odd pages (1, 3, 5...)'
      case 'even':
        return 'All even pages (2, 4, 6...)'
      case 'every-nth':
        return `Every ${options.everyNthPage}${getOrdinalSuffix(options.everyNthPage)} page starting from page ${options.startFromPage}`
      default:
        return 'No pages selected'
    }
  }

  const getOrdinalSuffix = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd']
    const v = n % 100
    return s[(v - 20) % 10] || s[v] || s[0]
  }

  const handleExtractPages = async () => {
    if (!selectedFile) return

    setIsProcessing(true)
    
    try {
      const arrayBuffer = await selectedFile.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      
      const jobId = `extract-${Date.now()}`
      addJob({
        id: jobId,
        type: 'extract',
        name: 'Extract Pages',
        status: 'running',
        progress: { current: 0, total: 100, message: 'Extracting pages...' },
        startTime: Date.now(),
        cancellable: true,
        fileIds: [selectedFile.name]
      })

      // Determine pages to extract
      let pagesToExtract: number[] = []
      
      switch (options.method) {
        case 'range':
          for (let i = options.pageRange.start; i <= Math.min(options.pageRange.end, totalPages); i++) {
            pagesToExtract.push(i - 1) // Convert to 0-based
          }
          break
        case 'specific':
          const parts = options.specificPages.split(',')
          for (const part of parts) {
            const trimmed = part.trim()
            if (trimmed.includes('-')) {
              const [start, end] = trimmed.split('-').map(n => parseInt(n.trim()))
              if (!isNaN(start) && !isNaN(end)) {
                for (let i = start; i <= Math.min(end, totalPages); i++) {
                  if (i >= 1) pagesToExtract.push(i - 1) // Convert to 0-based
                }
              }
            } else {
              const pageNum = parseInt(trimmed)
              if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                pagesToExtract.push(pageNum - 1) // Convert to 0-based
              }
            }
          }
          break
        case 'odd':
          for (let i = 1; i <= totalPages; i += 2) {
            pagesToExtract.push(i - 1) // Convert to 0-based
          }
          break
        case 'even':
          for (let i = 2; i <= totalPages; i += 2) {
            pagesToExtract.push(i - 1) // Convert to 0-based
          }
          break
        case 'every-nth':
          for (let i = options.startFromPage; i <= totalPages; i += options.everyNthPage) {
            pagesToExtract.push(i - 1) // Convert to 0-based
          }
          break
      }
      
      // Remove duplicates and sort
      pagesToExtract = [...new Set(pagesToExtract)].sort((a, b) => a - b)

      if (options.outputFormat === 'separate') {
        // Extract each page as separate PDF
        for (let i = 0; i < pagesToExtract.length; i++) {
          const pageIndex = pagesToExtract[i]
          const result = await workerManager.extractPages(uint8Array, [pageIndex])
          
          const blob = new Blob([new Uint8Array(result)], { type: 'application/pdf' })
          const fileName = selectedFile.name.replace(/\.pdf$/i, `_page_${pageIndex + 1}.pdf`)
          
          addFile({
            id: `extract-page-${pageIndex}-${Date.now()}`,
            name: fileName,
            size: blob.size,
            pageCount: 1,
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
          
          // Update progress
          updateJob(jobId, {
            progress: { 
              current: Math.round(((i + 1) / pagesToExtract.length) * 100), 
              total: 100, 
              message: `Extracted ${i + 1} of ${pagesToExtract.length} pages` 
            }
          })
        }
      } else {
        // Extract all pages as single PDF
        const result = await workerManager.extractPages(uint8Array, pagesToExtract)
        
        const blob = new Blob([new Uint8Array(result)], { type: 'application/pdf' })
        const fileName = selectedFile.name.replace(/\.pdf$/i, '_extracted.pdf')
        
        addFile({
          id: `extract-${Date.now()}`,
          name: fileName,
          size: blob.size,
          pageCount: pagesToExtract.length,
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
      }
      
      // Update job status
      updateJob(jobId, {
        status: 'completed',
        progress: { current: 100, total: 100, message: `Extracted ${pagesToExtract.length} pages` },
        endTime: Date.now()
      })

    } catch (error) {
      console.error('Error extracting pages:', error)
      updateJob(`extract-error-${Date.now()}`, {
        status: 'failed',
        progress: { current: 0, total: 100, message: 'Failed to extract pages' },
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
          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
            <Scissors className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Extract Pages</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Extract specific pages from your PDF</p>
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
                        <FileText className="w-5 h-5 text-red-600 dark:text-red-400" />
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

              {/* Extraction Options */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  Extraction Options
                </h3>
                
                <div className="space-y-6">
                  {/* Extraction Method */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Pages to Extract
                    </label>
                    <div className="space-y-3">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="method"
                          checked={options.method === 'range'}
                          onChange={() => setOptions({ ...options, method: 'range' })}
                          className="mr-2"
                        />
                        <span className="text-sm">Page range</span>
                      </label>
                      
                      {options.method === 'range' && (
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
                          name="method"
                          checked={options.method === 'specific'}
                          onChange={() => setOptions({ ...options, method: 'specific' })}
                          className="mr-2"
                        />
                        <span className="text-sm">Specific pages</span>
                      </label>
                      
                      {options.method === 'specific' && (
                        <div className="ml-6">
                          <input
                            type="text"
                            placeholder="e.g., 1,3,5-10,15"
                            value={options.specificPages}
                            onChange={(e) => setOptions({ ...options, specificPages: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Separate pages with commas, use dashes for ranges
                          </p>
                        </div>
                      )}
                      
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="method"
                          checked={options.method === 'odd'}
                          onChange={() => setOptions({ ...options, method: 'odd' })}
                          className="mr-2"
                        />
                        <span className="text-sm">All odd pages (1, 3, 5...)</span>
                      </label>
                      
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="method"
                          checked={options.method === 'even'}
                          onChange={() => setOptions({ ...options, method: 'even' })}
                          className="mr-2"
                        />
                        <span className="text-sm">All even pages (2, 4, 6...)</span>
                      </label>
                      
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="method"
                          checked={options.method === 'every-nth'}
                          onChange={() => setOptions({ ...options, method: 'every-nth' })}
                          className="mr-2"
                        />
                        <span className="text-sm">Every Nth page</span>
                      </label>
                      
                      {options.method === 'every-nth' && (
                        <div className="ml-6 grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Every N pages</label>
                            <input
                              type="number"
                              min="2"
                              max="10"
                              value={options.everyNthPage}
                              onChange={(e) => setOptions({ ...options, everyNthPage: parseInt(e.target.value) || 2 })}
                              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Start from page</label>
                            <input
                              type="number"
                              min="1"
                              max={totalPages || 1}
                              value={options.startFromPage}
                              onChange={(e) => setOptions({ ...options, startFromPage: parseInt(e.target.value) || 1 })}
                              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Output Format */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Output Format
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="outputFormat"
                          checked={options.outputFormat === 'separate'}
                          onChange={() => setOptions({ ...options, outputFormat: 'separate' })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Separate PDF files (one per page)</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="outputFormat"
                          checked={options.outputFormat === 'single'}
                          onChange={() => setOptions({ ...options, outputFormat: 'single' })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Single PDF file (all pages combined)</span>
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
                  {/* File Preview */}
                  <div className="text-center">
                    {preview ? (
                      <img 
                        src={preview} 
                        alt="PDF Preview" 
                        className="mx-auto max-w-48 border border-gray-200 dark:border-gray-600 rounded"
                      />
                    ) : (
                      <div className="mx-auto w-48 h-64 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded flex items-center justify-center">
                        <span className="text-gray-400">PDF Preview</span>
                      </div>
                    )}
                  </div>

                  {/* Extraction Summary */}
                  {totalPages > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">Extraction Summary</h4>
                      <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <li>• Method: {getExtractionDescription()}</li>
                        <li>• Pages to extract: {extractedCount} of {totalPages}</li>
                        <li>• Output: {options.outputFormat === 'separate' ? `${extractedCount} separate PDF files` : '1 combined PDF file'}</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Process Button */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <button
                  onClick={handleExtractPages}
                  disabled={!selectedFile || isProcessing || extractedCount === 0}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-md transition-colors flex items-center justify-center"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      Extracting Pages...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5 mr-2" />
                      Extract {extractedCount} Page{extractedCount !== 1 ? 's' : ''}
                    </>
                  )}
                </button>

                {!selectedFile && (
                  <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md">
                    <div className="flex">
                      <AlertCircle className="w-5 h-5 text-yellow-400 mr-2 flex-shrink-0" />
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        Please select a PDF file to extract pages.
                      </p>
                    </div>
                  </div>
                )}

                {extractedCount === 0 && selectedFile && (
                  <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-md">
                    <div className="flex">
                      <AlertCircle className="w-5 h-5 text-orange-400 mr-2 flex-shrink-0" />
                      <p className="text-sm text-orange-700 dark:text-orange-300">
                        No pages selected for extraction. Please adjust your selection criteria.
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

export default ExtractPagesTool