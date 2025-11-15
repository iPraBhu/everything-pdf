import { expose } from 'comlink'
import { createWorker, PSM, OEM } from 'tesseract.js'

export interface OCRWorkerAPI {
  performOCR: (imageData: ImageData, options: OCROptions) => Promise<OCRResult>
  setLanguage: (language: string) => Promise<void>
  terminate: () => Promise<void>
}

export interface OCROptions {
  language?: string
  pageSegMode?: PSM
  ocrEngineMode?: OEM
}

export interface OCRResult {
  text: string
  confidence: number
  words: Array<{
    text: string
    confidence: number
    bbox: { x0: number; y0: number; x1: number; y1: number }
  }>
  lines: Array<{
    text: string
    confidence: number
    bbox: { x0: number; y0: number; x1: number; y1: number }
    words: Array<{
      text: string
      confidence: number
      bbox: { x0: number; y0: number; x1: number; y1: number }
    }>
  }>
  paragraphs: Array<{
    text: string
    confidence: number
    bbox: { x0: number; y0: number; x1: number; y1: number }
  }>
}

class OCRWorker implements OCRWorkerAPI {
  private worker: any = null
  private currentLanguage = 'eng'

  async initializeWorker(): Promise<void> {
    if (this.worker) return

    try {
      console.log('Initializing Tesseract.js worker...')
      
      // Use default Tesseract.js configuration to avoid CDN issues
      this.worker = await createWorker(this.currentLanguage, OEM.LSTM_ONLY, {
        logger: (m: any) => {
          console.log('Tesseract worker:', m.status, m.progress ? `${Math.round(m.progress * 100)}%` : '')
        }
      })
      
      console.log('Tesseract.js worker initialized successfully')
    } catch (error) {
      console.error('Failed to initialize Tesseract.js worker:', error)
      throw new Error(`OCR worker initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async performOCR(imageData: ImageData, options: OCROptions = {}): Promise<OCRResult> {
    try {
      await this.initializeWorker()

      const {
        language = 'eng',
        pageSegMode = PSM.SINGLE_BLOCK,
        ocrEngineMode = OEM.LSTM_ONLY
      } = options

      console.log(`Performing OCR with language: ${language}, PSM: ${pageSegMode}`)

      // Set language if different
      if (language !== this.currentLanguage) {
        await this.setLanguage(language)
      }

      // Set page segmentation mode
      await this.worker.setParameters({
        tessedit_pageseg_mode: pageSegMode,
        tessedit_ocr_engine_mode: ocrEngineMode,
      })

      // Convert ImageData to Canvas for Tesseract
      const canvas = new OffscreenCanvas(imageData.width, imageData.height)
      const ctx = canvas.getContext('2d')!
      ctx.putImageData(imageData, 0, 0)

      // Perform OCR with simplified logger
      const { data } = await this.worker.recognize(canvas, {
        logger: (m: any) => {
          if (m.status) {
            console.log(`Tesseract: ${m.status} - ${m.progress ? Math.round(m.progress * 100) + '%' : ''}`)
          }
        }
      })

      console.log('OCR completed successfully, text length:', data.text.length)

      return {
        text: data.text,
        confidence: data.confidence,
        words: data.words.map((word: any) => ({
          text: word.text,
          confidence: word.confidence,
          bbox: word.bbox
        })),
        lines: data.lines.map((line: any) => ({
          text: line.text,
          confidence: line.confidence,
          bbox: line.bbox,
          words: line.words.map((word: any) => ({
            text: word.text,
            confidence: word.confidence,
            bbox: word.bbox
          }))
        })),
        paragraphs: data.paragraphs.map((paragraph: any) => ({
          text: paragraph.text,
          confidence: paragraph.confidence,
          bbox: paragraph.bbox
        }))
      }
    } catch (error) {
      console.error('OCR processing failed:', error)
      
      // Return an error result instead of throwing
      return {
        text: `OCR Error: ${error instanceof Error ? error.message : 'Unknown error during OCR processing'}`,
        confidence: 0,
        words: [],
        lines: [],
        paragraphs: []
      }
    }
  }

  async setLanguage(language: string): Promise<void> {
    if (this.currentLanguage === language) return

    if (this.worker) {
      await this.worker.terminate()
      this.worker = null
    }

    this.currentLanguage = language
    await this.initializeWorker()
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate()
      this.worker = null
    }
  }
}

expose(new OCRWorker())