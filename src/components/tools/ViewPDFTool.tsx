import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, Eye, ZoomIn, ZoomOut, RotateCw, Download, ChevronLeft, ChevronRight, Maximize2, Minimize2, Search, FileText, Info, Layers, Navigation } from 'lucide-react'
import { useAppStore } from '../../state/store'

interface ViewerState {
  currentPage: number
  totalPages: number
  zoom: number
  rotation: number
  fitMode: 'width' | 'height' | 'page' | 'auto'
  showThumbnails: boolean
  showBookmarks: boolean
  showInfo: boolean
}

const ViewPDFTool: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pdfDocument, setPdfDocument] = useState<any>(null)
  const [pageCanvas, setPageCanvas] = useState<HTMLCanvasElement | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [thumbnails, setThumbnails] = useState<string[]>([])

  const [viewerState, setViewerState] = useState<ViewerState>({
    currentPage: 1,
    totalPages: 0,
    zoom: 100,
    rotation: 0,
    fitMode: 'width',
    showThumbnails: false,
    showBookmarks: false,
    showInfo: false
  })

  const { addFile } = useAppStore()

  const handleFileSelect = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Please select a PDF file')
      return
    }

    setSelectedFile(file)
    setError(null)
    setIsLoading(true)

    try {
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      const { loadPDFDocument } = await import('../../lib/pdf')
      const doc = await loadPDFDocument(uint8Array)

      setPdfDocument(doc)
      setViewerState(prev => ({
        ...prev,
        totalPages: doc.numPages,
        currentPage: 1
      }))

      // Generate thumbnails for first few pages
      await generateThumbnails(doc)

      // Render first page
      await renderPage(doc, 1)

    } catch (error) {
      console.error('Error loading PDF:', error)
      setError('Failed to load PDF. The file might be corrupted or encrypted.')
    } finally {
      setIsLoading(false)
    }
  }

  const generateThumbnails = async (doc: any) => {
    try {
      const { getPageThumbnail } = await import('../../lib/pdf')
      const thumbs: string[] = []
      const maxThumbs = Math.min(doc.numPages, 20) // Limit to first 20 pages for performance

      for (let i = 1; i <= maxThumbs; i++) {
        try {
          const page = await doc.getPage(i)
          const thumbnail = await getPageThumbnail(page, 150)
          thumbs.push(thumbnail)
        } catch (error) {
          console.error(`Error generating thumbnail for page ${i}:`, error)
          thumbs.push('') // Placeholder for failed thumbnail
        }
      }
      setThumbnails(thumbs)
    } catch (error) {
      console.error('Error generating thumbnails:', error)
    }
  }

    const renderPage = async (doc: any, pageNumber: number) => {
    if (!doc || !canvasRef.current) return

    try {
      const { getPageThumbnail } = await import('../../lib/pdf')
      const page = await doc.getPage(pageNumber)
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')

      if (!context) return

      // Calculate scale based on zoom and fit mode
      const viewport = page.getViewport({ scale: 1, rotation: viewerState.rotation })
      let scale = viewerState.zoom / 100

      if (viewerState.fitMode === 'width') {
        scale = (canvas.parentElement?.clientWidth || 800) / viewport.width
      } else if (viewerState.fitMode === 'height') {
        scale = (canvas.parentElement?.clientHeight || 600) / viewport.height
      } else if (viewerState.fitMode === 'page') {
        const containerWidth = canvas.parentElement?.clientWidth || 800
        const containerHeight = canvas.parentElement?.clientHeight || 600
        scale = Math.min(containerWidth / viewport.width, containerHeight / viewport.height)
      }

      const scaledViewport = page.getViewport({ scale, rotation: viewerState.rotation })
      
      canvas.width = scaledViewport.width
      canvas.height = scaledViewport.height
      canvas.style.width = scaledViewport.width + 'px'
      canvas.style.height = scaledViewport.height + 'px'

      // Clear canvas
      context.clearRect(0, 0, canvas.width, canvas.height)

      // Render page
      const renderContext: any = {
        canvasContext: context,
        viewport: scaledViewport
      }

      await page.render(renderContext).promise
      setPageCanvas(canvas)

    } catch (error) {
      console.error('Error rendering page:', error)
      setError(`Failed to render page ${pageNumber}`)
    }
  }

  const handlePageChange = async (newPage: number) => {
    if (!pdfDocument || newPage < 1 || newPage > viewerState.totalPages) return

    setViewerState(prev => ({ ...prev, currentPage: newPage }))
    await renderPage(pdfDocument, newPage)
  }

  const handleZoomChange = async (newZoom: number) => {
    const clampedZoom = Math.max(25, Math.min(500, newZoom))
    setViewerState(prev => ({ ...prev, zoom: clampedZoom, fitMode: 'auto' }))

    if (pdfDocument) {
      await renderPage(pdfDocument, viewerState.currentPage)
    }
  }

  const handleRotation = async () => {
    const newRotation = (viewerState.rotation + 90) % 360
    setViewerState(prev => ({ ...prev, rotation: newRotation }))

    if (pdfDocument) {
      await renderPage(pdfDocument, viewerState.currentPage)
    }
  }

  const handleFitModeChange = async (newFitMode: 'width' | 'height' | 'page' | 'auto') => {
    setViewerState(prev => ({ ...prev, fitMode: newFitMode }))

    if (pdfDocument) {
      await renderPage(pdfDocument, viewerState.currentPage)
    }
  }

  const handleSearch = async () => {
    if (!pdfDocument || !searchQuery) return

    try {
      const results = []
      // TODO: Implement text search across PDF pages
      // For now, this is a placeholder
      console.warn('PDF text search not yet implemented')
      setSearchResults(results)
    } catch (error) {
      console.error('Error searching PDF:', error)
    }
  }

  const handleDownload = () => {
    if (!selectedFile) return

    const url = URL.createObjectURL(selectedFile)
    const a = document.createElement('a')
    a.href = url
    a.download = selectedFile.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }, [])

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!pdfDocument) return

      switch (e.key) {
        case 'ArrowLeft':
          if (e.ctrlKey || e.metaKey) {
            handlePageChange(viewerState.currentPage - 1)
          }
          break
        case 'ArrowRight':
          if (e.ctrlKey || e.metaKey) {
            handlePageChange(viewerState.currentPage + 1)
          }
          break
        case 'Home':
          handlePageChange(1)
          break
        case 'End':
          handlePageChange(viewerState.totalPages)
          break
        case '+':
        case '=':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            handleZoomChange(viewerState.zoom + 25)
          }
          break
        case '-':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            handleZoomChange(viewerState.zoom - 25)
          }
          break
        case '0':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            handleFitModeChange('width')
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pdfDocument, viewerState])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
              <Eye className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">PDF Viewer</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Open and view PDF documents with navigation and zoom</p>
            </div>
          </div>

          {selectedFile && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewerState(prev => ({ ...prev, showThumbnails: !prev.showThumbnails }))}
                className={`p-2 rounded-lg transition-colors ${viewerState.showThumbnails
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                title="Toggle thumbnails"
              >
                <Layers className="w-4 h-4" />
              </button>

              <button
                onClick={() => setViewerState(prev => ({ ...prev, showInfo: !prev.showInfo }))}
                className={`p-2 rounded-lg transition-colors ${viewerState.showInfo
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                title="Document info"
              >
                <Info className="w-4 h-4" />
              </button>

              <button
                onClick={handleDownload}
                className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Thumbnail Panel */}
        {selectedFile && viewerState.showThumbnails && (
          <div className="w-60 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 overflow-y-auto">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Pages</h3>
            <div className="space-y-2">
              {thumbnails.map((thumbnail, index) => (
                <button
                  key={index}
                  onClick={() => handlePageChange(index + 1)}
                  className={`w-full p-2 border rounded-lg transition-colors ${viewerState.currentPage === index + 1
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                >
                  {thumbnail ? (
                    <img
                      src={thumbnail}
                      alt={`Page ${index + 1}`}
                      className="w-full h-auto rounded"
                    />
                  ) : (
                    <div className="w-full h-24 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center">
                      <FileText className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Page {index + 1}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {!selectedFile ? (
            /* File Upload */
            <div className="flex-1 flex items-center justify-center p-8">
              <div
                className={`w-full max-w-md border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragOver
                    ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600'
                  }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <div>
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <span className="text-base font-medium text-blue-600 hover:text-blue-500">
                      Choose a PDF file
                    </span>
                    <span className="text-gray-500 dark:text-gray-400"> or drag and drop</span>
                  </label>
                  <input
                    ref={fileInputRef}
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    className="sr-only"
                    accept=".pdf"
                    onChange={handleFileInputChange}
                  />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  PDF files up to 10MB
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                {/* Navigation */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handlePageChange(viewerState.currentPage - 1)}
                    disabled={viewerState.currentPage <= 1}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={viewerState.currentPage}
                      onChange={(e) => handlePageChange(parseInt(e.target.value) || 1)}
                      className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-center"
                      min="1"
                      max={viewerState.totalPages}
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      of {viewerState.totalPages}
                    </span>
                  </div>

                  <button
                    onClick={() => handlePageChange(viewerState.currentPage + 1)}
                    disabled={viewerState.currentPage >= viewerState.totalPages}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Zoom Controls */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleZoomChange(viewerState.zoom - 25)}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>

                  <select
                    value={viewerState.fitMode}
                    onChange={(e) => handleFitModeChange(e.target.value as any)}
                    className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  >
                    <option value="auto">{viewerState.zoom}%</option>
                    <option value="width">Fit Width</option>
                    <option value="height">Fit Height</option>
                    <option value="page">Fit Page</option>
                  </select>

                  <button
                    onClick={() => handleZoomChange(viewerState.zoom + 25)}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>

                  <button
                    onClick={handleRotation}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                </div>

                {/* Search */}
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search..."
                      className="w-40 px-3 py-1 pl-8 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Search className="absolute left-2 top-1.5 w-3 h-3 text-gray-400" />
                  </div>
                  <button
                    onClick={handleSearch}
                    disabled={!searchQuery}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Find
                  </button>
                </div>
              </div>

              {/* PDF Canvas */}
              <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 p-4">
                <div className="flex justify-center">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600 dark:text-gray-400">Loading PDF...</p>
                      </div>
                    </div>
                  ) : error ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-center">
                        <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
                          <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                        </div>
                        <p className="text-red-600 dark:text-red-400">{error}</p>
                      </div>
                    </div>
                  ) : (
                    <canvas
                      ref={canvasRef}
                      className="border border-gray-300 dark:border-gray-600 shadow-lg bg-white"
                      style={{ maxWidth: '100%', height: 'auto' }}
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Info Panel */}
        {selectedFile && viewerState.showInfo && (
          <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Document Information</h3>

            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">File Details</h4>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <div><span className="font-medium">Name:</span> {selectedFile.name}</div>
                  <div><span className="font-medium">Size:</span> {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</div>
                  <div><span className="font-medium">Pages:</span> {viewerState.totalPages}</div>
                  <div><span className="font-medium">Type:</span> PDF Document</div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">View Settings</h4>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <div><span className="font-medium">Current Page:</span> {viewerState.currentPage}</div>
                  <div><span className="font-medium">Zoom:</span> {viewerState.zoom}%</div>
                  <div><span className="font-medium">Rotation:</span> {viewerState.rotation}°</div>
                  <div><span className="font-medium">Fit Mode:</span> {viewerState.fitMode}</div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Keyboard Shortcuts</h4>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <div><span className="font-medium">Ctrl + ←/→:</span> Previous/Next page</div>
                  <div><span className="font-medium">Ctrl + +/-:</span> Zoom in/out</div>
                  <div><span className="font-medium">Ctrl + 0:</span> Fit to width</div>
                  <div><span className="font-medium">Home/End:</span> First/Last page</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ViewPDFTool