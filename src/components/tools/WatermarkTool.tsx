import React, { useState, useRef } from 'react'
import { Upload, Droplets, Download, RefreshCw, AlertCircle, Eye, Settings, Type, Image } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { useJobsStore } from '../../state/jobs'
import { workerManager } from '../../lib/workerManager'

interface WatermarkOptions {
  type: 'text' | 'image'
  text: string
  fontSize: number
  color: string
  opacity: number
  rotation: number
  position: 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
  offsetX: number
  offsetY: number
  imageFile: File | null
  imageScale: number
  pageIndices: number[]
  applyToAll: boolean
}

const positions = [
  { id: 'top-left', name: 'Top Left' },
  { id: 'top-center', name: 'Top Center' },
  { id: 'top-right', name: 'Top Right' },
  { id: 'center-left', name: 'Center Left' },
  { id: 'center', name: 'Center' },
  { id: 'center-right', name: 'Center Right' },
  { id: 'bottom-left', name: 'Bottom Left' },
  { id: 'bottom-center', name: 'Bottom Center' },
  { id: 'bottom-right', name: 'Bottom Right' }
]

const WatermarkTool: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [options, setOptions] = useState<WatermarkOptions>({
    type: 'text',
    text: 'CONFIDENTIAL',
    fontSize: 48,
    color: '#808080',
    opacity: 0.3,
    rotation: 45,
    position: 'center',
    offsetX: 0,
    offsetY: 0,
    imageFile: null,
    imageScale: 100,
    pageIndices: [],
    applyToAll: true
  })
  const [preview, setPreview] = useState<string | null>(null)
  const [totalPages, setTotalPages] = useState<number>(0)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const { addFile } = useAppStore()
  const { addJob, updateJob } = useJobsStore()

  const handleFileSelect = async (file: File) => {
    if (file.type === 'application/pdf') {
      setSelectedFile(file)
      await generatePreview(file)
      await getTotalPages(file)
    }
  }

  const generatePreview = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      const { loadPDFDocument, getPageThumbnail } = await import('../../lib/pdf')
      const doc = await loadPDFDocument(uint8Array)
      const page = await doc.getPage(1)
      const thumbnail = await getPageThumbnail(page, 150)
      setPreview(thumbnail)
    } catch (error) {
      console.error('Error generating preview:', error)
    }
  }

  const getTotalPages = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      const { loadPDFDocument, getPDFInfo } = await import('../../lib/pdf')
      const doc = await loadPDFDocument(uint8Array)
      const info = await getPDFInfo(doc)
      setTotalPages(info.pageCount)
      setOptions(prev => ({
        ...prev,
        pageIndices: Array.from({ length: info.pageCount }, (_, i) => i)
      }))
    } catch (error) {
      console.error('Error getting PDF info:', error)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const droppedFiles = Array.from(e.dataTransfer.files)
    const pdfFile = droppedFiles.find(file => file.type === 'application/pdf')
    
    if (pdfFile) {
      handleFileSelect(pdfFile)
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
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      setOptions(prev => ({ ...prev, imageFile: file }))
    }
  }

  const handleWatermark = async () => {
    if (!selectedFile) return

    setIsProcessing(true)
    
    try {
      const arrayBuffer = await selectedFile.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      
      const jobId = `watermark-${Date.now()}`
      addJob({
        id: jobId,
        type: 'watermark',
        name: 'Add Watermark',
        status: 'running',
        progress: { current: 0, total: 100, message: 'Adding watermark...' },
        startTime: Date.now(),
        cancellable: true,
        fileIds: [selectedFile.name]
      })

      // Prepare watermark options
      const watermarkOptions = {
        pageIndices: options.applyToAll ? Array.from({ length: totalPages }, (_, i) => i) : options.pageIndices,
        fontSize: options.fontSize,
        color: {
          r: parseInt(options.color.slice(1, 3), 16) / 255,
          g: parseInt(options.color.slice(3, 5), 16) / 255,
          b: parseInt(options.color.slice(5, 7), 16) / 255
        },
        opacity: options.opacity,
        rotation: options.rotation,
        position: options.position,
        offsetX: options.offsetX,
        offsetY: options.offsetY
      }

      let result: Uint8Array
      
      if (options.type === 'text') {
        result = await workerManager.addWatermark(uint8Array, options.text, watermarkOptions)
      } else {
        // For image watermarks, we'll use text for now as a simplified implementation
        result = await workerManager.addWatermark(uint8Array, '[IMAGE WATERMARK]', watermarkOptions)
      }
      
      // Create new file with watermark
      const blob = new Blob([new Uint8Array(result)], { type: 'application/pdf' })
      const fileName = selectedFile.name.replace(/\.pdf$/i, '_watermarked.pdf')
      
      addFile({
        id: `watermark-${Date.now()}`,
        name: fileName,
        size: blob.size,
        pageCount: totalPages,
        data: new Uint8Array(await blob.arrayBuffer()),
        lastModified: Date.now()
      })
      
      // Download the file
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
      
      // Update job status
      updateJob(jobId, {
        status: 'completed',
        progress: { current: 100, total: 100, message: 'Watermark completed' },
        endTime: Date.now()
      })

    } catch (error) {
      console.error('Error adding watermark:', error)
      updateJob(`watermark-error-${Date.now()}`, {
        status: 'failed',
        progress: { current: 0, total: 100, message: 'Watermark failed' },
        endTime: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-cyan-100 dark:bg-cyan-900 rounded-lg flex items-center justify-center">
            <Droplets className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Add Watermark</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Add text or image watermarks to PDF</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* File Upload & Options */}
            <div className="space-y-6">
              {/* File Upload */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Select PDF File</h3>
                
                {!selectedFile ? (
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      isDragOver
                        ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                  >
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400 mb-2">
                      Drop your PDF file here or{' '}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        browse
                      </button>
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Supports PDF files up to 100MB
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf"
                      onChange={handleFileInput}
                      className="hidden"
                    />
                  </div>
                ) : (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
                        <Droplets className="w-5 h-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">{selectedFile.name}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {totalPages} pages
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedFile(null)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Watermark Options */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  Watermark Options
                </h3>
                
                <div className="space-y-6">
                  {/* Watermark Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Watermark Type
                    </label>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="watermarkType"
                          value="text"
                          checked={options.type === 'text'}
                          onChange={(e) => setOptions({ ...options, type: e.target.value as any })}
                          className="mr-2"
                        />
                        <Type className="w-4 h-4 mr-1" />
                        <span className="text-sm">Text</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="watermarkType"
                          value="image"
                          checked={options.type === 'image'}
                          onChange={(e) => setOptions({ ...options, type: e.target.value as any })}
                          className="mr-2"
                        />
                        <Image className="w-4 h-4 mr-1" />
                        <span className="text-sm">Image</span>
                      </label>
                    </div>
                  </div>

                  {/* Text Options */}
                  {options.type === 'text' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Watermark Text
                        </label>
                        <input
                          type="text"
                          value={options.text}
                          onChange={(e) => setOptions({ ...options, text: e.target.value })}
                          placeholder="Enter watermark text"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Font Size
                          </label>
                          <input
                            type="number"
                            min="8"
                            max="144"
                            value={options.fontSize}
                            onChange={(e) => setOptions({ ...options, fontSize: parseInt(e.target.value) || 48 })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Color
                          </label>
                          <input
                            type="color"
                            value={options.color}
                            onChange={(e) => setOptions({ ...options, color: e.target.value })}
                            className="w-full h-10 border border-gray-300 dark:border-gray-600 rounded-md"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Image Options */}
                  {options.type === 'image' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Select Image
                        </label>
                        <button
                          onClick={() => imageInputRef.current?.click()}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-left"
                        >
                          {options.imageFile ? options.imageFile.name : 'Choose image file...'}
                        </button>
                        <input
                          ref={imageInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageSelect}
                          className="hidden"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Scale (%)
                        </label>
                        <input
                          type="number"
                          min="10"
                          max="200"
                          value={options.imageScale}
                          onChange={(e) => setOptions({ ...options, imageScale: parseInt(e.target.value) || 100 })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Position & Effects */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Position
                      </label>
                      <select
                        value={options.position}
                        onChange={(e) => setOptions({ ...options, position: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        {positions.map(pos => (
                          <option key={pos.id} value={pos.id}>{pos.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Opacity
                        </label>
                        <input
                          type="range"
                          min="0.1"
                          max="1"
                          step="0.1"
                          value={options.opacity}
                          onChange={(e) => setOptions({ ...options, opacity: parseFloat(e.target.value) })}
                          className="w-full"
                        />
                        <div className="text-center text-sm text-gray-500">{Math.round(options.opacity * 100)}%</div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Rotation (°)
                        </label>
                        <input
                          type="range"
                          min="-90"
                          max="90"
                          value={options.rotation}
                          onChange={(e) => setOptions({ ...options, rotation: parseInt(e.target.value) })}
                          className="w-full"
                        />
                        <div className="text-center text-sm text-gray-500">{options.rotation}°</div>
                      </div>
                    </div>
                  </div>

                  {/* Page Selection */}
                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={options.applyToAll}
                        onChange={(e) => setOptions({ ...options, applyToAll: e.target.checked })}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Apply to all pages
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview & Actions */}
            <div className="space-y-6">
              {/* Preview */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                  <Eye className="w-5 h-5 mr-2" />
                  Preview
                </h3>
                
                <div className="space-y-4">
                  {/* Original Page Preview */}
                  {preview && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Original file preview:</p>
                      <div className="flex justify-center">
                        <div className="relative">
                          <img 
                            src={preview} 
                            alt="PDF Preview" 
                            className="max-w-48 border border-gray-200 dark:border-gray-600 rounded"
                          />
                          {/* Watermark Preview Overlay */}
                          {options.type === 'text' && options.text && (
                            <div 
                              className="absolute text-gray-500 font-bold pointer-events-none"
                              style={{
                                fontSize: `${Math.max(8, options.fontSize / 4)}px`,
                                opacity: options.opacity,
                                color: options.color,
                                ...(options.position === 'center' ? { 
                                  top: '50%', 
                                  left: '50%', 
                                  transform: `translate(-50%, -50%) rotate(${options.rotation}deg)` 
                                } : 
                                options.position === 'top-left' ? { top: '10px', left: '10px', transform: `rotate(${options.rotation}deg)` } :
                                options.position === 'top-right' ? { top: '10px', right: '10px', transform: `rotate(${options.rotation}deg)` } :
                                options.position === 'bottom-left' ? { bottom: '10px', left: '10px', transform: `rotate(${options.rotation}deg)` } :
                                options.position === 'bottom-right' ? { bottom: '10px', right: '10px', transform: `rotate(${options.rotation}deg)` } :
                                { top: '50%', left: '50%', transform: `translate(-50%, -50%) rotate(${options.rotation}deg)` })
                              }}
                            >
                              {options.text}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Watermark Info */}
                  {totalPages > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">Watermark Summary</h4>
                      <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <li>• Type: {options.type === 'text' ? `Text ("${options.text}")` : 'Image'}</li>
                        <li>• Position: {positions.find(p => p.id === options.position)?.name}</li>
                        <li>• Opacity: {Math.round(options.opacity * 100)}%</li>
                        <li>• Rotation: {options.rotation}°</li>
                        <li>• Apply to: {options.applyToAll ? `All ${totalPages} pages` : `Selected pages`}</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Process Button */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <button
                  onClick={handleWatermark}
                  disabled={!selectedFile || isProcessing || (options.type === 'text' && !options.text.trim())}
                  className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-md transition-colors flex items-center justify-center"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      Adding Watermark...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5 mr-2" />
                      Add Watermark
                    </>
                  )}
                </button>

                {!selectedFile && (
                  <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md">
                    <div className="flex">
                      <AlertCircle className="w-5 h-5 text-yellow-400 mr-2 flex-shrink-0" />
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        Please select a PDF file to add watermark.
                      </p>
                    </div>
                  </div>
                )}

                {options.type === 'text' && !options.text.trim() && (
                  <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md">
                    <div className="flex">
                      <AlertCircle className="w-5 h-5 text-yellow-400 mr-2 flex-shrink-0" />
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        Please enter watermark text.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WatermarkTool