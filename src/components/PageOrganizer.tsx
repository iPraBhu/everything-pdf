import React, { useEffect, useState, useCallback, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { PDFDocumentProxy } from 'pdfjs-dist'
import { Trash2, Copy, ChevronUp, ChevronDown } from 'lucide-react'

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.0.189/build/pdf.worker.min.js`

interface PageThumbnail {
  pageNum: number
  canvas: HTMLCanvasElement
  selected: boolean
}

interface PageOrganizerProps {
  file?: File
  className?: string
  onPagesChange?: (pages: number[]) => void
  onSelectionChange?: (selectedPages: number[]) => void
}

export const PageOrganizer: React.FC<PageOrganizerProps> = ({
  file,
  className = '',
  onPagesChange,
  onSelectionChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [_pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([])
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set())
  const [draggedPage, setDraggedPage] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateThumbnail = useCallback(async (pdfDocument: PDFDocumentProxy, pageNum: number): Promise<PageThumbnail> => {
    try {
      const page = await pdfDocument.getPage(pageNum)
      const scale = 0.3 // Small scale for thumbnails
      const viewport = page.getViewport({ scale })
      
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')!
      
      canvas.height = viewport.height
      canvas.width = viewport.width
      canvas.className = 'border border-gray-200 dark:border-gray-700 rounded shadow-sm'
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      }
      
      await page.render(renderContext).promise
      
      return {
        pageNum,
        canvas,
        selected: false
      }
    } catch (err) {
      console.error(`Error generating thumbnail for page ${pageNum}:`, err)
      throw err
    }
  }, [])

  const loadThumbnails = useCallback(async (pdfFile: File) => {
    setLoading(true)
    setError(null)
    setSelectedPages(new Set())
    
    try {
      const arrayBuffer = await pdfFile.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      
      setPdfDoc(pdf)
      
      // Generate all thumbnails
      const thumbnailPromises: Promise<PageThumbnail>[] = []
      for (let i = 1; i <= pdf.numPages; i++) {
        thumbnailPromises.push(generateThumbnail(pdf, i))
      }
      
      const generatedThumbnails = await Promise.all(thumbnailPromises)
      setThumbnails(generatedThumbnails)
      
    } catch (err) {
      console.error('Error loading thumbnails:', err)
      setError('Failed to load PDF thumbnails')
    } finally {
      setLoading(false)
    }
  }, [generateThumbnail])

  useEffect(() => {
    if (file) {
      loadThumbnails(file)
    }
  }, [file, loadThumbnails])

  const handlePageClick = useCallback((pageNum: number, event: React.MouseEvent) => {
    const isCtrlOrCmd = event.ctrlKey || event.metaKey
    const isShift = event.shiftKey
    
    setSelectedPages(prev => {
      const newSelection = new Set(prev)
      
      if (isCtrlOrCmd) {
        // Toggle selection
        if (newSelection.has(pageNum)) {
          newSelection.delete(pageNum)
        } else {
          newSelection.add(pageNum)
        }
      } else if (isShift && prev.size > 0) {
        // Range selection
        const lastSelected = Math.max(...Array.from(prev))
        const start = Math.min(lastSelected, pageNum)
        const end = Math.max(lastSelected, pageNum)
        
        newSelection.clear()
        for (let i = start; i <= end; i++) {
          newSelection.add(i)
        }
      } else {
        // Single selection
        newSelection.clear()
        newSelection.add(pageNum)
      }
      
      onSelectionChange?.(Array.from(newSelection))
      return newSelection
    })
  }, [onSelectionChange])

  const handleDeleteSelected = useCallback(() => {
    if (selectedPages.size === 0) return
    
    setThumbnails(prev => {
      const remaining = prev.filter(thumb => !selectedPages.has(thumb.pageNum))
      // Renumber pages
      const renumbered = remaining.map((thumb, index) => ({
        ...thumb,
        pageNum: index + 1
      }))
      
      onPagesChange?.(renumbered.map(t => t.pageNum))
      return renumbered
    })
    
    setSelectedPages(new Set())
  }, [selectedPages, onPagesChange])

  const handleDuplicateSelected = useCallback(() => {
    if (selectedPages.size === 0) return
    
    setThumbnails(prev => {
      const newThumbnails = [...prev]
      const selectedArray = Array.from(selectedPages).sort((a, b) => a - b)
      
      // Insert duplicates after their originals
      selectedArray.reverse().forEach(pageNum => {
        const originalIndex = newThumbnails.findIndex(t => t.pageNum === pageNum)
        if (originalIndex !== -1) {
          const duplicate = {
            ...newThumbnails[originalIndex],
            pageNum: newThumbnails.length + 1, // Temporary number
            canvas: newThumbnails[originalIndex].canvas.cloneNode(true) as HTMLCanvasElement
          }
          newThumbnails.splice(originalIndex + 1, 0, duplicate)
        }
      })
      
      // Renumber all pages
      const renumbered = newThumbnails.map((thumb, index) => ({
        ...thumb,
        pageNum: index + 1
      }))
      
      onPagesChange?.(renumbered.map(t => t.pageNum))
      return renumbered
    })
    
    setSelectedPages(new Set())
  }, [selectedPages, onPagesChange])

  const handleMovePages = useCallback((direction: 'up' | 'down') => {
    if (selectedPages.size === 0) return
    
    setThumbnails(prev => {
      const newThumbnails = [...prev]
      const selectedArray = Array.from(selectedPages).sort((a, b) => 
        direction === 'up' ? a - b : b - a
      )
      
      selectedArray.forEach(pageNum => {
        const currentIndex = newThumbnails.findIndex(t => t.pageNum === pageNum)
        if (currentIndex === -1) return
        
        const newIndex = direction === 'up' 
          ? Math.max(0, currentIndex - 1)
          : Math.min(newThumbnails.length - 1, currentIndex + 1)
        
        if (newIndex !== currentIndex) {
          const [moved] = newThumbnails.splice(currentIndex, 1)
          newThumbnails.splice(newIndex, 0, moved)
        }
      })
      
      // Renumber pages
      const renumbered = newThumbnails.map((thumb, index) => ({
        ...thumb,
        pageNum: index + 1
      }))
      
      onPagesChange?.(renumbered.map(t => t.pageNum))
      return renumbered
    })
  }, [selectedPages, onPagesChange])

  const handleDragStart = useCallback((pageNum: number, event: React.DragEvent) => {
    setDraggedPage(pageNum)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', pageNum.toString())
  }, [])

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback((targetPageNum: number, event: React.DragEvent) => {
    event.preventDefault()
    
    if (draggedPage === null || draggedPage === targetPageNum) {
      setDraggedPage(null)
      return
    }
    
    setThumbnails(prev => {
      const newThumbnails = [...prev]
      const draggedIndex = newThumbnails.findIndex(t => t.pageNum === draggedPage)
      const targetIndex = newThumbnails.findIndex(t => t.pageNum === targetPageNum)
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        const [draggedThumb] = newThumbnails.splice(draggedIndex, 1)
        newThumbnails.splice(targetIndex, 0, draggedThumb)
        
        // Renumber pages
        const renumbered = newThumbnails.map((thumb, index) => ({
          ...thumb,
          pageNum: index + 1
        }))
        
        onPagesChange?.(renumbered.map(t => t.pageNum))
        return renumbered
      }
      
      return prev
    })
    
    setDraggedPage(null)
  }, [draggedPage, onPagesChange])

  if (!file) {
    return (
      <div className={`flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900 ${className}`}>
        <div className="text-center">
          <div className="text-gray-400 text-lg mb-2">No PDF loaded</div>
          <div className="text-gray-500 text-sm">Upload a PDF file to organize its pages</div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <div className="text-gray-600 dark:text-gray-300">Loading page thumbnails...</div>
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
    <div className={`flex flex-col h-full bg-white dark:bg-gray-800 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {selectedPages.size > 0 ? `${selectedPages.size} page(s) selected` : `${thumbnails.length} pages`}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleMovePages('up')}
            disabled={selectedPages.size === 0}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Move up"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => handleMovePages('down')}
            disabled={selectedPages.size === 0}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Move down"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleDuplicateSelected}
            disabled={selectedPages.size === 0}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Duplicate"
          >
            <Copy className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleDeleteSelected}
            disabled={selectedPages.size === 0}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-red-600 dark:text-red-400"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Thumbnails Grid */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto p-4"
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {thumbnails.map((thumbnail) => (
            <div
              key={thumbnail.pageNum}
              className={`relative group cursor-pointer rounded-lg border-2 transition-all duration-200 ${
                selectedPages.has(thumbnail.pageNum)
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
              } ${draggedPage === thumbnail.pageNum ? 'opacity-50' : ''}`}
              onClick={(e) => handlePageClick(thumbnail.pageNum, e)}
              draggable
              onDragStart={(e) => handleDragStart(thumbnail.pageNum, e)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(thumbnail.pageNum, e)}
            >
              <div className="p-2">
                <div
                  ref={(el) => {
                    if (el && el.firstChild !== thumbnail.canvas) {
                      el.innerHTML = ''
                      el.appendChild(thumbnail.canvas)
                    }
                  }}
                  className="w-full h-auto"
                />
                <div className="text-center text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Page {thumbnail.pageNum}
                </div>
              </div>
              
              {/* Selection indicator */}
              {selectedPages.has(thumbnail.pageNum) && (
                <div className="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                  <div className="w-3 h-3 bg-white rounded-full"></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Click to select • Ctrl+Click for multiple • Shift+Click for range • Drag to reorder
        </div>
      </div>
    </div>
  )
}

export default PageOrganizer