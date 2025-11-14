import React, { useState, useRef } from 'react'
import { Upload, Hash, RefreshCw, AlertCircle, Eye, Zap, AlignCenter, AlignLeft, AlignRight, Settings, Download, Trash2 } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { useJobsStore } from '../../state/jobs'
import { workerManager } from '../../lib/workerManager'

interface PageNumberConfig {
  format: {
    style: 'numeric' | 'roman-upper' | 'roman-lower' | 'alpha-upper' | 'alpha-lower' | 'custom'
    pattern: string // e.g., "Page {n} of {total}", "{n}-{total}"
    startNumber: number
    prefix: string
    suffix: string
  }
  position: {
    location: 'header' | 'footer'
    alignment: 'left' | 'center' | 'right'
    marginX: number // horizontal margin from edge
    marginY: number // vertical margin from edge
  }
  styling: {
    fontSize: number
    fontFamily: string
    color: string
    bold: boolean
    italic: boolean
    underline: boolean
  }
  pageRange: {
    type: 'all' | 'range' | 'odd' | 'even' | 'custom'
    startPage?: number
    endPage?: number
    excludePages?: number[]
    skipFirst?: boolean
    skipLast?: boolean
  }
  advanced: {
    duplicateHandling: 'skip' | 'replace' | 'append'
    numberingStyle: 'continuous' | 'restart-each'
    showOnBlankPages: boolean
  }
}

const FORMAT_STYLES = [
  { id: 'numeric', name: 'Numeric (1, 2, 3)', example: '1, 2, 3' },
  { id: 'roman-upper', name: 'Roman Uppercase (I, II, III)', example: 'I, II, III' },
  { id: 'roman-lower', name: 'Roman Lowercase (i, ii, iii)', example: 'i, ii, iii' },
  { id: 'alpha-upper', name: 'Alpha Uppercase (A, B, C)', example: 'A, B, C' },
  { id: 'alpha-lower', name: 'Alpha Lowercase (a, b, c)', example: 'a, b, c' },
  { id: 'custom', name: 'Custom Pattern', example: 'Page {n} of {total}' }
]

const FONT_FAMILIES = [
  'Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia', 'Tahoma', 'Trebuchet MS'
]

const PRESET_PATTERNS = [
  'Page {n}',
  'Page {n} of {total}',
  '{n} / {total}',
  '{n} - {total}',
  '- {n} -',
  '[{n}]',
  '({n})'
]

const ProfessionalPageNumbersTool: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [totalPages, setTotalPages] = useState(0)
  const [preview, setPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { addFile } = useAppStore()
  const { addJob, updateJob } = useJobsStore()

  const [config, setConfig] = useState<PageNumberConfig>({
    format: {
      style: 'numeric',
      pattern: 'Page {n} of {total}',
      startNumber: 1,
      prefix: '',
      suffix: ''
    },
    position: {
      location: 'footer',
      alignment: 'center',
      marginX: 50,
      marginY: 30
    },
    styling: {
      fontSize: 12,
      fontFamily: 'Arial',
      color: '#000000',
      bold: false,
      italic: false,
      underline: false
    },
    pageRange: {
      type: 'all',
      skipFirst: false,
      skipLast: false
    },
    advanced: {
      duplicateHandling: 'replace',
      numberingStyle: 'continuous',
      showOnBlankPages: true
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

  const formatNumber = (num: number, style: string): string => {
    switch (style) {
      case 'numeric':
        return num.toString()
      case 'roman-upper':
        return toRomanNumerals(num).toUpperCase()
      case 'roman-lower':
        return toRomanNumerals(num).toLowerCase()
      case 'alpha-upper':
        return toAlpha(num).toUpperCase()
      case 'alpha-lower':
        return toAlpha(num).toLowerCase()
      default:
        return num.toString()
    }
  }

  const toRomanNumerals = (num: number): string => {
    const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1]
    const numerals = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I']
    let result = ''
    
    for (let i = 0; i < values.length; i++) {
      while (num >= values[i]) {
        result += numerals[i]
        num -= values[i]
      }
    }
    return result
  }

  const toAlpha = (num: number): string => {
    let result = ''
    while (num > 0) {
      num--
      result = String.fromCharCode(65 + (num % 26)) + result
      num = Math.floor(num / 26)
    }
    return result
  }

  const formatPageNumber = (pageNum: number, total: number): string => {
    if (config.format.style === 'custom') {
      return config.format.pattern
        .replace(/{n}/g, formatNumber(pageNum, 'numeric'))
        .replace(/{total}/g, total.toString())
        .replace(/{N}/g, formatNumber(pageNum, config.format.style))
    }
    
    const formattedNum = formatNumber(pageNum, config.format.style)
    return `${config.format.prefix}${formattedNum}${config.format.suffix}`
  }

  const getPreviewText = (): string => {
    if (!totalPages) return 'Page 1'
    return formatPageNumber(1, totalPages)
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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }

  const handleAddPageNumbers = async () => {
    if (!selectedFile) return

    setIsProcessing(true)
    const jobId = `pagenumbers-${Date.now()}`
    
    try {
      addJob({
        id: jobId,
        type: 'page-numbers',
        name: 'Add page numbers to ' + selectedFile.name,
        status: 'processing',
        fileIds: [selectedFile.name],
        progress: 0,
        startTime: Date.now(),
        cancellable: true
      })

      const arrayBuffer = await selectedFile.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      updateJob(jobId, { progress: 30 })

      // Prepare page number options for the worker
      const pageNumberOptions = {
        position: config.position.alignment,
        fontSize: config.styling.fontSize,
        fontFamily: config.styling.fontFamily,
        color: {
          r: parseInt(config.styling.color.slice(1, 3), 16) / 255,
          g: parseInt(config.styling.color.slice(3, 5), 16) / 255,
          b: parseInt(config.styling.color.slice(5, 7), 16) / 255
        },
        startPage: config.pageRange.startPage || 1,
        startNumber: config.format.startNumber,
        marginX: config.position.marginX,
        marginY: config.position.marginY,
        excludeFirstPage: config.pageRange.skipFirst || false,
        excludeLastPage: config.pageRange.skipLast || false,
        format: config.format.style,
        pattern: config.format.pattern
      }

      updateJob(jobId, { progress: 60 })

      const result = await workerManager.addPageNumbers(uint8Array, pageNumberOptions)
      
      updateJob(jobId, { progress: 90 })

      // Create new file with page numbers
      const numberedFileName = selectedFile.name.replace(/\.pdf$/i, '_numbered.pdf')
      const pdfFile = {
        id: `numbered-${Date.now()}`,
        name: numberedFileName,
        size: result.byteLength,
        type: 'application/pdf',
        lastModified: Date.now(),
        file: new File([new Uint8Array(result)], numberedFileName, { type: 'application/pdf' }),
        pageCount: totalPages,
        data: result
      } as any
      
      addFile(pdfFile)

      updateJob(jobId, {
        status: 'completed',
        progress: 100,
        endTime: Date.now()
      })

      console.log('Page numbers added successfully')

    } catch (error) {
      console.error('Error adding page numbers:', error)
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
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
              <Hash className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Professional Page Numbers</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Advanced page numbering with custom formats and positioning</p>
            </div>
          </div>
          {selectedFile && (
            <button
              onClick={handleAddPageNumbers}
              disabled={isProcessing}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {isProcessing ? 'Processing...' : 'Add Page Numbers'}
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
                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
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
                    <span className="text-base font-medium text-blue-600 hover:text-blue-500">
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

            {/* Selected File */}
            {selectedFile && (
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      {totalPages > 0 && ` • ${totalPages} pages`}
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

          {/* Configuration */}
          <div className="p-6 space-y-8">
            {/* Format Settings */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Number Format</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Numbering Style
                  </label>
                  <select
                    value={config.format.style}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      format: { ...prev.format, style: e.target.value as any }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {FORMAT_STYLES.map(style => (
                      <option key={style.id} value={style.id}>
                        {style.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Example: {FORMAT_STYLES.find(s => s.id === config.format.style)?.example}
                  </p>
                </div>

                {config.format.style === 'custom' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Custom Pattern
                    </label>
                    <input
                      type="text"
                      value={config.format.pattern}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        format: { ...prev.format, pattern: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Use {n} for page number, {total} for total pages"
                    />
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Quick patterns:</p>
                      <div className="flex flex-wrap gap-2">
                        {PRESET_PATTERNS.map(pattern => (
                          <button
                            key={pattern}
                            onClick={() => setConfig(prev => ({
                              ...prev,
                              format: { ...prev.format, pattern }
                            }))}
                            className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                          >
                            {pattern}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Start Number
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={config.format.startNumber}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        format: { ...prev.format, startNumber: parseInt(e.target.value) || 1 }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Prefix
                    </label>
                    <input
                      type="text"
                      value={config.format.prefix}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        format: { ...prev.format, prefix: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="e.g., Page "
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Suffix
                    </label>
                    <input
                      type="text"
                      value={config.format.suffix}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        format: { ...prev.format, suffix: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="e.g., ."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Position Settings */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Position</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Location
                    </label>
                    <select
                      value={config.position.location}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        position: { ...prev.position, location: e.target.value as any }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="header">Header</option>
                      <option value="footer">Footer</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Alignment
                    </label>
                    <div className="flex border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden">
                      <button
                        onClick={() => setConfig(prev => ({
                          ...prev,
                          position: { ...prev.position, alignment: 'left' }
                        }))}
                        className={`flex-1 py-2 px-3 text-center ${
                          config.position.alignment === 'left'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <AlignLeft className="w-4 h-4 mx-auto" />
                      </button>
                      <button
                        onClick={() => setConfig(prev => ({
                          ...prev,
                          position: { ...prev.position, alignment: 'center' }
                        }))}
                        className={`flex-1 py-2 px-3 text-center ${
                          config.position.alignment === 'center'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <AlignCenter className="w-4 h-4 mx-auto" />
                      </button>
                      <button
                        onClick={() => setConfig(prev => ({
                          ...prev,
                          position: { ...prev.position, alignment: 'right' }
                        }))}
                        className={`flex-1 py-2 px-3 text-center ${
                          config.position.alignment === 'right'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <AlignRight className="w-4 h-4 mx-auto" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Horizontal Margin (px)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="200"
                      value={config.position.marginX}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        position: { ...prev.position, marginX: parseInt(e.target.value) || 50 }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Vertical Margin (px)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="200"
                      value={config.position.marginY}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        position: { ...prev.position, marginY: parseInt(e.target.value) || 30 }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Styling Settings */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Styling</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Font Family
                    </label>
                    <select
                      value={config.styling.fontFamily}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        styling: { ...prev.styling, fontFamily: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {FONT_FAMILIES.map(font => (
                        <option key={font} value={font}>{font}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Font Size
                    </label>
                    <input
                      type="number"
                      min="6"
                      max="72"
                      value={config.styling.fontSize}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        styling: { ...prev.styling, fontSize: parseInt(e.target.value) || 12 }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Color
                    </label>
                    <input
                      type="color"
                      value={config.styling.color}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        styling: { ...prev.styling, color: e.target.value }
                      }))}
                      className="w-full h-10 border border-gray-300 dark:border-gray-600 rounded-md"
                    />
                  </div>
                </div>

                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.styling.bold}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        styling: { ...prev.styling, bold: e.target.checked }
                      }))}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Bold</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.styling.italic}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        styling: { ...prev.styling, italic: e.target.checked }
                      }))}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Italic</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.styling.underline}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        styling: { ...prev.styling, underline: e.target.checked }
                      }))}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Underline</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Page Range Settings */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Page Range</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="pageRange"
                      value="all"
                      checked={config.pageRange.type === 'all'}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        pageRange: { ...prev.pageRange, type: 'all' }
                      }))}
                      className="mr-2"
                    />
                    <span className="text-sm">All Pages</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="pageRange"
                      value="odd"
                      checked={config.pageRange.type === 'odd'}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        pageRange: { ...prev.pageRange, type: 'odd' }
                      }))}
                      className="mr-2"
                    />
                    <span className="text-sm">Odd Pages</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="pageRange"
                      value="even"
                      checked={config.pageRange.type === 'even'}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        pageRange: { ...prev.pageRange, type: 'even' }
                      }))}
                      className="mr-2"
                    />
                    <span className="text-sm">Even Pages</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="pageRange"
                      value="range"
                      checked={config.pageRange.type === 'range'}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        pageRange: { ...prev.pageRange, type: 'range' }
                      }))}
                      className="mr-2"
                    />
                    <span className="text-sm">Range</span>
                  </label>
                </div>

                {config.pageRange.type === 'range' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Start Page
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={totalPages || 999}
                        value={config.pageRange.startPage || 1}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          pageRange: { ...prev.pageRange, startPage: parseInt(e.target.value) || 1 }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        End Page
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={totalPages || 999}
                        value={config.pageRange.endPage || totalPages || 1}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          pageRange: { ...prev.pageRange, endPage: parseInt(e.target.value) || totalPages || 1 }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                )}

                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.pageRange.skipFirst || false}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        pageRange: { ...prev.pageRange, skipFirst: e.target.checked }
                      }))}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Skip First Page</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.pageRange.skipLast || false}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        pageRange: { ...prev.pageRange, skipLast: e.target.checked }
                      }))}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Skip Last Page</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        {preview && (
          <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Preview</h3>
            <div className="relative bg-white rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
              <img
                src={preview}
                alt="PDF Preview"
                className="w-full h-auto rounded-lg"
              />
              {/* Preview overlay showing page number position */}
              <div
                className={`absolute text-xs pointer-events-none ${
                  config.position.location === 'header' ? 'top-2' : 'bottom-2'
                } ${
                  config.position.alignment === 'left' ? 'left-2' :
                  config.position.alignment === 'right' ? 'right-2' : 'left-1/2 transform -translate-x-1/2'
                }`}
                style={{
                  color: config.styling.color,
                  fontSize: Math.max(8, config.styling.fontSize / 2),
                  fontFamily: config.styling.fontFamily,
                  fontWeight: config.styling.bold ? 'bold' : 'normal',
                  fontStyle: config.styling.italic ? 'italic' : 'normal',
                  textDecoration: config.styling.underline ? 'underline' : 'none'
                }}
              >
                {getPreviewText()}
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
              <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Preview Text</h4>
              <p className="text-sm text-gray-900 dark:text-gray-100 font-mono bg-gray-50 dark:bg-gray-800 p-2 rounded">
                {getPreviewText()}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProfessionalPageNumbersTool