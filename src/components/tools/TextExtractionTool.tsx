import React, { useState, useRef, useEffect } from 'react'
import { Upload, Download, RefreshCw, FileText, Copy, Eye, Filter, Search, Hash, BarChart3, Type, Layers } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { useJobsStore } from '../../state/jobs'
import { workerManager } from '../../lib/workerManager'

interface ExtractionOptions {
  extractionMode: 'all' | 'pages' | 'regions'
  pageRange: string
  includeHeaders: boolean
  includeFooters: boolean
  includeHiddenText: boolean
  preserveFormatting: boolean
  outputFormat: 'plain' | 'markdown' | 'html' | 'structured'
  cleanupOptions: {
    removeExtraSpaces: boolean
    removeLineBreaks: boolean
    removeSpecialChars: boolean
    normalizeWhitespace: boolean
  }
  textFiltering: {
    minWordLength: number
    maxWordLength: number
    excludeNumbers: boolean
    excludeSymbols: boolean
    customPatterns: string[]
  }
}

interface ExtractedText {
  pageNumber: number
  content: string
  wordCount: number
  characterCount: number
  confidence?: number
  metadata: {
    fontSize: number[]
    fontNames: string[]
    hasImages: boolean
    hasHeaders: boolean
    hasFooters: boolean
  }
}

interface TextStatistics {
  totalPages: number
  totalWords: number
  totalCharacters: number
  averageWordsPerPage: number
  mostCommonWords: Array<{ word: string; count: number }>
  textDensity: number
  readabilityScore?: number
}

const TextExtractionTool: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<any>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [extractedText, setExtractedText] = useState<ExtractedText[]>([])
  const [statistics, setStatistics] = useState<TextStatistics | null>(null)
  const [activeTab, setActiveTab] = useState<'options' | 'preview' | 'results' | 'statistics'>('options')
  const [selectedPage, setSelectedPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredText, setFilteredText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { addFile } = useAppStore()
  const { addJob, updateJob } = useJobsStore()

  const [options, setOptions] = useState<ExtractionOptions>({
    extractionMode: 'all',
    pageRange: '',
    includeHeaders: true,
    includeFooters: true,
    includeHiddenText: false,
    preserveFormatting: true,
    outputFormat: 'plain',
    cleanupOptions: {
      removeExtraSpaces: true,
      removeLineBreaks: false,
      removeSpecialChars: false,
      normalizeWhitespace: true
    },
    textFiltering: {
      minWordLength: 1,
      maxWordLength: 50,
      excludeNumbers: false,
      excludeSymbols: false,
      customPatterns: []
    }
  })

  useEffect(() => {
    if (extractedText.length > 0) {
      calculateStatistics()
      applyTextFiltering()
    }
  }, [extractedText, searchQuery])

  const calculateStatistics = () => {
    const totalWords = extractedText.reduce((sum, page) => sum + page.wordCount, 0)
    const totalCharacters = extractedText.reduce((sum, page) => sum + page.characterCount, 0)
    
    // Calculate word frequency
    const wordCounts: { [key: string]: number } = {}
    extractedText.forEach(page => {
      const words = page.content.toLowerCase().match(/\b\w+\b/g) || []
      words.forEach(word => {
        if (word.length >= 3) { // Only count words with 3+ characters
          wordCounts[word] = (wordCounts[word] || 0) + 1
        }
      })
    })

    const mostCommonWords = Object.entries(wordCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }))

    const textDensity = totalWords / Math.max(extractedText.length, 1)

    const stats: TextStatistics = {
      totalPages: extractedText.length,
      totalWords,
      totalCharacters,
      averageWordsPerPage: textDensity,
      mostCommonWords,
      textDensity,
      readabilityScore: calculateReadabilityScore(extractedText.map(p => p.content).join(' '))
    }

    setStatistics(stats)
  }

  const calculateReadabilityScore = (text: string): number => {
    // Simple Flesch Reading Ease approximation
    const sentences = text.split(/[.!?]+/).length - 1
    const words = text.split(/\s+/).length
    const syllables = text.split(/[aeiouAEIOU]/).length - 1

    if (sentences === 0 || words === 0) return 0

    const avgSentenceLength = words / sentences
    const avgSyllablesPerWord = syllables / words

    return Math.max(0, Math.min(100, 
      206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord)
    ))
  }

  const applyTextFiltering = () => {
    if (extractedText.length === 0) return

    let allText = extractedText.map(page => `Page ${page.pageNumber}:\n${page.content}\n\n`).join('')

    // Apply search filter
    if (searchQuery) {
      const lines = allText.split('\n')
      const filteredLines = lines.filter(line => 
        line.toLowerCase().includes(searchQuery.toLowerCase())
      )
      allText = filteredLines.join('\n')
    }

    setFilteredText(allText)
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
      setExtractedText([])
      setStatistics(null)
      setSelectedPage(1)
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

  const extractText = async () => {
    if (!selectedFile) return

    setIsProcessing(true)
    setActiveTab('preview')
    const jobId = `text-extraction-${Date.now()}`
    
    try {
      addJob({
        id: jobId,
        type: 'text-extraction',
        name: `Extract text from ${selectedFile.name}`,
        status: 'processing',
        fileIds: [selectedFile.id],
        progress: 0,
        startTime: Date.now(),
        cancellable: true
      })

      const results: ExtractedText[] = []

      // Determine pages to process
      let pagesToProcess: number[] = []
      
      switch (options.extractionMode) {
        case 'all':
          pagesToProcess = Array.from({ length: selectedFile.pageCount }, (_, i) => i)
          break
        case 'pages':
          // Parse page range
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
        case 'regions':
          // For regions, process all pages but later filter content
          pagesToProcess = Array.from({ length: selectedFile.pageCount }, (_, i) => i)
          break
      }

      // Process each page
      for (let i = 0; i < pagesToProcess.length; i++) {
        const pageIndex = pagesToProcess[i]
        const pageNumber = pageIndex + 1
        
        updateJob(jobId, { progress: (i / pagesToProcess.length) * 80 })

        // TODO: Implement actual text extraction in workerManager
        // For now, we'll simulate text extraction
        console.warn('Text extraction not yet implemented in workerManager')
        
        // Simulate text extraction
        const mockText = `This is extracted text from page ${pageNumber} of the PDF document.

The text extraction process would normally:
- Parse PDF text objects
- Handle different fonts and encodings
- Preserve formatting based on options
- Extract text from tables and columns
- Handle headers and footers as specified

Sample content for page ${pageNumber}:
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.

This would be the actual extracted text content with proper formatting, spacing, and structure preservation based on the selected options.`

        const cleanedText = applyCleanupOptions(mockText)
        const wordCount = (cleanedText.match(/\b\w+\b/g) || []).length
        const characterCount = cleanedText.length

        const result: ExtractedText = {
          pageNumber,
          content: cleanedText,
          wordCount,
          characterCount,
          confidence: 95 + Math.random() * 5,
          metadata: {
            fontSize: [12, 14, 16],
            fontNames: ['Times New Roman', 'Arial'],
            hasImages: Math.random() > 0.5,
            hasHeaders: options.includeHeaders && Math.random() > 0.3,
            hasFooters: options.includeFooters && Math.random() > 0.3
          }
        }

        results.push(result)
        
        // Small delay to simulate processing
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      setExtractedText(results)
      updateJob(jobId, { progress: 90 })

      // Create output files
      const allText = results.map(r => `Page ${r.pageNumber}:\n${r.content}\n\n`).join('')
      
      // Create text file
      let outputContent = allText
      let fileExtension = 'txt'
      let mimeType = 'text/plain'

      switch (options.outputFormat) {
        case 'markdown':
          outputContent = convertToMarkdown(results)
          fileExtension = 'md'
          mimeType = 'text/markdown'
          break
        case 'html':
          outputContent = convertToHTML(results)
          fileExtension = 'html'
          mimeType = 'text/html'
          break
        case 'structured':
          outputContent = JSON.stringify(results, null, 2)
          fileExtension = 'json'
          mimeType = 'application/json'
          break
      }

      const outputBlob = new Blob([outputContent], { type: mimeType })
      const outputData = new Uint8Array(await outputBlob.arrayBuffer())
      
      const outputFileName = selectedFile.name.replace(/\.pdf$/i, `_extracted.${fileExtension}`)
      
      const outputFile = {
        id: `extracted-text-${Date.now()}`,
        name: outputFileName,
        size: outputData.byteLength,
        type: mimeType,
        lastModified: Date.now(),
        file: new File([outputData], outputFileName, { type: mimeType }),
        data: outputData
      } as any
      
      addFile(outputFile)

      updateJob(jobId, {
        status: 'completed',
        progress: 100,
        endTime: Date.now()
      })

      setActiveTab('results')
      console.log('Text extraction completed (simulated)', { 
        pages: results.length,
        totalWords: results.reduce((sum, r) => sum + r.wordCount, 0),
        options 
      })

    } catch (error) {
      console.error('Error extracting text:', error)
      updateJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        endTime: Date.now()
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const applyCleanupOptions = (text: string): string => {
    let cleaned = text

    if (options.cleanupOptions.removeExtraSpaces) {
      cleaned = cleaned.replace(/\s+/g, ' ')
    }

    if (options.cleanupOptions.removeLineBreaks) {
      cleaned = cleaned.replace(/\n+/g, ' ')
    }

    if (options.cleanupOptions.removeSpecialChars) {
      cleaned = cleaned.replace(/[^\w\s]/g, '')
    }

    if (options.cleanupOptions.normalizeWhitespace) {
      cleaned = cleaned.trim().replace(/\s+/g, ' ')
    }

    return cleaned
  }

  const convertToMarkdown = (results: ExtractedText[]): string => {
    return results.map(result => {
      let content = `# Page ${result.pageNumber}\n\n`
      content += result.content.replace(/\n/g, '\n\n')
      content += '\n\n---\n\n'
      return content
    }).join('')
  }

  const convertToHTML = (results: ExtractedText[]): string => {
    let html = '<!DOCTYPE html>\n<html>\n<head>\n<title>Extracted Text</title>\n</head>\n<body>\n'
    
    results.forEach(result => {
      html += `<div class="page">\n<h2>Page ${result.pageNumber}</h2>\n`
      html += `<div class="content">\n${result.content.replace(/\n/g, '<br>\n')}\n</div>\n</div>\n\n`
    })
    
    html += '</body>\n</html>'
    return html
  }

  const copyAllText = async () => {
    const allText = extractedText.map(r => r.content).join('\n\n')
    try {
      await navigator.clipboard.writeText(allText)
      // Could add a toast notification here
    } catch (error) {
      console.error('Error copying to clipboard:', error)
    }
  }

  const copyPageText = async (pageText: string) => {
    try {
      await navigator.clipboard.writeText(pageText)
      // Could add a toast notification here
    } catch (error) {
      console.error('Error copying to clipboard:', error)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Extract Text</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Extract and analyze text content from PDF documents</p>
            </div>
          </div>
          {selectedFile && (
            <button
              onClick={extractText}
              disabled={isProcessing}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {isProcessing ? 'Extracting...' : 'Extract Text'}
            </button>
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
                  ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
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
                    Drop your PDF here to extract text
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
                PDF documents with extractable text content
              </p>
              <div className="mt-4 text-xs text-gray-400 text-center max-w-md">
                <p>Extract text in multiple formats: Plain text, Markdown, HTML, or structured JSON</p>
                <p className="mt-2">Includes text analysis, statistics, and advanced filtering options</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Tabs */}
              <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <nav className="flex space-x-8 px-6">
                  {[
                    { id: 'options', name: 'Options', icon: Filter },
                    { id: 'preview', name: 'Preview', icon: Eye },
                    { id: 'results', name: 'Text Results', icon: FileText, badge: extractedText.length },
                    { id: 'statistics', name: 'Statistics', icon: BarChart3, badge: statistics ? 1 : 0 }
                  ].map((tab) => {
                    const Icon = tab.icon
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                          activeTab === tab.id
                            ? 'border-green-500 text-green-600 dark:text-green-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                      >
                        <Icon className="w-4 h-4 mr-2" />
                        {tab.name}
                        {tab.badge !== undefined && tab.badge > 0 && (
                          <span className="ml-2 px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full">
                            {tab.badge}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </nav>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-auto p-6">
                {activeTab === 'options' && (
                  <div className="max-w-4xl space-y-8">
                    {/* Extraction Mode */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                        Extraction Settings
                      </h3>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Extraction Mode
                          </label>
                          <div className="space-y-2">
                            {[
                              { value: 'all', label: 'All Pages', description: 'Extract text from all pages' },
                              { value: 'pages', label: 'Specific Pages', description: 'Extract from selected page range' },
                              { value: 'regions', label: 'Text Regions', description: 'Extract from specific content areas' }
                            ].map(mode => (
                              <label key={mode.value} className="flex items-start">
                                <input
                                  type="radio"
                                  name="extractionMode"
                                  value={mode.value}
                                  checked={options.extractionMode === mode.value}
                                  onChange={(e) => setOptions({ ...options, extractionMode: e.target.value as any })}
                                  className="mr-3 mt-1"
                                />
                                <div>
                                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {mode.label}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {mode.description}
                                  </div>
                                </div>
                              </label>
                            ))}
                          </div>

                          {options.extractionMode === 'pages' && (
                            <div className="mt-3 ml-6">
                              <input
                                type="text"
                                value={options.pageRange}
                                onChange={(e) => setOptions({ ...options, pageRange: e.target.value })}
                                placeholder="e.g., 1-5, 8, 10-12"
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

                    {/* Content Options */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Content Options
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { key: 'includeHeaders', label: 'Include Headers' },
                          { key: 'includeFooters', label: 'Include Footers' },
                          { key: 'includeHiddenText', label: 'Include Hidden Text' },
                          { key: 'preserveFormatting', label: 'Preserve Formatting' }
                        ].map(option => (
                          <label key={option.key} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={options[option.key as keyof ExtractionOptions] as boolean}
                              onChange={(e) => setOptions({ ...options, [option.key]: e.target.checked })}
                              className="mr-2"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {option.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Output Format */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Output Format
                      </h4>
                      <select
                        value={options.outputFormat}
                        onChange={(e) => setOptions({ ...options, outputFormat: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                      >
                        <option value="plain">Plain Text (.txt)</option>
                        <option value="markdown">Markdown (.md)</option>
                        <option value="html">HTML (.html)</option>
                        <option value="structured">Structured JSON (.json)</option>
                      </select>
                    </div>

                    {/* Cleanup Options */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Text Cleanup
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        {Object.entries(options.cleanupOptions).map(([key, value]) => (
                          <label key={key} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={value}
                              onChange={(e) => setOptions({
                                ...options,
                                cleanupOptions: { ...options.cleanupOptions, [key]: e.target.checked }
                              })}
                              className="mr-2"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                              {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Text Filtering */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Text Filtering
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                            Min Word Length: {options.textFiltering.minWordLength}
                          </label>
                          <input
                            type="range"
                            min="1"
                            max="10"
                            value={options.textFiltering.minWordLength}
                            onChange={(e) => setOptions({
                              ...options,
                              textFiltering: { ...options.textFiltering, minWordLength: parseInt(e.target.value) }
                            })}
                            className="w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                            Max Word Length: {options.textFiltering.maxWordLength}
                          </label>
                          <input
                            type="range"
                            min="10"
                            max="100"
                            value={options.textFiltering.maxWordLength}
                            onChange={(e) => setOptions({
                              ...options,
                              textFiltering: { ...options.textFiltering, maxWordLength: parseInt(e.target.value) }
                            })}
                            className="w-full"
                          />
                        </div>
                      </div>

                      <div className="mt-3 flex space-x-6">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={options.textFiltering.excludeNumbers}
                            onChange={(e) => setOptions({
                              ...options,
                              textFiltering: { ...options.textFiltering, excludeNumbers: e.target.checked }
                            })}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            Exclude Numbers
                          </span>
                        </label>

                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={options.textFiltering.excludeSymbols}
                            onChange={(e) => setOptions({
                              ...options,
                              textFiltering: { ...options.textFiltering, excludeSymbols: e.target.checked }
                            })}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            Exclude Symbols
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'preview' && (
                  <div className="space-y-4">
                    {isProcessing ? (
                      <div className="text-center py-8">
                        <RefreshCw className="w-8 h-8 mx-auto animate-spin text-green-600 mb-3" />
                        <p className="text-gray-600 dark:text-gray-400">Extracting text from PDF...</p>
                      </div>
                    ) : extractedText.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No text extracted yet. Configure options and start extraction.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Page Navigation */}
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                            Text Preview
                          </h3>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => setSelectedPage(Math.max(1, selectedPage - 1))}
                              disabled={selectedPage <= 1}
                              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              ◀
                            </button>
                            <span className="text-sm text-gray-500 dark:text-gray-400 min-w-0">
                              Page {selectedPage} / {extractedText.length}
                            </span>
                            <button
                              onClick={() => setSelectedPage(Math.min(extractedText.length, selectedPage + 1))}
                              disabled={selectedPage >= extractedText.length}
                              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              ▶
                            </button>
                          </div>
                        </div>

                        {/* Current Page Text */}
                        {(() => {
                          const currentPage = extractedText.find(p => p.pageNumber === selectedPage)
                          if (!currentPage) return null

                          return (
                            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                                    Page {currentPage.pageNumber}
                                  </h4>
                                  <span className="text-sm text-gray-500 dark:text-gray-400">
                                    {currentPage.wordCount} words • {currentPage.characterCount} characters
                                  </span>
                                </div>
                                <button
                                  onClick={() => copyPageText(currentPage.content)}
                                  className="flex items-center px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                                >
                                  <Copy className="w-4 h-4 mr-2" />
                                  Copy
                                </button>
                              </div>
                              <div className="p-4">
                                <div className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 rounded p-3 max-h-96 overflow-auto font-mono">
                                  {currentPage.content}
                                </div>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'results' && (
                  <div className="space-y-4">
                    {extractedText.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No text extracted yet. Run the extraction process to see results.</p>
                      </div>
                    ) : (
                      <>
                        {/* Search and Actions */}
                        <div className="flex items-center justify-between">
                          <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Search in extracted text..."
                              className="pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 w-full"
                            />
                          </div>
                          <button
                            onClick={copyAllText}
                            className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Copy All
                          </button>
                        </div>

                        {/* Extracted Text Display */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                              Extracted Text {searchQuery && `(filtered by "${searchQuery}")`}
                            </h3>
                          </div>
                          <div className="p-4">
                            <div className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 rounded p-4 max-h-96 overflow-auto font-mono">
                              {searchQuery ? filteredText : extractedText.map(page => `Page ${page.pageNumber}:\n${page.content}\n\n`).join('')}
                            </div>
                          </div>
                        </div>

                        {/* Page-by-Page Results */}
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Page-by-Page Results
                          </h4>
                          {extractedText.map(page => (
                            <div key={page.pageNumber} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                              <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <span className="font-medium text-gray-900 dark:text-gray-100">
                                    Page {page.pageNumber}
                                  </span>
                                  <span className="text-sm text-gray-500 dark:text-gray-400">
                                    {page.wordCount} words • {page.characterCount} chars
                                  </span>
                                  {page.confidence && (
                                    <span className="text-sm text-green-600 dark:text-green-400">
                                      {page.confidence.toFixed(1)}% confidence
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => copyPageText(page.content)}
                                  className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="p-3">
                                <div className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 rounded p-3 max-h-32 overflow-auto">
                                  {page.content.substring(0, 500)}
                                  {page.content.length > 500 && '...'}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {activeTab === 'statistics' && (
                  <div className="space-y-6">
                    {!statistics ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No statistics available. Extract text to see analysis.</p>
                      </div>
                    ) : (
                      <>
                        {/* Overview Statistics */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                            Text Statistics
                          </h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                {statistics.totalPages}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">Pages</div>
                            </div>
                            <div>
                              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                {statistics.totalWords.toLocaleString()}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">Words</div>
                            </div>
                            <div>
                              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                {statistics.totalCharacters.toLocaleString()}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">Characters</div>
                            </div>
                            <div>
                              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                {Math.round(statistics.averageWordsPerPage)}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">Words/Page</div>
                            </div>
                          </div>
                        </div>

                        {/* Text Quality Metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                              Text Density
                            </h4>
                            <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                              {statistics.textDensity.toFixed(1)}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              Words per page average
                            </div>
                          </div>

                          {statistics.readabilityScore !== undefined && (
                            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                Readability Score
                              </h4>
                              <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                                {statistics.readabilityScore.toFixed(0)}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                Flesch Reading Ease
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Most Common Words */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Most Common Words
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            {statistics.mostCommonWords.map((item, index) => (
                              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {item.word}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {item.count}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Page Analysis */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Page Analysis
                          </h4>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {extractedText.map(page => (
                              <div key={page.pageNumber} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded text-sm">
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                  Page {page.pageNumber}
                                </span>
                                <div className="text-gray-600 dark:text-gray-400 space-x-4">
                                  <span>{page.wordCount} words</span>
                                  <span>{page.characterCount} chars</span>
                                  {page.metadata.hasImages && <span className="text-blue-600 dark:text-blue-400">📷</span>}
                                  {page.metadata.hasHeaders && <span className="text-green-600 dark:text-green-400">↑</span>}
                                  {page.metadata.hasFooters && <span className="text-orange-600 dark:text-orange-400">↓</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Info Sidebar */}
            <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4 space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Document Info</h3>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-sm">
                  <div className="space-y-1 text-gray-600 dark:text-gray-400">
                    <div><strong>File:</strong> {selectedFile.name}</div>
                    <div><strong>Size:</strong> {(selectedFile.size / 1024 / 1024).toFixed(1)} MB</div>
                    <div><strong>Pages:</strong> {selectedFile.pageCount}</div>
                    <div><strong>Format:</strong> {options.outputFormat.toUpperCase()}</div>
                  </div>
                </div>
              </div>

              {statistics && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Extract Summary</h3>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-sm">
                    <div className="space-y-1 text-gray-600 dark:text-gray-400">
                      <div><strong>Extracted:</strong> {statistics.totalPages} pages</div>
                      <div><strong>Words:</strong> {statistics.totalWords.toLocaleString()}</div>
                      <div><strong>Characters:</strong> {statistics.totalCharacters.toLocaleString()}</div>
                      <div><strong>Avg/Page:</strong> {Math.round(statistics.averageWordsPerPage)} words</div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Extraction Options</h3>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-xs">
                  <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                    <li>Mode: {options.extractionMode}</li>
                    <li>Format: {options.outputFormat}</li>
                    <li>Headers: {options.includeHeaders ? 'Yes' : 'No'}</li>
                    <li>Footers: {options.includeFooters ? 'Yes' : 'No'}</li>
                    <li>Formatting: {options.preserveFormatting ? 'Preserved' : 'Plain'}</li>
                    <li>Cleanup: {Object.values(options.cleanupOptions).some(v => v) ? 'Enabled' : 'None'}</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quick Actions</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setActiveTab('options')}
                    className="w-full flex items-center px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <Filter className="w-4 h-4 mr-2" />
                    Extract Options
                  </button>
                  {extractedText.length > 0 && (
                    <>
                      <button
                        onClick={() => setActiveTab('results')}
                        className="w-full flex items-center px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        View Results
                      </button>
                      <button
                        onClick={copyAllText}
                        className="w-full flex items-center px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy All Text
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default TextExtractionTool