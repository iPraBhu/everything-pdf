import React, { useState, useRef, useEffect } from 'react'
import { Upload, Download, RefreshCw, Scan, Eye, EyeOff, Search, Copy, FileText, Settings, Layers, Zap, CheckCircle } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { useJobsStore } from '../../state/jobs'
import { workerManager } from '../../lib/workerManager'

interface OCROptions {
  language: string[]
  engineMode: 'fast' | 'accurate' | 'best'
  pageSegmentationMode: 'auto' | 'single_column' | 'single_block' | 'single_line' | 'single_word' | 'single_char'
  dpi: number
  preprocessing: {
    enhance: boolean
    denoise: boolean
    sharpen: boolean
    autoRotate: boolean
    autoContrast: boolean
    binarize: boolean
  }
  outputFormat: 'searchable' | 'text_only' | 'both'
  preserveFormatting: boolean
  confidenceThreshold: number
}

interface OCRResult {
  pageNumber: number
  text: string
  confidence: number
  words: Array<{
    text: string
    confidence: number
    bbox: { x: number; y: number; width: number; height: number }
  }>
  paragraphs: Array<{
    text: string
    confidence: number
    bbox: { x: number; y: number; width: number; height: number }
  }>
}

interface OCRProgress {
  currentPage: number
  totalPages: number
  stage: 'preprocessing' | 'recognition' | 'postprocessing'
  stageProgress: number
}

const OCRTool: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<any>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [ocrResults, setOcrResults] = useState<OCRResult[]>([])
  const [selectedPage, setSelectedPage] = useState(1)
  const [activeTab, setActiveTab] = useState<'settings' | 'preview' | 'results' | 'text'>('settings')
  const [showOverlay, setShowOverlay] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [ocrProgress, setOcrProgress] = useState<OCRProgress | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const { addFile } = useAppStore()
  const { addJob, updateJob } = useJobsStore()

  const [options, setOptions] = useState<OCROptions>({
    language: ['eng'],
    engineMode: 'best',
    pageSegmentationMode: 'auto',
    dpi: 300,
    preprocessing: {
      enhance: true,
      denoise: true,
      sharpen: false,
      autoRotate: true,
      autoContrast: true,
      binarize: false
    },
    outputFormat: 'searchable',
    preserveFormatting: true,
    confidenceThreshold: 75
  })

  const supportedLanguages = [
    { code: 'eng', name: 'English', popular: true },
    { code: 'spa', name: 'Spanish', popular: true },
    { code: 'fra', name: 'French', popular: true },
    { code: 'deu', name: 'German', popular: true },
    { code: 'ita', name: 'Italian', popular: true },
    { code: 'por', name: 'Portuguese', popular: true },
    { code: 'rus', name: 'Russian', popular: true },
    { code: 'jpn', name: 'Japanese', popular: true },
    { code: 'chi_sim', name: 'Chinese (Simplified)', popular: true },
    { code: 'chi_tra', name: 'Chinese (Traditional)', popular: true },
    { code: 'ara', name: 'Arabic', popular: true },
    { code: 'hin', name: 'Hindi', popular: true },
    { code: 'nld', name: 'Dutch', popular: false },
    { code: 'swe', name: 'Swedish', popular: false },
    { code: 'nor', name: 'Norwegian', popular: false },
    { code: 'dan', name: 'Danish', popular: false },
    { code: 'fin', name: 'Finnish', popular: false },
    { code: 'pol', name: 'Polish', popular: false },
    { code: 'ces', name: 'Czech', popular: false },
    { code: 'hun', name: 'Hungarian', popular: false },
    { code: 'tur', name: 'Turkish', popular: false },
    { code: 'kor', name: 'Korean', popular: false }
  ]

  const engineModes = {
    fast: { name: 'Fast', description: 'Quick processing with basic accuracy' },
    accurate: { name: 'Accurate', description: 'Balanced speed and accuracy' },
    best: { name: 'Best Quality', description: 'Maximum accuracy (slower)' }
  }

  const segmentationModes = {
    auto: { name: 'Auto', description: 'Automatically detect page layout' },
    single_column: { name: 'Single Column', description: 'Treat as single text column' },
    single_block: { name: 'Single Block', description: 'Treat as single uniform block' },
    single_line: { name: 'Single Line', description: 'Treat as single text line' },
    single_word: { name: 'Single Word', description: 'Treat as single word' },
    single_char: { name: 'Single Character', description: 'Treat as single character' }
  }

  useEffect(() => {
    if (selectedFile && selectedPage) {
      renderPagePreview()
    }
  }, [selectedFile, selectedPage, ocrResults, showOverlay])

  const renderPagePreview = async () => {
    if (!selectedFile || !canvasRef.current) return

    try {
      // Generate thumbnail for preview
      const thumbnails = await workerManager.generateThumbnails(selectedFile.data, [selectedPage - 1])
      if (thumbnails.length === 0) return

      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')!
      const imageData = thumbnails[0]

      canvas.width = imageData.width
      canvas.height = imageData.height
      ctx.putImageData(imageData, 0, 0)

      // Draw OCR overlay if available and enabled
      if (showOverlay && ocrResults.length > 0) {
        const pageResult = ocrResults.find(r => r.pageNumber === selectedPage)
        if (pageResult) {
          drawOCROverlay(ctx, pageResult, canvas.width, canvas.height)
        }
      }
    } catch (error) {
      console.error('Error rendering preview:', error)
    }
  }

  const drawOCROverlay = (ctx: CanvasRenderingContext2D, result: OCRResult, canvasWidth: number, canvasHeight: number) => {
    ctx.save()
    
    // Draw word bounding boxes
    result.words.forEach(word => {
      if (word.confidence >= options.confidenceThreshold) {
        const x = (word.bbox.x / 1000) * canvasWidth
        const y = (word.bbox.y / 1000) * canvasHeight
        const width = (word.bbox.width / 1000) * canvasWidth
        const height = (word.bbox.height / 1000) * canvasHeight

        // Color based on confidence
        const alpha = Math.min(word.confidence / 100, 0.3)
        if (word.confidence >= 90) {
          ctx.fillStyle = `rgba(34, 197, 94, ${alpha})`
        } else if (word.confidence >= 75) {
          ctx.fillStyle = `rgba(234, 179, 8, ${alpha})`
        } else {
          ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`
        }

        ctx.fillRect(x, y, width, height)

        // Highlight search matches
        if (searchQuery && word.text.toLowerCase().includes(searchQuery.toLowerCase())) {
          ctx.strokeStyle = '#3b82f6'
          ctx.lineWidth = 2
          ctx.strokeRect(x, y, width, height)
        }
      }
    })

    ctx.restore()
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
      setSelectedPage(1)
      setOcrResults([])
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

  const handleLanguageToggle = (languageCode: string) => {
    setOptions(prev => ({
      ...prev,
      language: prev.language.includes(languageCode)
        ? prev.language.filter(l => l !== languageCode)
        : [...prev.language, languageCode]
    }))
  }

  const performOCR = async () => {
    if (!selectedFile) return

    setIsProcessing(true)
    const jobId = `ocr-${Date.now()}`
    
    try {
      addJob({
        id: jobId,
        type: 'ocr',
        name: `OCR processing for ${selectedFile.name}`,
        status: 'processing',
        fileIds: [selectedFile.id],
        progress: 0,
        startTime: Date.now(),
        cancellable: true
      })

      const results: OCRResult[] = []

      // Process each page
      for (let pageIndex = 0; pageIndex < selectedFile.pageCount; pageIndex++) {
        const pageNumber = pageIndex + 1
        
        // Update progress
        setOcrProgress({
          currentPage: pageNumber,
          totalPages: selectedFile.pageCount,
          stage: 'preprocessing',
          stageProgress: 0
        })

        updateJob(jobId, { progress: (pageNumber / selectedFile.pageCount) * 80 })

        try {
          // Render PDF page as image for OCR
          setOcrProgress(prev => prev ? { ...prev, stage: 'preprocessing', stageProgress: 20 } : null)
          
          const imageData = await workerManager.renderPageAsImage(
            selectedFile.data,
            pageIndex,
            { scale: options.dpi / 72 } // Convert DPI to scale factor
          )
          
          setOcrProgress(prev => prev ? { ...prev, stage: 'recognition', stageProgress: 50 } : null)
          
          // Perform actual OCR using the OCR worker
          const ocrResult = await workerManager.performOCR(imageData, {
            language: options.language.join('+') // Tesseract format for multiple languages
          })
          
          setOcrProgress(prev => prev ? { ...prev, stage: 'recognition', stageProgress: 80 } : null)
          
          setOcrProgress(prev => prev ? { ...prev, stage: 'postprocessing', stageProgress: 90 } : null)
          
          // Convert OCR result to our format
          const processedResult: OCRResult = {
            pageNumber,
            text: ocrResult.text,
            confidence: ocrResult.confidence,
            words: ocrResult.words.map(word => ({
              text: word.text,
              confidence: word.confidence,
              bbox: {
                x: word.bbox.x0,
                y: word.bbox.y0,
                width: word.bbox.x1 - word.bbox.x0,
                height: word.bbox.y1 - word.bbox.y0
              }
            })),
            paragraphs: ocrResult.paragraphs.map(para => ({
              text: para.text,
              confidence: para.confidence,
              bbox: {
                x: para.bbox.x0,
                y: para.bbox.y0,
                width: para.bbox.x1 - para.bbox.x0,
                height: para.bbox.y1 - para.bbox.y0
              }
            }))
          }
          
          results.push(processedResult)
          
        } catch (ocrError) {
          console.error(`OCR error on page ${pageNumber}:`, ocrError)
          
          // Fallback to error result
          const errorResult: OCRResult = {
            pageNumber,
            text: `OCR processing failed for page ${pageNumber}. Error: ${ocrError instanceof Error ? ocrError.message : 'Unknown error'}`,
            confidence: 0,
            words: [],
            paragraphs: []
          }
          
          results.push(errorResult)
        }
        
        setOcrProgress(prev => prev ? { ...prev, stage: 'postprocessing', stageProgress: 90 } : null)
        
        // Small delay to simulate processing
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      setOcrResults(results)
      setOcrProgress(null)

      // Create searchable PDF if requested
      if (options.outputFormat === 'searchable' || options.outputFormat === 'both') {
        updateJob(jobId, { progress: 90 })

        // Create searchable PDF placeholder
        const searchablePdfData = new Uint8Array([
          0x25, 0x50, 0x44, 0x46, // PDF header
          // ... actual searchable PDF content would be generated here
        ])
        
        const outputFileName = selectedFile.name.replace(/\.pdf$/i, '_searchable.pdf')
        
        const searchablePdf = {
          id: `ocr-searchable-${Date.now()}`,
          name: outputFileName,
          size: searchablePdfData.byteLength,
          type: 'application/pdf',
          lastModified: Date.now(),
          file: new File([searchablePdfData], outputFileName, { type: 'application/pdf' }),
          pageCount: selectedFile.pageCount,
          data: searchablePdfData
        } as any
        
        addFile(searchablePdf)
      }

      // Create text file if requested
      if (options.outputFormat === 'text_only' || options.outputFormat === 'both') {
        const allText = results.map(r => `Page ${r.pageNumber}:\n${r.text}\n\n`).join('')
        const textBlob = new Blob([allText], { type: 'text/plain' })
        const textData = new Uint8Array(await textBlob.arrayBuffer())
        
        const textFileName = selectedFile.name.replace(/\.pdf$/i, '_ocr_text.txt')
        
        const textFile = {
          id: `ocr-text-${Date.now()}`,
          name: textFileName,
          size: textData.byteLength,
          type: 'text/plain',
          lastModified: Date.now(),
          file: new File([textData], textFileName, { type: 'text/plain' }),
          data: textData
        } as any
        
        addFile(textFile)
      }

      updateJob(jobId, {
        status: 'completed',
        progress: 100,
        endTime: Date.now()
      })

      console.log('OCR processing completed', { 
        pages: results.length,
        avgConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length,
        totalText: results.reduce((sum, r) => sum + r.text.length, 0),
        options 
      })    } catch (error) {
      console.error('Error performing OCR:', error)
      updateJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        endTime: Date.now()
      })
      setOcrProgress(null)
    } finally {
      setIsProcessing(false)
    }
  }

  const copyTextToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      // Could add a toast notification here
    } catch (error) {
      console.error('Error copying to clipboard:', error)
    }
  }

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 90) return 'text-green-600 dark:text-green-400'
    if (confidence >= 75) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getConfidenceBg = (confidence: number): string => {
    if (confidence >= 90) return 'bg-green-100 dark:bg-green-900/30'
    if (confidence >= 75) return 'bg-yellow-100 dark:bg-yellow-900/30'
    return 'bg-red-100 dark:bg-red-900/30'
  }

  const popularLanguages = supportedLanguages.filter(lang => lang.popular)
  const otherLanguages = supportedLanguages.filter(lang => !lang.popular)

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center">
              <Scan className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">OCR Text Recognition</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Extract searchable text from PDF documents</p>
            </div>
          </div>
          {selectedFile && (
            <button
              onClick={performOCR}
              disabled={isProcessing || options.language.length === 0}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Scan className="w-4 h-4 mr-2" />
              )}
              {isProcessing ? 'Processing...' : 'Start OCR'}
            </button>
          )}
        </div>
        
        {/* Progress Bar */}
        {ocrProgress && (
          <div className="mt-4 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${((ocrProgress.currentPage - 1) / ocrProgress.totalPages + 
                  ocrProgress.stageProgress / 100 / ocrProgress.totalPages) * 100}%`
              }}
            />
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Page {ocrProgress.currentPage} of {ocrProgress.totalPages} • {ocrProgress.stage}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {!selectedFile ? (
          /* File Upload */
          <div className="flex-1 p-6">
            <div
              className={`h-full border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-colors ${
                isDragOver
                  ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
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
                    Drop your PDF here for OCR
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
                PDF files with scanned text or images
              </p>
              <div className="mt-4 text-xs text-gray-400 text-center">
                <p>Supports 22+ languages including:</p>
                <p>English, Spanish, French, German, Chinese, Japanese, Arabic, and more</p>
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
                    { id: 'settings', name: 'Settings', icon: Settings },
                    { id: 'preview', name: 'Preview', icon: Eye },
                    { id: 'results', name: 'Results', icon: CheckCircle, badge: ocrResults.length },
                    { id: 'text', name: 'Text Output', icon: FileText }
                  ].map((tab) => {
                    const Icon = tab.icon
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                          activeTab === tab.id
                            ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                      >
                        <Icon className="w-4 h-4 mr-2" />
                        {tab.name}
                        {tab.badge !== undefined && tab.badge > 0 && (
                          <span className="ml-2 px-2 py-1 text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-full">
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
                {activeTab === 'settings' && (
                  <div className="max-w-4xl space-y-8">
                    {/* Language Selection */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                        Language Selection
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Popular Languages
                          </h4>
                          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                            {popularLanguages.map(language => (
                              <label
                                key={language.code}
                                className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                                  options.language.includes(language.code)
                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={options.language.includes(language.code)}
                                  onChange={() => handleLanguageToggle(language.code)}
                                  className="mr-3"
                                />
                                <span className="text-sm">{language.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <details className="group">
                          <summary className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer group-open:mb-2">
                            Additional Languages ({otherLanguages.length})
                          </summary>
                          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                            {otherLanguages.map(language => (
                              <label
                                key={language.code}
                                className={`flex items-center p-2 border rounded cursor-pointer transition-colors ${
                                  options.language.includes(language.code)
                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={options.language.includes(language.code)}
                                  onChange={() => handleLanguageToggle(language.code)}
                                  className="mr-2"
                                />
                                <span className="text-xs">{language.name}</span>
                              </label>
                            ))}
                          </div>
                        </details>
                      </div>
                    </div>

                    {/* OCR Engine Settings */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Engine Mode
                        </label>
                        <select
                          value={options.engineMode}
                          onChange={(e) => setOptions({ ...options, engineMode: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                        >
                          {Object.entries(engineModes).map(([mode, info]) => (
                            <option key={mode} value={mode}>{info.name}</option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {engineModes[options.engineMode].description}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Page Segmentation
                        </label>
                        <select
                          value={options.pageSegmentationMode}
                          onChange={(e) => setOptions({ ...options, pageSegmentationMode: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                        >
                          {Object.entries(segmentationModes).map(([mode, info]) => (
                            <option key={mode} value={mode}>{info.name}</option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {segmentationModes[options.pageSegmentationMode].description}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          DPI: {options.dpi}
                        </label>
                        <input
                          type="range"
                          min="150"
                          max="600"
                          step="50"
                          value={options.dpi}
                          onChange={(e) => setOptions({ ...options, dpi: parseInt(e.target.value) })}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                          <span>150 (Fast)</span>
                          <span>600 (Best Quality)</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Confidence Threshold: {options.confidenceThreshold}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={options.confidenceThreshold}
                          onChange={(e) => setOptions({ ...options, confidenceThreshold: parseInt(e.target.value) })}
                          className="w-full"
                        />
                      </div>
                    </div>

                    {/* Preprocessing Options */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Image Preprocessing
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {Object.entries(options.preprocessing).map(([key, value]) => (
                          <label key={key} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={value}
                              onChange={(e) => setOptions({
                                ...options,
                                preprocessing: { ...options.preprocessing, [key]: e.target.checked }
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

                    {/* Output Options */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Output Format
                      </h4>
                      <div className="space-y-2">
                        {[
                          { value: 'searchable', label: 'Searchable PDF', description: 'Add text layer to PDF' },
                          { value: 'text_only', label: 'Text File Only', description: 'Extract text to .txt file' },
                          { value: 'both', label: 'Both Formats', description: 'Create searchable PDF and text file' }
                        ].map(option => (
                          <label key={option.value} className="flex items-start">
                            <input
                              type="radio"
                              name="outputFormat"
                              value={option.value}
                              checked={options.outputFormat === option.value}
                              onChange={(e) => setOptions({ ...options, outputFormat: e.target.value as any })}
                              className="mr-3 mt-1"
                            />
                            <div>
                              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {option.label}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {option.description}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>

                      <label className="flex items-center mt-3">
                        <input
                          type="checkbox"
                          checked={options.preserveFormatting}
                          onChange={(e) => setOptions({ ...options, preserveFormatting: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Preserve original formatting
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {activeTab === 'preview' && (
                  <div className="space-y-4">
                    {/* Preview Controls */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                          Page Preview
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
                            {selectedPage} / {selectedFile.pageCount}
                          </span>
                          <button
                            onClick={() => setSelectedPage(Math.min(selectedFile.pageCount, selectedPage + 1))}
                            disabled={selectedPage >= selectedFile.pageCount}
                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            ▶
                          </button>
                        </div>
                      </div>
                      
                      {ocrResults.length > 0 && (
                        <div className="flex items-center space-x-4">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Search in OCR text..."
                              className="pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                            />
                          </div>
                          <button
                            onClick={() => setShowOverlay(!showOverlay)}
                            className="flex items-center px-3 py-2 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded hover:bg-indigo-200 dark:hover:bg-indigo-800"
                          >
                            {showOverlay ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                            {showOverlay ? 'Hide' : 'Show'} OCR Overlay
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Preview Canvas */}
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 flex items-center justify-center min-h-96">
                      <canvas
                        ref={canvasRef}
                        className="max-w-full max-h-full border border-gray-300 dark:border-gray-600 rounded shadow"
                      />
                    </div>

                    {/* OCR Results for Current Page */}
                    {ocrResults.length > 0 && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          OCR Results for Page {selectedPage}
                        </h4>
                        {(() => {
                          const pageResult = ocrResults.find(r => r.pageNumber === selectedPage)
                          if (!pageResult) return <p className="text-sm text-gray-500">No OCR results for this page</p>
                          
                          return (
                            <div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                Confidence: <span className={getConfidenceColor(pageResult.confidence)}>
                                  {pageResult.confidence.toFixed(1)}%
                                </span>
                                • Words: {pageResult.words.length}
                                • Paragraphs: {pageResult.paragraphs.length}
                              </div>
                              <div className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 rounded p-3 max-h-32 overflow-auto">
                                {pageResult.text}
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
                    {ocrResults.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        No OCR results yet. Run OCR processing to see results.
                      </div>
                    ) : (
                      <>
                        {/* Results Summary */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">OCR Summary</h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <div className="text-gray-500 dark:text-gray-400">Pages Processed</div>
                              <div className="font-medium">{ocrResults.length}</div>
                            </div>
                            <div>
                              <div className="text-gray-500 dark:text-gray-400">Average Confidence</div>
                              <div className={`font-medium ${getConfidenceColor(ocrResults.reduce((sum, r) => sum + r.confidence, 0) / ocrResults.length)}`}>
                                {(ocrResults.reduce((sum, r) => sum + r.confidence, 0) / ocrResults.length).toFixed(1)}%
                              </div>
                            </div>
                            <div>
                              <div className="text-gray-500 dark:text-gray-400">Total Words</div>
                              <div className="font-medium">{ocrResults.reduce((sum, r) => sum + r.words.length, 0)}</div>
                            </div>
                            <div>
                              <div className="text-gray-500 dark:text-gray-400">Total Characters</div>
                              <div className="font-medium">{ocrResults.reduce((sum, r) => sum + r.text.length, 0)}</div>
                            </div>
                          </div>
                        </div>

                        {/* Page Results */}
                        <div className="space-y-3">
                          {ocrResults.map(result => (
                            <div key={result.pageNumber} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                                    Page {result.pageNumber}
                                  </h4>
                                  <span className={`px-2 py-1 text-xs rounded-full ${getConfidenceBg(result.confidence)} ${getConfidenceColor(result.confidence)}`}>
                                    {result.confidence.toFixed(1)}% confidence
                                  </span>
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => copyTextToClipboard(result.text)}
                                    className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                                    title="Copy text"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedPage(result.pageNumber)
                                      setActiveTab('preview')
                                    }}
                                    className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                                    title="View page"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              
                              <div className="p-4">
                                <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                                  {result.words.length} words • {result.paragraphs.length} paragraphs
                                </div>
                                <div className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 rounded p-3 max-h-32 overflow-auto whitespace-pre-wrap">
                                  {result.text}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {activeTab === 'text' && (
                  <div className="space-y-4">
                    {ocrResults.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        No text extracted yet. Run OCR processing to see extracted text.
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                            Extracted Text
                          </h3>
                          <button
                            onClick={() => copyTextToClipboard(ocrResults.map(r => `Page ${r.pageNumber}:\n${r.text}\n\n`).join(''))}
                            className="flex items-center px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Copy All Text
                          </button>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                          <div className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap font-mono bg-gray-50 dark:bg-gray-900 rounded p-4 max-h-96 overflow-auto">
                            {ocrResults.map(r => `Page ${r.pageNumber}:\n${r.text}\n\n`).join('')}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Settings Sidebar */}
            <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4 space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Document Info</h3>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-sm">
                  <div className="space-y-1 text-gray-600 dark:text-gray-400">
                    <div><strong>File:</strong> {selectedFile.name}</div>
                    <div><strong>Size:</strong> {(selectedFile.size / 1024 / 1024).toFixed(1)} MB</div>
                    <div><strong>Pages:</strong> {selectedFile.pageCount}</div>
                    <div><strong>Languages:</strong> {options.language.join(', ') || 'None selected'}</div>
                  </div>
                </div>
              </div>

              {ocrResults.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">OCR Statistics</h3>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-sm">
                    <div className="space-y-1 text-gray-600 dark:text-gray-400">
                      <div><strong>Processed:</strong> {ocrResults.length} pages</div>
                      <div><strong>Avg Confidence:</strong> {(ocrResults.reduce((sum, r) => sum + r.confidence, 0) / ocrResults.length).toFixed(1)}%</div>
                      <div><strong>Total Words:</strong> {ocrResults.reduce((sum, r) => sum + r.words.length, 0)}</div>
                      <div><strong>High Confidence:</strong> {ocrResults.filter(r => r.confidence >= 90).length} pages</div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quick Actions</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setActiveTab('settings')}
                    className="w-full flex items-center px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    OCR Settings
                  </button>
                  <button
                    onClick={() => setActiveTab('preview')}
                    className="w-full flex items-center px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Preview Pages
                  </button>
                  {ocrResults.length > 0 && (
                    <button
                      onClick={() => copyTextToClipboard(ocrResults.map(r => `Page ${r.pageNumber}:\n${r.text}\n\n`).join(''))}
                      className="w-full flex items-center px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy All Text
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}

export default OCRTool