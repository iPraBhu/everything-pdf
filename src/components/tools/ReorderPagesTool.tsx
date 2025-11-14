import React, { useState, useRef } from 'react'
import { Upload, ArrowUpDown, Download, Eye, AlertCircle, RefreshCw, Trash2, RotateCw, Copy } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { useJobsStore } from '../../state/jobs'
import { workerManager } from '../../lib/workerManager'

interface PageItem {
  index: number
  thumbnail: string | null
  rotation: number
  selected: boolean
}

const ReorderPagesTool: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isLoadingPages, setIsLoadingPages] = useState(false)
  const [pages, setPages] = useState<PageItem[]>([])
  const [totalPages, setTotalPages] = useState<number>(0)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addFile } = useAppStore()
  const { addJob, updateJob } = useJobsStore()

  const handleFileSelect = async (file: File) => {
    if (file.type === 'application/pdf') {
      setSelectedFile(file)
      await loadPages(file)
    }
  }

  const loadPages = async (file: File) => {
    setIsLoadingPages(true)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      const { loadPDFDocument, getPDFInfo, getPageThumbnail } = await import('../../lib/pdf')
      const doc = await loadPDFDocument(uint8Array)
      const info = await getPDFInfo(doc)
      setTotalPages(info.pageCount)
      
      // Generate thumbnails for all pages
      const pageItems: PageItem[] = []
      for (let i = 0; i < info.pageCount; i++) {
        const page = await doc.getPage(i + 1)
        const thumbnail = await getPageThumbnail(page, 120)
        pageItems.push({
          index: i,
          thumbnail,
          rotation: 0,
          selected: false
        })
      }
      setPages(pageItems)
    } catch (error) {
      console.error('Error loading pages:', error)
    } finally {
      setIsLoadingPages(false)
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

  const movePageUp = (index: number) => {
    if (index > 0) {
      const newPages = [...pages]
      const temp = newPages[index]
      newPages[index] = newPages[index - 1]
      newPages[index - 1] = temp
      setPages(newPages)
    }
  }

  const movePageDown = (index: number) => {
    if (index < pages.length - 1) {
      const newPages = [...pages]
      const temp = newPages[index]
      newPages[index] = newPages[index + 1]
      newPages[index + 1] = temp
      setPages(newPages)
    }
  }

  const rotatePage = (index: number) => {
    const newPages = [...pages]
    newPages[index] = {
      ...newPages[index],
      rotation: (newPages[index].rotation + 90) % 360
    }
    setPages(newPages)
  }

  const duplicatePage = (index: number) => {
    const newPages = [...pages]
    const pageToClone = { ...newPages[index] }
    newPages.splice(index + 1, 0, pageToClone)
    setPages(newPages)
  }

  const removePage = (index: number) => {
    if (pages.length > 1) {
      const newPages = pages.filter((_, i) => i !== index)
      setPages(newPages)
    }
  }

  const togglePageSelection = (index: number) => {
    const newPages = [...pages]
    newPages[index] = {
      ...newPages[index],
      selected: !newPages[index].selected
    }
    setPages(newPages)
  }

  const selectAllPages = () => {
    const newPages = pages.map(page => ({ ...page, selected: true }))
    setPages(newPages)
  }

  const clearSelection = () => {
    const newPages = pages.map(page => ({ ...page, selected: false }))
    setPages(newPages)
  }

  const deleteSelected = () => {
    const newPages = pages.filter(page => !page.selected)
    if (newPages.length > 0) {
      setPages(newPages)
    }
  }

  const duplicateSelected = () => {
    const newPages = [...pages]
    for (let i = pages.length - 1; i >= 0; i--) {
      if (pages[i].selected) {
        const pageToClone = { ...pages[i], selected: false }
        newPages.splice(i + 1, 0, pageToClone)
      }
    }
    setPages(newPages)
  }

  const resetToOriginal = () => {
    if (selectedFile) {
      loadPages(selectedFile)
    }
  }

  const handleReorderPages = async () => {
    if (!selectedFile || pages.length === 0) return

    setIsProcessing(true)
    
    try {
      const arrayBuffer = await selectedFile.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      
      const jobId = `reorder-${Date.now()}`
      addJob({
        id: jobId,
        type: 'reorder',
        name: 'Reorder Pages',
        status: 'running',
        progress: { current: 0, total: 100, message: 'Reordering pages...' },
        startTime: Date.now(),
        cancellable: true,
        fileIds: [selectedFile.name]
      })

      // For reordering, extract pages in the new order
      // Note: Since we don't have a specific reorder method, we'll use extractPages
      // to create a new PDF with pages in the desired order
      const pageIndices = pages.map(page => page.index)
      
      // If any pages have rotations, we'll need to handle that separately
      // For now, we'll extract pages in the new order
      const result = await workerManager.extractPages(uint8Array, pageIndices)
      
      // Create new file with reordered pages
      const blob = new Blob([new Uint8Array(result)], { type: 'application/pdf' })
      const fileName = selectedFile.name.replace(/\.pdf$/i, '_reordered.pdf')
      
      addFile({
        id: `reorder-${Date.now()}`,
        name: fileName,
        size: blob.size,
        pageCount: pages.length,
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
        progress: { current: 100, total: 100, message: `Reordered ${pages.length} pages` },
        endTime: Date.now()
      })

    } catch (error) {
      console.error('Error reordering pages:', error)
      updateJob(`reorder-error-${Date.now()}`, {
        status: 'failed',
        progress: { current: 0, total: 100, message: 'Failed to reorder pages' },
        endTime: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const selectedCount = pages.filter(page => page.selected).length

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center">
            <ArrowUpDown className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Reorder Pages</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Drag, reorder, rotate, and organize PDF pages</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6">
          {!selectedFile ? (
            /* File Upload */
            <div className="max-w-2xl mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6 text-center">Select PDF File</h3>
                
                <div
                  className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                    isDragOver
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  <Upload className="w-16 h-16 text-gray-400 mx-auto mb-6" />
                  <p className="text-gray-600 dark:text-gray-400 mb-3 text-lg">
                    Drop your PDF file here or{' '}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
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
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* File Info & Controls */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-4 lg:space-y-0">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
                        <ArrowUpDown className="w-5 h-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{selectedFile.name}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {pages.length} pages
                          {pages.length !== totalPages && ` (originally ${totalPages})`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3">
                    {selectedCount > 0 && (
                      <>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {selectedCount} selected
                        </span>
                        <button
                          onClick={duplicateSelected}
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                        >
                          <Copy className="w-4 h-4 mr-1" />
                          Duplicate
                        </button>
                        <button
                          onClick={deleteSelected}
                          disabled={pages.length - selectedCount < 1}
                          className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 flex items-center"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </button>
                        <button
                          onClick={clearSelection}
                          className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          Clear Selection
                        </button>
                      </>
                    )}
                    
                    {selectedCount === 0 && (
                      <button
                        onClick={selectAllPages}
                        className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        Select All
                      </button>
                    )}
                    
                    <button
                      onClick={resetToOriginal}
                      className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>

              {/* Pages Grid */}
              {isLoadingPages ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12">
                  <div className="text-center">
                    <RefreshCw className="w-8 h-8 text-gray-400 mx-auto mb-4 animate-spin" />
                    <p className="text-gray-600 dark:text-gray-400">Loading page thumbnails...</p>
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                    <Eye className="w-5 h-5 mr-2" />
                    Page Order ({pages.length} pages)
                  </h3>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                    {pages.map((page, index) => (
                      <div
                        key={`${page.index}-${index}`}
                        className={`relative group border-2 rounded-lg p-2 transition-colors ${
                          page.selected 
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                      >
                        {/* Selection Checkbox */}
                        <div className="absolute top-1 left-1 z-10">
                          <input
                            type="checkbox"
                            checked={page.selected}
                            onChange={() => togglePageSelection(index)}
                            className="w-4 h-4 text-blue-600 bg-white rounded border-gray-300 focus:ring-blue-500"
                          />
                        </div>

                        {/* Page Number */}
                        <div className="absolute top-1 right-1 bg-gray-900 text-white text-xs px-2 py-1 rounded">
                          {index + 1}
                        </div>

                        {/* Thumbnail */}
                        <div 
                          className="w-full h-32 bg-gray-100 dark:bg-gray-700 rounded mb-2 flex items-center justify-center cursor-pointer"
                          style={{ transform: `rotate(${page.rotation}deg)` }}
                          onClick={() => togglePageSelection(index)}
                        >
                          {page.thumbnail ? (
                            <img 
                              src={page.thumbnail} 
                              alt={`Page ${page.index + 1}`}
                              className="max-w-full max-h-full object-contain"
                            />
                          ) : (
                            <span className="text-gray-400 text-sm">Page {page.index + 1}</span>
                          )}
                        </div>

                        {/* Controls */}
                        <div className="flex justify-between items-center">
                          <div className="flex space-x-1">
                            <button
                              onClick={() => movePageUp(index)}
                              disabled={index === 0}
                              className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-50"
                              title="Move up"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => movePageDown(index)}
                              disabled={index === pages.length - 1}
                              className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-50"
                              title="Move down"
                            >
                              ↓
                            </button>
                          </div>
                          
                          <div className="flex space-x-1">
                            <button
                              onClick={() => rotatePage(index)}
                              className="p-1 text-gray-400 hover:text-green-600"
                              title="Rotate 90°"
                            >
                              <RotateCw className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => duplicatePage(index)}
                              className="p-1 text-gray-400 hover:text-blue-600"
                              title="Duplicate"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => removePage(index)}
                              disabled={pages.length <= 1}
                              className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-50"
                              title="Remove"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Process Button */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <button
                  onClick={handleReorderPages}
                  disabled={isProcessing || pages.length === 0}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-md transition-colors flex items-center justify-center"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5 mr-2" />
                      Create Reordered PDF ({pages.length} pages)
                    </>
                  )}
                </button>

                {pages.length === 0 && selectedFile && (
                  <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md">
                    <div className="flex">
                      <AlertCircle className="w-5 h-5 text-yellow-400 mr-2 flex-shrink-0" />
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        No pages available. Please upload a PDF file.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ReorderPagesTool