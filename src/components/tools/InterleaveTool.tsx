import React, { useState, useRef } from 'react'
import { Upload, Layers, Download, Settings, Eye, AlertCircle, RefreshCw, Plus, X, ArrowUp, ArrowDown } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { useJobsStore } from '../../state/jobs'
import { workerManager } from '../../lib/workerManager'

interface InterleaveModeType {
  id: string
  name: string
  description: string
  pattern?: string
}

interface InterleaveOptions {
  mode: 'zip' | 'alternate' | 'custom' | 'burst'
  customPattern: number[]
  insertAfter: number
  preserveOrder: boolean
  skipBlankPages: boolean
}

const interleaveModes: InterleaveModeType[] = [
  {
    id: 'zip',
    name: 'Zip Mode',
    description: 'Alternate pages from each document (A1, B1, A2, B2, ...)',
    pattern: '[A1, B1, A2, B2, A3, B3, ...]'
  },
  {
    id: 'alternate',
    name: 'Alternate Blocks',
    description: 'Insert complete document between pages of another',
    pattern: '[A1-An, B1-Bn, A(n+1), ...]'
  },
  {
    id: 'burst',
    name: 'Burst Insert',
    description: 'Insert pages at specific positions in the main document'
  },
  {
    id: 'custom',
    name: 'Custom Pattern',
    description: 'Define your own interleaving pattern'
  }
]

const InterleaveTool: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [options, setOptions] = useState<InterleaveOptions>({
    mode: 'zip',
    customPattern: [1, 2, 1, 2], // Document indices
    insertAfter: 1,
    preserveOrder: true,
    skipBlankPages: false
  })
  const [previews, setPreviews] = useState<string[]>([])
  const [totalPages, setTotalPages] = useState<number[]>([])
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addFile } = useAppStore()
  const { addJob, updateJob } = useJobsStore()

  const handleFileSelect = async (files: FileList) => {
    const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf')
    if (pdfFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...pdfFiles])
      await generatePreviews(pdfFiles)
      await getTotalPages(pdfFiles)
    }
  }

  const generatePreviews = async (files: File[]) => {
    const newPreviews: string[] = []
    
    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        const { loadPDFDocument, getPageThumbnail } = await import('../../lib/pdf')
        const doc = await loadPDFDocument(uint8Array)
        const page = await doc.getPage(1)
        const thumbnail = await getPageThumbnail(page, 100)
        newPreviews.push(thumbnail)
      } catch (error) {
        console.error('Error generating preview:', error)
        newPreviews.push('')
      }
    }
    
    setPreviews(prev => [...prev, ...newPreviews])
  }

  const getTotalPages = async (files: File[]) => {
    const newPageCounts: number[] = []
    
    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        const { loadPDFDocument, getPDFInfo } = await import('../../lib/pdf')
        const doc = await loadPDFDocument(uint8Array)
        const info = await getPDFInfo(doc)
        newPageCounts.push(info.pageCount)
      } catch (error) {
        console.error('Error getting PDF info:', error)
        newPageCounts.push(0)
      }
    }
    
    setTotalPages(prev => [...prev, ...newPageCounts])
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
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
    setPreviews(prev => prev.filter((_, i) => i !== index))
    setTotalPages(prev => prev.filter((_, i) => i !== index))
  }

  const moveFile = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === selectedFiles.length - 1)) {
      return
    }
    
    const newIndex = direction === 'up' ? index - 1 : index + 1
    
    setSelectedFiles(prev => {
      const newFiles = [...prev]
      const temp = newFiles[index]
      newFiles[index] = newFiles[newIndex]
      newFiles[newIndex] = temp
      return newFiles
    })
    
    setPreviews(prev => {
      const newPreviews = [...prev]
      const temp = newPreviews[index]
      newPreviews[index] = newPreviews[newIndex]
      newPreviews[newIndex] = temp
      return newPreviews
    })
    
    setTotalPages(prev => {
      const newPages = [...prev]
      const temp = newPages[index]
      newPages[index] = newPages[newIndex]
      newPages[newIndex] = temp
      return newPages
    })
  }

  const calculateOutputPages = () => {
    return totalPages.reduce((sum, count) => sum + count, 0)
  }

  const getInterleavePattern = () => {
    switch (options.mode) {
      case 'zip':
        return 'A1, B1, A2, B2, A3, B3, ...'
      case 'alternate':
        return 'All pages of A, then all pages of B, then remaining...'
      case 'burst':
        return `Insert after page ${options.insertAfter} of main document`
      case 'custom':
        return `Pattern: ${options.customPattern.map(i => `Doc${i}`).join(', ')}`
      default:
        return ''
    }
  }

  const handleInterleave = async () => {
    if (selectedFiles.length < 2) return

    setIsProcessing(true)
    
    try {
      const pdfDatas = await Promise.all(
        selectedFiles.map(async file => {
          const arrayBuffer = await file.arrayBuffer()
          return new Uint8Array(arrayBuffer)
        })
      )
      
      const jobId = `interleave-${Date.now()}`
      addJob({
        id: jobId,
        type: 'interleave',
        name: 'Interleave Pages',
        status: 'running',
        progress: { current: 0, total: 100, message: 'Interleaving pages...' },
        startTime: Date.now(),
        cancellable: true,
        fileIds: selectedFiles.map(f => f.name)
      })

      const interleaveOptions = {
        mode: options.mode,
        customPattern: options.customPattern,
        insertAfter: options.insertAfter,
        preserveOrder: options.preserveOrder,
        skipBlankPages: options.skipBlankPages
      }

      const result = await workerManager.interleavePages(pdfDatas, interleaveOptions)
      
      // Create new file with interleaved content
      const blob = new Blob([new Uint8Array(result)], { type: 'application/pdf' })
      const fileName = `interleaved_${options.mode}_${Date.now()}.pdf`
      
      addFile({
        id: `interleave-${Date.now()}`,
        name: fileName,
        size: blob.size,
        pageCount: calculateOutputPages(),
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
        progress: { current: 100, total: 100, message: 'Interleave completed' },
        endTime: Date.now()
      })

    } catch (error) {
      console.error('Error interleaving PDFs:', error)
      updateJob(`interleave-error-${Date.now()}`, {
        status: 'failed',
        progress: { current: 0, total: 100, message: 'Interleave failed' },
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
          <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center">
            <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Interleave Pages</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Mix pages from multiple documents</p>
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
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Select PDF Files</h3>
                
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
                    Drop multiple PDF files here or{' '}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      browse
                    </button>
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Select 2 or more PDF files to interleave
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </div>

                {/* Selected Files */}
                {selectedFiles.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <h4 className="font-medium text-gray-900 dark:text-white">Selected Files ({selectedFiles.length})</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {selectedFiles.map((file, index) => (
                        <div key={index} className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                          {previews[index] && (
                            <img 
                              src={previews[index]} 
                              alt={`Preview ${index + 1}`}
                              className="w-8 h-10 object-cover rounded border"
                            />
                          )}
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 dark:text-white text-sm">{file.name}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {(file.size / (1024 * 1024)).toFixed(2)} MB • {totalPages[index] || 0} pages
                            </p>
                          </div>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => moveFile(index, 'up')}
                              disabled={index === 0}
                              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => moveFile(index, 'down')}
                              disabled={index === selectedFiles.length - 1}
                              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                            >
                              <ArrowDown className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => removeFile(index)}
                              className="p-1 text-gray-400 hover:text-red-600"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Interleave Options */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  Interleave Mode
                </h3>
                
                <div className="space-y-4">
                  {interleaveModes.map((mode) => (
                    <label key={mode.id} className="block">
                      <input
                        type="radio"
                        name="interleaveMode"
                        value={mode.id}
                        checked={options.mode === mode.id}
                        onChange={(e) => setOptions({ ...options, mode: e.target.value as any })}
                        className="sr-only"
                      />
                      <div className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        options.mode === mode.id
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                          : 'border-gray-300 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-500'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900 dark:text-white">{mode.name}</h4>
                          {options.mode === mode.id && (
                            <div className="w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center">
                              <div className="w-2 h-2 bg-white rounded-full" />
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{mode.description}</p>
                        {mode.pattern && (
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 font-mono">{mode.pattern}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>

                {/* Mode-specific options */}
                {options.mode === 'burst' && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Insert after page
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={totalPages[0] || 1}
                      value={options.insertAfter}
                      onChange={(e) => setOptions({ ...options, insertAfter: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}

                {options.mode === 'custom' && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Custom Pattern (Document indices)
                    </label>
                    <div className="flex items-center space-x-2">
                      {options.customPattern.map((docIndex, index) => (
                        <input
                          key={index}
                          type="number"
                          min="1"
                          max={selectedFiles.length}
                          value={docIndex}
                          onChange={(e) => {
                            const newPattern = [...options.customPattern]
                            newPattern[index] = parseInt(e.target.value) || 1
                            setOptions({ ...options, customPattern: newPattern })
                          }}
                          className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      ))}
                      <button
                        onClick={() => setOptions({ 
                          ...options, 
                          customPattern: [...options.customPattern, 1] 
                        })}
                        className="p-1 text-indigo-600 hover:text-indigo-700"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Use document numbers (1 for first file, 2 for second, etc.)
                    </p>
                  </div>
                )}

                {/* Additional Options */}
                <div className="mt-4 space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={options.preserveOrder}
                      onChange={(e) => setOptions({ ...options, preserveOrder: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Preserve page order within documents
                    </span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={options.skipBlankPages}
                      onChange={(e) => setOptions({ ...options, skipBlankPages: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Skip blank pages
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Preview & Actions */}
            <div className="space-y-6">
              {/* Preview */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                  <Eye className="w-5 h-5 mr-2" />
                  Interleave Preview
                </h3>
                
                <div className="space-y-4">
                  {selectedFiles.length > 1 && (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">Pattern Preview</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                        {getInterleavePattern()}
                      </p>
                    </div>
                  )}

                  {/* File Previews Grid */}
                  {selectedFiles.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Document previews:</p>
                      <div className="grid grid-cols-2 gap-4">
                        {selectedFiles.map((_, index) => (
                          <div key={index} className="text-center">
                            <div className="bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded p-2 mb-2">
                              {previews[index] ? (
                                <img 
                                  src={previews[index]} 
                                  alt={`Preview ${index + 1}`}
                                  className="w-full h-24 object-contain"
                                />
                              ) : (
                                <div className="w-full h-24 flex items-center justify-center text-gray-400">
                                  <Layers className="w-8 h-8" />
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              Doc {index + 1}: {totalPages[index] || 0} pages
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  {selectedFiles.length > 1 && (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">Output Summary</h4>
                      <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <li>• Input files: {selectedFiles.length}</li>
                        <li>• Total pages: {calculateOutputPages()}</li>
                        <li>• Interleave mode: {interleaveModes.find(m => m.id === options.mode)?.name}</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Process Button */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <button
                  onClick={handleInterleave}
                  disabled={selectedFiles.length < 2 || isProcessing}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-md transition-colors flex items-center justify-center"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      Interleaving...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5 mr-2" />
                      Interleave Pages
                    </>
                  )}
                </button>

                {selectedFiles.length < 2 && (
                  <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md">
                    <div className="flex">
                      <AlertCircle className="w-5 h-5 text-yellow-400 mr-2 flex-shrink-0" />
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        Please select at least 2 PDF files to interleave.
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

export default InterleaveTool