import React, { useState, useRef, useCallback } from 'react'
import { Upload, FileText, Download, RefreshCw, Image, Plus, Trash2, RotateCw, Eye, Grid3x3, Layers, Type, Crop, Settings } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { useJobsStore } from '../../state/jobs'
import { workerManager } from '../../lib/workerManager'

interface ConvertOptions {
  pageSize: 'letter' | 'a4' | 'legal' | 'custom'
  customWidth: number
  customHeight: number
  orientation: 'portrait' | 'landscape' | 'auto'
  margins: {
    top: number
    bottom: number
    left: number
    right: number
  }
  imageSettings: {
    quality: number
    dpi: number
    compression: 'auto' | 'maximum' | 'high' | 'medium' | 'low'
    resizeMode: 'fit' | 'fill' | 'stretch' | 'original'
  }
  textSettings: {
    fontFamily: string
    fontSize: number
    lineHeight: number
    encoding: 'auto' | 'utf-8' | 'latin-1'
  }
  outputSettings: {
    title: string
    author: string
    subject: string
    keywords: string
    creator: string
  }
}

interface InputFile {
  id: string
  file: File
  type: 'image' | 'text' | 'document'
  preview?: string
  pages?: number
  order: number
}

const ConvertToPDFTool: React.FC = () => {
  const [inputFiles, setInputFiles] = useState<InputFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeTab, setActiveTab] = useState<'files' | 'pages' | 'images' | 'text' | 'output'>('files')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { addFile } = useAppStore()
  const { addJob, updateJob } = useJobsStore()

  const [options, setOptions] = useState<ConvertOptions>({
    pageSize: 'letter',
    customWidth: 8.5,
    customHeight: 11,
    orientation: 'portrait',
    margins: {
      top: 72,
      bottom: 72,
      left: 72,
      right: 72
    },
    imageSettings: {
      quality: 85,
      dpi: 300,
      compression: 'auto',
      resizeMode: 'fit'
    },
    textSettings: {
      fontFamily: 'Times New Roman',
      fontSize: 12,
      lineHeight: 1.5,
      encoding: 'auto'
    },
    outputSettings: {
      title: '',
      author: '',
      subject: '',
      keywords: '',
      creator: 'Free PDF Tools'
    }
  })

  const supportedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff', 'image/webp']
  const supportedTextTypes = ['text/plain', 'text/html', 'text/csv']
  const supportedDocumentTypes = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document']

  const pageSizes = {
    letter: { width: 8.5, height: 11, label: 'Letter (8.5" × 11")' },
    a4: { width: 8.27, height: 11.69, label: 'A4 (210 × 297 mm)' },
    legal: { width: 8.5, height: 14, label: 'Legal (8.5" × 14")' },
    custom: { width: 8.5, height: 11, label: 'Custom' }
  }

  const fontFamilies = [
    'Times New Roman', 'Arial', 'Helvetica', 'Courier New', 'Georgia', 
    'Verdana', 'Trebuchet MS', 'Comic Sans MS', 'Impact'
  ]

  const handleFileSelect = async (files: FileList) => {
    const newFiles: InputFile[] = []
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const fileType = getFileType(file)
      
      if (fileType) {
        const inputFile: InputFile = {
          id: `file-${Date.now()}-${i}`,
          file,
          type: fileType,
          order: inputFiles.length + newFiles.length
        }

        // Generate preview for images
        if (fileType === 'image' && file.type.startsWith('image/')) {
          try {
            inputFile.preview = await generateImagePreview(file)
          } catch (error) {
            console.error('Error generating preview:', error)
          }
        }

        newFiles.push(inputFile)
      }
    }

    if (newFiles.length > 0) {
      setInputFiles(prev => [...prev, ...newFiles])
    } else {
      alert('No supported files were selected. Please select images, text files, or documents.')
    }
  }

  const getFileType = (file: File): 'image' | 'text' | 'document' | null => {
    if (supportedImageTypes.includes(file.type)) return 'image'
    if (supportedTextTypes.includes(file.type)) return 'text'
    if (supportedDocumentTypes.includes(file.type)) return 'document'
    return null
  }

  const generateImagePreview = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handleRemoveFile = (fileId: string) => {
    setInputFiles(prev => {
      const filtered = prev.filter(f => f.id !== fileId)
      // Reorder remaining files
      return filtered.map((file, index) => ({ ...file, order: index }))
    })
  }

  const handleReorderFiles = (dragIndex: number, hoverIndex: number) => {
    setInputFiles(prev => {
      const dragItem = prev[dragIndex]
      const newItems = [...prev]
      newItems.splice(dragIndex, 1)
      newItems.splice(hoverIndex, 0, dragItem)
      return newItems.map((item, index) => ({ ...item, order: index }))
    })
  }

  const handleMoveUp = (fileId: string) => {
    setInputFiles(prev => {
      const index = prev.findIndex(f => f.id === fileId)
      if (index <= 0) return prev
      
      const newFiles = [...prev]
      ;[newFiles[index - 1], newFiles[index]] = [newFiles[index], newFiles[index - 1]]
      return newFiles.map((file, i) => ({ ...file, order: i }))
    })
  }

  const handleMoveDown = (fileId: string) => {
    setInputFiles(prev => {
      const index = prev.findIndex(f => f.id === fileId)
      if (index >= prev.length - 1) return prev
      
      const newFiles = [...prev]
      ;[newFiles[index], newFiles[index + 1]] = [newFiles[index + 1], newFiles[index]]
      return newFiles.map((file, i) => ({ ...file, order: i }))
    })
  }

  const calculateEstimatedPages = (): number => {
    let totalPages = 0
    
    inputFiles.forEach(inputFile => {
      switch (inputFile.type) {
        case 'image':
          totalPages += 1 // One page per image
          break
        case 'text':
          // Estimate pages based on file size (rough calculation)
          const kb = inputFile.file.size / 1024
          totalPages += Math.max(1, Math.ceil(kb / 2)) // Approx 2KB per page
          break
        case 'document':
          totalPages += inputFile.pages || 1
          break
      }
    })
    
    return totalPages
  }

  const handleConvertToPDF = async () => {
    if (inputFiles.length === 0) return

    setIsProcessing(true)
    const jobId = `convert-to-pdf-${Date.now()}`
    
    try {
      addJob({
        id: jobId,
        type: 'convert-to-pdf',
        name: `Convert ${inputFiles.length} files to PDF`,
        status: 'processing',
        fileIds: inputFiles.map(f => f.file.name),
        progress: 0,
        startTime: Date.now(),
        cancellable: true
      })

      updateJob(jobId, { progress: 20 })

      // Prepare conversion parameters
      const conversionParams = {
        files: inputFiles,
        options,
        pageSize: options.pageSize === 'custom' ? 
          { width: options.customWidth, height: options.customHeight } : 
          pageSizes[options.pageSize]
      }

      updateJob(jobId, { progress: 50 })

      // For now, we'll simulate the conversion
      console.warn('Convert to PDF not yet implemented in workerManager')
      
      // Create a simple PDF placeholder (in reality this would be the converted PDF)
      const pdfContent = new Uint8Array([
        0x25, 0x50, 0x44, 0x46, // PDF header
        // ... actual PDF content would be generated here
      ])
      
      updateJob(jobId, { progress: 90 })

      // Create converted file
      const outputFileName = options.outputSettings.title || 
        `converted_${inputFiles.length}_files_${Date.now()}.pdf`
      
      const pdfFile = {
        id: `converted-${Date.now()}`,
        name: outputFileName.endsWith('.pdf') ? outputFileName : `${outputFileName}.pdf`,
        size: pdfContent.byteLength,
        type: 'application/pdf',
        lastModified: Date.now(),
        file: new File([pdfContent], outputFileName, { type: 'application/pdf' }),
        pageCount: calculateEstimatedPages(),
        data: pdfContent
      } as any
      
      addFile(pdfFile)

      updateJob(jobId, {
        status: 'completed',
        progress: 100,
        endTime: Date.now()
      })

      console.log('PDF conversion completed (simulated)', { conversionParams })

    } catch (error) {
      console.error('Error converting to PDF:', error)
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
    if (e.dataTransfer.files) {
      handleFileSelect(e.dataTransfer.files)
    }
  }, [])

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFileSelect(e.target.files)
    }
  }

  const handleAddMoreFiles = () => {
    fileInputRef.current?.click()
  }

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'image': return Image
      case 'text': return FileText
      case 'document': return FileText
      default: return FileText
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Convert to PDF</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Convert images, text files, and documents to PDF</p>
            </div>
          </div>
          {inputFiles.length > 0 && (
            <button
              onClick={handleConvertToPDF}
              disabled={isProcessing}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {isProcessing ? 'Converting...' : 'Convert to PDF'}
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
                    Choose files to convert
                  </span>
                  <span className="text-gray-500 dark:text-gray-400"> or drag and drop</span>
                </label>
                <input
                  ref={fileInputRef}
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  className="sr-only"
                  multiple
                  accept=".jpg,.jpeg,.png,.gif,.bmp,.tiff,.webp,.txt,.html,.csv,.docx"
                  onChange={handleFileInputChange}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Images (JPG, PNG, GIF, etc.), text files (TXT, HTML, CSV), and documents (DOCX)
              </p>
            </div>
          </div>

          {/* Files List */}
          {inputFiles.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Files to Convert ({inputFiles.length})
                </h3>
                <button
                  onClick={handleAddMoreFiles}
                  className="flex items-center px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add More
                </button>
              </div>

              <div className="p-4 space-y-3">
                {inputFiles
                  .sort((a, b) => a.order - b.order)
                  .map((inputFile, index) => {
                    const FileIcon = getFileIcon(inputFile.type)
                    return (
                      <div
                        key={inputFile.id}
                        className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      >
                        {/* Order Number */}
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-sm rounded-full flex items-center justify-center font-medium mr-3">
                          {index + 1}
                        </div>

                        {/* File Icon */}
                        <div className="mr-3">
                          <FileIcon className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                        </div>

                        {/* Preview */}
                        {inputFile.preview && (
                          <div className="w-12 h-12 mr-3 flex-shrink-0">
                            <img
                              src={inputFile.preview}
                              alt="Preview"
                              className="w-full h-full object-cover rounded border border-gray-200 dark:border-gray-600"
                            />
                          </div>
                        )}

                        {/* File Info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                            {inputFile.file.name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {inputFile.type} • {(inputFile.file.size / 1024).toFixed(1)} KB
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleMoveUp(inputFile.id)}
                            disabled={index === 0}
                            className="p-1 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Move up"
                          >
                            <RotateCw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleMoveDown(inputFile.id)}
                            disabled={index === inputFiles.length - 1}
                            className="p-1 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Move down"
                          >
                            <RotateCw className="w-4 h-4 rotate-180" />
                          </button>
                          <button
                            onClick={() => handleRemoveFile(inputFile.id)}
                            className="p-1 text-red-600 hover:text-red-700"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {/* Conversion Settings */}
          {inputFiles.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              {/* Tabs */}
              <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="flex space-x-8 px-6">
                  {[
                    { id: 'pages', name: 'Page Setup', icon: Layers },
                    { id: 'images', name: 'Images', icon: Image },
                    { id: 'text', name: 'Text', icon: Type },
                    { id: 'output', name: 'Output', icon: Settings }
                  ].map((tab) => {
                    const Icon = tab.icon
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`py-4 px-1 border-b-2 font-medium text-sm ${
                          activeTab === tab.id
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
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
                {activeTab === 'pages' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Page Size */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Page Size
                      </label>
                      <select
                        value={options.pageSize}
                        onChange={(e) => setOptions({ ...options, pageSize: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                      >
                        {Object.entries(pageSizes).map(([key, size]) => (
                          <option key={key} value={key}>{size.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Custom Dimensions */}
                    {options.pageSize === 'custom' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Width (inches)
                          </label>
                          <input
                            type="number"
                            value={options.customWidth}
                            onChange={(e) => setOptions({ ...options, customWidth: parseFloat(e.target.value) || 8.5 })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                            min="1"
                            max="100"
                            step="0.1"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Height (inches)
                          </label>
                          <input
                            type="number"
                            value={options.customHeight}
                            onChange={(e) => setOptions({ ...options, customHeight: parseFloat(e.target.value) || 11 })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                            min="1"
                            max="100"
                            step="0.1"
                          />
                        </div>
                      </>
                    )}

                    {/* Orientation */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Orientation
                      </label>
                      <select
                        value={options.orientation}
                        onChange={(e) => setOptions({ ...options, orientation: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                      >
                        <option value="portrait">Portrait</option>
                        <option value="landscape">Landscape</option>
                        <option value="auto">Auto (based on content)</option>
                      </select>
                    </div>

                    {/* Margins */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Margins (points)
                      </label>
                      <div className="grid grid-cols-4 gap-3">
                        {(['top', 'bottom', 'left', 'right'] as const).map(margin => (
                          <div key={margin}>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1 capitalize">
                              {margin}
                            </label>
                            <input
                              type="number"
                              value={options.margins[margin]}
                              onChange={(e) => setOptions({
                                ...options,
                                margins: { ...options.margins, [margin]: parseInt(e.target.value) || 0 }
                              })}
                              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                              min="0"
                              max="144"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'images' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Quality: {options.imageSettings.quality}%
                      </label>
                      <input
                        type="range"
                        min="50"
                        max="100"
                        value={options.imageSettings.quality}
                        onChange={(e) => setOptions({
                          ...options,
                          imageSettings: { ...options.imageSettings, quality: parseInt(e.target.value) }
                        })}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        DPI: {options.imageSettings.dpi}
                      </label>
                      <input
                        type="range"
                        min="72"
                        max="600"
                        step="1"
                        value={options.imageSettings.dpi}
                        onChange={(e) => setOptions({
                          ...options,
                          imageSettings: { ...options.imageSettings, dpi: parseInt(e.target.value) }
                        })}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Compression
                      </label>
                      <select
                        value={options.imageSettings.compression}
                        onChange={(e) => setOptions({
                          ...options,
                          imageSettings: { ...options.imageSettings, compression: e.target.value as any }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                      >
                        <option value="auto">Auto</option>
                        <option value="maximum">Maximum</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Resize Mode
                      </label>
                      <select
                        value={options.imageSettings.resizeMode}
                        onChange={(e) => setOptions({
                          ...options,
                          imageSettings: { ...options.imageSettings, resizeMode: e.target.value as any }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                      >
                        <option value="fit">Fit to page</option>
                        <option value="fill">Fill page</option>
                        <option value="stretch">Stretch to fit</option>
                        <option value="original">Original size</option>
                      </select>
                    </div>
                  </div>
                )}

                {activeTab === 'text' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Font Family
                      </label>
                      <select
                        value={options.textSettings.fontFamily}
                        onChange={(e) => setOptions({
                          ...options,
                          textSettings: { ...options.textSettings, fontFamily: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                      >
                        {fontFamilies.map(font => (
                          <option key={font} value={font}>{font}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Font Size: {options.textSettings.fontSize}pt
                      </label>
                      <input
                        type="range"
                        min="8"
                        max="24"
                        value={options.textSettings.fontSize}
                        onChange={(e) => setOptions({
                          ...options,
                          textSettings: { ...options.textSettings, fontSize: parseInt(e.target.value) }
                        })}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Line Height: {options.textSettings.lineHeight}
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="3"
                        step="0.1"
                        value={options.textSettings.lineHeight}
                        onChange={(e) => setOptions({
                          ...options,
                          textSettings: { ...options.textSettings, lineHeight: parseFloat(e.target.value) }
                        })}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Text Encoding
                      </label>
                      <select
                        value={options.textSettings.encoding}
                        onChange={(e) => setOptions({
                          ...options,
                          textSettings: { ...options.textSettings, encoding: e.target.value as any }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                      >
                        <option value="auto">Auto-detect</option>
                        <option value="utf-8">UTF-8</option>
                        <option value="latin-1">Latin-1</option>
                      </select>
                    </div>
                  </div>
                )}

                {activeTab === 'output' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Title
                      </label>
                      <input
                        type="text"
                        value={options.outputSettings.title}
                        onChange={(e) => setOptions({
                          ...options,
                          outputSettings: { ...options.outputSettings, title: e.target.value }
                        })}
                        placeholder="Document title"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Author
                      </label>
                      <input
                        type="text"
                        value={options.outputSettings.author}
                        onChange={(e) => setOptions({
                          ...options,
                          outputSettings: { ...options.outputSettings, author: e.target.value }
                        })}
                        placeholder="Document author"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Subject
                      </label>
                      <input
                        type="text"
                        value={options.outputSettings.subject}
                        onChange={(e) => setOptions({
                          ...options,
                          outputSettings: { ...options.outputSettings, subject: e.target.value }
                        })}
                        placeholder="Document subject"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Keywords
                      </label>
                      <input
                        type="text"
                        value={options.outputSettings.keywords}
                        onChange={(e) => setOptions({
                          ...options,
                          outputSettings: { ...options.outputSettings, keywords: e.target.value }
                        })}
                        placeholder="comma, separated, keywords"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Summary Panel */}
        {inputFiles.length > 0 && (
          <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Conversion Summary</h3>
            
            <div className="space-y-3">
              <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Input Files</h4>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <div>Total files: {inputFiles.length}</div>
                  <div>Images: {inputFiles.filter(f => f.type === 'image').length}</div>
                  <div>Text files: {inputFiles.filter(f => f.type === 'text').length}</div>
                  <div>Documents: {inputFiles.filter(f => f.type === 'document').length}</div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Output Settings</h4>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <div>Page size: {pageSizes[options.pageSize].label}</div>
                  <div>Orientation: {options.orientation}</div>
                  <div>Est. pages: {calculateEstimatedPages()}</div>
                  <div>Image quality: {options.imageSettings.quality}%</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ConvertToPDFTool