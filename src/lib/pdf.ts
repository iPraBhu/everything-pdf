import { PDFDocument, PDFPage, rgb, degrees } from 'pdf-lib'
import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'

// Configure pdf.js worker - use the bundled worker
if (typeof window !== 'undefined') {
  // Try to use the local worker file first
  pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.js`
} else {
  // For server-side rendering or Node.js environment
  try {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.mjs',
      import.meta.url
    ).toString()
  } catch (e) {
    console.warn('Failed to set PDF worker source:', e)
  }
}

/**
 * PDF processing utilities
 */

export interface PDFInfo {
  pageCount: number
  title?: string
  author?: string
  subject?: string
  keywords?: string
  creator?: string
  producer?: string
  creationDate?: Date
  modificationDate?: Date
  isEncrypted: boolean
  permissions?: {
    printing: boolean
    modifying: boolean
    copying: boolean
    annotating: boolean
    fillingForms: boolean
    contentAccessibility: boolean
    documentAssembly: boolean
  }
}

export interface PageInfo {
  width: number
  height: number
  rotation: number
  mediaBox: [number, number, number, number]
  cropBox?: [number, number, number, number]
  trimBox?: [number, number, number, number]
  bleedBox?: [number, number, number, number]
}

/**
 * Load PDF document using pdf.js
 */
export async function loadPDFDocument(data: Uint8Array): Promise<PDFDocumentProxy> {
  try {
    const loadingTask = pdfjs.getDocument({ data })
    return await loadingTask.promise
  } catch (error) {
    throw new Error(`Failed to load PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get PDF document info
 */
export async function getPDFInfo(doc: PDFDocumentProxy): Promise<PDFInfo> {
  try {
    const metadata = await doc.getMetadata()
    const permissions = await doc.getPermissions()
    
    return {
      pageCount: doc.numPages,
      title: (metadata.info as any)?.Title || undefined,
      author: (metadata.info as any)?.Author || undefined,
      subject: (metadata.info as any)?.Subject || undefined,
      keywords: (metadata.info as any)?.Keywords || undefined,
      creator: (metadata.info as any)?.Creator || undefined,
      producer: (metadata.info as any)?.Producer || undefined,
      creationDate: (metadata.info as any)?.CreationDate ? new Date((metadata.info as any).CreationDate) : undefined,
      modificationDate: (metadata.info as any)?.ModDate ? new Date((metadata.info as any).ModDate) : undefined,
      isEncrypted: (doc as any).isEncrypted,
      permissions: permissions ? {
        printing: !!(permissions[2] & 0x04), // bit 3
        modifying: !!(permissions[2] & 0x08), // bit 4
        copying: !!(permissions[2] & 0x10), // bit 5
        annotating: !!(permissions[2] & 0x20), // bit 6
        fillingForms: !!(permissions[2] & 0x100), // bit 9
        contentAccessibility: !!(permissions[2] & 0x200), // bit 10
        documentAssembly: !!(permissions[2] & 0x400), // bit 11
      } : undefined
    }
  } catch (error) {
    throw new Error(`Failed to get PDF info: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get page info
 */
export async function getPageInfo(doc: PDFDocumentProxy, pageNumber: number): Promise<PageInfo> {
  try {
    const page = await doc.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 1.0 })
    
    return {
      width: viewport.width,
      height: viewport.height,
      rotation: viewport.rotation,
      mediaBox: [0, 0, viewport.width, viewport.height],
      // Note: pdf.js doesn't provide easy access to crop/trim/bleed boxes
      // We'd need to parse the page dictionary directly for those
    }
  } catch (error) {
    throw new Error(`Failed to get page info: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Render page to canvas
 */
export async function renderPageToCanvas(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  scale: number = 1,
  rotation: number = 0
): Promise<void> {
  const viewport = page.getViewport({ scale, rotation })
  const context = canvas.getContext('2d')
  
  if (!context) {
    throw new Error('Cannot get 2D context from canvas')
  }
  
  canvas.width = viewport.width
  canvas.height = viewport.height
  
  const renderContext = {
    canvasContext: context,
    viewport: viewport,
  }
  
  try {
    await page.render(renderContext).promise
  } catch (error) {
    throw new Error(`Failed to render page: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Extract text from page
 */
export async function extractPageText(page: PDFPageProxy): Promise<string> {
  try {
    const textContent = await page.getTextContent()
    return textContent.items
      .filter((item): item is any => 'str' in item)
      .map(item => item.str)
      .join(' ')
  } catch (error) {
    throw new Error(`Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Search text in page
 */
export async function searchPageText(
  page: PDFPageProxy, 
  query: string
): Promise<Array<{ text: string; bbox: number[] }>> {
  try {
    const textContent = await page.getTextContent()
    const matches: Array<{ text: string; bbox: number[] }> = []
    const searchTerm = query.toLowerCase()
    
    for (const item of textContent.items) {
      if ('str' in item && item.str.toLowerCase().includes(searchTerm)) {
        matches.push({
          text: item.str,
          bbox: 'bbox' in item && (item as any).bbox ? (item as any).bbox as number[] : [0, 0, 0, 0]
        })
      }
    }
    
    return matches
  } catch (error) {
    throw new Error(`Failed to search text: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Create empty PDF document
 */
export async function createEmptyPDF(): Promise<PDFDocument> {
  return PDFDocument.create()
}

/**
 * Load PDF document using pdf-lib
 */
export async function loadPDFLib(data: Uint8Array): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(data)
  } catch (error) {
    throw new Error(`Failed to load PDF with pdf-lib: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Copy pages from one document to another
 */
export async function copyPages(
  sourcePdf: PDFDocument,
  targetPdf: PDFDocument,
  pageIndices: number[]
): Promise<PDFPage[]> {
  try {
    const copiedPages = await targetPdf.copyPages(sourcePdf, pageIndices)
    return copiedPages.map(page => targetPdf.addPage(page))
  } catch (error) {
    throw new Error(`Failed to copy pages: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Merge multiple PDFs
 */
export async function mergePDFs(pdfDatas: Uint8Array[]): Promise<Uint8Array> {
  try {
    const mergedPdf = await createEmptyPDF()
    
    for (const pdfData of pdfDatas) {
      const sourcePdf = await loadPDFLib(pdfData)
      const pageCount = sourcePdf.getPageCount()
      const pageIndices = Array.from({ length: pageCount }, (_, i) => i)
      
      await copyPages(sourcePdf, mergedPdf, pageIndices)
    }
    
    return await mergedPdf.save()
  } catch (error) {
    throw new Error(`Failed to merge PDFs: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Split PDF into separate documents
 */
export async function splitPDF(
  pdfData: Uint8Array,
  splitPoints: number[] // Page numbers where to split (1-indexed)
): Promise<Uint8Array[]> {
  try {
    const sourcePdf = await loadPDFLib(pdfData)
    const totalPages = sourcePdf.getPageCount()
    const results: Uint8Array[] = []
    
    let currentStart = 0
    
    for (const splitPoint of [...splitPoints, totalPages].sort((a, b) => a - b)) {
      if (splitPoint <= currentStart || splitPoint > totalPages) continue
      
      const newPdf = await createEmptyPDF()
      const pageIndices = Array.from(
        { length: splitPoint - currentStart },
        (_, i) => currentStart + i
      )
      
      await copyPages(sourcePdf, newPdf, pageIndices)
      results.push(await newPdf.save())
      
      currentStart = splitPoint
    }
    
    return results
  } catch (error) {
    throw new Error(`Failed to split PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Extract specific pages to new PDF
 */
export async function extractPages(
  pdfData: Uint8Array,
  pageIndices: number[] // 0-indexed
): Promise<Uint8Array> {
  try {
    const sourcePdf = await loadPDFLib(pdfData)
    const newPdf = await createEmptyPDF()
    
    await copyPages(sourcePdf, newPdf, pageIndices)
    
    return await newPdf.save()
  } catch (error) {
    throw new Error(`Failed to extract pages: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Rotate pages
 */
export async function rotatePages(
  pdfData: Uint8Array,
  rotations: Array<{ pageIndex: number; degrees: number }> // 0-indexed
): Promise<Uint8Array> {
  try {
    const pdfDoc = await loadPDFLib(pdfData)
    
    for (const { pageIndex, degrees: rotationDegrees } of rotations) {
      const page = pdfDoc.getPage(pageIndex)
      page.setRotation(degrees(rotationDegrees))
    }
    
    return await pdfDoc.save()
  } catch (error) {
    throw new Error(`Failed to rotate pages: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Add watermark to pages
 */
export async function addWatermark(
  pdfData: Uint8Array,
  watermarkText: string,
  options: {
    pageIndices?: number[] // 0-indexed, if not provided, applies to all pages
    fontSize?: number
    color?: { r: number; g: number; b: number }
    opacity?: number
    rotation?: number
    position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  } = {}
): Promise<Uint8Array> {
  try {
    const pdfDoc = await loadPDFLib(pdfData)
    const {
      pageIndices = Array.from({ length: pdfDoc.getPageCount() }, (_, i) => i),
      fontSize = 48,
      color = { r: 0.5, g: 0.5, b: 0.5 },
      opacity = 0.3,
      rotation = 0,
      position = 'center'
    } = options
    
    for (const pageIndex of pageIndices) {
      const page = pdfDoc.getPage(pageIndex)
      const { width, height } = page.getSize()
      
      let x: number, y: number
      
      switch (position) {
        case 'top-left':
          x = 50; y = height - 50
          break
        case 'top-right':
          x = width - 50; y = height - 50
          break
        case 'bottom-left':
          x = 50; y = 50
          break
        case 'bottom-right':
          x = width - 50; y = 50
          break
        case 'center':
        default:
          x = width / 2; y = height / 2
          break
      }
      
      page.drawText(watermarkText, {
        x,
        y,
        size: fontSize,
        color: rgb(color.r, color.g, color.b),
        opacity,
        rotate: degrees(rotation),
      })
    }
    
    return await pdfDoc.save()
  } catch (error) {
    throw new Error(`Failed to add watermark: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Compress PDF by reducing image quality
 */
export async function compressPDF(
  pdfData: Uint8Array,
  _options: {
    imageQuality?: number // 0-1, where 1 is highest quality
    grayscale?: boolean
  } = {}
): Promise<Uint8Array> {
  try {
    // Note: This is a basic implementation
    // For real compression, we'd need to parse and recompress images
    const pdfDoc = await loadPDFLib(pdfData)
    
    // For now, just re-save the document which may provide some compression
    return await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false
    })
  } catch (error) {
    throw new Error(`Failed to compress PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Set PDF metadata
 */
export async function setPDFMetadata(
  pdfData: Uint8Array,
  metadata: {
    title?: string
    author?: string
    subject?: string
    keywords?: string
    creator?: string
    producer?: string
  }
): Promise<Uint8Array> {
  try {
    const pdfDoc = await loadPDFLib(pdfData)
    
    if (metadata.title) pdfDoc.setTitle(metadata.title)
    if (metadata.author) pdfDoc.setAuthor(metadata.author)
    if (metadata.subject) pdfDoc.setSubject(metadata.subject)
    if (metadata.keywords) pdfDoc.setKeywords([metadata.keywords])
    if (metadata.creator) pdfDoc.setCreator(metadata.creator)
    if (metadata.producer) pdfDoc.setProducer(metadata.producer)
    
    pdfDoc.setCreationDate(new Date())
    pdfDoc.setModificationDate(new Date())
    
    return await pdfDoc.save()
  } catch (error) {
    throw new Error(`Failed to set metadata: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get page thumbnail as data URL
 */
export async function getPageThumbnail(
  page: PDFPageProxy,
  maxWidth: number = 150,
  maxHeight: number = 200
): Promise<string> {
  try {
    const viewport = page.getViewport({ scale: 1.0 })
    const scale = Math.min(maxWidth / viewport.width, maxHeight / viewport.height)
    
    const canvas = document.createElement('canvas')
    await renderPageToCanvas(page, canvas, scale)
    
    return canvas.toDataURL('image/png')
  } catch (error) {
    throw new Error(`Failed to generate thumbnail: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}