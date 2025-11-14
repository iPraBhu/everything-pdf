import React, { useState, useRef } from 'react'
import { Upload, Scissors, RefreshCw, AlertCircle, Eye, Download, Settings, Bookmark, Hash, Target, Layers, Search, FileText, Trash2, Plus } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { useJobsStore } from '../../state/jobs'
import { workerManager } from '../../lib/workerManager'

interface ExtractionRule {
  id: string
  name: string
  type: 'bookmark' | 'pattern' | 'range' | 'interval'
  enabled: boolean
  config: any
}

interface ExtractionConfig {
  method: 'smart' | 'rules' | 'manual'
  outputFormat: 'separate' | 'combined' | 'both'
  rules: ExtractionRule[]
  manualPages: string
  smartOptions: {
    useBookmarks: boolean
    detectChapters: boolean
    detectBlankPages: boolean
    minPagesPerSection: number
  }
  naming: {
    pattern: string // e.g., "{original}_{section}", "Chapter_{n}", "Section_{start}-{end}"
    includePageNumbers: boolean
    paddingZeros: boolean
  }
  advanced: {
    preserveBookmarks: boolean
    preserveLinks: boolean
    preserveAnnotations: boolean
    optimizeSize: boolean
  }
}

const EXTRACTION_PATTERNS = [
  { id: 'chapters', name: 'Chapter Headings', pattern: '^Chapter\\s+\\d+', description: 'Extract by chapter markers' },
  { id: 'sections', name: 'Section Headers', pattern: '^\\d+\\.\\s+', description: 'Extract by numbered sections' },
  { id: 'blank-separation', name: 'Blank Page Breaks', pattern: '', description: 'Split at blank pages' },
  { id: 'page-count', name: 'Fixed Page Count', pattern: '', description: 'Split every N pages' }
]

const NAMING_PATTERNS = [
  '{original}_{section}',
  'Chapter_{n}',
  'Section_{start}-{end}',
  '{original}_Part_{n}',
  'Extract_{timestamp}_{n}'
]

const AdvancedPageExtractionTool: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [totalPages, setTotalPages] = useState(0)
  const [bookmarks, setBookmarks] = useState<any[]>([])
  const [preview, setPreview] = useState<string | null>(null)
  const [extractionResults, setExtractionResults] = useState<any[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { addFile } = useAppStore()
  const { addJob, updateJob } = useJobsStore()

  const [config, setConfig] = useState<ExtractionConfig>({
    method: 'smart',
    outputFormat: 'separate',
    rules: [],
    manualPages: '',
    smartOptions: {
      useBookmarks: true,
      detectChapters: true,
      detectBlankPages: false,
      minPagesPerSection: 2
    },
    naming: {
      pattern: '{original}_{section}',
      includePageNumbers: true,
      paddingZeros: true
    },
    advanced: {
      preserveBookmarks: true,
      preserveLinks: true,
      preserveAnnotations: false,
      optimizeSize: false
    }
  })

  const handleFileSelect = async (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file')
      return
    }

    setSelectedFile(file)
    setPreview(null)
    setBookmarks([])
    setExtractionResults([])
    await generatePreview(file)
    await analyzePDF(file)
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

  const analyzePDF = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      const { loadPDFDocument } = await import('../../lib/pdf')
      const doc = await loadPDFDocument(uint8Array)
      
      setTotalPages(doc.numPages)
      
      // Try to extract bookmarks (outline)
      try {
        const outline = await doc.getOutline()
        if (outline) {
          setBookmarks(outline)
        }
      } catch (error) {
        console.log('No bookmarks found')
      }
    } catch (error) {
      console.error('Error analyzing PDF:', error)
    }
  }

  const addExtractionRule = (patternType: string) => {
    const pattern = EXTRACTION_PATTERNS.find(p => p.id === patternType)
    if (!pattern) return

    const newRule: ExtractionRule = {
      id: Date.now().toString(),
      name: pattern.name,
      type: 'pattern',
      enabled: true,
      config: {
        pattern: pattern.pattern,
        description: pattern.description
      }
    }

    setConfig(prev => ({
      ...prev,
      rules: [...prev.rules, newRule]
    }))
  }

  const removeRule = (ruleId: string) => {
    setConfig(prev => ({
      ...prev,
      rules: prev.rules.filter(rule => rule.id !== ruleId)
    }))
  }

  const updateRule = (ruleId: string, updates: Partial<ExtractionRule>) => {
    setConfig(prev => ({
      ...prev,
      rules: prev.rules.map(rule =>
        rule.id === ruleId ? { ...rule, ...updates } : rule
      )
    }))
  }

  const detectSmartExtractionPoints = (): Array<{start: number, end: number, title: string}> => {
    const sections = []
    
    // Use bookmarks if available and enabled
    if (config.smartOptions.useBookmarks && bookmarks.length > 0) {
      for (let i = 0; i < bookmarks.length; i++) {
        const bookmark = bookmarks[i]
        const nextBookmark = bookmarks[i + 1]
        
        const startPage = Math.max(1, bookmark.dest ? (bookmark.dest.pageNumber || 1) : 1)
        const endPage = nextBookmark 
          ? Math.min(totalPages, (nextBookmark.dest?.pageNumber || totalPages) - 1)
          : totalPages
        
        if (endPage - startPage + 1 >= config.smartOptions.minPagesPerSection) {
          sections.push({
            start: startPage,
            end: endPage,
            title: bookmark.title || `Section ${i + 1}`
          })
        }
      }
    }
    
    // If no bookmark sections found, create equal-sized sections
    if (sections.length === 0) {
      const sectionSize = Math.max(config.smartOptions.minPagesPerSection, Math.ceil(totalPages / 5))
      let currentPage = 1
      let sectionNumber = 1
      
      while (currentPage <= totalPages) {
        const endPage = Math.min(currentPage + sectionSize - 1, totalPages)
        sections.push({
          start: currentPage,
          end: endPage,
          title: `Section ${sectionNumber}`
        })
        currentPage = endPage + 1
        sectionNumber++
      }
    }
    
    return sections
  }

  const parseManualPages = (pageString: string): Array<{start: number, end: number, title: string}> => {
    const sections = []
    const ranges = pageString.split(',').map(s => s.trim()).filter(s => s)
    
    for (let i = 0; i < ranges.length; i++) {
      const range = ranges[i]
      if (range.includes('-')) {
        const [start, end] = range.split('-').map(s => parseInt(s.trim()))
        if (start && end && start <= end && start >= 1 && end <= totalPages) {
          sections.push({
            start,
            end,
            title: `Pages ${start}-${end}`
          })
        }
      } else {
        const pageNum = parseInt(range)
        if (pageNum && pageNum >= 1 && pageNum <= totalPages) {
          sections.push({
            start: pageNum,
            end: pageNum,
            title: `Page ${pageNum}`
          })
        }
      }
    }
    
    return sections
  }

  const generateFileName = (section: {start: number, end: number, title: string}, index: number): string => {
    const originalName = selectedFile?.name.replace(/\.pdf$/i, '') || 'document'
    const timestamp = new Date().toISOString().slice(0, 10)
    
    return config.naming.pattern
      .replace(/{original}/g, originalName)
      .replace(/{section}/g, section.title.replace(/[^a-zA-Z0-9]/g, '_'))
      .replace(/{n}/g, config.naming.paddingZeros ? String(index + 1).padStart(2, '0') : String(index + 1))
      .replace(/{start}/g, String(section.start))
      .replace(/{end}/g, String(section.end))
      .replace(/{timestamp}/g, timestamp) + '.pdf'
  }

  const handleExtraction = async () => {
    if (!selectedFile) return

    setIsProcessing(true)
    const jobId = `extraction-${Date.now()}`
    
    try {
      addJob({
        id: jobId,
        type: 'extract',
        name: `Extract from ${selectedFile.name}`,
        status: 'processing',
        fileIds: [selectedFile.name],
        progress: 0,
        startTime: Date.now(),
        cancellable: true
      })

      const arrayBuffer = await selectedFile.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      updateJob(jobId, { progress: 20 })

      // Determine extraction sections based on method
      let sections: Array<{start: number, end: number, title: string}> = []
      
      switch (config.method) {
        case 'smart':
          sections = detectSmartExtractionPoints()
          break
        case 'manual':
          sections = parseManualPages(config.manualPages)
          break
        case 'rules':
          // For now, fall back to smart extraction
          // In a full implementation, this would analyze content patterns
          sections = detectSmartExtractionPoints()
          break
      }

      if (sections.length === 0) {
        throw new Error('No valid extraction sections found')
      }

      updateJob(jobId, { progress: 40 })

      const results = []
      
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i]
        
        // Extract pages (convert to 0-based indexing)
        const pageIndices = []
        for (let page = section.start; page <= section.end; page++) {
          pageIndices.push(page - 1)
        }
        
        updateJob(jobId, { progress: 40 + (i / sections.length) * 50 })
        
        const extractedPDF = await workerManager.extractPages(uint8Array, pageIndices)
        
        const fileName = generateFileName(section, i)
        const pdfFile = {
          id: `extract-${Date.now()}-${i}`,
          name: fileName,
          size: extractedPDF.byteLength,
          type: 'application/pdf',
          lastModified: Date.now(),
          file: new File([new Uint8Array(extractedPDF)], fileName, { type: 'application/pdf' }),
          pageCount: pageIndices.length,
          data: extractedPDF
        } as any
        
        addFile(pdfFile)
        results.push({
          section,
          fileName,
          pageCount: pageIndices.length,
          size: extractedPDF.byteLength
        })
      }

      setExtractionResults(results)

      updateJob(jobId, {
        status: 'completed',
        progress: 100,
        endTime: Date.now()
      })

      console.log(`Successfully extracted ${results.length} sections`)

    } catch (error) {
      console.error('Error extracting pages:', error)
      updateJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        endTime: Date.now()
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const previewExtractionSections = () => {
    switch (config.method) {
      case 'smart':
        return detectSmartExtractionPoints()
      case 'manual':
        return parseManualPages(config.manualPages)
      case 'rules':
        return detectSmartExtractionPoints() // Simplified for now
      default:
        return []
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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

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
              <Scissors className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Advanced Page Extraction</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Intelligent page extraction using bookmarks, patterns, and ranges</p>
            </div>
          </div>
          {selectedFile && (
            <button
              onClick={handleExtraction}
              disabled={isProcessing || !previewExtractionSections().length}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {isProcessing ? 'Processing...' : 'Extract Sections'}
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

            {/* Selected File Info */}
            {selectedFile && (
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{selectedFile.name}</p>
                    <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                      <span>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                      {totalPages > 0 && <span>{totalPages} pages</span>}
                      {bookmarks.length > 0 && <span>{bookmarks.length} bookmarks</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedFile(null)
                      setPreview(null)
                      setBookmarks([])
                      setTotalPages(0)
                      setExtractionResults([])
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
          {selectedFile && (
            <div className="p-6 space-y-8">
              {/* Extraction Method */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Extraction Method</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <label className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    config.method === 'smart' 
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                  }`}>
                    <input
                      type="radio"
                      name="method"
                      value="smart"
                      checked={config.method === 'smart'}
                      onChange={(e) => setConfig(prev => ({ ...prev, method: 'smart' }))}
                      className="mr-3"
                    />
                    <div>
                      <div className="flex items-center mb-2">
                        <Target className="w-5 h-5 mr-2 text-green-600" />
                        <span className="font-medium text-gray-900 dark:text-gray-100">Smart Detection</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Automatically detect sections using bookmarks and content analysis
                      </p>
                    </div>
                  </label>

                  <label className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    config.method === 'rules' 
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                  }`}>
                    <input
                      type="radio"
                      name="method"
                      value="rules"
                      checked={config.method === 'rules'}
                      onChange={(e) => setConfig(prev => ({ ...prev, method: 'rules' }))}
                      className="mr-3"
                    />
                    <div>
                      <div className="flex items-center mb-2">
                        <Search className="w-5 h-5 mr-2 text-blue-600" />
                        <span className="font-medium text-gray-900 dark:text-gray-100">Pattern Rules</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Use custom patterns to identify section boundaries
                      </p>
                    </div>
                  </label>

                  <label className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    config.method === 'manual' 
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                  }`}>
                    <input
                      type="radio"
                      name="method"
                      value="manual"
                      checked={config.method === 'manual'}
                      onChange={(e) => setConfig(prev => ({ ...prev, method: 'manual' }))}
                      className="mr-3"
                    />
                    <div>
                      <div className="flex items-center mb-2">
                        <Hash className="w-5 h-5 mr-2 text-purple-600" />
                        <span className="font-medium text-gray-900 dark:text-gray-100">Manual Pages</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Specify exact page ranges or individual pages
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Smart Options */}
              {config.method === 'smart' && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Smart Detection Settings</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={config.smartOptions.useBookmarks}
                            onChange={(e) => setConfig(prev => ({
                              ...prev,
                              smartOptions: { ...prev.smartOptions, useBookmarks: e.target.checked }
                            }))}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Use bookmarks/outline</span>
                          {bookmarks.length > 0 && (
                            <span className="ml-2 text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                              {bookmarks.length} found
                            </span>
                          )}
                        </label>
                        
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={config.smartOptions.detectChapters}
                            onChange={(e) => setConfig(prev => ({
                              ...prev,
                              smartOptions: { ...prev.smartOptions, detectChapters: e.target.checked }
                            }))}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Detect chapter headers</span>
                        </label>
                        
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={config.smartOptions.detectBlankPages}
                            onChange={(e) => setConfig(prev => ({
                              ...prev,
                              smartOptions: { ...prev.smartOptions, detectBlankPages: e.target.checked }
                            }))}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Use blank pages as separators</span>
                        </label>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Minimum pages per section
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={config.smartOptions.minPagesPerSection}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            smartOptions: { ...prev.smartOptions, minPagesPerSection: parseInt(e.target.value) || 2 }
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Manual Pages Input */}
              {config.method === 'manual' && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Manual Page Specification</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Page ranges (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={config.manualPages}
                        onChange={(e) => setConfig(prev => ({ ...prev, manualPages: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="e.g., 1-5, 10-15, 20, 25-30"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Examples: "1-10" (range), "5,8,12" (individual), "1-5,10-15" (mixed)
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Pattern Rules */}
              {config.method === 'rules' && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Pattern Rules</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Add extraction patterns
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {EXTRACTION_PATTERNS.map(pattern => (
                          <button
                            key={pattern.id}
                            onClick={() => addExtractionRule(pattern.id)}
                            className="flex items-center justify-between p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
                          >
                            <div>
                              <span className="font-medium text-gray-900 dark:text-gray-100">{pattern.name}</span>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{pattern.description}</p>
                            </div>
                            <Plus className="w-4 h-4 text-gray-400" />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Active Rules */}
                    {config.rules.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Active Rules</h4>
                        <div className="space-y-2">
                          {config.rules.map(rule => (
                            <div key={rule.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={rule.enabled}
                                  onChange={(e) => updateRule(rule.id, { enabled: e.target.checked })}
                                  className="mr-3"
                                />
                                <div>
                                  <span className="font-medium text-gray-900 dark:text-gray-100">{rule.name}</span>
                                  {rule.config.pattern && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{rule.config.pattern}</p>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => removeRule(rule.id)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Naming Convention */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">File Naming</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Naming pattern
                    </label>
                    <input
                      type="text"
                      value={config.naming.pattern}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        naming: { ...prev.naming, pattern: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="e.g., {original}_{section}"
                    />
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Quick patterns:</p>
                      <div className="flex flex-wrap gap-2">
                        {NAMING_PATTERNS.map(pattern => (
                          <button
                            key={pattern}
                            onClick={() => setConfig(prev => ({
                              ...prev,
                              naming: { ...prev.naming, pattern }
                            }))}
                            className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                          >
                            {pattern}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={config.naming.includePageNumbers}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          naming: { ...prev.naming, includePageNumbers: e.target.checked }
                        }))}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Include page numbers</span>
                    </label>
                    
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={config.naming.paddingZeros}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          naming: { ...prev.naming, paddingZeros: e.target.checked }
                        }))}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Pad with zeros (01, 02)</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Preview Extraction */}
              {previewExtractionSections().length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                    Extraction Preview ({previewExtractionSections().length} sections)
                  </h3>
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            <th className="px-4 py-2 text-left">Section</th>
                            <th className="px-4 py-2 text-left">Pages</th>
                            <th className="px-4 py-2 text-left">Count</th>
                            <th className="px-4 py-2 text-left">Filename</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                          {previewExtractionSections().map((section, index) => (
                            <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                              <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                                {section.title}
                              </td>
                              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                                {section.start}-{section.end}
                              </td>
                              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                                {section.end - section.start + 1}
                              </td>
                              <td className="px-4 py-2 text-gray-600 dark:text-gray-400 font-mono text-xs">
                                {generateFileName(section, index)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Preview Panel */}
        {preview && (
          <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">PDF Preview</h3>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 mb-4">
              <img
                src={preview}
                alt="PDF Preview"
                className="w-full h-auto rounded-lg"
              />
            </div>

            {/* Document Info */}
            <div className="space-y-3">
              <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Document Info</h4>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <div>Pages: {totalPages}</div>
                  {bookmarks.length > 0 && <div>Bookmarks: {bookmarks.length}</div>}
                  {extractionResults.length > 0 && <div>Extracted: {extractionResults.length} files</div>}
                </div>
              </div>

              {bookmarks.length > 0 && (
                <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Bookmarks</h4>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {bookmarks.slice(0, 5).map((bookmark, index) => (
                      <div key={index} className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        {bookmark.title}
                      </div>
                    ))}
                    {bookmarks.length > 5 && (
                      <div className="text-xs text-gray-500 dark:text-gray-500">
                        +{bookmarks.length - 5} more...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {extractionResults.length > 0 && (
                <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Extraction Results</h4>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {extractionResults.map((result, index) => (
                      <div key={index} className="text-xs">
                        <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {result.fileName}
                        </div>
                        <div className="text-gray-600 dark:text-gray-400">
                          {result.pageCount} pages • {(result.size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdvancedPageExtractionTool