import re

# Read the file
with open('src/workers/pdfWorker.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Define the new interface methods to add
new_methods = """  analyzeEncryption: (pdfData: Uint8Array) => Promise<any>
  testPassword: (pdfData: Uint8Array, password: string) => Promise<boolean>
  detectFormFields: (pdfData: Uint8Array) => Promise<any[]>
  fillForms: (pdfData: Uint8Array, formData: Record<string, any>) => Promise<Uint8Array>
  convertToGrayscale: (pdfData: Uint8Array) => Promise<Uint8Array>
  convertImageToPDF: (imageData: Uint8Array, options: any) => Promise<Uint8Array>
  convertPDFPageToImage: (pdfData: Uint8Array, pageIndex: number, format: 'png' | 'jpeg' | 'webp') => Promise<Uint8Array>
  createSearchablePDF: (pdfData: Uint8Array, options: any) => Promise<Uint8Array>
}"""

# Find and replace the interface closing
old_closing = "  sanitizePDF: (pdfData: Uint8Array, options: any) => Promise<Uint8Array>\n}"
new_closing = "  sanitizePDF: (pdfData: Uint8Array, options: any) => Promise<Uint8Array>\n  " + new_methods

content = content.replace(old_closing, new_closing)

# Write back
with open('src/workers/pdfWorker.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print('✓ Successfully updated PDFWorkerAPI interface')
