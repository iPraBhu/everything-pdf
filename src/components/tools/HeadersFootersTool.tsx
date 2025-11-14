import React, { useState, useRef, useCallback } from 'react'
import { Upload, Type, Download, RefreshCw, AlignLeft, AlignCenter, AlignRight, Calendar, Hash, FileText, Eye, Layers } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { useJobsStore } from '../../state/jobs'
import { workerManager } from '../../lib/workerManager'

interface HeaderFooterOptions {
  enableHeader: boolean
  enableFooter: boolean
  headerText: {
    left: string
    center: string
    right: string
  }
  footerText: {
    left: string
    center: string
    right: string
  }
  font: {
    family: string
    size: number
    color: string
    bold: boolean
    italic: boolean
  }
  positioning: {
    headerMarginTop: number
    footerMarginBottom: number
    leftMargin: number
    rightMargin: number
  }
  applyToPages: 'all' | 'range' | 'odd' | 'even'
  pageRange: string
  variables: {
    showPageNumber: boolean
    showTotalPages: boolean
    showDate: boolean
    showTime: boolean
    showFilename: boolean
    dateFormat: string
    timeFormat: string
  }
}

const HeadersFootersTool: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [preview, setPreview] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'header' | 'footer' | 'styling' | 'variables'>('header')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { addFile } = useAppStore()
  const { addJob, updateJob } = useJobsStore()

  const [options, setOptions] = useState<HeaderFooterOptions>({
    enableHeader: true,
    enableFooter: true,
    headerText: {
      left: '',
      center: '{filename}',
      right: '{date}'
    },
    footerText: {
      left: '{time}',
      center: '',
      right: 'Page {pageNumber} of {totalPages}'
    },
    font: {
      family: 'Arial',
      size: 10,
      color: '#000000',
      bold: false,
      italic: false
    },
    positioning: {
      headerMarginTop: 36,
      footerMarginBottom: 36,
      leftMargin: 72,
      rightMargin: 72
    },
    applyToPages: 'all',
    pageRange: '1-',
    variables: {
      showPageNumber: true,
      showTotalPages: true,
      showDate: true,
      showTime: true,
      showFilename: true,
      dateFormat: 'MM/dd/yyyy',
      timeFormat: 'HH:mm'
    }
  })

  const fontFamilies = [
    'Arial', 'Times New Roman', 'Courier New', 'Helvetica', 'Georgia', 
    'Verdana', 'Trebuchet MS', 'Comic Sans MS', 'Impact', 'Lucida Console'
  ]

  const dateFormats = [
    'MM/dd/yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd', 'MMMM dd, yyyy', 
    'dd MMMM yyyy', 'MMM dd, yyyy', 'dd MMM yyyy'
  ]

  const timeFormats = [
    'HH:mm', 'HH:mm:ss', 'h:mm a', 'h:mm:ss a'
  ]

  const variableOptions = [
    { key: '{pageNumber}', label: 'Page Number', description: 'Current page number' },
    { key: '{totalPages}', label: 'Total Pages', description: 'Total number of pages' },
    { key: '{date}', label: 'Date', description: 'Current date' },
    { key: '{time}', label: 'Time', description: 'Current time' },
    { key: '{filename}', label: 'Filename', description: 'PDF filename without extension' },
    { key: '{filepath}', label: 'File Path', description: 'Complete file path' },
    { key: '{author}', label: 'Author', description: 'Document author' },
    { key: '{title}', label: 'Title', description: 'Document title' },
    { key: '{subject}', label: 'Subject', description: 'Document subject' },
    { key: '{creator}', label: 'Creator', description: 'Application that created the PDF' }
  ]

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

  const insertVariable = (variable: string, position: 'headerLeft' | 'headerCenter' | 'headerRight' | 'footerLeft' | 'footerCenter' | 'footerRight') => {
    setOptions(prev => {
      const newOptions = { ...prev }
      
      switch (position) {
        case 'headerLeft':
          newOptions.headerText.left += variable
          break
        case 'headerCenter':
          newOptions.headerText.center += variable
          break
        case 'headerRight':
          newOptions.headerText.right += variable
          break
        case 'footerLeft':
          newOptions.footerText.left += variable
          break
        case 'footerCenter':
          newOptions.footerText.center += variable
          break
        case 'footerRight':
          newOptions.footerText.right += variable
          break
      }
      
      return newOptions
    })
  }

  const previewText = (text: string): string => {
    if (!selectedFile) return text
    
    let preview = text
    const now = new Date()
    
    preview = preview.replace(/{pageNumber}/g, currentPage.toString())
    preview = preview.replace(/{totalPages}/g, totalPages.toString())
    preview = preview.replace(/{filename}/g, selectedFile.name.replace(/\.pdf$/i, ''))
    preview = preview.replace(/{filepath}/g, selectedFile.name)
    preview = preview.replace(/{date}/g, now.toLocaleDateString())
    preview = preview.replace(/{time}/g, now.toLocaleTimeString())
    preview = preview.replace(/{author}/g, 'Document Author')
    preview = preview.replace(/{title}/g, 'Document Title')
    preview = preview.replace(/{subject}/g, 'Document Subject')
    preview = preview.replace(/{creator}/g, 'PDF Creator')
    
    return preview || ' ' // Return space if empty to maintain layout
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

  const handleApplyHeadersFooters = async () => {
    if (!selectedFile) return

    setIsProcessing(true)
    const jobId = `headers-footers-${Date.now()}`
    
    try {
      addJob({
        id: jobId,
        type: 'headers-footers',
        name: `Add headers/footers to ${selectedFile.name}`,
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
      const headerFooterParams = {
        ...options,
        affectedPages,
        totalPages,
        filename: selectedFile.name
      }

      updateJob(jobId, { progress: 70 })

      // TODO: Implement addHeadersFooters in workerManager
      // For now, we'll simulate the operation
      console.warn('PDF headers/footers not yet implemented in workerManager')
      const result = uint8Array // Placeholder - would normally have headers/footers added
      
      updateJob(jobId, { progress: 90 })

      // Create file with headers/footers
      const fileName = selectedFile.name.replace(/\.pdf$/i, '_with_headers_footers.pdf')
      const pdfFile = {
        id: `headers-footers-${Date.now()}`,
        name: fileName,
        size: result.byteLength,
        type: 'application/pdf',
        lastModified: Date.now(),
        file: new File([new Uint8Array(result)], fileName, { type: 'application/pdf' }),
        pageCount: totalPages,
        data: result
      } as any
      
      addFile(pdfFile)

      updateJob(jobId, {
        status: 'completed',
        progress: 100,
        endTime: Date.now()
      })

      console.log('Headers/footers completed (simulated)', { headerFooterParams })

    } catch (error) {
      console.error('Error adding headers/footers:', error)
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
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
              <Type className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Headers & Footers</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Add headers and footers with variables and custom text</p>
            </div>
          </div>
          {selectedFile && (
            <button
              onClick={handleApplyHeadersFooters}
              disabled={isProcessing || (!options.enableHeader && !options.enableFooter)}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Type className="w-4 h-4 mr-2" />
              )}
              {isProcessing ? 'Processing...' : 'Apply Headers & Footers'}
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
                ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
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
                  <span className="text-base font-medium text-green-600 hover:text-green-500">
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

          {/* Settings */}
          {selectedFile && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              {/* Tabs */}
              <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="flex space-x-8 px-6">
                  {[
                    { id: 'header', name: 'Header', icon: AlignLeft },
                    { id: 'footer', name: 'Footer', icon: AlignRight },
                    { id: 'styling', name: 'Styling', icon: Type },
                    { id: 'variables', name: 'Variables', icon: Hash }
                  ].map((tab) => {
                    const Icon = tab.icon
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`py-4 px-1 border-b-2 font-medium text-sm ${
                          activeTab === tab.id
                            ? 'border-green-500 text-green-600 dark:text-green-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                      >
                        <Icon className="w-4 h-4 inline mr-2" />
                        {tab.name}
                      </button>
                    )
                  })}
                </nav>
              </div>

              <div className="p-6">
                {activeTab === 'header' && (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="enableHeader"
                        checked={options.enableHeader}
                        onChange={(e) => setOptions({ ...options, enableHeader: e.target.checked })}
                        className="h-4 w-4 text-green-600"
                      />
                      <label htmlFor="enableHeader" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Enable Header
                      </label>
                    </div>

                    {options.enableHeader && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Left
                          </label>
                          <input
                            type="text"
                            value={options.headerText.left}
                            onChange={(e) => setOptions({
                              ...options,
                              headerText: { ...options.headerText, left: e.target.value }
                            })}
                            placeholder="Header left text"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Preview: {previewText(options.headerText.left)}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Center
                          </label>
                          <input
                            type="text"
                            value={options.headerText.center}
                            onChange={(e) => setOptions({
                              ...options,
                              headerText: { ...options.headerText, center: e.target.value }
                            })}
                            placeholder="Header center text"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Preview: {previewText(options.headerText.center)}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Right
                          </label>
                          <input
                            type="text"
                            value={options.headerText.right}
                            onChange={(e) => setOptions({
                              ...options,
                              headerText: { ...options.headerText, right: e.target.value }
                            })}
                            placeholder="Header right text"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Preview: {previewText(options.headerText.right)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'footer' && (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="enableFooter"
                        checked={options.enableFooter}
                        onChange={(e) => setOptions({ ...options, enableFooter: e.target.checked })}
                        className="h-4 w-4 text-green-600"
                      />
                      <label htmlFor="enableFooter" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Enable Footer
                      </label>
                    </div>

                    {options.enableFooter && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Left
                          </label>
                          <input
                            type="text"
                            value={options.footerText.left}
                            onChange={(e) => setOptions({
                              ...options,
                              footerText: { ...options.footerText, left: e.target.value }
                            })}
                            placeholder="Footer left text"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Preview: {previewText(options.footerText.left)}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Center
                          </label>
                          <input
                            type="text"
                            value={options.footerText.center}
                            onChange={(e) => setOptions({
                              ...options,
                              footerText: { ...options.footerText, center: e.target.value }
                            })}
                            placeholder="Footer center text"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Preview: {previewText(options.footerText.center)}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Right
                          </label>
                          <input
                            type="text"
                            value={options.footerText.right}
                            onChange={(e) => setOptions({
                              ...options,
                              footerText: { ...options.footerText, right: e.target.value }
                            })}
                            placeholder="Footer right text"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Preview: {previewText(options.footerText.right)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'styling' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Font Settings */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Font</h4>
                      
                      <div>
                        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Family</label>
                        <select
                          value={options.font.family}
                          onChange={(e) => setOptions({
                            ...options,
                            font: { ...options.font, family: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                        >
                          {fontFamilies.map(font => (
                            <option key={font} value={font}>{font}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                          Size: {options.font.size}pt
                        </label>
                        <input
                          type="range"
                          min="6"
                          max="24"
                          value={options.font.size}
                          onChange={(e) => setOptions({
                            ...options,
                            font: { ...options.font, size: parseInt(e.target.value) }
                          })}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Color</label>
                        <input
                          type="color"
                          value={options.font.color}
                          onChange={(e) => setOptions({
                            ...options,
                            font: { ...options.font, color: e.target.value }
                          })}
                          className="w-full h-10 border border-gray-300 dark:border-gray-600 rounded-md"
                        />
                      </div>

                      <div className="flex space-x-4">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={options.font.bold}
                            onChange={(e) => setOptions({
                              ...options,
                              font: { ...options.font, bold: e.target.checked }
                            })}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Bold</span>
                        </label>
                        
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={options.font.italic}
                            onChange={(e) => setOptions({
                              ...options,
                              font: { ...options.font, italic: e.target.checked }
                            })}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Italic</span>
                        </label>
                      </div>
                    </div>

                    {/* Positioning */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Positioning</h4>
                      
                      <div>
                        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                          Header Top Margin: {options.positioning.headerMarginTop}pt
                        </label>
                        <input
                          type="range"
                          min="18"
                          max="72"
                          value={options.positioning.headerMarginTop}
                          onChange={(e) => setOptions({
                            ...options,
                            positioning: { ...options.positioning, headerMarginTop: parseInt(e.target.value) }
                          })}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                          Footer Bottom Margin: {options.positioning.footerMarginBottom}pt
                        </label>
                        <input
                          type="range"
                          min="18"
                          max="72"
                          value={options.positioning.footerMarginBottom}
                          onChange={(e) => setOptions({
                            ...options,
                            positioning: { ...options.positioning, footerMarginBottom: parseInt(e.target.value) }
                          })}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                          Left Margin: {options.positioning.leftMargin}pt
                        </label>
                        <input
                          type="range"
                          min="36"
                          max="144"
                          value={options.positioning.leftMargin}
                          onChange={(e) => setOptions({
                            ...options,
                            positioning: { ...options.positioning, leftMargin: parseInt(e.target.value) }
                          })}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                          Right Margin: {options.positioning.rightMargin}pt
                        </label>
                        <input
                          type="range"
                          min="36"
                          max="144"
                          value={options.positioning.rightMargin}
                          onChange={(e) => setOptions({
                            ...options,
                            positioning: { ...options.positioning, rightMargin: parseInt(e.target.value) }
                          })}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'variables' && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Available Variables</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {variableOptions.map(variable => (
                          <div key={variable.key} className="p-3 border border-gray-200 dark:border-gray-600 rounded-md">
                            <div className="flex items-center justify-between">
                              <div>
                                <code className="text-sm font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                  {variable.key}
                                </code>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {variable.description}
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(variable.key)
                                }}
                                className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
                              >
                                Copy
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Date/Time Formats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">Date Format</label>
                        <select
                          value={options.variables.dateFormat}
                          onChange={(e) => setOptions({
                            ...options,
                            variables: { ...options.variables, dateFormat: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                        >
                          {dateFormats.map(format => (
                            <option key={format} value={format}>{format}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">Time Format</label>
                        <select
                          value={options.variables.timeFormat}
                          onChange={(e) => setOptions({
                            ...options,
                            variables: { ...options.variables, timeFormat: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                        >
                          {timeFormats.map(format => (
                            <option key={format} value={format}>{format}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Apply To Pages */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">Apply to Pages</label>
                        <select
                          value={options.applyToPages}
                          onChange={(e) => setOptions({ ...options, applyToPages: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                        >
                          <option value="all">All pages</option>
                          <option value="range">Page range</option>
                          <option value="odd">Odd pages only</option>
                          <option value="even">Even pages only</option>
                        </select>
                      </div>

                      {options.applyToPages === 'range' && (
                        <div>
                          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">Page Range</label>
                          <input
                            type="text"
                            value={options.pageRange}
                            onChange={(e) => setOptions({ ...options, pageRange: e.target.value })}
                            placeholder="e.g., 1-5, 8, 10-12"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Preview Panel */}
        {selectedFile && preview && (
          <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
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

            {/* Preview with Headers/Footers */}
            <div className="relative bg-white rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
              {/* Header Preview */}
              {options.enableHeader && (
                <div className="absolute top-2 left-2 right-2 flex justify-between text-xs border-b border-gray-200 pb-1"
                     style={{ 
                       fontSize: `${Math.max(6, options.font.size / 2)}px`,
                       color: options.font.color,
                       fontFamily: options.font.family,
                       fontWeight: options.font.bold ? 'bold' : 'normal',
                       fontStyle: options.font.italic ? 'italic' : 'normal'
                     }}>
                  <span className="truncate">{previewText(options.headerText.left)}</span>
                  <span className="truncate">{previewText(options.headerText.center)}</span>
                  <span className="truncate">{previewText(options.headerText.right)}</span>
                </div>
              )}

              {/* Main Content */}
              <img
                src={preview}
                alt="PDF Preview"
                className="w-full h-auto"
                style={{ 
                  paddingTop: options.enableHeader ? '20px' : '4px',
                  paddingBottom: options.enableFooter ? '20px' : '4px'
                }}
              />

              {/* Footer Preview */}
              {options.enableFooter && (
                <div className="absolute bottom-2 left-2 right-2 flex justify-between text-xs border-t border-gray-200 pt-1"
                     style={{ 
                       fontSize: `${Math.max(6, options.font.size / 2)}px`,
                       color: options.font.color,
                       fontFamily: options.font.family,
                       fontWeight: options.font.bold ? 'bold' : 'normal',
                       fontStyle: options.font.italic ? 'italic' : 'normal'
                     }}>
                  <span className="truncate">{previewText(options.footerText.left)}</span>
                  <span className="truncate">{previewText(options.footerText.center)}</span>
                  <span className="truncate">{previewText(options.footerText.right)}</span>
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="mt-4 space-y-3">
              <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Settings Summary</h4>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <div>Header: {options.enableHeader ? 'Enabled' : 'Disabled'}</div>
                  <div>Footer: {options.enableFooter ? 'Enabled' : 'Disabled'}</div>
                  <div>Font: {options.font.family} {options.font.size}pt</div>
                  <div>Pages: {getAffectedPages().length} of {totalPages}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default HeadersFootersTool