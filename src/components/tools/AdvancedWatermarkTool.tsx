import React, { useState, useRef, useCallback } from 'react'
import { Upload, Droplets, RefreshCw, AlertCircle, Eye, Type, Settings, Download, Palette, Move, RotateCw, Layers, Plus, Trash2, Copy } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { useJobsStore } from '../../state/jobs'
import { workerManager } from '../../lib/workerManager'

interface WatermarkTemplate {
  id: string
  name: string
  type: 'text' | 'image'
  config: WatermarkConfig
  preview?: string
}

interface WatermarkConfig {
  type: 'text' | 'image'
  content?: string
  imageData?: string
  position: {
    x: number // percentage from left
    y: number // percentage from top
    preset?: string
  }
  style: {
    opacity: number
    rotation: number
    scale: number
  }
  text?: {
    fontSize: number
    fontFamily: string
    color: string
    bold: boolean
    italic: boolean
  }
  image?: {
    width: number
    height: number
    maintainAspectRatio: boolean
  }
  advanced: {
    blendMode: string
    layer: 'behind' | 'front'
    pageRange: 'all' | 'odd' | 'even' | 'first' | 'last' | 'custom'
    customPages?: string
  }
}

const DEFAULT_TEMPLATES: WatermarkTemplate[] = [
  {
    id: 'confidential',
    name: 'Confidential',
    type: 'text',
    config: {
      type: 'text',
      content: 'CONFIDENTIAL',
      position: { x: 50, y: 50, preset: 'center' },
      style: { opacity: 0.3, rotation: -45, scale: 1.5 },
      text: {
        fontSize: 48,
        fontFamily: 'Arial',
        color: '#ff0000',
        bold: true,
        italic: false
      },
      advanced: {
        blendMode: 'normal',
        layer: 'behind',
        pageRange: 'all'
      }
    }
  },
  {
    id: 'draft',
    name: 'Draft',
    type: 'text',
    config: {
      type: 'text',
      content: 'DRAFT',
      position: { x: 50, y: 10, preset: 'top-center' },
      style: { opacity: 0.5, rotation: 0, scale: 1 },
      text: {
        fontSize: 36,
        fontFamily: 'Arial',
        color: '#888888',
        bold: true,
        italic: true
      },
      advanced: {
        blendMode: 'normal',
        layer: 'front',
        pageRange: 'all'
      }
    }
  },
  {
    id: 'copyright',
    name: 'Copyright',
    type: 'text',
    config: {
      type: 'text',
      content: '© 2024 Company Name',
      position: { x: 95, y: 95, preset: 'bottom-right' },
      style: { opacity: 0.7, rotation: 0, scale: 0.8 },
      text: {
        fontSize: 12,
        fontFamily: 'Arial',
        color: '#333333',
        bold: false,
        italic: false
      },
      advanced: {
        blendMode: 'normal',
        layer: 'front',
        pageRange: 'all'
      }
    }
  }
]

const POSITION_PRESETS = [
  { id: 'top-left', name: 'Top Left', x: 5, y: 5 },
  { id: 'top-center', name: 'Top Center', x: 50, y: 5 },
  { id: 'top-right', name: 'Top Right', x: 95, y: 5 },
  { id: 'center', name: 'Center', x: 50, y: 50 },
  { id: 'bottom-left', name: 'Bottom Left', x: 5, y: 95 },
  { id: 'bottom-center', name: 'Bottom Center', x: 50, y: 95 },
  { id: 'bottom-right', name: 'Bottom Right', x: 95, y: 95 },
  { id: 'custom', name: 'Custom Position', x: 50, y: 50 }
]

const FONT_FAMILIES = [
  'Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia', 'Tahoma', 'Trebuchet MS'
]

const BLEND_MODES = [
  { id: 'normal', name: 'Normal' },
  { id: 'multiply', name: 'Multiply' },
  { id: 'screen', name: 'Screen' },
  { id: 'overlay', name: 'Overlay' },
  { id: 'soft-light', name: 'Soft Light' },
  { id: 'hard-light', name: 'Hard Light' }
]

const AdvancedWatermarkTool: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeTab, setActiveTab] = useState<'text' | 'image' | 'templates'>('text')
  const [customTemplates, setCustomTemplates] = useState<WatermarkTemplate[]>([])
  const [preview, setPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { addFile } = useAppStore()
  const { addJob, updateJob } = useJobsStore()

  const [watermarkConfig, setWatermarkConfig] = useState<WatermarkConfig>({
    type: 'text',
    content: 'WATERMARK',
    position: { x: 50, y: 50, preset: 'center' },
    style: { opacity: 0.5, rotation: 0, scale: 1 },
    text: {
      fontSize: 24,
      fontFamily: 'Arial',
      color: '#888888',
      bold: false,
      italic: false
    },
    advanced: {
      blendMode: 'normal',
      layer: 'behind',
      pageRange: 'all'
    }
  })

  const handleFileSelect = useCallback((files: FileList) => {
    const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf')
    if (pdfFiles.length === 0) {
      alert('Please select PDF files only')
      return
    }
    setSelectedFiles(prev => [...prev, ...pdfFiles])
    if (pdfFiles.length > 0 && !preview) {
      generatePreview(pdfFiles[0])
    }
  }, [preview])

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
  }, [handleFileSelect])

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFileSelect(e.target.files)
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const applyTemplate = (template: WatermarkTemplate) => {
    setWatermarkConfig(template.config)
    setActiveTab(template.type)
  }

  const saveAsTemplate = () => {
    const templateName = prompt('Enter template name:')
    if (templateName) {
      const newTemplate: WatermarkTemplate = {
        id: Date.now().toString(),
        name: templateName,
        type: watermarkConfig.type,
        config: { ...watermarkConfig }
      }
      setCustomTemplates(prev => [...prev, newTemplate])
      console.log('Template saved successfully')
    }
  }

  const updatePosition = (preset: string) => {
    const position = POSITION_PRESETS.find(p => p.id === preset)
    if (position) {
      setWatermarkConfig(prev => ({
        ...prev,
        position: {
          x: position.x,
          y: position.y,
          preset
        }
      }))
    }
  }

  const handleWatermark = async () => {
    if (selectedFiles.length === 0) return
    
    setIsProcessing(true)
    const jobId = Date.now().toString()
    
    try {
      addJob({
        id: jobId,
        type: 'watermark',
        name: `Apply watermark to ${selectedFiles.length} file(s)`,
        status: 'processing',
        fileIds: selectedFiles.map(f => f.name),
        progress: 0,
        startTime: Date.now(),
        cancellable: true
      })

      const results = []
      
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i]
        const arrayBuffer = await file.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)

        updateJob(jobId, { progress: (i / selectedFiles.length) * 80 })

        // Prepare watermark options for the worker
        const watermarkOptions = {
          fontSize: watermarkConfig.text?.fontSize || 24,
          color: {
            r: parseInt(watermarkConfig.text?.color.slice(1, 3) || '88', 16) / 255,
            g: parseInt(watermarkConfig.text?.color.slice(3, 5) || '88', 16) / 255,
            b: parseInt(watermarkConfig.text?.color.slice(5, 7) || '88', 16) / 255
          },
          opacity: watermarkConfig.style.opacity,
          rotation: watermarkConfig.style.rotation,
          position: watermarkConfig.position.preset || 'center'
        }

        const result = await workerManager.addWatermark(
          uint8Array, 
          watermarkConfig.content || 'WATERMARK', 
          watermarkOptions
        )
        
        // Create new file with watermark
        const watermarkedFileName = file.name.replace(/\.pdf$/i, '_watermarked.pdf')
        const pdfFile = {
          id: `watermark-${Date.now()}-${i}`,
          name: watermarkedFileName,
          size: result.byteLength,
          type: 'application/pdf',
          lastModified: Date.now(),
          file: new File([new Uint8Array(result)], watermarkedFileName, { type: 'application/pdf' }),
          pageCount: 1,
          data: result
        } as any
        
        addFile(pdfFile)
        results.push(result)
      }

      updateJob(jobId, {
        status: 'completed',
        progress: 100,
        endTime: Date.now()
      })

      console.log(`Successfully watermarked ${selectedFiles.length} file(s)`)
      
    } catch (error) {
      console.error('Error applying watermark:', error)
      updateJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        endTime: Date.now()
      })
      console.error('Failed to apply watermark')
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
              <Droplets className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Advanced Watermark Tool</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Professional watermarking with templates and advanced controls</p>
            </div>
          </div>
          {selectedFiles.length > 0 && (
            <button
              onClick={handleWatermark}
              disabled={isProcessing}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {isProcessing ? 'Processing...' : 'Apply Watermark'}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* File Upload Area */}
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
                      Upload PDF files
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
                    accept=".pdf"
                    onChange={handleFileInputChange}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">PDF files up to 10MB each</p>
              </div>
            </div>

            {/* Selected Files */}
            {selectedFiles.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Selected Files ({selectedFiles.length})
                </h3>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded">
                      <span className="text-sm text-gray-600 dark:text-gray-300 truncate flex-1">
                        {file.name}
                      </span>
                      <button
                        onClick={() => removeFile(index)}
                        className="ml-2 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Configuration Tabs */}
          <div className="flex-1 flex flex-col">
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setActiveTab('text')}
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === 'text'
                    ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Type className="w-4 h-4 inline mr-2" />
                Text Watermark
              </button>
              <button
                onClick={() => setActiveTab('templates')}
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === 'templates'
                    ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Layers className="w-4 h-4 inline mr-2" />
                Templates
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {activeTab === 'text' && (
                <div className="space-y-6">
                  {/* Text Content */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Watermark Text
                    </label>
                    <input
                      type="text"
                      value={watermarkConfig.content || ''}
                      onChange={(e) => setWatermarkConfig(prev => ({ ...prev, content: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Enter watermark text"
                    />
                  </div>

                  {/* Font Settings */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Font Family
                      </label>
                      <select
                        value={watermarkConfig.text?.fontFamily || 'Arial'}
                        onChange={(e) => setWatermarkConfig(prev => ({
                          ...prev,
                          text: { ...prev.text!, fontFamily: e.target.value }
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
                        min="8"
                        max="72"
                        value={watermarkConfig.text?.fontSize || 24}
                        onChange={(e) => setWatermarkConfig(prev => ({
                          ...prev,
                          text: { ...prev.text!, fontSize: parseInt(e.target.value) || 24 }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Color and Style */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Color
                      </label>
                      <input
                        type="color"
                        value={watermarkConfig.text?.color || '#888888'}
                        onChange={(e) => setWatermarkConfig(prev => ({
                          ...prev,
                          text: { ...prev.text!, color: e.target.value }
                        }))}
                        className="w-full h-10 border border-gray-300 dark:border-gray-600 rounded-md"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Opacity
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={watermarkConfig.style.opacity}
                        onChange={(e) => setWatermarkConfig(prev => ({
                          ...prev,
                          style: { ...prev.style, opacity: parseFloat(e.target.value) }
                        }))}
                        className="w-full"
                      />
                      <span className="text-sm text-gray-500">{Math.round(watermarkConfig.style.opacity * 100)}%</span>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Rotation
                      </label>
                      <input
                        type="range"
                        min="-90"
                        max="90"
                        value={watermarkConfig.style.rotation}
                        onChange={(e) => setWatermarkConfig(prev => ({
                          ...prev,
                          style: { ...prev.style, rotation: parseInt(e.target.value) }
                        }))}
                        className="w-full"
                      />
                      <span className="text-sm text-gray-500">{watermarkConfig.style.rotation}°</span>
                    </div>
                  </div>

                  {/* Position Presets */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Position
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {POSITION_PRESETS.map(preset => (
                        <button
                          key={preset.id}
                          onClick={() => updatePosition(preset.id)}
                          className={`p-2 text-sm border rounded ${
                            watermarkConfig.position.preset === preset.id
                              ? 'bg-blue-100 border-blue-500 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                              : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Advanced Settings */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Page Range
                    </label>
                    <select
                      value={watermarkConfig.advanced.pageRange}
                      onChange={(e) => setWatermarkConfig(prev => ({
                        ...prev,
                        advanced: { ...prev.advanced, pageRange: e.target.value as any }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="all">All Pages</option>
                      <option value="odd">Odd Pages Only</option>
                      <option value="even">Even Pages Only</option>
                      <option value="first">First Page Only</option>
                      <option value="last">Last Page Only</option>
                    </select>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={saveAsTemplate}
                      className="flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Save as Template
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'templates' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Default Templates</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {DEFAULT_TEMPLATES.map(template => (
                        <div key={template.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">{template.name}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{template.config.content}</p>
                          <button
                            onClick={() => applyTemplate(template)}
                            className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                          >
                            Use Template
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {customTemplates.length > 0 && (
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Custom Templates</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {customTemplates.map(template => (
                          <div key={template.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">{template.name}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{template.config.content}</p>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => applyTemplate(template)}
                                className="flex-1 py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                              >
                                Use
                              </button>
                              <button
                                onClick={() => setCustomTemplates(prev => prev.filter(t => t.id !== template.id))}
                                className="py-2 px-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
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
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span
                  className="text-gray-400"
                  style={{
                    fontSize: `${Math.max(8, (watermarkConfig.text?.fontSize || 24) / 4)}px`,
                    opacity: watermarkConfig.style.opacity,
                    transform: `rotate(${watermarkConfig.style.rotation}deg)`,
                    fontWeight: watermarkConfig.text?.bold ? 'bold' : 'normal',
                    fontStyle: watermarkConfig.text?.italic ? 'italic' : 'normal',
                    color: watermarkConfig.text?.color || '#888888'
                  }}
                >
                  {watermarkConfig.content || 'WATERMARK'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdvancedWatermarkTool