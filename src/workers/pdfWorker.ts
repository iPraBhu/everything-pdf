import { expose } from 'comlink'
import { PDFDocument, rgb, degrees } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.js', import.meta.url).href

export interface PDFWorkerAPI {
  getPageCount: (pdfData: Uint8Array) => Promise<number>
  renderPageAsImage: (pdfData: Uint8Array, pageIndex: number, options?: { scale?: number; format?: 'png' | 'jpeg' }) => Promise<ImageData>
  mergePDFs: (pdfDatas: Uint8Array[]) => Promise<Uint8Array>
  splitPDF: (pdfData: Uint8Array, splitPoints: number[]) => Promise<Uint8Array[]>
  extractPages: (pdfData: Uint8Array, pageIndices: number[]) => Promise<Uint8Array>
  rotatePages: (pdfData: Uint8Array, rotations: Array<{ pageIndex: number; degrees: number }>) => Promise<Uint8Array>
  addWatermark: (pdfData: Uint8Array, text: string, options: any) => Promise<Uint8Array>
  addPageNumbers: (pdfData: Uint8Array, options: any) => Promise<Uint8Array>
  addHeadersFooters: (pdfData: Uint8Array, options: any) => Promise<Uint8Array>
  cropPages: (pdfData: Uint8Array, cropBoxes: Array<{ pageIndex: number; x: number; y: number; width: number; height: number }>) => Promise<Uint8Array>
  nUpLayout: (pdfDatas: Uint8Array[], options: any) => Promise<Uint8Array>
  posterize: (pdfData: Uint8Array, options: any) => Promise<Uint8Array>
  interleavePages: (pdfDatas: Uint8Array[], options: any) => Promise<Uint8Array>
  compressPDF: (pdfData: Uint8Array, options: any) => Promise<Uint8Array>
  encryptPDF: (pdfData: Uint8Array, userPassword: string, ownerPassword?: string, permissions?: any) => Promise<Uint8Array>
  decryptPDF: (pdfData: Uint8Array, password: string) => Promise<Uint8Array>
  setMetadata: (pdfData: Uint8Array, metadata: any) => Promise<Uint8Array>
  flattenForms: (pdfData: Uint8Array) => Promise<Uint8Array>
  removeAnnotations: (pdfData: Uint8Array) => Promise<Uint8Array>
  sanitizePDF: (pdfData: Uint8Array, options: any) => Promise<Uint8Array>
}

class PDFWorker implements PDFWorkerAPI {
  async getPageCount(pdfData: Uint8Array): Promise<number> {
    try {
      const pdfDoc = await PDFDocument.load(pdfData)
      return pdfDoc.getPageCount()
    } catch (error) {
      console.error('Error getting page count:', error)
      throw new Error('Failed to get page count from PDF')
    }
  }

  async renderPageAsImage(pdfData: Uint8Array, pageIndex: number, options: { scale?: number; format?: 'png' | 'jpeg' } = {}): Promise<ImageData> {
    const { scale = 2.0 } = options
    
    try {
      // Load PDF with PDF.js for rendering
      const loadingTask = pdfjsLib.getDocument({ data: pdfData })
      const pdfDocument = await loadingTask.promise
      
      // Get the specific page
      const page = await pdfDocument.getPage(pageIndex + 1) // PDF.js uses 1-based indexing
      
      // Get page dimensions
      const viewport = page.getViewport({ scale })
      
      // Create canvas for rendering
      const canvas = new OffscreenCanvas(viewport.width, viewport.height)
      const context = canvas.getContext('2d')!
      
      // Render page to canvas
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      }
      
      await page.render(renderContext).promise
      
      // Get ImageData from canvas
      const imageData = context.getImageData(0, 0, viewport.width, viewport.height)
      
      // Clean up
      page.cleanup()
      pdfDocument.destroy()
      
      return imageData
      
    } catch (error) {
      console.error('Error rendering PDF page as image:', error)
      
      // Fallback: create a simple white canvas with error text
      const width = Math.floor(595 * scale) // A4 width in points * scale
      const height = Math.floor(842 * scale) // A4 height in points * scale
      
      const canvas = new OffscreenCanvas(width, height)
      const ctx = canvas.getContext('2d')!
      
      // Fill with white background
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, width, height)
      
      // Add error message
      ctx.fillStyle = 'black'
      ctx.font = `${Math.floor(16 * scale)}px Arial`
      ctx.fillText('Page rendering failed', 50, 50)
      ctx.fillText(`Page ${pageIndex + 1}`, 50, 80)
      
      return ctx.getImageData(0, 0, width, height)
    }
  }

  async mergePDFs(pdfDatas: Uint8Array[]): Promise<Uint8Array> {
    const mergedPdf = await PDFDocument.create()
    
    for (const pdfData of pdfDatas) {
      const sourcePdf = await PDFDocument.load(pdfData)
      const pageCount = sourcePdf.getPageCount()
      const pageIndices = Array.from({ length: pageCount }, (_, i) => i)
      
      const copiedPages = await mergedPdf.copyPages(sourcePdf, pageIndices)
      copiedPages.forEach(page => mergedPdf.addPage(page))
    }
    
    return await mergedPdf.save()
  }

  async splitPDF(pdfData: Uint8Array, splitPoints: number[]): Promise<Uint8Array[]> {
    const sourcePdf = await PDFDocument.load(pdfData)
    const totalPages = sourcePdf.getPageCount()
    const results: Uint8Array[] = []
    
    let currentStart = 0
    
    for (const splitPoint of [...splitPoints, totalPages].sort((a, b) => a - b)) {
      if (splitPoint <= currentStart || splitPoint > totalPages) continue
      
      const newPdf = await PDFDocument.create()
      const pageIndices = Array.from(
        { length: splitPoint - currentStart },
        (_, i) => currentStart + i
      )
      
      const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices)
      copiedPages.forEach(page => newPdf.addPage(page))
      
      results.push(await newPdf.save())
      currentStart = splitPoint
    }
    
    return results
  }

  async extractPages(pdfData: Uint8Array, pageIndices: number[]): Promise<Uint8Array> {
    const sourcePdf = await PDFDocument.load(pdfData)
    const newPdf = await PDFDocument.create()
    
    const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices)
    copiedPages.forEach(page => newPdf.addPage(page))
    
    return await newPdf.save()
  }

  async rotatePages(
    pdfData: Uint8Array, 
    rotations: Array<{ pageIndex: number; degrees: number }>
  ): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfData)
    
    for (const { pageIndex, degrees: rotationDegrees } of rotations) {
      const page = pdfDoc.getPage(pageIndex)
      page.setRotation(degrees(rotationDegrees))
    }
    
    return await pdfDoc.save()
  }

  async addWatermark(pdfData: Uint8Array, text: string, options: any = {}): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfData)
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
      
      page.drawText(text, {
        x,
        y,
        size: fontSize,
        color: rgb(color.r, color.g, color.b),
        opacity,
        rotate: degrees(rotation),
      })
    }
    
    return await pdfDoc.save()
  }

  async addPageNumbers(pdfData: Uint8Array, options: any = {}): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfData)
    const {
      pageIndices = Array.from({ length: pdfDoc.getPageCount() }, (_, i) => i),
      startNumber = 1,
      fontSize = 12,
      color = { r: 0, g: 0, b: 0 },
      position = 'bottom-center',
      format = '{page}' // Can be '{page}', '{page} of {total}', etc.
    } = options
    
    const totalPages = pdfDoc.getPageCount()
    
    for (let i = 0; i < pageIndices.length; i++) {
      const pageIndex = pageIndices[i]
      const page = pdfDoc.getPage(pageIndex)
      const { width, height } = page.getSize()
      
      const pageNumber = startNumber + i
      const text = format
        .replace('{page}', pageNumber.toString())
        .replace('{total}', totalPages.toString())
      
      let x: number, y: number
      
      switch (position) {
        case 'top-left':
          x = 50; y = height - 30
          break
        case 'top-center':
          x = width / 2; y = height - 30
          break
        case 'top-right':
          x = width - 50; y = height - 30
          break
        case 'bottom-left':
          x = 50; y = 30
          break
        case 'bottom-right':
          x = width - 50; y = 30
          break
        case 'bottom-center':
        default:
          x = width / 2; y = 30
          break
      }
      
      page.drawText(text, {
        x,
        y,
        size: fontSize,
        color: rgb(color.r, color.g, color.b),
      })
    }
    
    return await pdfDoc.save()
  }

  async addHeadersFooters(pdfData: Uint8Array, options: any = {}): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfData)
    const {
      pageIndices = Array.from({ length: pdfDoc.getPageCount() }, (_, i) => i),
      header = { left: '', center: '', right: '' },
      footer = { left: '', center: '', right: '' },
      fontSize = 10,
      color = { r: 0, g: 0, b: 0 },
      marginTop = 30,
      marginBottom = 30
    } = options
    
    for (const pageIndex of pageIndices) {
      const page = pdfDoc.getPage(pageIndex)
      const { width, height } = page.getSize()
      
      // Draw header
      if (header.left) {
        page.drawText(header.left, {
          x: 50,
          y: height - marginTop,
          size: fontSize,
          color: rgb(color.r, color.g, color.b),
        })
      }
      if (header.center) {
        page.drawText(header.center, {
          x: width / 2,
          y: height - marginTop,
          size: fontSize,
          color: rgb(color.r, color.g, color.b),
        })
      }
      if (header.right) {
        page.drawText(header.right, {
          x: width - 50,
          y: height - marginTop,
          size: fontSize,
          color: rgb(color.r, color.g, color.b),
        })
      }
      
      // Draw footer
      if (footer.left) {
        page.drawText(footer.left, {
          x: 50,
          y: marginBottom,
          size: fontSize,
          color: rgb(color.r, color.g, color.b),
        })
      }
      if (footer.center) {
        page.drawText(footer.center, {
          x: width / 2,
          y: marginBottom,
          size: fontSize,
          color: rgb(color.r, color.g, color.b),
        })
      }
      if (footer.right) {
        page.drawText(footer.right, {
          x: width - 50,
          y: marginBottom,
          size: fontSize,
          color: rgb(color.r, color.g, color.b),
        })
      }
    }
    
    return await pdfDoc.save()
  }

  async cropPages(
    pdfData: Uint8Array,
    cropBoxes: Array<{ pageIndex: number; x: number; y: number; width: number; height: number }>
  ): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfData)
    
    for (const { pageIndex, x, y, width, height } of cropBoxes) {
      const page = pdfDoc.getPage(pageIndex)
      page.setCropBox(x, y, width, height)
    }
    
    return await pdfDoc.save()
  }

  async nUpLayout(pdfDatas: Uint8Array[], options: any = {}): Promise<Uint8Array> {
    const {
      cols = 2,
      rows = 2,
      pageOrder = 'horizontal', // 'horizontal' | 'vertical'
      spacing = 10,
      margin = 20,
      orientation = 'auto', // 'auto' | 'portrait' | 'landscape'
      scaling = 'fit', // 'fit' | 'fill' | 'custom'
      customScale = 1.0,
      border = { width: 0, color: '#000000' },
      backgroundColor = '#ffffff',
      addPageNumbers = false,
      centerPages = true
    } = options
    
    const outputPdf = await PDFDocument.create()
    
    // Merge all input PDFs into one source PDF
    const mergedSourcePdf = await PDFDocument.create()
    for (const pdfData of pdfDatas) {
      const sourcePdf = await PDFDocument.load(pdfData)
      const pageCount = sourcePdf.getPageCount()
      const pageIndices = Array.from({ length: pageCount }, (_, i) => i)
      const copiedPages = await mergedSourcePdf.copyPages(sourcePdf, pageIndices)
      copiedPages.forEach(page => mergedSourcePdf.addPage(page))
    }
    
    const sourcePageCount = mergedSourcePdf.getPageCount()
    if (sourcePageCount === 0) {
      return await outputPdf.save()
    }
    
    // Get first page dimensions for auto-orientation
    const firstPage = mergedSourcePdf.getPage(0)
    const { width: sourceWidth, height: sourceHeight } = firstPage.getSize()
    
    // Determine page size and orientation
    let pageWidth: number, pageHeight: number
    if (orientation === 'auto') {
      // Auto-detect based on source page aspect ratio
      const sourceIsLandscape = sourceWidth > sourceHeight
      const layoutIsWide = cols > rows
      if (sourceIsLandscape === layoutIsWide) {
        pageWidth = 792; pageHeight = 612 // Letter landscape
      } else {
        pageWidth = 612; pageHeight = 792 // Letter portrait
      }
    } else if (orientation === 'landscape') {
      pageWidth = 792; pageHeight = 612
    } else {
      pageWidth = 612; pageHeight = 792
    }
    
    const pagesPerSheet = cols * rows
    const totalSheets = Math.ceil(sourcePageCount / pagesPerSheet)
    
    // Parse background color
    const bgColor = backgroundColor.startsWith('#') 
      ? {
          r: parseInt(backgroundColor.slice(1, 3), 16) / 255,
          g: parseInt(backgroundColor.slice(3, 5), 16) / 255,
          b: parseInt(backgroundColor.slice(5, 7), 16) / 255
        }
      : { r: 1, g: 1, b: 1 }
    
    // Parse border color
    const borderColor = border.color.startsWith('#')
      ? {
          r: parseInt(border.color.slice(1, 3), 16) / 255,
          g: parseInt(border.color.slice(3, 5), 16) / 255,
          b: parseInt(border.color.slice(5, 7), 16) / 255
        }
      : { r: 0, g: 0, b: 0 }
    
    for (let sheet = 0; sheet < totalSheets; sheet++) {
      const outputPage = outputPdf.addPage([pageWidth, pageHeight])
      
      // Fill background color
      if (backgroundColor !== '#ffffff') {
        outputPage.drawRectangle({
          x: 0,
          y: 0,
          width: pageWidth,
          height: pageHeight,
          color: rgb(bgColor.r, bgColor.g, bgColor.b)
        })
      }
      
      const cellWidth = (pageWidth - 2 * margin - (cols - 1) * spacing) / cols
      const cellHeight = (pageHeight - 2 * margin - (rows - 1) * spacing) / rows
      
      for (let pos = 0; pos < pagesPerSheet; pos++) {
        let sourcePageIndex: number
        
        // Calculate source page index based on page order
        if (pageOrder === 'vertical') {
          const col = Math.floor(pos / rows)
          const row = pos % rows
          sourcePageIndex = sheet * pagesPerSheet + col * rows + row
        } else {
          sourcePageIndex = sheet * pagesPerSheet + pos
        }
        
        if (sourcePageIndex >= sourcePageCount) break
        
        const sourcePage = mergedSourcePdf.getPage(sourcePageIndex)
        const [embeddedPage] = await outputPdf.embedPages([sourcePage])
        
        const col = pageOrder === 'vertical' ? Math.floor(pos / rows) : pos % cols
        const row = pageOrder === 'vertical' ? pos % rows : Math.floor(pos / cols)
        
        let x = margin + col * (cellWidth + spacing)
        let y = pageHeight - margin - (row + 1) * cellHeight - row * spacing
        
        // Calculate scaling
        const { width: originalWidth, height: originalHeight } = sourcePage.getSize()
        let scaleX = cellWidth / originalWidth
        let scaleY = cellHeight / originalHeight
        
        if (scaling === 'fit') {
          const scale = Math.min(scaleX, scaleY)
          scaleX = scaleY = scale
        } else if (scaling === 'custom') {
          scaleX = scaleY = customScale
        }
        // For 'fill', use different scales for X and Y (already set)
        
        const scaledWidth = originalWidth * scaleX
        const scaledHeight = originalHeight * scaleY
        
        // Center the page in the cell if requested
        if (centerPages) {
          x += (cellWidth - scaledWidth) / 2
          y += (cellHeight - scaledHeight) / 2
        }
        
        // Draw the embedded page
        outputPage.drawPage(embeddedPage, {
          x,
          y,
          width: scaledWidth,
          height: scaledHeight
        })
        
        // Draw border if specified
        if (border.width > 0) {
          outputPage.drawRectangle({
            x: margin + col * (cellWidth + spacing),
            y: pageHeight - margin - (row + 1) * cellHeight - row * spacing,
            width: cellWidth,
            height: cellHeight,
            borderColor: rgb(borderColor.r, borderColor.g, borderColor.b),
            borderWidth: border.width
          })
        }
        
        // Add page numbers if requested
        if (addPageNumbers) {
          const pageNumber = sourcePageIndex + 1
          const numberX = margin + col * (cellWidth + spacing) + cellWidth / 2
          const numberY = pageHeight - margin - (row + 1) * cellHeight - row * spacing - 15
          
          outputPage.drawText(pageNumber.toString(), {
            x: numberX,
            y: numberY,
            size: 8,
            color: rgb(0, 0, 0)
          })
        }
      }
    }
    
    return await outputPdf.save()
  }

  async posterize(pdfData: Uint8Array, options: any = {}): Promise<Uint8Array> {
    const {
      scaleMode = 'fit',
      customScale = 2.0,
      tileSize = { width: 595, height: 842 }, // A4 by default
      overlap = 20,
      margin = 20,
      addCutLines = true,
      cutLineStyle = 'dashed',
      cutLineColor = '#cccccc',
      addLabels = true,
      labelPosition = 'corner'
      // outputFormat - used for future enhancements
    } = options
    
    const sourcePdf = await PDFDocument.load(pdfData)
    const sourcePageCount = sourcePdf.getPageCount()
    
    if (sourcePageCount === 0) {
      return await sourcePdf.save()
    }
    
    const outputPdf = await PDFDocument.create()
    
    // Parse cut line color
    const cutColor = cutLineColor.startsWith('#')
      ? {
          r: parseInt(cutLineColor.slice(1, 3), 16) / 255,
          g: parseInt(cutLineColor.slice(3, 5), 16) / 255,
          b: parseInt(cutLineColor.slice(5, 7), 16) / 255
        }
      : { r: 0.8, g: 0.8, b: 0.8 }
    
    for (let pageIndex = 0; pageIndex < sourcePageCount; pageIndex++) {
      const sourcePage = sourcePdf.getPage(pageIndex)
      const { width: sourceWidth, height: sourceHeight } = sourcePage.getSize()
      
      // Calculate scale factor
      let scale: number
      if (scaleMode === 'custom') {
        scale = customScale
      } else {
        // Auto-fit: scale to fit at least 2x2 tiles
        scale = Math.max(2, Math.ceil(Math.max(sourceWidth / tileSize.width, sourceHeight / tileSize.height)))
      }
      
      const scaledWidth = sourceWidth * scale
      const scaledHeight = sourceHeight * scale
      
      // Calculate number of tiles needed
      const tilesX = Math.ceil((scaledWidth - overlap) / (tileSize.width - overlap))
      const tilesY = Math.ceil((scaledHeight - overlap) / (tileSize.height - overlap))
      
      // Create tiles
      for (let tileY = 0; tileY < tilesY; tileY++) {
        for (let tileX = 0; tileX < tilesX; tileX++) {
          const tilePage = outputPdf.addPage([tileSize.width, tileSize.height])
          
          // Calculate the source area for this tile
          const tileStartX = tileX * (tileSize.width - overlap)
          const tileStartY = tileY * (tileSize.height - overlap)
          
          // Calculate the portion of the scaled page to show
          const scaleX = scaledWidth / sourceWidth
          const scaleY = scaledHeight / sourceHeight
          
          // Position the source page to show the correct portion
          const offsetX = -tileStartX / scaleX + margin
          const offsetY = tileSize.height - tileStartY / scaleY - sourceHeight * scaleY + margin
          
          // Embed and draw the source page
          const [embeddedPage] = await outputPdf.embedPages([sourcePage])
          tilePage.drawPage(embeddedPage, {
            x: offsetX,
            y: offsetY,
            width: sourceWidth * scaleX,
            height: sourceHeight * scaleY
          })
          
          // Add cut lines if requested
          if (addCutLines) {
            const lineWidth = 1
            
            // Draw border cut lines
            tilePage.drawRectangle({
              x: margin,
              y: margin,
              width: tileSize.width - 2 * margin,
              height: tileSize.height - 2 * margin,
              borderColor: rgb(cutColor.r, cutColor.g, cutColor.b),
              borderWidth: lineWidth
            })
            
            // Draw overlap indicators if there's overlap
            if (overlap > 0 && (tileX > 0 || tileY > 0 || tileX < tilesX - 1 || tileY < tilesY - 1)) {
              // Left overlap
              if (tileX > 0) {
                tilePage.drawLine({
                  start: { x: margin + overlap, y: margin },
                  end: { x: margin + overlap, y: tileSize.height - margin },
                  color: rgb(cutColor.r, cutColor.g, cutColor.b),
                  thickness: lineWidth,
                  dashArray: cutLineStyle === 'dashed' ? [5, 5] : cutLineStyle === 'dotted' ? [2, 2] : undefined
                })
              }
              
              // Top overlap
              if (tileY > 0) {
                tilePage.drawLine({
                  start: { x: margin, y: tileSize.height - margin - overlap },
                  end: { x: tileSize.width - margin, y: tileSize.height - margin - overlap },
                  color: rgb(cutColor.r, cutColor.g, cutColor.b),
                  thickness: lineWidth,
                  dashArray: cutLineStyle === 'dashed' ? [5, 5] : cutLineStyle === 'dotted' ? [2, 2] : undefined
                })
              }
            }
          }
          
          // Add labels if requested
          if (addLabels) {
            const label = `${String.fromCharCode(65 + tileY)}${tileX + 1}` // A1, A2, B1, B2, etc.
            const fontSize = 12
            
            let labelX: number, labelY: number
            if (labelPosition === 'corner') {
              labelX = tileSize.width - margin - 30
              labelY = tileSize.height - margin - 15
            } else {
              labelX = tileSize.width - margin - 30
              labelY = margin + 5
            }
            
            // Draw label background
            tilePage.drawRectangle({
              x: labelX - 15,
              y: labelY - 8,
              width: 30,
              height: 16,
              color: rgb(1, 1, 1),
              borderColor: rgb(0, 0, 0),
              borderWidth: 1
            })
            
            tilePage.drawText(label, {
              x: labelX - 8,
              y: labelY,
              size: fontSize,
              color: rgb(0, 0, 0)
            })
          }
        }
      }
    }
    
    return await outputPdf.save()
  }

  async interleavePages(pdfDatas: Uint8Array[], options: any = {}): Promise<Uint8Array> {
    const { 
      mode = 'zip',
      customPattern = [1, 2, 1, 2],
      insertAfter = 1,
      skipBlankPages = false
      // preserveOrder - used for future enhancements
    } = options
    
    const outputPdf = await PDFDocument.create()
    const sourcePdfs = await Promise.all(pdfDatas.map(data => PDFDocument.load(data)))
    
    if (sourcePdfs.length === 0) {
      return await outputPdf.save()
    }
    
    // Collect all pages from source PDFs
    const allSourcePages: Array<{ pdfIndex: number; pageIndex: number; page: any }> = []
    
    for (let pdfIndex = 0; pdfIndex < sourcePdfs.length; pdfIndex++) {
      const pdf = sourcePdfs[pdfIndex]
      const pageCount = pdf.getPageCount()
      
      for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
        const page = pdf.getPage(pageIndex)
        
        // Skip blank pages if requested (simplified check)
        if (skipBlankPages) {
          // This is a simplified blank page detection
          // In a full implementation, you would analyze page content
          const { width, height } = page.getSize()
          if (width === 0 || height === 0) continue
        }
        
        allSourcePages.push({ pdfIndex, pageIndex, page })
      }
    }
    
    let pagesToAdd: Array<{ pdfIndex: number; pageIndex: number }> = []
    
    switch (mode) {
      case 'zip': {
        // Alternate pages from each document
        const maxPages = Math.max(...sourcePdfs.map(pdf => pdf.getPageCount()))
        for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
          for (let pdfIndex = 0; pdfIndex < sourcePdfs.length; pdfIndex++) {
            if (pageIndex < sourcePdfs[pdfIndex].getPageCount()) {
              pagesToAdd.push({ pdfIndex, pageIndex })
            }
          }
        }
        break
      }
      
      case 'alternate': {
        // Add all pages from first document, then all from second, etc.
        for (let pdfIndex = 0; pdfIndex < sourcePdfs.length; pdfIndex++) {
          const pageCount = sourcePdfs[pdfIndex].getPageCount()
          for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
            pagesToAdd.push({ pdfIndex, pageIndex })
          }
        }
        break
      }
      
      case 'burst': {
        // Insert pages from other documents at specific position in main document
        const mainPdf = sourcePdfs[0]
        const mainPageCount = mainPdf.getPageCount()
        
        // Add pages before insertion point
        for (let pageIndex = 0; pageIndex < Math.min(insertAfter, mainPageCount); pageIndex++) {
          pagesToAdd.push({ pdfIndex: 0, pageIndex })
        }
        
        // Insert pages from other documents
        for (let pdfIndex = 1; pdfIndex < sourcePdfs.length; pdfIndex++) {
          const pageCount = sourcePdfs[pdfIndex].getPageCount()
          for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
            pagesToAdd.push({ pdfIndex, pageIndex })
          }
        }
        
        // Add remaining pages from main document
        for (let pageIndex = insertAfter; pageIndex < mainPageCount; pageIndex++) {
          pagesToAdd.push({ pdfIndex: 0, pageIndex })
        }
        break
      }
      
      case 'custom': {
        // Follow custom pattern
        let patternIndex = 0
        const maxPagesPerDoc = sourcePdfs.map(pdf => pdf.getPageCount())
        const currentPageIndex = new Array(sourcePdfs.length).fill(0)
        
        while (patternIndex < customPattern.length && currentPageIndex.some((idx, docIdx) => idx < maxPagesPerDoc[docIdx])) {
          const docIndex = customPattern[patternIndex] - 1 // Convert to 0-based
          
          if (docIndex >= 0 && docIndex < sourcePdfs.length && currentPageIndex[docIndex] < maxPagesPerDoc[docIndex]) {
            pagesToAdd.push({ pdfIndex: docIndex, pageIndex: currentPageIndex[docIndex] })
            currentPageIndex[docIndex]++
          }
          
          patternIndex = (patternIndex + 1) % customPattern.length
          
          // Prevent infinite loop
          if (pagesToAdd.length > 10000) break
        }
        break
      }
    }
    
    // Copy and add pages to output PDF
    for (const { pdfIndex, pageIndex } of pagesToAdd) {
      try {
        const sourcePdf = sourcePdfs[pdfIndex]
        const [copiedPage] = await outputPdf.copyPages(sourcePdf, [pageIndex])
        outputPdf.addPage(copiedPage)
      } catch (error) {
        console.warn(`Error copying page ${pageIndex} from document ${pdfIndex}:`, error)
      }
    }
    
    return await outputPdf.save()
  }

  async compressPDF(pdfData: Uint8Array, _options: any = {}): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfData)
    
    // Basic compression by re-saving with optimization
    return await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false
    })
  }

  async encryptPDF(
    pdfData: Uint8Array,
    _userPassword: string,
    _ownerPassword?: string,
    _permissions?: any
  ): Promise<Uint8Array> {
    // Note: pdf-lib has limited encryption support
    // This is a placeholder for the basic implementation
    const pdfDoc = await PDFDocument.load(pdfData)
    return await pdfDoc.save()
  }

  async decryptPDF(pdfData: Uint8Array, _password: string): Promise<Uint8Array> {
    // Note: pdf-lib has limited decryption support
    // This is a placeholder for the basic implementation
    const pdfDoc = await PDFDocument.load(pdfData)
    return await pdfDoc.save()
  }

  async setMetadata(pdfData: Uint8Array, metadata: any): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfData)
    
    if (metadata.title) pdfDoc.setTitle(metadata.title)
    if (metadata.author) pdfDoc.setAuthor(metadata.author)
    if (metadata.subject) pdfDoc.setSubject(metadata.subject)
    if (metadata.keywords) pdfDoc.setKeywords([metadata.keywords])
    if (metadata.creator) pdfDoc.setCreator(metadata.creator)
    if (metadata.producer) pdfDoc.setProducer(metadata.producer)
    
    pdfDoc.setCreationDate(new Date())
    pdfDoc.setModificationDate(new Date())
    
    return await pdfDoc.save()
  }

  async flattenForms(pdfData: Uint8Array): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfData)
    const form = pdfDoc.getForm()
    
    // Flatten all form fields
    form.flatten()
    
    return await pdfDoc.save()
  }

  async removeAnnotations(pdfData: Uint8Array): Promise<Uint8Array> {
    // Note: pdf-lib has limited annotation support
    // This is a basic implementation
    const pdfDoc = await PDFDocument.load(pdfData)
    return await pdfDoc.save()
  }

  async sanitizePDF(pdfData: Uint8Array, options: any = {}): Promise<Uint8Array> {
    const {
      removeMetadata = true,
      removeJavaScript: _removeJavaScript = true,
      removeEmbeddedFiles: _removeEmbeddedFiles = true
    } = options
    
    const pdfDoc = await PDFDocument.load(pdfData)
    
    if (removeMetadata) {
      pdfDoc.setTitle('')
      pdfDoc.setAuthor('')
      pdfDoc.setSubject('')
      pdfDoc.setKeywords([])
      pdfDoc.setCreator('')
      pdfDoc.setProducer('')
    }
    
    // Note: pdf-lib has limited support for JavaScript and embedded file removal
    // These would need more advanced PDF manipulation
    
    return await pdfDoc.save()
  }
}

expose(new PDFWorker())