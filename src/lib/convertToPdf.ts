import mammoth from 'mammoth'
import { PDFDocument, StandardFonts } from 'pdf-lib'

export interface ConvertToPdfOptions {
  pageSize: 'letter' | 'a4' | 'legal' | 'custom'
  customWidth: number
  customHeight: number
  orientation: 'portrait' | 'landscape' | 'auto'
  margins: {
    top: number
    bottom: number
    left: number
    right: number
  }
  imageSettings: {
    quality: number
    dpi: number
    compression: 'auto' | 'maximum' | 'high' | 'medium' | 'low'
    resizeMode: 'fit' | 'fill' | 'stretch' | 'original'
  }
  textSettings: {
    fontFamily: string
    fontSize: number
    lineHeight: number
    encoding: 'auto' | 'utf-8' | 'latin-1'
  }
  outputSettings: {
    title: string
    author: string
    subject: string
    keywords: string
    creator: string
  }
}

export interface ConvertToPdfInputFile {
  id: string
  file: File
  type: 'image' | 'text' | 'document'
  preview?: string
  pages?: number
  order: number
}

const pageSizes = {
  letter: { width: 8.5, height: 11 },
  a4: { width: 8.27, height: 11.69 },
  legal: { width: 8.5, height: 14 },
  custom: { width: 8.5, height: 11 }
}

export function calculateEstimatedPdfPages(inputFiles: ConvertToPdfInputFile[]): number {
  let totalPages = 0

  inputFiles.forEach((inputFile) => {
    switch (inputFile.type) {
      case 'image':
        totalPages += 1
        break
      case 'text':
        totalPages += Math.max(1, Math.ceil((inputFile.file.size / 1024) / 2))
        break
      case 'document':
        totalPages += inputFile.pages || 1
        break
    }
  })

  return totalPages
}

function getBasePageSizePoints(options: ConvertToPdfOptions) {
  const pageSize = options.pageSize === 'custom'
    ? { width: options.customWidth, height: options.customHeight }
    : pageSizes[options.pageSize]

  let width = pageSize.width * 72
  let height = pageSize.height * 72

  if (options.orientation === 'landscape') {
    ;[width, height] = [height, width]
  }

  return { width, height }
}

async function getFontForText(pdfDoc: PDFDocument, options: ConvertToPdfOptions) {
  const family = options.textSettings.fontFamily.toLowerCase()

  if (family.includes('courier')) {
    return pdfDoc.embedFont(StandardFonts.Courier)
  }

  if (family.includes('times') || family.includes('georgia')) {
    return pdfDoc.embedFont(StandardFonts.TimesRoman)
  }

  return pdfDoc.embedFont(StandardFonts.Helvetica)
}

function readImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()

    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`Unsupported image format: ${file.name}`))
    }

    img.src = url
  })
}

async function imageFileToPngBytes(file: File): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const img = await readImageElement(file)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Unable to create a canvas for image conversion.')
  }

  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  ctx.drawImage(img, 0, 0)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(new Error(`Failed to encode image: ${file.name}`))
        return
      }

      resolve(result)
    }, 'image/png')
  })

  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    width: img.naturalWidth,
    height: img.naturalHeight
  }
}

async function extractPlainText(inputFile: ConvertToPdfInputFile): Promise<string> {
  if (inputFile.type === 'document') {
    const result = await mammoth.extractRawText({ arrayBuffer: await inputFile.file.arrayBuffer() })
    return result.value
  }

  const rawText = await inputFile.file.text()

  if (inputFile.file.type === 'text/html') {
    const parsed = new DOMParser().parseFromString(rawText, 'text/html')
    return parsed.body.textContent || ''
  }

  return rawText
}

function splitTextIntoLines(text: string, maxWidth: number, font: any, fontSize: number) {
  const normalizedText = text.replace(/\r\n/g, '\n')
  const paragraphs = normalizedText.split('\n')
  const lines: string[] = []

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean)

    if (words.length === 0) {
      lines.push('')
      continue
    }

    let currentLine = ''

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word
      const candidateWidth = font.widthOfTextAtSize(candidate, fontSize)

      if (candidateWidth <= maxWidth || !currentLine) {
        currentLine = candidate
      } else {
        lines.push(currentLine)
        currentLine = word
      }
    }

    if (currentLine) {
      lines.push(currentLine)
    }
  }

  return lines
}

async function addTextDocument(
  pdfDoc: PDFDocument,
  inputFile: ConvertToPdfInputFile,
  options: ConvertToPdfOptions
) {
  const { width, height } = getBasePageSizePoints(options)
  const font = await getFontForText(pdfDoc, options)
  const text = await extractPlainText(inputFile)
  const lines = splitTextIntoLines(
    text,
    width - options.margins.left - options.margins.right,
    font,
    options.textSettings.fontSize
  )
  const lineHeight = options.textSettings.fontSize * options.textSettings.lineHeight
  let page = pdfDoc.addPage([width, height])
  let cursorY = height - options.margins.top

  for (const line of lines) {
    if (cursorY - lineHeight < options.margins.bottom) {
      page = pdfDoc.addPage([width, height])
      cursorY = height - options.margins.top
    }

    page.drawText(line, {
      x: options.margins.left,
      y: cursorY - options.textSettings.fontSize,
      size: options.textSettings.fontSize,
      font
    })

    cursorY -= lineHeight
  }
}

async function addImageDocument(
  pdfDoc: PDFDocument,
  inputFile: ConvertToPdfInputFile,
  options: ConvertToPdfOptions
) {
  const image = await imageFileToPngBytes(inputFile.file)
  let { width, height } = getBasePageSizePoints(options)

  if (options.orientation === 'auto' && image.width > image.height) {
    ;[width, height] = [height, width]
  }

  const page = pdfDoc.addPage([width, height])
  const embeddedImage = await pdfDoc.embedPng(image.bytes)
  const usableWidth = width - options.margins.left - options.margins.right
  const usableHeight = height - options.margins.top - options.margins.bottom
  const imageWidthInPoints = image.width * 72 / options.imageSettings.dpi
  const imageHeightInPoints = image.height * 72 / options.imageSettings.dpi

  let drawWidth = imageWidthInPoints
  let drawHeight = imageHeightInPoints

  switch (options.imageSettings.resizeMode) {
    case 'fill': {
      const scale = Math.max(usableWidth / imageWidthInPoints, usableHeight / imageHeightInPoints)
      drawWidth = imageWidthInPoints * scale
      drawHeight = imageHeightInPoints * scale
      break
    }
    case 'stretch':
      drawWidth = usableWidth
      drawHeight = usableHeight
      break
    case 'original':
      drawWidth = Math.min(imageWidthInPoints, usableWidth)
      drawHeight = Math.min(imageHeightInPoints, usableHeight)
      break
    case 'fit':
    default: {
      const scale = Math.min(usableWidth / imageWidthInPoints, usableHeight / imageHeightInPoints)
      drawWidth = imageWidthInPoints * scale
      drawHeight = imageHeightInPoints * scale
      break
    }
  }

  page.drawImage(embeddedImage, {
    x: options.margins.left + (usableWidth - drawWidth) / 2,
    y: options.margins.bottom + (usableHeight - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight
  })
}

export async function buildPdfFromInputs(
  inputFiles: ConvertToPdfInputFile[],
  options: ConvertToPdfOptions
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const orderedFiles = [...inputFiles].sort((a, b) => a.order - b.order)

  for (const inputFile of orderedFiles) {
    if (inputFile.type === 'image') {
      await addImageDocument(pdfDoc, inputFile, options)
    } else {
      await addTextDocument(pdfDoc, inputFile, options)
    }
  }

  if (options.outputSettings.title) pdfDoc.setTitle(options.outputSettings.title)
  if (options.outputSettings.author) pdfDoc.setAuthor(options.outputSettings.author)
  if (options.outputSettings.subject) pdfDoc.setSubject(options.outputSettings.subject)
  if (options.outputSettings.keywords) {
    pdfDoc.setKeywords(options.outputSettings.keywords.split(',').map((keyword) => keyword.trim()).filter(Boolean))
  }
  if (options.outputSettings.creator) pdfDoc.setCreator(options.outputSettings.creator)

  return pdfDoc.save()
}
