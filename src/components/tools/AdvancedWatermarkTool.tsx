import React, { useState, useRef, useCallback } from 'react'
import { Upload, Droplets, RefreshCw, AlertCircle, Eye, Image, Type, Zap, Palette, Move, RotateCw } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { useJobsStore } from '../../state/jobs'
import { workerManager } from '../../lib/workerManager'
import { globalBatchProcessor } from '../../lib/batchProcessor'

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
    preset?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center' | 'custom'
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
  const [watermarkConfig, setWatermarkConfig] = useState<WatermarkConfig>(DEFAULT_TEMPLATES[0].config)
  const [customTemplates, setCustomTemplates] = useState<WatermarkTemplate[]>([])
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [activeTab, setActiveTab] = useState<'text' | 'image' | 'templates'>('text')
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const { addFile } = useAppStore()
  const { addJob, updateJob } = useJobsStore()

  const handleFileSelect = async (files: FileList) => {
    const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf')
    setSelectedFiles(prev => [...prev, ...pdfFiles])
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const imageData = event.target?.result as string
        setWatermarkConfig(prev => ({
          ...prev,
          type: 'image',
          imageData,
          image: {
            width: 100,
            height: 100,
            maintainAspectRatio: true,
            ...prev.image
          }
        }))
        setActiveTab('image')
      }
      reader.readAsDataURL(file)
    }
  }

  const generatePreview = useCallback(async () => {
    if (selectedFiles.length === 0) return

    try {
      const file = selectedFiles[0]
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      
      const { loadPDFDocument, getPageThumbnail } = await import('../../lib/pdf')
      const doc = await loadPDFDocument(uint8Array)
      const page = await doc.getPage(1)
      const thumbnail = await getPageThumbnail(page, 300)
      
      setPreviewImage(thumbnail)
      setShowPreview(true)
    } catch (error) {
      console.error('Preview generation failed:', error)
    }
  }, [selectedFiles, watermarkConfig])

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
          preset: preset as any
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
        status: 'processing',
        files: selectedFiles.map(f => f.name),
        progress: 0,
        createdAt: new Date()
      })

      const files = await Promise.all(\n        selectedFiles.map(f => f.arrayBuffer().then(ab => new Uint8Array(ab)))\n      )\n      \n      const results = await workerManager.submitJob({\n        type: 'watermark',\n        files,\n        options: {\n          watermark: watermarkConfig,\n          onProgress: (progress: number) => {\n            updateJob(jobId, { progress })\n          }\n        }\n      })\n      \n      // Add watermarked files to the app\n      results.forEach((fileData: Uint8Array, index: number) => {\n        const originalFile = selectedFiles[index]\n        const watermarkedFileName = generateWatermarkedFileName(originalFile.name)\n        const watermarkedFile = new File([fileData], watermarkedFileName, { type: 'application/pdf' })\n        addFile(watermarkedFile)\n      })\n      \n      updateJob(jobId, {\n        status: 'completed',\n        progress: 100,\n        result: {\n          processedFiles: results.length,\n          watermarkType: watermarkConfig.type\n        }\n      })\n      \n      setSelectedFiles([])\n      \n    } catch (error) {\n      console.error('Watermarking failed:', error)\n      updateJob(jobId, {\n        status: 'failed',\n        error: error instanceof Error ? error.message : 'Unknown error'\n      })\n    } finally {\n      setIsProcessing(false)\n    }\n  }\n\n  const addToBatch = () => {\n    if (selectedFiles.length === 0) return\n\n    globalBatchProcessor.addOperation({\n      type: 'watermark',\n      files: selectedFiles,\n      options: { watermark: watermarkConfig },\n      priority: 3,\n      onComplete: (results) => {\n        results.forEach((fileData: Uint8Array, index: number) => {\n          const originalFile = selectedFiles[index]\n          const watermarkedFileName = generateWatermarkedFileName(originalFile.name)\n          const watermarkedFile = new File([fileData], watermarkedFileName, { type: 'application/pdf' })\n          addFile(watermarkedFile)\n        })\n      }\n    })\n\n    setSelectedFiles([])\n  }\n\n  const generateWatermarkedFileName = (originalName: string) => {\n    const baseName = originalName.replace('.pdf', '')\n    const watermarkType = watermarkConfig.type === 'text' ? 'text' : 'image'\n    return `${baseName}_watermarked_${watermarkType}.pdf`\n  }\n\n  const formatFileSize = (bytes: number): string => {\n    if (bytes === 0) return '0 B'\n    const k = 1024\n    const sizes = ['B', 'KB', 'MB', 'GB']\n    const i = Math.floor(Math.log(bytes) / Math.log(k))\n    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]\n  }\n\n  return (\n    <div className=\"p-6\">\n      <div className=\"flex items-center justify-between mb-6\">\n        <h2 className=\"text-2xl font-bold text-gray-900 dark:text-gray-100\">Advanced Watermarking</h2>\n        <div className=\"flex items-center gap-3\">\n          {selectedFiles.length > 0 && (\n            <button\n              onClick={generatePreview}\n              className=\"flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors\"\n            >\n              <Eye className=\"w-4 h-4\" />\n              Preview\n            </button>\n          )}\n          {selectedFiles.length > 0 && (\n            <button\n              onClick={addToBatch}\n              className=\"flex items-center gap-2 px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors\"\n            >\n              <Zap className=\"w-4 h-4\" />\n              Add to Batch\n            </button>\n          )}\n        </div>\n      </div>\n\n      {/* File Upload */}\n      <div\n        onDrop={handleDrop}\n        onDragOver={handleDragOver}\n        onDragLeave={handleDragLeave}\n        className={`mb-6 border-2 border-dashed rounded-lg p-8 text-center transition-colors ${\n          isDragOver\n            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900'\n            : 'border-gray-300 dark:border-gray-600'\n        }`}\n      >\n        <Upload className=\"w-12 h-12 mx-auto mb-4 text-gray-400\" />\n        <h3 className=\"text-lg font-medium mb-2 text-gray-900 dark:text-gray-100\">\n          Add PDF files to watermark\n        </h3>\n        <p className=\"text-gray-500 dark:text-gray-400 mb-4\">\n          Drag and drop PDF files here, or click to browse\n        </p>\n        <button\n          onClick={() => fileInputRef.current?.click()}\n          className=\"bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors\"\n        >\n          Select Files\n        </button>\n        <input\n          ref={fileInputRef}\n          type=\"file\"\n          multiple\n          accept=\".pdf\"\n          onChange={handleFileInput}\n          className=\"hidden\"\n        />\n      </div>\n\n      {/* Selected Files */}\n      {selectedFiles.length > 0 && (\n        <div className=\"mb-6\">\n          <h3 className=\"text-lg font-medium mb-3 text-gray-900 dark:text-gray-100\">\n            Selected Files ({selectedFiles.length})\n          </h3>\n          <div className=\"space-y-2 max-h-32 overflow-y-auto\">\n            {selectedFiles.map((file, index) => (\n              <div\n                key={index}\n                className=\"flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded\"\n              >\n                <div>\n                  <span className=\"font-medium text-gray-900 dark:text-gray-100\">{file.name}</span>\n                  <span className=\"text-sm text-gray-500 dark:text-gray-400 ml-2\">\n                    {formatFileSize(file.size)}\n                  </span>\n                </div>\n                <button\n                  onClick={() => removeFile(index)}\n                  className=\"text-red-500 hover:text-red-700\"\n                >\n                  ×\n                </button>\n              </div>\n            ))}\n          </div>\n        </div>\n      )}\n\n      {/* Watermark Configuration */}\n      <div className=\"grid grid-cols-1 lg:grid-cols-2 gap-6\">\n        {/* Left Column - Configuration */}\n        <div>\n          {/* Tab Navigation */}\n          <div className=\"flex space-x-1 mb-4 bg-gray-100 dark:bg-gray-700 rounded-lg p-1\">\n            <button\n              onClick={() => setActiveTab('text')}\n              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-colors ${\n                activeTab === 'text'\n                  ? 'bg-white dark:bg-gray-800 text-blue-600 shadow'\n                  : 'text-gray-600 dark:text-gray-400'\n              }`}\n            >\n              <Type className=\"w-4 h-4\" />\n              Text\n            </button>\n            <button\n              onClick={() => setActiveTab('image')}\n              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-colors ${\n                activeTab === 'image'\n                  ? 'bg-white dark:bg-gray-800 text-blue-600 shadow'\n                  : 'text-gray-600 dark:text-gray-400'\n              }`}\n            >\n              <Image className=\"w-4 h-4\" />\n              Image\n            </button>\n            <button\n              onClick={() => setActiveTab('templates')}\n              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-colors ${\n                activeTab === 'templates'\n                  ? 'bg-white dark:bg-gray-800 text-blue-600 shadow'\n                  : 'text-gray-600 dark:text-gray-400'\n              }`}\n            >\n              <Palette className=\"w-4 h-4\" />\n              Templates\n            </button>\n          </div>\n\n          {/* Text Watermark Options */}\n          {activeTab === 'text' && (\n            <div className=\"space-y-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700\">\n              <div>\n                <label className=\"block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2\">\n                  Text Content\n                </label>\n                <input\n                  type=\"text\"\n                  value={watermarkConfig.content || ''}\n                  onChange={(e) => setWatermarkConfig(prev => ({\n                    ...prev,\n                    content: e.target.value,\n                    type: 'text'\n                  }))}\n                  placeholder=\"Enter watermark text\"\n                  className=\"w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100\"\n                />\n              </div>\n\n              <div className=\"grid grid-cols-2 gap-4\">\n                <div>\n                  <label className=\"block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2\">\n                    Font Size\n                  </label>\n                  <input\n                    type=\"number\"\n                    value={watermarkConfig.text?.fontSize || 24}\n                    onChange={(e) => setWatermarkConfig(prev => ({\n                      ...prev,\n                      text: { ...prev.text!, fontSize: parseInt(e.target.value) }\n                    }))}\n                    min=\"8\"\n                    max=\"200\"\n                    className=\"w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100\"\n                  />\n                </div>\n                <div>\n                  <label className=\"block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2\">\n                    Font Family\n                  </label>\n                  <select\n                    value={watermarkConfig.text?.fontFamily || 'Arial'}\n                    onChange={(e) => setWatermarkConfig(prev => ({\n                      ...prev,\n                      text: { ...prev.text!, fontFamily: e.target.value }\n                    }))}\n                    className=\"w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100\"\n                  >\n                    {FONT_FAMILIES.map(font => (\n                      <option key={font} value={font}>{font}</option>\n                    ))}\n                  </select>\n                </div>\n              </div>\n\n              <div className=\"grid grid-cols-3 gap-4\">\n                <div>\n                  <label className=\"block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2\">\n                    Color\n                  </label>\n                  <input\n                    type=\"color\"\n                    value={watermarkConfig.text?.color || '#000000'}\n                    onChange={(e) => setWatermarkConfig(prev => ({\n                      ...prev,\n                      text: { ...prev.text!, color: e.target.value }\n                    }))}\n                    className=\"w-full h-10 border border-gray-300 dark:border-gray-600 rounded\"\n                  />\n                </div>\n                <div className=\"flex items-center gap-4 pt-6\">\n                  <label className=\"flex items-center gap-2\">\n                    <input\n                      type=\"checkbox\"\n                      checked={watermarkConfig.text?.bold || false}\n                      onChange={(e) => setWatermarkConfig(prev => ({\n                        ...prev,\n                        text: { ...prev.text!, bold: e.target.checked }\n                      }))}\n                      className=\"rounded\"\n                    />\n                    <span className=\"text-sm text-gray-700 dark:text-gray-300\">Bold</span>\n                  </label>\n                </div>\n                <div className=\"flex items-center gap-4 pt-6\">\n                  <label className=\"flex items-center gap-2\">\n                    <input\n                      type=\"checkbox\"\n                      checked={watermarkConfig.text?.italic || false}\n                      onChange={(e) => setWatermarkConfig(prev => ({\n                        ...prev,\n                        text: { ...prev.text!, italic: e.target.checked }\n                      }))}\n                      className=\"rounded\"\n                    />\n                    <span className=\"text-sm text-gray-700 dark:text-gray-300\">Italic</span>\n                  </label>\n                </div>\n              </div>\n            </div>\n          )}\n\n          {/* Image Watermark Options */}\n          {activeTab === 'image' && (\n            <div className=\"space-y-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700\">\n              <div>\n                <label className=\"block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2\">\n                  Select Image\n                </label>\n                <button\n                  onClick={() => imageInputRef.current?.click()}\n                  className=\"w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-gray-400 transition-colors\"\n                >\n                  {watermarkConfig.imageData ? 'Change Image' : 'Choose Image'}\n                </button>\n                <input\n                  ref={imageInputRef}\n                  type=\"file\"\n                  accept=\"image/*\"\n                  onChange={handleImageSelect}\n                  className=\"hidden\"\n                />\n              </div>\n\n              {watermarkConfig.imageData && (\n                <>\n                  <div className=\"grid grid-cols-2 gap-4\">\n                    <div>\n                      <label className=\"block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2\">\n                        Width (px)\n                      </label>\n                      <input\n                        type=\"number\"\n                        value={watermarkConfig.image?.width || 100}\n                        onChange={(e) => setWatermarkConfig(prev => ({\n                          ...prev,\n                          image: { ...prev.image!, width: parseInt(e.target.value) }\n                        }))}\n                        min=\"10\"\n                        max=\"1000\"\n                        className=\"w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100\"\n                      />\n                    </div>\n                    <div>\n                      <label className=\"block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2\">\n                        Height (px)\n                      </label>\n                      <input\n                        type=\"number\"\n                        value={watermarkConfig.image?.height || 100}\n                        onChange={(e) => setWatermarkConfig(prev => ({\n                          ...prev,\n                          image: { ...prev.image!, height: parseInt(e.target.value) }\n                        }))}\n                        min=\"10\"\n                        max=\"1000\"\n                        className=\"w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100\"\n                      />\n                    </div>\n                  </div>\n\n                  <label className=\"flex items-center gap-2\">\n                    <input\n                      type=\"checkbox\"\n                      checked={watermarkConfig.image?.maintainAspectRatio !== false}\n                      onChange={(e) => setWatermarkConfig(prev => ({\n                        ...prev,\n                        image: { ...prev.image!, maintainAspectRatio: e.target.checked }\n                      }))}\n                      className=\"rounded\"\n                    />\n                    <span className=\"text-sm text-gray-700 dark:text-gray-300\">Maintain aspect ratio</span>\n                  </label>\n                </>\n              )}\n            </div>\n          )}\n\n          {/* Template Options */}\n          {activeTab === 'templates' && (\n            <div className=\"space-y-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700\">\n              <div className=\"flex items-center justify-between\">\n                <h4 className=\"font-medium text-gray-900 dark:text-gray-100\">Built-in Templates</h4>\n                <button\n                  onClick={saveAsTemplate}\n                  className=\"text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors\"\n                >\n                  Save Current\n                </button>\n              </div>\n              \n              <div className=\"space-y-2\">\n                {DEFAULT_TEMPLATES.map((template) => (\n                  <button\n                    key={template.id}\n                    onClick={() => applyTemplate(template)}\n                    className=\"w-full text-left p-3 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors\"\n                  >\n                    <div className=\"font-medium text-gray-900 dark:text-gray-100\">{template.name}</div>\n                    <div className=\"text-sm text-gray-500 dark:text-gray-400\">\n                      {template.type === 'text' ? `Text: \"${template.config.content}\"` : 'Image watermark'}\n                    </div>\n                  </button>\n                ))}\n              </div>\n\n              {customTemplates.length > 0 && (\n                <>\n                  <h4 className=\"font-medium text-gray-900 dark:text-gray-100 mt-6\">Custom Templates</h4>\n                  <div className=\"space-y-2\">\n                    {customTemplates.map((template) => (\n                      <button\n                        key={template.id}\n                        onClick={() => applyTemplate(template)}\n                        className=\"w-full text-left p-3 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors\"\n                      >\n                        <div className=\"font-medium text-gray-900 dark:text-gray-100\">{template.name}</div>\n                        <div className=\"text-sm text-gray-500 dark:text-gray-400\">\n                          {template.type === 'text' ? `Text: \"${template.config.content}\"` : 'Image watermark'}\n                        </div>\n                      </button>\n                    ))}\n                  </div>\n                </>\n              )}\n            </div>\n          )}\n\n          {/* Position & Style */}\n          <div className=\"mt-6 space-y-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700\">\n            <h4 className=\"font-medium text-gray-900 dark:text-gray-100\">Position & Style</h4>\n            \n            <div>\n              <label className=\"block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2\">\n                Position Preset\n              </label>\n              <select\n                value={watermarkConfig.position.preset || 'center'}\n                onChange={(e) => updatePosition(e.target.value)}\n                className=\"w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100\"\n              >\n                {POSITION_PRESETS.map(preset => (\n                  <option key={preset.id} value={preset.id}>{preset.name}</option>\n                ))}\n              </select>\n            </div>\n\n            {watermarkConfig.position.preset === 'custom' && (\n              <div className=\"grid grid-cols-2 gap-4\">\n                <div>\n                  <label className=\"block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2\">\n                    X Position (%)\n                  </label>\n                  <input\n                    type=\"number\"\n                    value={watermarkConfig.position.x}\n                    onChange={(e) => setWatermarkConfig(prev => ({\n                      ...prev,\n                      position: { ...prev.position, x: parseFloat(e.target.value) }\n                    }))}\n                    min=\"0\"\n                    max=\"100\"\n                    className=\"w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100\"\n                  />\n                </div>\n                <div>\n                  <label className=\"block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2\">\n                    Y Position (%)\n                  </label>\n                  <input\n                    type=\"number\"\n                    value={watermarkConfig.position.y}\n                    onChange={(e) => setWatermarkConfig(prev => ({\n                      ...prev,\n                      position: { ...prev.position, y: parseFloat(e.target.value) }\n                    }))}\n                    min=\"0\"\n                    max=\"100\"\n                    className=\"w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100\"\n                  />\n                </div>\n              </div>\n            )}\n\n            <div className=\"grid grid-cols-3 gap-4\">\n              <div>\n                <label className=\"block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2\">\n                  Opacity: {Math.round(watermarkConfig.style.opacity * 100)}%\n                </label>\n                <input\n                  type=\"range\"\n                  min=\"0.1\"\n                  max=\"1\"\n                  step=\"0.1\"\n                  value={watermarkConfig.style.opacity}\n                  onChange={(e) => setWatermarkConfig(prev => ({\n                    ...prev,\n                    style: { ...prev.style, opacity: parseFloat(e.target.value) }\n                  }))}\n                  className=\"w-full\"\n                />\n              </div>\n              <div>\n                <label className=\"block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2\">\n                  Rotation: {watermarkConfig.style.rotation}°\n                </label>\n                <input\n                  type=\"range\"\n                  min=\"-180\"\n                  max=\"180\"\n                  step=\"15\"\n                  value={watermarkConfig.style.rotation}\n                  onChange={(e) => setWatermarkConfig(prev => ({\n                    ...prev,\n                    style: { ...prev.style, rotation: parseInt(e.target.value) }\n                  }))}\n                  className=\"w-full\"\n                />\n              </div>\n              <div>\n                <label className=\"block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2\">\n                  Scale: {Math.round(watermarkConfig.style.scale * 100)}%\n                </label>\n                <input\n                  type=\"range\"\n                  min=\"0.5\"\n                  max=\"3\"\n                  step=\"0.1\"\n                  value={watermarkConfig.style.scale}\n                  onChange={(e) => setWatermarkConfig(prev => ({\n                    ...prev,\n                    style: { ...prev.style, scale: parseFloat(e.target.value) }\n                  }))}\n                  className=\"w-full\"\n                />\n              </div>\n            </div>\n          </div>\n\n          {/* Advanced Options */}\n          <div className=\"mt-6 space-y-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700\">\n            <h4 className=\"font-medium text-gray-900 dark:text-gray-100\">Advanced Options</h4>\n            \n            <div className=\"grid grid-cols-2 gap-4\">\n              <div>\n                <label className=\"block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2\">\n                  Blend Mode\n                </label>\n                <select\n                  value={watermarkConfig.advanced.blendMode}\n                  onChange={(e) => setWatermarkConfig(prev => ({\n                    ...prev,\n                    advanced: { ...prev.advanced, blendMode: e.target.value }\n                  }))}\n                  className=\"w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100\"\n                >\n                  {BLEND_MODES.map(mode => (\n                    <option key={mode.id} value={mode.id}>{mode.name}</option>\n                  ))}\n                </select>\n              </div>\n              <div>\n                <label className=\"block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2\">\n                  Layer\n                </label>\n                <select\n                  value={watermarkConfig.advanced.layer}\n                  onChange={(e) => setWatermarkConfig(prev => ({\n                    ...prev,\n                    advanced: { ...prev.advanced, layer: e.target.value as 'behind' | 'front' }\n                  }))}\n                  className=\"w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100\"\n                >\n                  <option value=\"behind\">Behind content</option>\n                  <option value=\"front\">In front of content</option>\n                </select>\n              </div>\n            </div>\n\n            <div>\n              <label className=\"block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2\">\n                Page Range\n              </label>\n              <select\n                value={watermarkConfig.advanced.pageRange}\n                onChange={(e) => setWatermarkConfig(prev => ({\n                  ...prev,\n                  advanced: { ...prev.advanced, pageRange: e.target.value as any }\n                }))}\n                className=\"w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100\"\n              >\n                <option value=\"all\">All pages</option>\n                <option value=\"odd\">Odd pages only</option>\n                <option value=\"even\">Even pages only</option>\n                <option value=\"first\">First page only</option>\n                <option value=\"last\">Last page only</option>\n                <option value=\"custom\">Custom range</option>\n              </select>\n            </div>\n\n            {watermarkConfig.advanced.pageRange === 'custom' && (\n              <div>\n                <label className=\"block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2\">\n                  Custom Pages (e.g., \"1-5, 10, 15-20\")\n                </label>\n                <input\n                  type=\"text\"\n                  value={watermarkConfig.advanced.customPages || ''}\n                  onChange={(e) => setWatermarkConfig(prev => ({\n                    ...prev,\n                    advanced: { ...prev.advanced, customPages: e.target.value }\n                  }))}\n                  placeholder=\"1-5, 10, 15-20\"\n                  className=\"w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100\"\n                />\n              </div>\n            )}\n          </div>\n        </div>\n\n        {/* Right Column - Preview */}\n        <div>\n          {showPreview && previewImage && (\n            <div className=\"p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700\">\n              <h4 className=\"font-medium text-gray-900 dark:text-gray-100 mb-4\">Live Preview</h4>\n              <div className=\"relative\">\n                <img\n                  src={previewImage}\n                  alt=\"PDF Preview\"\n                  className=\"w-full rounded border border-gray-200 dark:border-gray-600\"\n                />\n                {/* Watermark overlay simulation */}\n                <div\n                  className=\"absolute pointer-events-none\"\n                  style={{\n                    left: `${watermarkConfig.position.x}%`,\n                    top: `${watermarkConfig.position.y}%`,\n                    transform: `translate(-50%, -50%) rotate(${watermarkConfig.style.rotation}deg) scale(${watermarkConfig.style.scale})`,\n                    opacity: watermarkConfig.style.opacity\n                  }}\n                >\n                  {watermarkConfig.type === 'text' && watermarkConfig.content && (\n                    <span\n                      style={{\n                        fontFamily: watermarkConfig.text?.fontFamily,\n                        fontSize: `${(watermarkConfig.text?.fontSize || 24) * 0.5}px`,\n                        color: watermarkConfig.text?.color,\n                        fontWeight: watermarkConfig.text?.bold ? 'bold' : 'normal',\n                        fontStyle: watermarkConfig.text?.italic ? 'italic' : 'normal'\n                      }}\n                    >\n                      {watermarkConfig.content}\n                    </span>\n                  )}\n                  {watermarkConfig.type === 'image' && watermarkConfig.imageData && (\n                    <img\n                      src={watermarkConfig.imageData}\n                      alt=\"Watermark\"\n                      style={{\n                        width: `${(watermarkConfig.image?.width || 100) * 0.5}px`,\n                        height: `${(watermarkConfig.image?.height || 100) * 0.5}px`\n                      }}\n                    />\n                  )}\n                </div>\n              </div>\n            </div>\n          )}\n\n          {!showPreview && (\n            <div className=\"p-8 bg-gray-50 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-center\">\n              <Eye className=\"w-12 h-12 mx-auto mb-4 text-gray-400\" />\n              <p className=\"text-gray-500 dark:text-gray-400\">\n                Add files and click \"Preview\" to see watermark placement\n              </p>\n            </div>\n          )}\n        </div>\n      </div>\n\n      {/* Action Buttons */}\n      {selectedFiles.length > 0 && (\n        <div className=\"mt-6 grid grid-cols-1 md:grid-cols-2 gap-4\">\n          <button\n            onClick={handleWatermark}\n            disabled={isProcessing}\n            className=\"bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2\"\n          >\n            {isProcessing ? (\n              <RefreshCw className=\"w-5 h-5 animate-spin\" />\n            ) : (\n              <Droplets className=\"w-5 h-5\" />\n            )}\n            {isProcessing ? 'Adding Watermarks...' : 'Apply Watermark'}\n          </button>\n          \n          <button\n            onClick={addToBatch}\n            disabled={isProcessing}\n            className=\"bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2\"\n          >\n            <Zap className=\"w-5 h-5\" />\n            Add to Batch Queue\n          </button>\n        </div>\n      )}\n\n      {selectedFiles.length === 0 && (\n        <div className=\"p-4 bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg\">\n          <div className=\"flex items-center gap-2\">\n            <AlertCircle className=\"w-5 h-5 text-yellow-600\" />\n            <span className=\"text-yellow-800 dark:text-yellow-200\">\n              Add PDF files to apply watermarks.\n            </span>\n          </div>\n        </div>\n      )}\n    </div>\n  )\n}\n\nexport default AdvancedWatermarkTool"