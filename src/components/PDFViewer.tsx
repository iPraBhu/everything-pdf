import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { PDFDocumentProxy } from 'pdfjs-dist'
import { ZoomIn, ZoomOut, RotateCw, ChevronLeft, ChevronRight, Download, Maximize2 } from 'lucide-react'
import { useAppStore } from '../state/store'

// Configure PDF.js worker to use local file
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.js`
}

interface PDFViewerProps {
  file?: File
  className?: string
  showControls?: boolean
  onPageChange?: (page: number) => void
  onZoomChange?: (zoom: number) => void
}

interface PageRenderInfo {
  pageNum: number
  canvas: HTMLCanvasElement
  rendered: boolean
}

export const PDFViewer: React.FC<PDFViewerProps> = ({
  file,
  className = '',
  showControls = true,
  onPageChange,
  onZoomChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [rotation, setRotation] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [_renderedPages, setRenderedPages] = useState<Map<number, PageRenderInfo>>(new Map())

  const { 
    viewerZoom, 
    viewerPage, 
    setViewerZoom, 
    setViewerPage, 
    updateFile,
    activeFileId
  } = useAppStore()

  const loadPDF = useCallback(async (pdfFile: File) => {
    setLoading(true)
    setError(null)
    
    try {
      const arrayBuffer = await pdfFile.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      
      setPdfDoc(pdf)
      setTotalPages(pdf.numPages)
      setRenderedPages(new Map())
      
      // Update the file in the store with the correct page count
      if (activeFileId) {
        updateFile(activeFileId, { pageCount: pdf.numPages })
      }
      
    } catch (err) {
      console.error('Error loading PDF:', err)
      setError('Failed to load PDF file')
    } finally {
      setLoading(false)
    }
  }, [activeFileId, updateFile])

  const renderPage = useCallback(async (pageNum: number, pdfDocument: PDFDocumentProxy) => {
    try {
      const page = await pdfDocument.getPage(pageNum)
      const viewport = page.getViewport({ scale: viewerZoom, rotation })
      
      // Create canvas
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')!
      
      canvas.height = viewport.height
      canvas.width = viewport.width
      canvas.className = 'border border-gray-200 dark:border-gray-700 shadow-lg mx-auto block'
      
      // Render page
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      }
      
      await page.render(renderContext).promise
      
      return { pageNum, canvas, rendered: true }
    } catch (err) {
      console.error(`Error rendering page ${pageNum}:`, err)
      throw err
    }
  }, [viewerZoom, rotation])

  const updateVisiblePages = useCallback(async () => {
    if (!pdfDoc || !canvasContainerRef.current) return

    // Clear previous renders
    canvasContainerRef.current.innerHTML = ''
    
    try {
      // For now, render only the current page
      // TODO: Implement virtual scrolling for better performance
      const pageInfo = await renderPage(viewerPage, pdfDoc)
      
      canvasContainerRef.current.appendChild(pageInfo.canvas)
      
      setRenderedPages(new Map([[viewerPage, pageInfo]]))
    } catch (err) {
      console.error('Error updating visible pages:', err)
      setError('Failed to render PDF page')
    }
  }, [pdfDoc, viewerPage, renderPage])

  // Load PDF when file changes
  useEffect(() => {
    if (file) {
      loadPDF(file)
    }
  }, [file, loadPDF])

  // Re-render when scale, rotation, or current page changes
  useEffect(() => {
    if (pdfDoc) {
      updateVisiblePages()
    }
  }, [pdfDoc, viewerPage, viewerZoom, rotation, updateVisiblePages])

  const handleZoomIn = () => {
    const newScale = Math.min(viewerZoom * 1.25, 3)
    setViewerZoom(newScale)
    onZoomChange?.(newScale)
  }

  const handleZoomOut = () => {
    const newScale = Math.max(viewerZoom / 1.25, 0.25)
    setViewerZoom(newScale)
    onZoomChange?.(newScale)
  }

  const handleRotate = () => {
    setRotation((rotation + 90) % 360)
  }

  const handlePrevPage = () => {
    const newPage = Math.max(1, viewerPage - 1)
    setViewerPage(newPage)
    onPageChange?.(newPage)
  }

  const handleNextPage = () => {
    const newPage = Math.min(totalPages, viewerPage + 1)
    setViewerPage(newPage)
    onPageChange?.(newPage)
  }

  const handlePageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const page = parseInt(e.target.value)
    if (page >= 1 && page <= totalPages) {
      setViewerPage(page)
      onPageChange?.(page)
    }
  }

  const handleDownload = () => {
    if (file) {
      const url = URL.createObjectURL(file)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const handleFullscreen = () => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen()
      } else {
        containerRef.current.requestFullscreen()
      }
    }
  }

  if (!file) {
    return (
      <div className={`flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900 ${className}`}>
        <div className="text-center">
          <div className="text-gray-400 text-lg mb-2">No PDF loaded</div>
          <div className="text-gray-500 text-sm">Upload a PDF file to view it here</div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <div className="text-gray-600 dark:text-gray-300">Loading PDF...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900 ${className}`}>
        <div className="text-center">
          <div className="text-red-500 text-lg mb-2">Error</div>
          <div className="text-gray-600 dark:text-gray-300">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`flex flex-col h-full bg-gray-50 dark:bg-gray-900 ${className}`}>
      {showControls && (
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          {/* Navigation Controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrevPage}
              disabled={viewerPage <= 1}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <div className="flex items-center space-x-1">
              <input
                type="number"
                value={viewerPage}
                onChange={handlePageInput}
                min={1}
                max={totalPages}
                className="w-12 px-1 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
              />
              <span className="text-sm text-gray-600 dark:text-gray-300">
                of {totalPages}
              </span>
            </div>
            
            <button
              onClick={handleNextPage}
              disabled={viewerPage >= totalPages}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleZoomOut}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            
            <span className="text-sm text-gray-600 dark:text-gray-300 min-w-12 text-center">
              {Math.round(viewerZoom * 100)}%
            </span>
            
            <button
              onClick={handleZoomIn}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Additional Controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRotate}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Rotate"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            
            <button
              onClick={handleFullscreen}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            
            <button
              onClick={handleDownload}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* PDF Content */}
      <div className="flex-1 overflow-auto p-4">
        <div
          ref={canvasContainerRef}
          className="min-h-full flex flex-col items-center space-y-4"
        />
      </div>
    </div>
  )
}

export default PDFViewer