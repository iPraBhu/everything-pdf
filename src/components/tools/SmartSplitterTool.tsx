import React, { useState, useRef } from 'react'
import { Upload, Scissors, RefreshCw, AlertCircle, Eye, Download, FileText, Zap, Brain, Search } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { useJobsStore } from '../../state/jobs'
import { workerManager } from '../../lib/workerManager'
import { globalBatchProcessor } from '../../lib/batchProcessor'

interface SplitMethod {
  id: string
  name: string
  description: string
  icon: React.ReactNode
}

interface SplitOptions {
  method: string
  pages?: {
    ranges: string
    customRanges: Array<{ start: number; end: number }>
  }
  size?: {
    maxFileSize: number // in MB
    overlap: number // number of pages to overlap
  }
  content?: {
    detectChapters: boolean
    detectSections: boolean
    blankPageThreshold: number
    textDensityThreshold: number
  }
  bookmarks?: {
    splitByBookmarks: boolean
    bookmarkLevel: number
  }
  naming?: {
    pattern: string
    includePageNumbers: boolean
    customPrefix: string
  }
}

const SPLIT_METHODS: SplitMethod[] = [
  {
    id: 'pages',
    name: 'Page Ranges',
    description: 'Split by specific page ranges or intervals',
    icon: <FileText className="w-5 h-5" />
  },
  {
    id: 'size',
    name: 'File Size',
    description: 'Split to maintain maximum file sizes',
    icon: <Search className="w-5 h-5" />
  },
  {
    id: 'content',
    name: 'Smart Content Analysis',
    description: 'AI-powered detection of natural break points',
    icon: <Brain className="w-5 h-5" />
  },
  {
    id: 'bookmarks',
    name: 'Bookmark Structure',
    description: 'Split using existing PDF bookmarks/outline',
    icon: <Eye className="w-5 h-5" />
  }
]

const SmartSplitterTool: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  const [splitOptions, setSplitOptions] = useState<SplitOptions>({
    method: 'pages',
    pages: {
      ranges: '',
      customRanges: []
    },
    size: {
      maxFileSize: 10,
      overlap: 0
    },
    content: {
      detectChapters: true,
      detectSections: false,
      blankPageThreshold: 90,
      textDensityThreshold: 5
    },
    bookmarks: {
      splitByBookmarks: true,
      bookmarkLevel: 1
    },
    naming: {
      pattern: '[filename]_part[number]',
      includePageNumbers: true,
      customPrefix: ''
    }
  })
  const [predictedSplits, setPredictedSplits] = useState<Array<{ start: number; end: number; reason: string }>>([])
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addFile } = useAppStore()
  const { addJob, updateJob } = useJobsStore()

  const handleFileSelect = async (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file')
      return
    }

    setSelectedFile(file)
    
    try {
      // Analyze the PDF to get preview data
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      const { loadPDFDocument, getPDFInfo, analyzeContent } = await import('../../lib/pdf')
      
      const doc = await loadPDFDocument(uint8Array)
      const info = await getPDFInfo(doc)
      
      // Analyze content for smart splitting
      const analysis = await analyzeContent(doc)
      
      setPreviewData({
        pageCount: info.pageCount,
        fileSize: file.size,
        hasBookmarks: analysis.bookmarks?.length > 0,
        bookmarks: analysis.bookmarks || [],
        textDensity: analysis.textDensity || [],
        blankPages: analysis.blankPages || [],
        chapters: analysis.detectedChapters || []
      })

      // Generate smart split predictions
      generateSplitPredictions(analysis, info.pageCount)
      
    } catch (error) {
      console.error('Error analyzing PDF:', error)
      setPreviewData({
        pageCount: 0,
        fileSize: file.size,
        hasBookmarks: false,
        bookmarks: [],
        textDensity: [],
        blankPages: [],
        chapters: []
      })
    }
  }

  const generateSplitPredictions = (analysis: any, pageCount: number) => {
    const splits: Array<{ start: number; end: number; reason: string }> = []
    
    switch (splitOptions.method) {
      case 'content':
        // Smart content-based splitting
        if (analysis.detectedChapters?.length > 0) {
          analysis.detectedChapters.forEach((chapter: any, index: number) => {
            const nextChapter = analysis.detectedChapters[index + 1]
            splits.push({
              start: chapter.startPage,
              end: nextChapter ? nextChapter.startPage - 1 : pageCount,
              reason: `Chapter: ${chapter.title || `Chapter ${index + 1}`}`
            })
          })
        } else {
          // Fallback to blank page detection
          let start = 1
          analysis.blankPages?.forEach((blankPage: number) => {
            if (blankPage > start) {
              splits.push({
                start,
                end: blankPage - 1,
                reason: 'Natural section break'
              })
              start = blankPage + 1
            }
          })
          if (start <= pageCount) {
            splits.push({
              start,
              end: pageCount,
              reason: 'Final section'
            })
          }
        }
        break
        
      case 'bookmarks':
        if (analysis.bookmarks?.length > 0) {
          analysis.bookmarks.forEach((bookmark: any, index: number) => {
            const nextBookmark = analysis.bookmarks[index + 1]
            splits.push({
              start: bookmark.page,
              end: nextBookmark ? nextBookmark.page - 1 : pageCount,
              reason: `Bookmark: ${bookmark.title}`
            })
          })
        }
        break
        
      case 'size':
        const avgPageSize = analysis.averagePageSize || (selectedFile!.size / pageCount)
        const pagesPerSplit = Math.floor((splitOptions.size!.maxFileSize * 1024 * 1024) / avgPageSize)
        
        for (let i = 1; i <= pageCount; i += pagesPerSplit) {
          splits.push({
            start: i,
            end: Math.min(i + pagesPerSplit - 1, pageCount),
            reason: `Size limit: ${splitOptions.size!.maxFileSize}MB`
          })
        }
        break
        
      case 'pages':
        // Parse custom ranges
        if (splitOptions.pages!.ranges) {
          const ranges = splitOptions.pages!.ranges.split(',').map(range => range.trim())
          ranges.forEach(range => {
            if (range.includes('-')) {
              const [start, end] = range.split('-').map(n => parseInt(n.trim()))
              if (start && end && start <= end && start >= 1 && end <= pageCount) {
                splits.push({
                  start,
                  end,
                  reason: `Custom range: ${range}`
                })
              }
            } else {
              const page = parseInt(range)
              if (page >= 1 && page <= pageCount) {
                splits.push({
                  start: page,
                  end: page,
                  reason: `Single page: ${page}`
                })
              }
            }
          })
        }
        break
    }
    
    setPredictedSplits(splits)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
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
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }

  const handleSplit = async () => {
    if (!selectedFile || predictedSplits.length === 0) return
    
    setIsProcessing(true)
    const jobId = Date.now().toString()
    
    try {
      addJob({
        id: jobId,
        type: 'split',
        status: 'processing',
        files: [selectedFile.name],
        progress: 0,
        createdAt: new Date()
      })

      const arrayBuffer = await selectedFile.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      
      const result = await workerManager.submitJob({
        type: 'split',
        file: uint8Array,
        options: {
          splits: predictedSplits,
          namingPattern: splitOptions.naming,
          onProgress: (progress: number) => {
            updateJob(jobId, { progress })
          }
        }
      })
      
      // Add all split files to the app
      result.files.forEach((fileData: Uint8Array, index: number) => {
        const split = predictedSplits[index]
        const fileName = generateFileName(selectedFile.name, index + 1, split)
        const splitFile = new File([fileData], fileName, { type: 'application/pdf' })
        addFile(splitFile)
      })
      
      updateJob(jobId, {
        status: 'completed',
        progress: 100,
        result: {
          splitCount: result.files.length,
          totalSize: result.files.reduce((sum: number, file: Uint8Array) => sum + file.byteLength, 0)
        }
      })
      
      setSelectedFile(null)
      setPreviewData(null)
      setPredictedSplits([])
      
    } catch (error) {
      console.error('Split failed:', error)
      updateJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const addToBatch = () => {
    if (!selectedFile || predictedSplits.length === 0) return

    globalBatchProcessor.addOperation({
      type: 'split',
      files: [selectedFile],
      options: {
        splits: predictedSplits,
        namingPattern: splitOptions.naming
      },
      priority: 4,
      onComplete: (result) => {
        result.files.forEach((fileData: Uint8Array, index: number) => {
          const split = predictedSplits[index]
          const fileName = generateFileName(selectedFile.name, index + 1, split)
          const splitFile = new File([fileData], fileName, { type: 'application/pdf' })
          addFile(splitFile)
        })
      }
    })

    setSelectedFile(null)
    setPreviewData(null)
    setPredictedSplits([])
  }

  const generateFileName = (originalName: string, partNumber: number, split: { start: number; end: number; reason: string }) => {
    const baseName = originalName.replace('.pdf', '')
    let fileName = splitOptions.naming.pattern
      .replace('[filename]', baseName)
      .replace('[number]', partNumber.toString().padStart(2, '0'))
      .replace('[start]', split.start.toString())
      .replace('[end]', split.end.toString())
    
    if (splitOptions.naming.customPrefix) {
      fileName = splitOptions.naming.customPrefix + fileName
    }
    
    return fileName + '.pdf'
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  // Re-run predictions when options change
  React.useEffect(() => {
    if (previewData) {
      generateSplitPredictions(previewData, previewData.pageCount)
    }
  }, [splitOptions])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Smart PDF Splitter</h2>
        {selectedFile && predictedSplits.length > 0 && (
          <button
            onClick={addToBatch}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Zap className="w-4 h-4" />
            Add to Batch
          </button>
        )}
      </div>

      {/* File Upload */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`mb-6 border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragOver
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900'
            : 'border-gray-300 dark:border-gray-600'
        }`}
      >
        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-gray-100">
          {selectedFile ? selectedFile.name : 'Select a PDF file to split'}
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          {selectedFile 
            ? `${previewData?.pageCount || 0} pages • ${formatFileSize(selectedFile.size)}`
            : 'Drag and drop a PDF file here, or click to browse'
          }
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
        >
          {selectedFile ? 'Change File' : 'Select File'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      {/* Split Method Selection */}
      {selectedFile && (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">Split Method</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {SPLIT_METHODS.map((method) => (
              <button
                key={method.id}
                onClick={() => setSplitOptions(prev => ({ ...prev, method: method.id }))}
                className={`p-4 rounded-lg border-2 transition-colors text-left ${
                  splitOptions.method === method.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  {method.icon}
                  <span className="font-medium text-gray-900 dark:text-gray-100">{method.name}</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{method.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Split Options */}
      {selectedFile && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            {SPLIT_METHODS.find(m => m.id === splitOptions.method)?.name} Options
          </h3>
          
          {splitOptions.method === 'pages' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Page Ranges (e.g., "1-5, 10-15, 20")
                </label>
                <input
                  type="text"
                  value={splitOptions.pages!.ranges}
                  onChange={(e) => setSplitOptions(prev => ({
                    ...prev,
                    pages: { ...prev.pages!, ranges: e.target.value }
                  }))}
                  placeholder="1-10, 15-25, 30"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          )}

          {splitOptions.method === 'size' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Maximum File Size (MB)
                </label>
                <input
                  type="number"
                  value={splitOptions.size!.maxFileSize}
                  onChange={(e) => setSplitOptions(prev => ({
                    ...prev,
                    size: { ...prev.size!, maxFileSize: parseFloat(e.target.value) }
                  }))}
                  min="1"
                  max="100"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          )}

          {splitOptions.method === 'content' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={splitOptions.content!.detectChapters}
                    onChange={(e) => setSplitOptions(prev => ({
                      ...prev,
                      content: { ...prev.content!, detectChapters: e.target.checked }
                    }))}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Detect chapters</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={splitOptions.content!.detectSections}
                    onChange={(e) => setSplitOptions(prev => ({
                      ...prev,
                      content: { ...prev.content!, detectSections: e.target.checked }
                    }))}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Detect sections</span>
                </label>
              </div>
            </div>
          )}

          {splitOptions.method === 'bookmarks' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Bookmark Level to Split On
                </label>
                <select
                  value={splitOptions.bookmarks!.bookmarkLevel}
                  onChange={(e) => setSplitOptions(prev => ({
                    ...prev,
                    bookmarks: { ...prev.bookmarks!, bookmarkLevel: parseInt(e.target.value) }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value={1}>Level 1 (Main chapters)</option>
                  <option value={2}>Level 2 (Sub-sections)</option>
                  <option value={3}>Level 3 (Sub-sub-sections)</option>
                </select>
              </div>
              {previewData?.hasBookmarks && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900 rounded">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    ✓ This PDF has {previewData.bookmarks.length} bookmarks available
                  </p>
                </div>
              )}
              {!previewData?.hasBookmarks && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900 rounded">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    ⚠ This PDF doesn't have bookmarks. Consider using content analysis instead.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* File Naming Options */}
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">File Naming</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                  Naming Pattern
                </label>
                <input
                  type="text"
                  value={splitOptions.naming.pattern}
                  onChange={(e) => setSplitOptions(prev => ({
                    ...prev,
                    naming: { ...prev.naming, pattern: e.target.value }
                  }))}
                  placeholder="[filename]_part[number]"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Available: [filename], [number], [start], [end]
                </p>
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                  Custom Prefix
                </label>
                <input
                  type="text"
                  value={splitOptions.naming.customPrefix}
                  onChange={(e) => setSplitOptions(prev => ({
                    ...prev,
                    naming: { ...prev.naming, customPrefix: e.target.value }
                  }))}
                  placeholder="Optional prefix"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Split Preview */}
      {selectedFile && predictedSplits.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">
            Split Preview ({predictedSplits.length} files)
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {predictedSplits.map((split, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded"
              >
                <div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {generateFileName(selectedFile.name, index + 1, split)}
                  </span>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Pages {split.start}-{split.end} • {split.reason}
                  </div>
                </div>
                <Eye className="w-4 h-4 text-gray-400" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {selectedFile && predictedSplits.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={handleSplit}
            disabled={isProcessing}
            className="bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Scissors className="w-5 h-5" />
            )}
            {isProcessing ? 'Splitting...' : 'Split Now'}
          </button>
          
          <button
            onClick={addToBatch}
            disabled={isProcessing}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Zap className="w-5 h-5" />
            Add to Batch Queue
          </button>
        </div>
      )}

      {selectedFile && predictedSplits.length === 0 && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <span className="text-yellow-800 dark:text-yellow-200">
              No valid splits detected. Please check your options or try a different split method.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default SmartSplitterTool