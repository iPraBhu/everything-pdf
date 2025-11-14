/**
 * File handling utilities
 */

export interface FileInfo {
  name: string
  size: number
  type: string
  lastModified: number
}

/**
 * Convert File to Uint8Array
 */
export function fileToUint8Array(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result))
      } else {
        reject(new Error('Failed to read file as ArrayBuffer'))
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Download data as file
 */
export function downloadFile(data: Uint8Array, filename: string, mimeType: string = 'application/octet-stream'): void {
  const blob = new Blob([data as BlobPart], { type: mimeType })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  // Clean up
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

/**
 * Download text as file
 */
export function downloadTextFile(text: string, filename: string, mimeType: string = 'text/plain'): void {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  downloadFile(data, filename, mimeType)
}

/**
 * Download JSON as file
 */
export function downloadJsonFile(obj: unknown, filename: string): void {
  const json = JSON.stringify(obj, null, 2)
  downloadTextFile(json, filename, 'application/json')
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Get file extension
 */
export function getFileExtension(filename: string): string {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2).toLowerCase()
}

/**
 * Change file extension
 */
export function changeFileExtension(filename: string, newExtension: string): string {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
  return `${nameWithoutExt}.${newExtension.replace(/^\./, '')}`
}

/**
 * Generate unique filename
 */
export function generateUniqueFilename(baseName: string, existingNames: string[]): string {
  const extension = getFileExtension(baseName)
  const nameWithoutExt = baseName.replace(/\.[^/.]+$/, '')
  
  let counter = 1
  let newName = baseName
  
  while (existingNames.includes(newName)) {
    newName = extension 
      ? `${nameWithoutExt} (${counter}).${extension}`
      : `${nameWithoutExt} (${counter})`
    counter++
  }
  
  return newName
}

/**
 * Validate file type
 */
export function isValidPDFFile(file: File): boolean {
  return file.type === 'application/pdf' || getFileExtension(file.name) === 'pdf'
}

/**
 * Validate image file type
 */
export function isValidImageFile(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff', 'image/svg+xml']
  const validExtensions = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff', 'tif', 'svg']
  
  return validTypes.includes(file.type) || validExtensions.includes(getFileExtension(file.name))
}

/**
 * Validate text file type
 */
export function isValidTextFile(file: File): boolean {
  const validTypes = ['text/plain', 'text/markdown']
  const validExtensions = ['txt', 'md', 'markdown']
  
  return validTypes.includes(file.type) || validExtensions.includes(getFileExtension(file.name))
}

/**
 * Create data URL from Uint8Array
 */
export function createDataUrl(data: Uint8Array, mimeType: string): string {
    const blob = new Blob([data as BlobPart], { type: mimeType })
  return URL.createObjectURL(blob)
}

/**
 * Revoke data URL
 */
export function revokeDataUrl(url: string): void {
  URL.revokeObjectURL(url)
}

/**
 * Check if browser supports file system access API
 */
export function supportsFileSystemAccess(): boolean {
  return 'showOpenFilePicker' in window && 'showSaveFilePicker' in window
}

/**
 * Open file picker using File System Access API (if supported)
 */
export async function openFileWithFSA(options: {
  multiple?: boolean
  accept?: Record<string, string[]>
} = {}): Promise<File[]> {
  if (!supportsFileSystemAccess()) {
    throw new Error('File System Access API not supported')
  }
  
  try {
    const fileHandles = await (window as any).showOpenFilePicker({
      multiple: options.multiple || false,
      types: options.accept ? Object.entries(options.accept).map(([description, accept]) => ({
        description,
        accept: { [(Object.keys(accept) as string[])[0]]: (accept as any)[(Object.keys(accept) as string[])[0]] }
      })) : undefined
    })
    
    const files = []
    for (const fileHandle of fileHandles) {
      files.push(await fileHandle.getFile())
    }
    
    return files
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return []
    }
    throw error
  }
}

/**
 * Save file using File System Access API (if supported)
 */
export async function saveFileWithFSA(
  data: Uint8Array,
  suggestedName: string,
  mimeType: string = 'application/octet-stream'
): Promise<void> {
  if (!supportsFileSystemAccess()) {
    throw new Error('File System Access API not supported')
  }
  
  try {
    const fileHandle = await (window as any).showSaveFilePicker({
      suggestedName,
      types: [{
        description: 'Files',
        accept: { [mimeType]: [`.${getFileExtension(suggestedName)}`] }
      }]
    })
    
    const writable = await fileHandle.createWritable()
    await writable.write(data)
    await writable.close()
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return
    }
    throw error
  }
}

/**
 * Read file as text
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to read file as text'))
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

/**
 * Read file as data URL
 */
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to read file as data URL'))
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/**
 * Check if file is too large for memory
 */
export function isFileTooLarge(file: File, maxSizeMB: number = 100): boolean {
  return file.size > maxSizeMB * 1024 * 1024
}

/**
 * Get estimated memory usage
 */
export function getEstimatedMemoryUsage(): number {
  // Estimate based on performance.memory API if available
  if ('memory' in performance) {
    return (performance as any).memory.usedJSHeapSize || 0
  }
  return 0
}

/**
 * Check available memory
 */
export function hasAvailableMemory(requiredMB: number = 50): boolean {
  if ('memory' in performance) {
    const memory = (performance as any).memory
    const availableMB = (memory.jsHeapSizeLimit - memory.usedJSHeapSize) / (1024 * 1024)
    return availableMB > requiredMB
  }
  return true // Assume available if we can't check
}