import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { buildPdfFromInputs, type ConvertToPdfInputFile, type ConvertToPdfOptions } from '../lib/convertToPdf'
import { extractPageText, getPDFInfo, loadPDFDocument, searchPageText } from '../lib/pdf'
import { workerManager } from '../lib/workerManager'

declare global {
  interface Window {
    runToolTests?: () => Promise<ToolTestSummary>
    __toolTestStatus?: {
      state: 'idle' | 'running' | 'done' | 'failed'
      summary?: ToolTestSummary
      error?: string
    }
  }
}

type ToolTestStatus = 'passed' | 'failed'

interface ToolTestResult {
  id: string
  name: string
  status: ToolTestStatus
  durationMs: number
  details: string
}

interface ToolTestSummary {
  total: number
  passed: number
  failed: number
  results: ToolTestResult[]
}

interface Fixtures {
  basePdf: Uint8Array
  mergePdfA: Uint8Array
  mergePdfB: Uint8Array
  formPdf: Uint8Array
  posterPdf: Uint8Array
  scannedPdf: Uint8Array
  colorPdf: Uint8Array
  pngFile: File
  textFile: File
}

const convertOptions: ConvertToPdfOptions = {
  pageSize: 'letter',
  customWidth: 8.5,
  customHeight: 11,
  orientation: 'portrait',
  margins: {
    top: 72,
    bottom: 72,
    left: 72,
    right: 72
  },
  imageSettings: {
    quality: 85,
    dpi: 144,
    compression: 'auto',
    resizeMode: 'fit'
  },
  textSettings: {
    fontFamily: 'Helvetica',
    fontSize: 14,
    lineHeight: 1.5,
    encoding: 'utf-8'
  },
  outputSettings: {
    title: 'Harness Output',
    author: 'Tool Harness',
    subject: 'Integration tests',
    keywords: 'pdf,tests',
    creator: 'Tool Harness'
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, ' ').trim().toUpperCase()
}

function blobFromCanvas(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to encode canvas content.'))
        return
      }

      resolve(blob)
    }, type, quality)
  })
}

async function createTextPdf(pageTexts: string[], size: [number, number] = [612, 792]) {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  pageTexts.forEach((text, index) => {
    const page = pdfDoc.addPage(size)
    page.drawText(`Fixture Page ${index + 1}`, {
      x: 50,
      y: size[1] - 70,
      size: 16,
      font
    })
    page.drawText(text, {
      x: 50,
      y: size[1] - 120,
      size: 22,
      font
    })
  })

  return pdfDoc.save()
}

async function createFormPdf() {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792])
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const form = pdfDoc.getForm()

  page.drawText('Form Fixture', { x: 50, y: 740, size: 18, font })
  page.drawText('Full Name', { x: 50, y: 700, size: 12, font })
  page.drawText('Agree Terms', { x: 50, y: 650, size: 12, font })

  const textField = form.createTextField('FullName')
  textField.addToPage(page, { x: 140, y: 690, width: 220, height: 24 })

  const checkbox = form.createCheckBox('AgreeTerms')
  checkbox.addToPage(page, { x: 140, y: 646, width: 16, height: 16 })

  return pdfDoc.save()
}

async function createPngFile(name: string, draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 800
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Failed to create 2D context.')
  }

  draw(ctx, canvas.width, canvas.height)

  const blob = await blobFromCanvas(canvas)
  const bytes = await blob.arrayBuffer()
  return new File([bytes], name, { type: 'image/png' })
}

async function createScannedPdf(text: string) {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([1200, 800])
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  page.drawRectangle({
    x: 0,
    y: 0,
    width: 1200,
    height: 800,
    color: rgb(1, 1, 1)
  })
  page.drawText(text, {
    x: 180,
    y: 360,
    size: 120,
    font,
    color: rgb(0.1, 0.1, 0.1)
  })

  return pdfDoc.save()
}

async function createColorPdf() {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([800, 600])
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  page.drawRectangle({
    x: 0,
    y: 0,
    width: 800,
    height: 600,
    color: rgb(1, 1, 1)
  })
  page.drawRectangle({
    x: 80,
    y: 300,
    width: 220,
    height: 180,
    color: rgb(1, 0, 0)
  })
  page.drawRectangle({
    x: 420,
    y: 260,
    width: 220,
    height: 180,
    color: rgb(0, 0, 1)
  })
  page.drawText('COLOR', {
    x: 250,
    y: 120,
    size: 96,
    font,
    color: rgb(0, 0.5, 0)
  })

  return pdfDoc.save()
}

async function createFixtures(): Promise<Fixtures> {
  const pngFile = await createPngFile('fixture-image.png', (ctx, width, height) => {
    ctx.fillStyle = '#f7f1e3'
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = '#d45d42'
    ctx.fillRect(100, 100, width - 200, height - 200)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 96px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('IMAGE FIXTURE', width / 2, height / 2)
  })

  return {
    basePdf: await createTextPdf([
      'ALPHA PAGE ONE',
      'BRAVO PAGE TWO',
      'CHARLIE PAGE THREE'
    ]),
    mergePdfA: await createTextPdf([
      'MERGE ALPHA ONE',
      'MERGE ALPHA TWO'
    ]),
    mergePdfB: await createTextPdf([
      'MERGE BRAVO ONE',
      'MERGE BRAVO TWO'
    ]),
    formPdf: await createFormPdf(),
    posterPdf: await createTextPdf(['POSTER SOURCE PAGE'], [1200, 1600]),
    scannedPdf: await createScannedPdf('OCR SAMPLE'),
    colorPdf: await createColorPdf(),
    pngFile,
    textFile: new File(
      ['This is a text conversion fixture.\nIt should become searchable text in the output PDF.'],
      'fixture.txt',
      { type: 'text/plain' }
    )
  }
}

async function extractAllPageText(pdfData: Uint8Array) {
  const doc = await loadPDFDocument(pdfData)
  const texts: string[] = []

  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber)
      texts.push(await extractPageText(page))
    }
  } finally {
    await doc.destroy()
  }

  return texts
}

async function findMatches(pdfData: Uint8Array, query: string) {
  const doc = await loadPDFDocument(pdfData)
  const matches: number[] = []

  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber)
      const pageMatches = await searchPageText(page, query)
      if (pageMatches.length > 0) {
        matches.push(pageNumber)
      }
    }
  } finally {
    await doc.destroy()
  }

  return matches
}

async function getImageDimensions(bytes: Uint8Array) {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const bitmap = await createImageBitmap(new Blob([buffer]))
  const dimensions = { width: bitmap.width, height: bitmap.height }
  bitmap.close()
  return dimensions
}

async function runTest(id: string, name: string, fn: () => Promise<string>): Promise<ToolTestResult> {
  const startedAt = performance.now()

  try {
    const details = await fn()
    return {
      id,
      name,
      status: 'passed',
      durationMs: Math.round(performance.now() - startedAt),
      details
    }
  } catch (error) {
    return {
      id,
      name,
      status: 'failed',
      durationMs: Math.round(performance.now() - startedAt),
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export async function runAllToolTests(): Promise<ToolTestSummary> {
  const fixtures = await createFixtures()
  const convertInputs: ConvertToPdfInputFile[] = [
    { id: 'text', file: fixtures.textFile, type: 'text', order: 0 },
    { id: 'image', file: fixtures.pngFile, type: 'image', order: 1 }
  ]

  const tests: Array<() => Promise<ToolTestResult>> = [
    () => runTest('view', 'View PDF', async () => {
      const doc = await loadPDFDocument(fixtures.basePdf)

      try {
        const info = await getPDFInfo(doc)
        const page = await doc.getPage(2)
        const matches = await searchPageText(page, 'BRAVO')

        assert(info.pageCount === 3, 'Expected the viewer fixture to contain 3 pages.')
        assert(matches.length > 0, 'Expected to find BRAVO on page 2.')
        return 'Loaded and searched a real 3-page PDF.'
      } finally {
        await doc.destroy()
      }
    }),
    () => runTest('merge', 'Merge PDFs', async () => {
      const result = await workerManager.submitJob({
        type: 'enhanced-merge',
        files: [fixtures.mergePdfA, fixtures.mergePdfB]
      })
      const texts = await extractAllPageText(result)

      assert(texts.length === 4, 'Expected merged output to contain 4 pages.')
      assert(normalizeText(texts[0]).includes('MERGE ALPHA ONE'), 'Merged page order was incorrect.')
      assert(normalizeText(texts[3]).includes('MERGE BRAVO TWO'), 'Merged output is missing the last source page.')
      return 'Merged two real PDFs into a 4-page output.'
    }),
    () => runTest('split', 'Split PDF', async () => {
      const outputs = await workerManager.splitPDF(fixtures.basePdf, [2])
      assert(outputs.length === 2, 'Expected split output to produce 2 files.')

      const firstTexts = await extractAllPageText(outputs[0])
      const secondTexts = await extractAllPageText(outputs[1])

      assert(firstTexts.length === 2, 'First split should contain 2 pages.')
      assert(secondTexts.length === 1, 'Second split should contain 1 page.')
      assert(normalizeText(secondTexts[0]).includes('CHARLIE PAGE THREE'), 'Split output lost the final page.')
      return 'Split a 3-page PDF at page 2.'
    }),
    () => runTest('smart-split', 'Smart Split', async () => {
      const result = await workerManager.submitJob({
        type: 'split',
        file: fixtures.basePdf,
        options: {
          splits: [
            { start: 1, end: 2 },
            { start: 3, end: 3 }
          ]
        }
      })

      assert(Array.isArray(result.files), 'Smart split did not return a files array.')
      assert(result.files.length === 2, 'Smart split should have created 2 files.')
      return 'Split by predicted ranges through the same job path used by the UI.'
    }),
    () => runTest('reorder', 'Reorder Pages', async () => {
      const result = await workerManager.extractPages(fixtures.basePdf, [2, 0, 1])
      const texts = await extractAllPageText(result)

      assert(normalizeText(texts[0]).includes('CHARLIE PAGE THREE'), 'Reorder did not move page 3 to the front.')
      assert(normalizeText(texts[2]).includes('BRAVO PAGE TWO'), 'Reorder did not preserve the requested order.')
      return 'Reordered pages to 3-1-2.'
    }),
    () => runTest('extract', 'Extract Pages', async () => {
      const result = await workerManager.extractPages(fixtures.basePdf, [0, 2])
      const texts = await extractAllPageText(result)

      assert(texts.length === 2, 'Extract output should contain 2 pages.')
      assert(normalizeText(texts[1]).includes('CHARLIE PAGE THREE'), 'Extracted output is missing page 3.')
      return 'Extracted pages 1 and 3 into a new PDF.'
    }),
    () => runTest('advanced-extract', 'Advanced Extract', async () => {
      const result = await workerManager.extractPages(fixtures.basePdf, [1, 2])
      const texts = await extractAllPageText(result)

      assert(texts.length === 2, 'Advanced extract output should contain 2 pages.')
      assert(normalizeText(texts[0]).includes('BRAVO PAGE TWO'), 'Advanced extract did not preserve page 2.')
      return 'Extracted a non-default page range using the shared extraction path.'
    }),
    () => runTest('rotate', 'Rotate Pages', async () => {
      const result = await workerManager.rotatePages(fixtures.basePdf, [{ pageIndex: 0, degrees: 90 }])
      const pdfDoc = await PDFDocument.load(result)

      assert(pdfDoc.getPage(0).getRotation().angle === 90, 'Expected page 1 rotation to be 90 degrees.')
      return 'Applied a 90 degree rotation to page 1.'
    }),
    () => runTest('crop', 'Crop Pages', async () => {
      const result = await workerManager.submitJob({
        type: 'crop',
        file: fixtures.basePdf,
        cropBoxes: [{ pageIndex: 0, x: 20, y: 20, width: 300, height: 400 }]
      })
      const pdfDoc = await PDFDocument.load(result)
      const cropBox = pdfDoc.getPage(0).getCropBox()

      assert(Math.round(cropBox.width) === 300, 'Crop width did not match the requested size.')
      assert(Math.round(cropBox.height) === 400, 'Crop height did not match the requested size.')
      return 'Set a custom crop box on page 1.'
    }),
    () => runTest('page-numbers', 'Page Numbers', async () => {
      const result = await workerManager.addPageNumbers(fixtures.basePdf, {
        format: 'PAGE {page} OF {total}',
        position: 'bottom-center'
      })
      const matches = await findMatches(result, 'PAGE 1 OF 3')

      assert(matches.includes(1), 'Page numbering text was not searchable on page 1.')
      return 'Added searchable page-number text to the output PDF.'
    }),
    () => runTest('headers-footers', 'Headers & Footers', async () => {
      const result = await workerManager.submitJob({
        type: 'headers-footers',
        file: fixtures.basePdf,
        options: {
          header: { left: 'HEADER TEXT', center: '', right: '' },
          footer: { left: '', center: '', right: 'FOOTER TEXT' }
        }
      })
      const headerMatches = await findMatches(result, 'HEADER TEXT')
      const footerMatches = await findMatches(result, 'FOOTER TEXT')

      assert(headerMatches.length > 0, 'Header text was not found in the result PDF.')
      assert(footerMatches.length > 0, 'Footer text was not found in the result PDF.')
      return 'Stamped searchable header and footer text.'
    }),
    () => runTest('watermark', 'Watermark', async () => {
      const result = await workerManager.addWatermark(fixtures.basePdf, 'CONFIDENTIAL', {
        pageIndices: [0, 1, 2],
        rotation: 45
      })
      const matches = await findMatches(result, 'CONFIDENTIAL')

      assert(matches.length > 0, 'Watermark text was not searchable in the output PDF.')
      return 'Applied a text watermark across all pages.'
    }),
    () => runTest('nup', 'N-Up Layout', async () => {
      const result = await workerManager.nUpLayout([fixtures.basePdf], {
        cols: 2,
        rows: 2,
        spacing: 10,
        margin: 20
      })
      const pdfDoc = await PDFDocument.load(result)

      assert(pdfDoc.getPageCount() === 1, 'A 2x2 N-up layout should fit the 3 input pages onto 1 sheet.')
      return 'Composed 3 source pages onto a single N-up sheet.'
    }),
    () => runTest('interleave', 'Interleave', async () => {
      const result = await workerManager.interleavePages([fixtures.mergePdfA, fixtures.mergePdfB], { mode: 'zip' })
      const texts = await extractAllPageText(result)

      assert(normalizeText(texts[0]).includes('MERGE ALPHA ONE'), 'Interleave page 1 is incorrect.')
      assert(normalizeText(texts[1]).includes('MERGE BRAVO ONE'), 'Interleave page 2 is incorrect.')
      assert(normalizeText(texts[2]).includes('MERGE ALPHA TWO'), 'Interleave page 3 is incorrect.')
      return 'Alternated pages between two PDFs in zip mode.'
    }),
    () => runTest('posterize', 'Posterize', async () => {
      const result = await workerManager.posterize(fixtures.posterPdf, {
        scaleMode: 'custom',
        customScale: 2,
        tileSize: { width: 595, height: 842 },
        overlap: 20,
        margin: 20,
        addCutLines: true,
        addLabels: true
      })
      const pdfDoc = await PDFDocument.load(result)

      assert(pdfDoc.getPageCount() > 1, 'Posterize should have produced multiple output tiles.')
      return 'Split a large-format source page into poster tiles.'
    }),
    () => runTest('convert-to-pdf', 'Convert to PDF', async () => {
      const result = await buildPdfFromInputs(convertInputs, convertOptions)
      const pdfDoc = await PDFDocument.load(result)

      assert(pdfDoc.getPageCount() === 2, 'Convert to PDF should have created one page per input file.')
      assert(pdfDoc.getTitle() === 'Harness Output', 'Converted PDF metadata title was not applied.')
      return 'Built a PDF from a text file and a PNG image.'
    }),
    () => runTest('convert-from-pdf', 'Convert from PDF', async () => {
      const result = await workerManager.convertPDFPageToImage(fixtures.basePdf, 0, 'png')
      const image = await getImageDimensions(result)

      assert(image.width > 0 && image.height > 0, 'Converted page image dimensions were invalid.')
      return `Rendered page 1 to PNG (${image.width}x${image.height}).`
    }),
    () => runTest('grayscale', 'Grayscale', async () => {
      const result = await workerManager.submitJob({
        type: 'grayscale',
        file: fixtures.colorPdf
      })
      const imageData = await workerManager.renderPageAsImage(result, 0, { scale: 1 })
      const sampleOffset = ((100 * imageData.width) + 100) * 4
      const r = imageData.data[sampleOffset]
      const g = imageData.data[sampleOffset + 1]
      const b = imageData.data[sampleOffset + 2]

      assert(r === g && g === b, 'Expected the sampled output pixel to be grayscale.')
      return 'Converted a color PDF page into grayscale image content.'
    }),
    () => runTest('fill-forms', 'Fill Forms', async () => {
      const fields = await workerManager.detectFormFields(fixtures.formPdf)
      assert(fields.some((field) => field.name === 'FullName'), 'Text form field was not detected.')
      assert(fields.some((field) => field.name === 'AgreeTerms'), 'Checkbox field was not detected.')

      const result = await workerManager.fillForms(fixtures.formPdf, {
        FullName: 'Alice Example',
        AgreeTerms: true
      })
      const pdfDoc = await PDFDocument.load(result)
      const form = pdfDoc.getForm()

      assert(form.getTextField('FullName').getText() === 'Alice Example', 'Text field value was not saved.')
      assert(form.getCheckBox('AgreeTerms').isChecked(), 'Checkbox value was not saved.')
      return 'Detected and filled text and checkbox form fields.'
    }),
    () => runTest('metadata', 'Metadata', async () => {
      const result = await workerManager.submitJob({
        type: 'metadata',
        file: fixtures.basePdf,
        options: {
          metadata: {
            title: 'Updated Metadata Title',
            author: 'Tool Harness'
          }
        }
      })
      const pdfDoc = await PDFDocument.load(result)

      assert(pdfDoc.getTitle() === 'Updated Metadata Title', 'Metadata title update did not persist.')
      return 'Updated document metadata through the same job route used by the editor.'
    }),
    () => runTest('compress', 'Compress PDF', async () => {
      const result = await workerManager.submitJob({
        type: 'compress',
        files: [fixtures.basePdf],
        options: {
          config: {
            quality: { overall: 0.8 },
            imageProcessing: { downsampleImages: false }
          }
        }
      })

      assert(Array.isArray(result), 'Compression job should return an array for multi-file input.')
      assert(result.length === 1, 'Compression job should have returned one output file.')
      const pdfDoc = await PDFDocument.load(result[0])
      assert(pdfDoc.getPageCount() === 3, 'Compressed PDF lost pages.')
      return 'Compressed a PDF through the batch-oriented component job path.'
    }),
    () => runTest('ocr', 'OCR Text Recognition', async () => {
      const imageData = await workerManager.renderPageAsImage(fixtures.scannedPdf, 0, { scale: 2 })
      const ocrResult = await workerManager.performOCR(imageData, { language: 'eng' })
      const text = normalizeText(ocrResult.text)

      assert(text.includes('OCR') || text.includes('SAMPLE'), 'OCR output did not contain the expected words.')
      return `OCR extracted "${ocrResult.text.trim()}".`
    }),
    () => runTest('searchable-pdf', 'Searchable PDF', async () => {
      const result = await workerManager.createSearchablePDF(fixtures.scannedPdf, {
        ocrLanguage: ['eng']
      })
      const matches = await findMatches(result, 'OCR')

      assert(matches.length > 0, 'Searchable PDF output did not expose OCR text to search.')
      return 'Added an invisible searchable text layer to a scanned PDF.'
    }),
    () => runTest('text-extraction', 'Text Extraction', async () => {
      const imageData = await workerManager.renderPageAsImage(fixtures.scannedPdf, 0, { scale: 2 })
      const ocrResult = await workerManager.performOCR(imageData, { language: 'eng' })
      const cleaned = ocrResult.text.trim().replace(/\s+/g, ' ')
      const wordCount = cleaned.length > 0 ? cleaned.split(' ').length : 0

      assert(wordCount > 0, 'Text extraction did not return any words.')
      assert(normalizeText(cleaned).includes('OCR') || normalizeText(cleaned).includes('SAMPLE'), 'Extracted text did not contain the expected content.')
      return `Extracted ${wordCount} words from a scanned PDF page.`
    })
  ]

  const results: ToolTestResult[] = []

  for (const test of tests) {
    results.push(await test())
  }
  await workerManager.terminateAll()

  return {
    total: results.length,
    passed: results.filter((result) => result.status === 'passed').length,
    failed: results.filter((result) => result.status === 'failed').length,
    results
  }
}

export function attachToolTestHarness() {
  window.runToolTests = runAllToolTests

  if (!window.__toolTestStatus || window.__toolTestStatus.state === 'idle') {
    window.__toolTestStatus = { state: 'running' }

    void runAllToolTests()
      .then((summary) => {
        window.__toolTestStatus = {
          state: 'done',
          summary
        }
      })
      .catch((error) => {
        window.__toolTestStatus = {
          state: 'failed',
          error: error instanceof Error ? error.message : 'Unknown tool harness error'
        }
      })
  }
}

if (typeof window !== 'undefined') {
  attachToolTestHarness()
}
