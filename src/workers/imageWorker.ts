import { expose } from 'comlink'

export interface ImageWorkerAPI {
  resizeImage: (imageData: ImageData, width: number, height: number) => Promise<ImageData>
  convertToGrayscale: (imageData: ImageData) => Promise<ImageData>
  adjustBrightness: (imageData: ImageData, brightness: number) => Promise<ImageData>
  adjustContrast: (imageData: ImageData, contrast: number) => Promise<ImageData>
  cropImage: (imageData: ImageData, x: number, y: number, width: number, height: number) => Promise<ImageData>
  rotateImage: (imageData: ImageData, degrees: number) => Promise<ImageData>
  flipImage: (imageData: ImageData, horizontal: boolean, vertical: boolean) => Promise<ImageData>
  compressImage: (imageData: ImageData, quality: number, format: 'jpeg' | 'png' | 'webp') => Promise<Uint8Array>
  imageToDataURL: (imageData: ImageData, format: 'jpeg' | 'png' | 'webp', quality?: number) => Promise<string>
  fileToImageData: (file: File) => Promise<ImageData>
  urlToImageData: (url: string) => Promise<ImageData>
}

class ImageWorker implements ImageWorkerAPI {
  async resizeImage(imageData: ImageData, width: number, height: number): Promise<ImageData> {
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')!
    
    // Create temporary canvas for source image
    const sourceCanvas = new OffscreenCanvas(imageData.width, imageData.height)
    const sourceCtx = sourceCanvas.getContext('2d')!
    sourceCtx.putImageData(imageData, 0, 0)
    
    // Draw resized image
    ctx.drawImage(sourceCanvas, 0, 0, width, height)
    
    return ctx.getImageData(0, 0, width, height)
  }

  async convertToGrayscale(imageData: ImageData): Promise<ImageData> {
    const data = new Uint8ClampedArray(imageData.data)
    
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
      data[i] = gray     // R
      data[i + 1] = gray // G
      data[i + 2] = gray // B
      // Alpha channel (i + 3) stays the same
    }
    
    return new ImageData(data, imageData.width, imageData.height)
  }

  async adjustBrightness(imageData: ImageData, brightness: number): Promise<ImageData> {
    const data = new Uint8ClampedArray(imageData.data)
    const adjustment = brightness * 255
    
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, data[i] + adjustment))     // R
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + adjustment)) // G
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + adjustment)) // B
      // Alpha channel (i + 3) stays the same
    }
    
    return new ImageData(data, imageData.width, imageData.height)
  }

  async adjustContrast(imageData: ImageData, contrast: number): Promise<ImageData> {
    const data = new Uint8ClampedArray(imageData.data)
    const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255))
    
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, factor * (data[i] - 128) + 128))     // R
      data[i + 1] = Math.max(0, Math.min(255, factor * (data[i + 1] - 128) + 128)) // G
      data[i + 2] = Math.max(0, Math.min(255, factor * (data[i + 2] - 128) + 128)) // B
      // Alpha channel (i + 3) stays the same
    }
    
    return new ImageData(data, imageData.width, imageData.height)
  }

  async cropImage(imageData: ImageData, x: number, y: number, width: number, height: number): Promise<ImageData> {
    const canvas = new OffscreenCanvas(imageData.width, imageData.height)
    const ctx = canvas.getContext('2d')!
    ctx.putImageData(imageData, 0, 0)
    
    return ctx.getImageData(x, y, width, height)
  }

  async rotateImage(imageData: ImageData, degrees: number): Promise<ImageData> {
    const radians = (degrees * Math.PI) / 180
    const cos = Math.abs(Math.cos(radians))
    const sin = Math.abs(Math.sin(radians))
    
    const newWidth = Math.round(imageData.width * cos + imageData.height * sin)
    const newHeight = Math.round(imageData.width * sin + imageData.height * cos)
    
    const canvas = new OffscreenCanvas(newWidth, newHeight)
    const ctx = canvas.getContext('2d')!
    
    // Create source canvas
    const sourceCanvas = new OffscreenCanvas(imageData.width, imageData.height)
    const sourceCtx = sourceCanvas.getContext('2d')!
    sourceCtx.putImageData(imageData, 0, 0)
    
    // Move to center and rotate
    ctx.translate(newWidth / 2, newHeight / 2)
    ctx.rotate(radians)
    ctx.drawImage(sourceCanvas, -imageData.width / 2, -imageData.height / 2)
    
    return ctx.getImageData(0, 0, newWidth, newHeight)
  }

  async flipImage(imageData: ImageData, horizontal: boolean, vertical: boolean): Promise<ImageData> {
    const canvas = new OffscreenCanvas(imageData.width, imageData.height)
    const ctx = canvas.getContext('2d')!
    
    // Create source canvas
    const sourceCanvas = new OffscreenCanvas(imageData.width, imageData.height)
    const sourceCtx = sourceCanvas.getContext('2d')!
    sourceCtx.putImageData(imageData, 0, 0)
    
    ctx.scale(horizontal ? -1 : 1, vertical ? -1 : 1)
    ctx.drawImage(
      sourceCanvas, 
      horizontal ? -imageData.width : 0, 
      vertical ? -imageData.height : 0
    )
    
    return ctx.getImageData(0, 0, imageData.width, imageData.height)
  }

  async compressImage(imageData: ImageData, quality: number, format: 'jpeg' | 'png' | 'webp'): Promise<Uint8Array> {
    const canvas = new OffscreenCanvas(imageData.width, imageData.height)
    const ctx = canvas.getContext('2d')!
    ctx.putImageData(imageData, 0, 0)
    
    const blob = await canvas.convertToBlob({ 
      type: `image/${format}`, 
      quality: format === 'png' ? undefined : quality 
    })
    
    return new Uint8Array(await blob.arrayBuffer())
  }

  async imageToDataURL(imageData: ImageData, format: 'jpeg' | 'png' | 'webp', quality?: number): Promise<string> {
    const canvas = new OffscreenCanvas(imageData.width, imageData.height)
    const ctx = canvas.getContext('2d')!
    ctx.putImageData(imageData, 0, 0)
    
    const blob = await canvas.convertToBlob({ 
      type: `image/${format}`, 
      quality: quality && format !== 'png' ? quality : undefined 
    })
    
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
  }

  async fileToImageData(file: File): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = new OffscreenCanvas(img.width, img.height)
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        resolve(ctx.getImageData(0, 0, img.width, img.height))
      }
      img.onerror = reject
      img.src = URL.createObjectURL(file)
    })
  }

  async urlToImageData(url: string): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = new OffscreenCanvas(img.width, img.height)
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        resolve(ctx.getImageData(0, 0, img.width, img.height))
      }
      img.onerror = reject
      img.src = url
    })
  }
}

expose(new ImageWorker())