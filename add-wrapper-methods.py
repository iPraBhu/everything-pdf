import re

# Read the file
with open('src/lib/workerManager.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# New methods to add
new_methods = """
  // PDF Worker Methods - Encryption & Forms
  async analyzeEncryption(pdfData: Uint8Array): Promise<any> {
    const worker = await this.getPDFWorker()
    return worker.analyzeEncryption(pdfData)
  }

  async testPassword(pdfData: Uint8Array, password: string): Promise<boolean> {
    const worker = await this.getPDFWorker()
    return worker.testPassword(pdfData, password)
  }

  async detectFormFields(pdfData: Uint8Array): Promise<any[]> {
    const worker = await this.getPDFWorker()
    return worker.detectFormFields(pdfData)
  }

  async fillForms(pdfData: Uint8Array, formData: Record<string, any>): Promise<Uint8Array> {
    const worker = await this.getPDFWorker()
    return worker.fillForms(pdfData, formData)
  }

  async convertToGrayscalePDF(pdfData: Uint8Array): Promise<Uint8Array> {
    const worker = await this.getPDFWorker()
    return worker.convertToGrayscale(pdfData)
  }

  async convertImageToPDF(imageData: Uint8Array, options: any = {}): Promise<Uint8Array> {
    const worker = await this.getPDFWorker()
    return worker.convertImageToPDF(imageData, options)
  }

  async convertPDFPageToImage(
    pdfData: Uint8Array,
    pageIndex: number,
    format: 'png' | 'jpeg' | 'webp' = 'png'
  ): Promise<Uint8Array> {
    const worker = await this.getPDFWorker()
    return worker.convertPDFPageToImage(pdfData, pageIndex, format)
  }

  async createSearchablePDF(pdfData: Uint8Array, options: any = {}): Promise<Uint8Array> {
    const worker = await this.getPDFWorker()
    return worker.createSearchablePDF(pdfData, options)
  }

  async compressPDF(pdfData: Uint8Array, options: any = {}): Promise<Uint8Array> {
    const worker = await this.getPDFWorker()
    return worker.compressPDF(pdfData, options)
  }

  async encryptPDF(
    pdfData: Uint8Array,
    userPassword: string,
    ownerPassword?: string,
    permissions?: any
  ): Promise<Uint8Array> {
    const worker = await this.getPDFWorker()
    return worker.encryptPDF(pdfData, userPassword, ownerPassword, permissions)
  }

  async decryptPDF(pdfData: Uint8Array, password: string): Promise<Uint8Array> {
    const worker = await this.getPDFWorker()
    return worker.decryptPDF(pdfData, password)
  }
"""

# Find the closing brace of the class (before the export)
pattern = r'(\}\n\n// Export singleton instance)'
match = re.search(pattern, content)

if match:
    insert_pos = match.start()
    # Insert the new methods before the closing brace
    updated_content = content[:insert_pos] + new_methods + '\n' + content[insert_pos:]
    
    # Write back
    with open('src/lib/workerManager.ts', 'w', encoding='utf-8') as f:
        f.write(updated_content)
    
    print('✓ Successfully added wrapper methods to workerManager.ts')
else:
    print('ERROR: Could not find insertion point')
