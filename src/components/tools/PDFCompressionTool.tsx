import React, { useState, useRef, useCallback } from 'react'
import { Upload, Minimize2, RefreshCw, AlertCircle, Zap, Settings, BarChart3, Target } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { useJobsStore } from '../../state/jobs'
import { workerManager } from '../../lib/workerManager'
import { globalBatchProcessor } from '../../lib/batchProcessor'

interface CompressionConfig {
  preset: 'web' | 'print' | 'archive' | 'maximum' | 'custom'
  quality: {
    images: number // 0.1 to 1.0
    overall: number // 0.1 to 1.0
  }
  optimization: {
    removeUnusedObjects: boolean
    optimizeImages: boolean
    compressStreams: boolean
    linearize: boolean
    removeMetadata: boolean
    removeThumbnails: boolean
    removeBookmarks: boolean
    removeFormFields: boolean
    removeAnnotations: boolean
  }
  imageProcessing: {
    downsampleImages: boolean
    maxImageDPI: number
    grayscaleCompression: boolean
    monochromeCompression: boolean
    jpegQuality: number
  }
  advanced: {
    objectStreams: boolean
    crossRefStreams: boolean
    removeUnusedFonts: boolean
    subsettingThreshold: number
    compressText: boolean
  }
}

interface CompressionPreset {
  id: string
  name: string
  description: string
  targetReduction: string
  config: CompressionConfig
}

const COMPRESSION_PRESETS: CompressionPreset[] = [
  {
    id: 'web',
    name: 'Web Optimized',
    description: 'Balanced compression for web viewing',
    targetReduction: '40-60%',
    config: {
      preset: 'web',
      quality: { images: 0.8, overall: 0.85 },
      optimization: {
        removeUnusedObjects: true,
        optimizeImages: true,
        compressStreams: true,
        linearize: true,
        removeMetadata: false,
        removeThumbnails: false,
        removeBookmarks: false,
        removeFormFields: false,
        removeAnnotations: false
      },
      imageProcessing: {
        downsampleImages: true,
        maxImageDPI: 150,
        grayscaleCompression: true,
        monochromeCompression: true,
        jpegQuality: 80
      },
      advanced: {
        objectStreams: true,
        crossRefStreams: true,
        removeUnusedFonts: false,
        subsettingThreshold: 35,
        compressText: true
      }
    }
  },
  {
    id: 'print',
    name: 'Print Quality',
    description: 'High quality suitable for printing',
    targetReduction: '20-40%',
    config: {
      preset: 'print',
      quality: { images: 0.9, overall: 0.95 },
      optimization: {
        removeUnusedObjects: true,
        optimizeImages: false,
        compressStreams: true,
        linearize: false,
        removeMetadata: false,
        removeThumbnails: false,
        removeBookmarks: false,
        removeFormFields: false,
        removeAnnotations: false
      },
      imageProcessing: {
        downsampleImages: false,
        maxImageDPI: 300,
        grayscaleCompression: false,
        monochromeCompression: true,
        jpegQuality: 90
      },
      advanced: {
        objectStreams: true,
        crossRefStreams: true,
        removeUnusedFonts: false,
        subsettingThreshold: 50,
        compressText: true
      }
    }
  },
  {
    id: 'archive',
    name: 'Archive Quality',
    description: 'Minimal compression for long-term storage',
    targetReduction: '10-25%',
    config: {
      preset: 'archive',
      quality: { images: 1.0, overall: 1.0 },
      optimization: {
        removeUnusedObjects: true,
        optimizeImages: false,
        compressStreams: true,
        linearize: false,
        removeMetadata: false,
        removeThumbnails: false,
        removeBookmarks: false,
        removeFormFields: false,
        removeAnnotations: false
      },
      imageProcessing: {
        downsampleImages: false,
        maxImageDPI: 600,
        grayscaleCompression: false,
        monochromeCompression: false,
        jpegQuality: 95
      },
      advanced: {
        objectStreams: false,
        crossRefStreams: false,
        removeUnusedFonts: false,
        subsettingThreshold: 100,
        compressText: false
      }
    }
  },
  {
    id: 'maximum',
    name: 'Maximum Compression',
    description: 'Smallest file size, may reduce quality',
    targetReduction: '60-80%',
    config: {
      preset: 'maximum',
      quality: { images: 0.6, overall: 0.7 },
      optimization: {
        removeUnusedObjects: true,
        optimizeImages: true,
        compressStreams: true,
        linearize: true,
        removeMetadata: true,
        removeThumbnails: true,
        removeBookmarks: false,
        removeFormFields: false,
        removeAnnotations: false
      },
      imageProcessing: {
        downsampleImages: true,
        maxImageDPI: 100,
        grayscaleCompression: true,
        monochromeCompression: true,
        jpegQuality: 60
      },
      advanced: {
        objectStreams: true,
        crossRefStreams: true,
        removeUnusedFonts: true,
        subsettingThreshold: 20,
        compressText: true
      }
    }
  }
]

interface FileAnalysis {
  originalSize: number
  estimatedSize: number
  compressionRatio: number
  imageCount: number
  pageCount: number
  hasMetadata: boolean
  hasForms: boolean
  hasAnnotations: boolean
}

const PDFCompressionTool: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [compressionConfig, setCompressionConfig] = useState<CompressionConfig>(COMPRESSION_PRESETS[0].config)
  const [activePreset, setActivePreset] = useState<string>(COMPRESSION_PRESETS[0].id)
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)
  const [fileAnalyses, setFileAnalyses] = useState<Map<string, FileAnalysis>>(new Map())
  const [totalSavings, setTotalSavings] = useState<{ original: number; estimated: number; savings: number }>({
    original: 0,
    estimated: 0,
    savings: 0
  })
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addFile } = useAppStore()
  const { addJob, updateJob } = useJobsStore()

  const analyzeFile = useCallback(async (file: File): Promise<FileAnalysis> => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      const { loadPDFDocument, getPDFInfo, analyzeContent } = await import('../../lib/pdf')
      
      const doc = await loadPDFDocument(uint8Array)
      const info = await getPDFInfo(doc)
      const analysis = await analyzeContent(doc)
      
      // Estimate compression based on current settings
      const imageReduction = compressionConfig.imageProcessing.downsampleImages ? 0.3 : 0.1
      const generalReduction = compressionConfig.quality.overall
      const metadataSize = analysis.hasImages ? file.size * 0.05 : 0
      
      const estimatedReduction = 1 - (generalReduction * (1 - imageReduction))
      const estimatedSize = Math.round(file.size * (1 - estimatedReduction) + metadataSize)
      
      return {
        originalSize: file.size,
        estimatedSize: Math.max(estimatedSize, file.size * 0.1), // Minimum 10% of original
        compressionRatio: Math.round((1 - estimatedSize / file.size) * 100),
        imageCount: analysis.hasImages ? 5 : 0, // Estimated
        pageCount: info.pageCount,
        hasMetadata: false, // Simplified
        hasForms: false, // Simplified
        hasAnnotations: false // Simplified
      }
    } catch (error) {
      console.error('File analysis failed:', error)
      return {
        originalSize: file.size,
        estimatedSize: file.size * 0.8,
        compressionRatio: 20,
        imageCount: 0,
        pageCount: 0,
        hasMetadata: false,
        hasForms: false,
        hasAnnotations: false
      }
    }
  }, [compressionConfig])

  const handleFileSelect = async (files: FileList) => {
    const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf')
    setSelectedFiles(prev => [...prev, ...pdfFiles])

    // Analyze each file
    const newAnalyses = new Map(fileAnalyses)
    for (const file of pdfFiles) {
      const analysis = await analyzeFile(file)
      newAnalyses.set(file.name, analysis)
    }
    setFileAnalyses(newAnalyses)
    
    // Calculate total savings
    calculateTotalSavings(newAnalyses)
  }

  const calculateTotalSavings = (analyses: Map<string, FileAnalysis>) => {
    let totalOriginal = 0
    let totalEstimated = 0
    
    analyses.forEach(analysis => {
      totalOriginal += analysis.originalSize
      totalEstimated += analysis.estimatedSize
    })
    
    setTotalSavings({
      original: totalOriginal,
      estimated: totalEstimated,
      savings: totalOriginal > 0 ? Math.round(((totalOriginal - totalEstimated) / totalOriginal) * 100) : 0
    })
  }

  const applyPreset = (presetId: string) => {
    const preset = COMPRESSION_PRESETS.find(p => p.id === presetId)
    if (preset) {
      setCompressionConfig(preset.config)
      setActivePreset(presetId)
      
      // Re-analyze files with new settings
      if (selectedFiles.length > 0) {
        reanalyzeFiles()
      }
    }
  }

  const reanalyzeFiles = async () => {
    const newAnalyses = new Map<string, FileAnalysis>()
    for (const file of selectedFiles) {
      const analysis = await analyzeFile(file)
      newAnalyses.set(file.name, analysis)
    }
    setFileAnalyses(newAnalyses)
    calculateTotalSavings(newAnalyses)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const droppedFiles = e.dataTransfer.files
    handleFileSelect(droppedFiles)
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
    if (e.target.files) {
      handleFileSelect(e.target.files)
    }
  }

  const removeFile = (index: number) => {
    const fileToRemove = selectedFiles[index]
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
    
    const newAnalyses = new Map(fileAnalyses)
    newAnalyses.delete(fileToRemove.name)
    setFileAnalyses(newAnalyses)
    calculateTotalSavings(newAnalyses)
  }

  const handleCompress = async () => {
    if (selectedFiles.length === 0) return
    
    setIsProcessing(true)
    const jobId = Date.now().toString()
    
    try {
      addJob({
        id: jobId,
        type: 'compress',
        name: 'Compress ' + selectedFiles.length + ' file(s)',
        status: 'processing',
        fileIds: selectedFiles.map(f => f.name),
        progress: 0,
        startTime: Date.now(),
        cancellable: true
      })

      const files = await Promise.all(
        selectedFiles.map(f => f.arrayBuffer().then(ab => new Uint8Array(ab)))
      )
      
      const results = await workerManager.submitJob({
        type: 'compress',
        files,
        options: {
          config: compressionConfig,
          onProgress: (progress: number) => {
            updateJob(jobId, { progress })
          }
        }
      })
      
      // Calculate actual compression results
      let totalOriginal = 0
      let totalCompressed = 0
      
      results.forEach((fileData: Uint8Array, index: number) => {
        const originalFile = selectedFiles[index]
        const compressedFileName = generateCompressedFileName(originalFile.name)
        const pdfFile = {
          id: Date.now().toString(),
          name: compressedFileName,
          size: fileData.byteLength,
          type: 'application/pdf',
          lastModified: Date.now(),
          file: new File([new Uint8Array(fileData)], compressedFileName, { type: 'application/pdf' }),
          pageCount: selectedFiles.length > 0 ? 1 : 1,
          data: fileData
        } as any
        addFile(pdfFile)
        
        totalOriginal += originalFile.size
        totalCompressed += fileData.byteLength
      })
      
      const actualReduction = Math.round(((totalOriginal - totalCompressed) / totalOriginal) * 100)
      
      updateJob(jobId, {
        status: 'completed',
        progress: 100,
        result: {
          processedFiles: results.length,
          originalSize: totalOriginal,
          compressedSize: totalCompressed,
          compressionRatio: actualReduction,
          preset: activePreset
        }
      })
      
      setSelectedFiles([])
      setFileAnalyses(new Map())
      setTotalSavings({ original: 0, estimated: 0, savings: 0 })
      
    } catch (error) {
      console.error('Compression failed:', error)
      updateJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const addToBatch = () => {
    if (selectedFiles.length === 0) return

    globalBatchProcessor.addOperation({
      type: 'compress',
      files: selectedFiles,
      options: { config: compressionConfig },
      priority: 2,
      onComplete: async (results) => {
        results.forEach((fileData: Uint8Array, index: number) => {
          const originalFile = selectedFiles[index]
          const compressedFileName = generateCompressedFileName(originalFile.name)
          const pdfFile = {
            id: Date.now().toString(),
            name: compressedFileName,
            size: fileData.byteLength,
            type: 'application/pdf',
            lastModified: Date.now(),
            file: new File([new Uint8Array(fileData)], compressedFileName, { type: 'application/pdf' }),
            pageCount: 1,
            data: fileData
          } as any
          addFile(pdfFile)
        })
      }
    })

    setSelectedFiles([])
    setFileAnalyses(new Map())
    setTotalSavings({ original: 0, estimated: 0, savings: 0 })
  }

  const generateCompressedFileName = (originalName: string) => {
    const baseName = originalName.replace('.pdf', '')
    const preset = activePreset
    return `${baseName}_compressed_${preset}.pdf`
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  // Re-analyze when compression config changes
  React.useEffect(() => {
    if (selectedFiles.length > 0) {
      reanalyzeFiles()
    }
  }, [compressionConfig])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">PDF Compression</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <Settings className="w-4 h-4" />
            {showAdvancedOptions ? 'Hide' : 'Show'} Advanced
          </button>
          {selectedFiles.length > 0 && (
            <button
              onClick={addToBatch}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Zap className="w-4 h-4" />
              Add to Batch
            </button>
          )}
        </div>
      </div>

      {/* Compression Stats */}
      {selectedFiles.length > 0 && (
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900 dark:to-purple-900 rounded-lg border border-blue-200 dark:border-blue-700">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {selectedFiles.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Files Selected</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                {formatFileSize(totalSavings.original)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Original Size</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatFileSize(totalSavings.estimated)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Estimated Size</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {totalSavings.savings}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Size Reduction</div>
            </div>
          </div>
        </div>
      )}

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
          Add PDF files to compress
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          Drag and drop PDF files here, or click to browse
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
        >
          Select Files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf"
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      {/* Compression Presets */}
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">Compression Presets</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COMPRESSION_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset.id)}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                activePreset === preset.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900 transform scale-105'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <Target className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-gray-900 dark:text-gray-100">{preset.name}</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{preset.description}</p>
              <div className="text-xs font-medium text-green-600 dark:text-green-400">
                Target: {preset.targetReduction} reduction
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Settings */}
        <div className="space-y-6">
          {/* Quality Settings */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Quality Settings</h4>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Overall Quality: {Math.round(compressionConfig.quality.overall * 100)}%
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  value={compressionConfig.quality.overall}
                  onChange={(e) => {
                    setCompressionConfig(prev => ({
                      ...prev,
                      preset: 'custom',
                      quality: { ...prev.quality, overall: parseFloat(e.target.value) }
                    }))
                    setActivePreset('custom')
                  }}
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Image Quality: {Math.round(compressionConfig.quality.images * 100)}%
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  value={compressionConfig.quality.images}
                  onChange={(e) => {
                    setCompressionConfig(prev => ({
                      ...prev,
                      preset: 'custom',
                      quality: { ...prev.quality, images: parseFloat(e.target.value) }
                    }))
                    setActivePreset('custom')
                  }}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Basic Optimization */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Basic Optimization</h4>
            
            <div className="space-y-3">
              {[
                { key: 'removeUnusedObjects', label: 'Remove unused objects', description: 'Clean up unused PDF objects' },
                { key: 'optimizeImages', label: 'Optimize images', description: 'Compress and optimize embedded images' },
                { key: 'compressStreams', label: 'Compress streams', description: 'Compress PDF content streams' },
                { key: 'linearize', label: 'Linearize for web', description: 'Optimize for fast web viewing' }
              ].map(({ key, label, description }) => (
                <div key={key} className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={compressionConfig.optimization[key as keyof typeof compressionConfig.optimization]}
                    onChange={(e) => {
                      setCompressionConfig(prev => ({
                        ...prev,
                        preset: 'custom',
                        optimization: { ...prev.optimization, [key]: e.target.checked }
                      }))
                      setActivePreset('custom')
                    }}
                    className="mt-1 rounded"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Advanced Options */}
          {showAdvancedOptions && (
            <>
              {/* Data Removal */}
              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Data Removal</h4>
                
                <div className="space-y-3">
                  {[
                    { key: 'removeMetadata', label: 'Remove metadata', description: 'Strip document metadata and properties' },
                    { key: 'removeThumbnails', label: 'Remove thumbnails', description: 'Remove page thumbnails' },
                    { key: 'removeBookmarks', label: 'Remove bookmarks', description: 'Strip navigation bookmarks' },
                    { key: 'removeFormFields', label: 'Remove form fields', description: 'Remove interactive form elements' },
                    { key: 'removeAnnotations', label: 'Remove annotations', description: 'Strip comments and annotations' }
                  ].map(({ key, label, description }) => (
                    <div key={key} className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={compressionConfig.optimization[key as keyof typeof compressionConfig.optimization]}
                        onChange={(e) => {
                          setCompressionConfig(prev => ({
                            ...prev,
                            preset: 'custom',
                            optimization: { ...prev.optimization, [key]: e.target.checked }
                          }))
                          setActivePreset('custom')
                        }}
                        className="mt-1 rounded"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Image Processing */}
              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Image Processing</h4>
                
                <div className="space-y-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={compressionConfig.imageProcessing.downsampleImages}
                      onChange={(e) => {
                        setCompressionConfig(prev => ({
                          ...prev,
                          preset: 'custom',
                          imageProcessing: { ...prev.imageProcessing, downsampleImages: e.target.checked }
                        }))
                        setActivePreset('custom')
                      }}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Downsample images</span>
                  </label>
                  
                  {compressionConfig.imageProcessing.downsampleImages && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Maximum DPI: {compressionConfig.imageProcessing.maxImageDPI}
                      </label>
                      <input
                        type="range"
                        min="72"
                        max="300"
                        step="24"
                        value={compressionConfig.imageProcessing.maxImageDPI}
                        onChange={(e) => {
                          setCompressionConfig(prev => ({
                            ...prev,
                            preset: 'custom',
                            imageProcessing: { ...prev.imageProcessing, maxImageDPI: parseInt(e.target.value) }
                          }))
                          setActivePreset('custom')
                        }}
                        className="w-full"
                      />
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      JPEG Quality: {compressionConfig.imageProcessing.jpegQuality}%
                    </label>
                    <input
                      type="range"
                      min="20"
                      max="100"
                      step="5"
                      value={compressionConfig.imageProcessing.jpegQuality}
                      onChange={(e) => {
                        setCompressionConfig(prev => ({
                          ...prev,
                          preset: 'custom',
                          imageProcessing: { ...prev.imageProcessing, jpegQuality: parseInt(e.target.value) }
                        }))
                        setActivePreset('custom')
                      }}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Column - File List & Analysis */}
        <div className="space-y-6">
          {/* File List */}
          {selectedFiles.length > 0 && (
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">
                Files to Compress ({selectedFiles.length})
              </h4>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {selectedFiles.map((file, index) => {
                  const analysis = fileAnalyses.get(file.name)
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded border"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                          {file.name}
                        </div>
                        {analysis && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 grid grid-cols-2 gap-2">
                            <span>{formatFileSize(analysis.originalSize)} → {formatFileSize(analysis.estimatedSize)}</span>
                            <span className="text-green-600 dark:text-green-400">-{analysis.compressionRatio}%</span>
                            <span>{analysis.pageCount} pages</span>
                            <span>{analysis.imageCount} images</span>
                          </div>
                        )}
                      </div>
                      
                      {analysis && (
                        <div className="flex items-center gap-2 ml-4">
                          <BarChart3 className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-green-600 dark:text-green-400">
                            -{analysis.compressionRatio}%
                          </span>
                        </div>
                      )}
                      
                      <button
                        onClick={() => removeFile(index)}
                        className="ml-3 text-red-500 hover:text-red-700"
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Compression Preview */}
          {selectedFiles.length > 0 && (
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Compression Preview</h4>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Current preset:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                    {activePreset === 'custom' ? 'Custom Settings' : COMPRESSION_PRESETS.find(p => p.id === activePreset)?.name}
                  </span>
                </div>
                
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(totalSavings.savings, 100)}%` }}
                  ></div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                    <div className="text-lg font-bold text-gray-800 dark:text-gray-200">
                      {formatFileSize(totalSavings.original - totalSavings.estimated)}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Space Saved</div>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                    <div className="text-lg font-bold text-green-600 dark:text-green-400">
                      {totalSavings.savings}%
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Reduction</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      {selectedFiles.length > 0 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={handleCompress}
            disabled={isProcessing}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Minimize2 className="w-5 h-5" />
            )}
            {isProcessing ? 'Compressing...' : 'Compress Files'}
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

      {selectedFiles.length === 0 && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <span className="text-yellow-800 dark:text-yellow-200">
              Add PDF files to start compression analysis and optimization.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default PDFCompressionTool