import React, { useState, useRef } from 'react'
import { Upload, Hash, Download, Settings, Eye, AlertCircle, RefreshCw } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { useJobsStore } from '../../state/jobs'
import { workerManager } from '../../lib/workerManager'

interface PageNumberOptions {
  position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
  format: 'number' | 'page-of-total' | 'custom'
  customFormat: string
  fontSize: number
  fontFamily: string
  fontColor: string
  startPage: number
  startNumber: number
  marginX: number
  marginY: number
  excludeFirstPage: boolean
  excludeLastPage: boolean
}

const PageNumbersTool: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [options, setOptions] = useState<PageNumberOptions>({
    position: 'bottom-center',
    format: 'number',
    customFormat: 'Page {page} of {total}',
    fontSize: 12,
    fontFamily: 'Arial',
    fontColor: '#000000',
    startPage: 1,
    startNumber: 1,
    marginX: 50,
    marginY: 50,
    excludeFirstPage: false,
    excludeLastPage: false
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

  const formatPreviewText = () => {
    const { format, customFormat, startNumber } = options
    const currentPage = Math.max(1, startNumber)
    
    switch (format) {
      case 'number':
        return currentPage.toString()
      case 'page-of-total':
        return `Page ${currentPage} of ${totalPages || 5}`
      case 'custom':
        return customFormat
          .replace('{page}', currentPage.toString())
          .replace('{total}', (totalPages || 5).toString())
      default:
        return currentPage.toString()
    }
  }

  const handleAddPageNumbers = async () => {
    if (!selectedFile) return

    setIsProcessing(true)
    
    try {
      const arrayBuffer = await selectedFile.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      
      const jobId = `page-numbers-${Date.now()}`
      addJob({
        id: jobId,
        type: 'page-numbers',
        name: 'Add Page Numbers',
        status: 'running',
        progress: { current: 0, total: 100, message: 'Adding page numbers...' },
        startTime: Date.now(),
        cancellable: true,
        fileIds: [selectedFile.name]
      })

      // Prepare page number options for worker
      const pageNumberOptions = {
        position: options.position,
        format: options.format,
        customFormat: options.customFormat,
        fontSize: options.fontSize,
        fontColor: {
          r: parseInt(options.fontColor.slice(1, 3), 16) / 255,
          g: parseInt(options.fontColor.slice(3, 5), 16) / 255,
          b: parseInt(options.fontColor.slice(5, 7), 16) / 255
        },
        startPage: options.startPage,
        startNumber: options.startNumber,
        marginX: options.marginX,
        marginY: options.marginY,
        excludeFirstPage: options.excludeFirstPage,
        excludeLastPage: options.excludeLastPage
      }

      const result = await workerManager.addPageNumbers(uint8Array, pageNumberOptions)
      
      // Create new file with page numbers
      const blob = new Blob([new Uint8Array(result)], { type: 'application/pdf' })
      const fileName = selectedFile.name.replace(/\.pdf$/i, '_numbered.pdf')
      
      addFile({
        id: `page-numbers-${Date.now()}`,
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
        progress: { current: 100, total: 100, message: 'Page numbers added' },
        endTime: Date.now()
      })

    } catch (error) {
      console.error('Error adding page numbers:', error)
      updateJob(`page-numbers-error-${Date.now()}`, {
        status: 'failed',
        progress: { current: 0, total: 100, message: 'Failed to add page numbers' },
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
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
            <Hash className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Add Page Numbers</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Add customizable page numbers to your PDF</p>
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
                        <Hash className="w-5 h-5 text-red-600 dark:text-red-400" />
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

              {/* Page Number Options */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  Page Number Options
                </h3>
                
                <div className="space-y-4">
                  {/* Position */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Position
                    </label>
                    <select
                      value={options.position}
                      onChange={(e) => setOptions({ ...options, position: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="top-left">Top Left</option>
                      <option value="top-center">Top Center</option>
                      <option value="top-right">Top Right</option>
                      <option value="bottom-left">Bottom Left</option>
                      <option value="bottom-center">Bottom Center</option>
                      <option value="bottom-right">Bottom Right</option>
                    </select>
                  </div>

                  {/* Format */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Format
                    </label>
                    <select
                      value={options.format}
                      onChange={(e) => setOptions({ ...options, format: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="number">Page Number Only</option>
                      <option value="page-of-total">Page X of Y</option>
                      <option value="custom">Custom Format</option>
                    </select>
                  </div>

                  {/* Custom Format */}
                  {options.format === 'custom' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Custom Format
                      </label>
                      <input
                        type="text"
                        value={options.customFormat}
                        onChange={(e) => setOptions({ ...options, customFormat: e.target.value })}
                        placeholder="Page {page} of {total}"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Use {'{page}'} for current page and {'{total}'} for total pages
                      </p>
                    </div>
                  )}

                  {/* Font Settings */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Font Size
                      </label>
                      <input
                        type="number"
                        min="8"
                        max="72"
                        value={options.fontSize}
                        onChange={(e) => setOptions({ ...options, fontSize: parseInt(e.target.value) || 12 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Font Color
                      </label>
                      <input
                        type="color"
                        value={options.fontColor}
                        onChange={(e) => setOptions({ ...options, fontColor: e.target.value })}
                        className="w-full h-10 border border-gray-300 dark:border-gray-600 rounded-md"
                      />
                    </div>
                  </div>

                  {/* Start Settings */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Start Page
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={options.startPage}
                        onChange={(e) => setOptions({ ...options, startPage: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Start Number
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={options.startNumber}
                        onChange={(e) => setOptions({ ...options, startNumber: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Margins */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Horizontal Margin (px)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={options.marginX}
                        onChange={(e) => setOptions({ ...options, marginX: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Vertical Margin (px)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={options.marginY}
                        onChange={(e) => setOptions({ ...options, marginY: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Exclusions */}
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={options.excludeFirstPage}
                        onChange={(e) => setOptions({ ...options, excludeFirstPage: e.target.checked })}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Exclude first page
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={options.excludeLastPage}
                        onChange={(e) => setOptions({ ...options, excludeLastPage: e.target.checked })}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Exclude last page
                      </span>
                    </label>
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
                  {/* Text Preview */}
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Page Number Text:</p>
                    <div 
                      className="inline-block px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded border"
                      style={{ 
                        fontSize: `${options.fontSize}px`,
                        fontFamily: options.fontFamily,
                        color: options.fontColor
                      }}
                    >
                      {formatPreviewText()}
                    </div>
                  </div>

                  {/* Position Preview */}
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Position Preview:</p>
                    <div className="relative w-full h-64 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded overflow-hidden">
                      {preview ? (
                        <img 
                          src={preview} 
                          alt="PDF Preview" 
                          className="w-full h-full object-contain rounded"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">
                          PDF Preview
                        </div>
                      )}
                      
                      {/* Position indicator */}
                      <div
                        className={`absolute text-xs bg-blue-600 text-white px-2 py-1 rounded ${
                          options.position.includes('top') ? 'top-2' : 'bottom-2'
                        } ${
                          options.position.includes('left') ? 'left-2' :
                          options.position.includes('right') ? 'right-2' : 'left-1/2 transform -translate-x-1/2'
                        }`}
                        style={{
                          marginLeft: options.position.includes('center') ? 0 : `${options.marginX / 5}px`,
                          marginRight: options.position.includes('center') ? 0 : `${options.marginX / 5}px`,
                          marginTop: options.position.includes('top') ? `${options.marginY / 5}px` : 0,
                          marginBottom: options.position.includes('bottom') ? `${options.marginY / 5}px` : 0,
                        }}
                      >
                        {formatPreviewText()}
                      </div>
                    </div>
                  </div>

                  {/* Options Summary */}
                  {totalPages > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">Page Numbers Summary</h4>
                      <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <li>• Format: {options.format === 'number' ? 'Numbers only' : options.format === 'page-of-total' ? 'Page X of Y' : 'Custom format'}</li>
                        <li>• Position: {options.position.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</li>
                        <li>• Font size: {options.fontSize}px</li>
                        <li>• Start from page {options.startPage} with number {options.startNumber}</li>
                        {(options.excludeFirstPage || options.excludeLastPage) && (
                          <li>• Exclusions: {[options.excludeFirstPage && 'first page', options.excludeLastPage && 'last page'].filter(Boolean).join(', ')}</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Process Button */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <button
                  onClick={handleAddPageNumbers}
                  disabled={!selectedFile || isProcessing}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-md transition-colors flex items-center justify-center"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      Adding Page Numbers...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5 mr-2" />
                      Add Page Numbers
                    </>
                  )}
                </button>

                {!selectedFile && (
                  <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md">
                    <div className="flex">
                      <AlertCircle className="w-5 h-5 text-yellow-400 mr-2 flex-shrink-0" />
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        Please select a PDF file to add page numbers.
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

export default PageNumbersTool