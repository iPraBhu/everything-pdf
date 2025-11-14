import React, { useState, useRef, useCallback } from 'react'
import { FileText, RefreshCw, AlertCircle, Zap, Info, Calendar, Tag, Save, Plus, Trash2, Edit3, BookOpen } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { useJobsStore } from '../../state/jobs'
import { workerManager } from '../../lib/workerManager'
import { globalBatchProcessor } from '../../lib/batchProcessor'

interface DocumentMetadata {
  title: string
  author: string
  subject: string
  keywords: string[]
  creator: string
  producer: string
  creationDate: Date | null
  modificationDate: Date | null
  language: string
  customFields: Record<string, string>
  xmpMetadata?: {
    [key: string]: any
  }
  pdfInfo: {
    version: string
    pageCount: number
    encrypted: boolean
    fileSize: number
  }
}

interface MetadataTemplate {
  name: string
  description: string
  metadata: Partial<DocumentMetadata>
}

interface MetadataOptions {
  preserveExisting: boolean
  updateDates: boolean
  cleanEmptyFields: boolean
  includeCustomFields: boolean
  templateId?: string
}

const METADATA_TEMPLATES: MetadataTemplate[] = [
  {
    name: 'Business Document',
    description: 'Professional business document template',
    metadata: {
      creator: 'Business Suite',
      language: 'en-US',
      customFields: {
        'Document Type': 'Business Report',
        'Department': '',
        'Classification': 'Internal'
      }
    }
  },
  {
    name: 'Academic Paper',
    description: 'Academic research paper template',
    metadata: {
      creator: 'Academic Publisher',
      language: 'en-US',
      customFields: {
        'Publication': '',
        'DOI': '',
        'Volume': '',
        'Issue': '',
        'ISSN': ''
      }
    }
  },
  {
    name: 'Legal Document',
    description: 'Legal document template',
    metadata: {
      creator: 'Legal Office',
      language: 'en-US',
      customFields: {
        'Case Number': '',
        'Court': '',
        'Attorney': '',
        'Practice Area': ''
      }
    }
  },
  {
    name: 'Marketing Material',
    description: 'Marketing and promotional content',
    metadata: {
      creator: 'Marketing Department',
      language: 'en-US',
      customFields: {
        'Campaign': '',
        'Target Audience': '',
        'Brand': '',
        'Version': ''
      }
    }
  }
]

const LANGUAGE_OPTIONS = [
  { code: 'en-US', name: 'English (US)' },
  { code: 'en-GB', name: 'English (UK)' },
  { code: 'es-ES', name: 'Spanish' },
  { code: 'fr-FR', name: 'French' },
  { code: 'de-DE', name: 'German' },
  { code: 'it-IT', name: 'Italian' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)' },
  { code: 'zh-CN', name: 'Chinese (Simplified)' },
  { code: 'ja-JP', name: 'Japanese' },
  { code: 'ko-KR', name: 'Korean' },
  { code: 'ar-SA', name: 'Arabic' },
  { code: 'ru-RU', name: 'Russian' }
]

const DocumentMetadataEditor: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [currentMetadata, setCurrentMetadata] = useState<DocumentMetadata | null>(null)
  const [editedMetadata, setEditedMetadata] = useState<DocumentMetadata | null>(null)
  const [newKeyword, setNewKeyword] = useState('')
  const [newCustomFieldKey, setNewCustomFieldKey] = useState('')
  const [newCustomFieldValue, setNewCustomFieldValue] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [metadataOptions, setMetadataOptions] = useState<MetadataOptions>({
    preserveExisting: true,
    updateDates: true,
    cleanEmptyFields: false,
    includeCustomFields: true
  })
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addFile } = useAppStore()
  const { addJob, updateJob } = useJobsStore()

  const analyzeMetadata = useCallback(async (file: File) => {
    setIsAnalyzing(true)
    
    try {
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      const { loadPDFDocument, getDocumentMetadata } = await import('../../lib/pdf')
      
      const doc = await loadPDFDocument(uint8Array)
      const metadata = await getDocumentMetadata(doc)
      
      const documentMetadata: DocumentMetadata = {
        title: metadata.info.Title || '',
        author: metadata.info.Author || '',
        subject: metadata.info.Subject || '',
        keywords: metadata.info.Keywords ? metadata.info.Keywords.split(',').map((k: string) => k.trim()).filter((k: string) => k) : [],
        creator: metadata.info.Creator || '',
        producer: metadata.info.Producer || '',
        creationDate: metadata.info.CreationDate ? new Date(metadata.info.CreationDate) : null,
        modificationDate: metadata.info.ModDate ? new Date(metadata.info.ModDate) : null,
        language: '', // Not available in stub
        customFields: {},
        xmpMetadata: {}, // Not available in stub
        pdfInfo: {
          version: `PDF 1.4`, // Default version since pdfInfo not available
          pageCount: doc.numPages,
          encrypted: false, // Simplified since loadingTask.password not available
          fileSize: file.size
        }
      }
      
      // Custom fields can be added manually by user
      // XMP metadata extraction would require full implementation
      
      setCurrentMetadata(documentMetadata)
      setEditedMetadata({ ...documentMetadata })
      
    } catch (error) {
      console.error('Metadata analysis failed:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }, [])

  const handleFileSelect = async (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file')
      return
    }

    setSelectedFile(file)
    setCurrentMetadata(null)
    setEditedMetadata(null)
    
    await analyzeMetadata(file)
  }

  const applyTemplate = (templateId: string) => {
    const template = METADATA_TEMPLATES.find(t => t.name === templateId)
    if (!template || !editedMetadata) return
    
    setEditedMetadata(prev => ({
      ...prev!,
      ...template.metadata,
      customFields: {
        ...(metadataOptions.preserveExisting ? prev!.customFields : {}),
        ...template.metadata.customFields
      }
    }))
    setSelectedTemplate(templateId)
  }

  const addKeyword = () => {
    if (!newKeyword.trim() || !editedMetadata) return
    
    const keyword = newKeyword.trim()
    if (!editedMetadata.keywords.includes(keyword)) {
      setEditedMetadata(prev => ({
        ...prev!,
        keywords: [...prev!.keywords, keyword]
      }))
    }
    setNewKeyword('')
  }

  const removeKeyword = (keyword: string) => {
    if (!editedMetadata) return
    
    setEditedMetadata(prev => ({
      ...prev!,
      keywords: prev!.keywords.filter(k => k !== keyword)
    }))
  }

  const addCustomField = () => {
    if (!newCustomFieldKey.trim() || !editedMetadata) return
    
    const key = newCustomFieldKey.trim()
    const value = newCustomFieldValue.trim()
    
    setEditedMetadata(prev => ({
      ...prev!,
      customFields: {
        ...prev!.customFields,
        [key]: value
      }
    }))
    setNewCustomFieldKey('')
    setNewCustomFieldValue('')
  }

  const removeCustomField = (key: string) => {
    if (!editedMetadata) return
    
    setEditedMetadata(prev => {
      const newCustomFields = { ...prev!.customFields }
      delete newCustomFields[key]
      return {
        ...prev!,
        customFields: newCustomFields
      }
    })
  }

  const updateCustomField = (key: string, value: string) => {
    if (!editedMetadata) return
    
    setEditedMetadata(prev => ({
      ...prev!,
      customFields: {
        ...prev!.customFields,
        [key]: value
      }
    }))
  }

  const handleSaveMetadata = async () => {
    if (!selectedFile || !editedMetadata) return
    
    setIsProcessing(true)
    const jobId = Date.now().toString()
    
    try {
      addJob({
        id: jobId,
        type: 'metadata',
        name: 'Edit metadata for ' + selectedFile.name,
        status: 'processing',
        fileIds: [selectedFile.name],
        progress: 0,
        startTime: Date.now(),
        cancellable: true
      })

      const arrayBuffer = await selectedFile.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      
      // Clean metadata if requested
      let finalMetadata = { ...editedMetadata }
      if (metadataOptions.cleanEmptyFields) {
        finalMetadata = {
          ...finalMetadata,
          title: finalMetadata.title.trim(),
          author: finalMetadata.author.trim(),
          subject: finalMetadata.subject.trim(),
          creator: finalMetadata.creator.trim(),
          producer: finalMetadata.producer.trim(),
          language: finalMetadata.language.trim(),
          keywords: finalMetadata.keywords.filter(k => k.trim()),
          customFields: Object.fromEntries(
            Object.entries(finalMetadata.customFields).filter(([k, v]) => k.trim() && v.trim())
          )
        }
      }
      
      // Update dates if requested
      if (metadataOptions.updateDates) {
        finalMetadata.modificationDate = new Date()
        if (!finalMetadata.creationDate) {
          finalMetadata.creationDate = new Date()
        }
      }
      
      const result = await workerManager.submitJob({
        type: 'metadata',
        file: uint8Array,
        options: {
          metadata: finalMetadata,
          metadataOptions,
          onProgress: (progress: number) => {
            updateJob(jobId, { progress })
          }
        }
      })
      
      const outputFileName = generateMetadataFileName()
      const outputFile = new File([result], outputFileName, { type: 'application/pdf' })
      const pdfFile = {
        id: Date.now().toString(),
        name: outputFile.name,
        size: outputFile.size,
        type: outputFile.type,
        lastModified: outputFile.lastModified,
        file: outputFile,
        pageCount: currentMetadata?.pdfInfo.pageCount || 1,
        data: new Uint8Array(await outputFile.arrayBuffer())
      } as any
      addFile(pdfFile)
      
      updateJob(jobId, {
        status: 'completed',
        progress: 100,
        result: {
          fieldsUpdated: Object.keys(finalMetadata).filter(key => 
            key !== 'pdfInfo' && finalMetadata[key as keyof DocumentMetadata]
          ).length,
          customFields: Object.keys(finalMetadata.customFields).length,
          outputSize: result.byteLength
        }
      })
      
    } catch (error) {
      console.error('Metadata update failed:', error)
      updateJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const addToBatch = () => {
    if (!selectedFile || !editedMetadata) return

    globalBatchProcessor.addOperation({
      type: 'metadata',
      files: [selectedFile],
      options: { 
        metadata: editedMetadata,
        metadataOptions 
      },
      priority: 2,
      onComplete: async (result) => {
        const outputFileName = generateMetadataFileName()
        const outputFile = new File([result], outputFileName, { type: 'application/pdf' })
        const pdfFile = {
          id: Date.now().toString(),
          name: outputFile.name,
          size: outputFile.size,
          type: outputFile.type,
          lastModified: outputFile.lastModified,
          file: outputFile,
          pageCount: currentMetadata?.pdfInfo.pageCount || 1,
          data: new Uint8Array(await outputFile.arrayBuffer())
        } as any
        addFile(pdfFile)
      }
    })
  }

  const generateMetadataFileName = () => {
    const baseName = selectedFile?.name.replace('.pdf', '') || 'document'
    return `${baseName}_metadata_updated.pdf`
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }

  const formatDate = (date: Date | null): string => {
    if (!date) return 'Not set'
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const hasChanges = currentMetadata && editedMetadata && JSON.stringify(currentMetadata) !== JSON.stringify(editedMetadata)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Document Metadata Editor</h2>
        <div className="flex items-center gap-3">
          {editedMetadata && hasChanges && (
            <button
              onClick={addToBatch}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Zap className="w-4 h-4" />
              Add to Batch
            </button>
          )}
        </div>
      </div>

      {/* File Upload */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`mb-6 border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragOver
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900'
            : 'border-gray-300 dark:border-gray-600'
        }`}
      >
        <Info className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-gray-100">
          {selectedFile ? selectedFile.name : 'Select a PDF file to edit metadata'}
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          {currentMetadata 
            ? `${currentMetadata.pdfInfo.pageCount} pages • ${formatFileSize(currentMetadata.pdfInfo.fileSize)}`
            : 'Drag and drop a PDF file here, or click to browse'
          }
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
        >
          {selectedFile ? 'Change File' : 'Select File'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      {/* Current Metadata Overview */}
      {currentMetadata && (
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900 dark:to-green-900 rounded-lg border border-blue-200 dark:border-blue-700">
          <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">Current Document Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-white dark:bg-gray-800 rounded">
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {currentMetadata.pdfInfo.version}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">PDF Version</div>
            </div>
            
            <div className="text-center p-3 bg-white dark:bg-gray-800 rounded">
              <div className="text-lg font-bold text-green-600 dark:text-green-400">
                {currentMetadata.pdfInfo.pageCount}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Pages</div>
            </div>
            
            <div className="text-center p-3 bg-white dark:bg-gray-800 rounded">
              <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                {Object.keys(currentMetadata.customFields).length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Custom Fields</div>
            </div>
            
            <div className="text-center p-3 bg-white dark:bg-gray-800 rounded">
              <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                {currentMetadata.keywords.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Keywords</div>
            </div>
          </div>
        </div>
      )}

      {editedMetadata && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
          {/* Main Metadata Fields */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <h4 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Basic Information
              </h4>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={editedMetadata.title}
                    onChange={(e) => setEditedMetadata(prev => ({ ...prev!, title: e.target.value }))}
                    placeholder="Document title"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Author
                  </label>
                  <input
                    type="text"
                    value={editedMetadata.author}
                    onChange={(e) => setEditedMetadata(prev => ({ ...prev!, author: e.target.value }))}
                    placeholder="Document author"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Subject
                  </label>
                  <textarea
                    value={editedMetadata.subject}
                    onChange={(e) => setEditedMetadata(prev => ({ ...prev!, subject: e.target.value }))}
                    placeholder="Document subject or description"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Creator
                    </label>
                    <input
                      type="text"
                      value={editedMetadata.creator}
                      onChange={(e) => setEditedMetadata(prev => ({ ...prev!, creator: e.target.value }))}
                      placeholder="Creating application"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Language
                    </label>
                    <select
                      value={editedMetadata.language}
                      onChange={(e) => setEditedMetadata(prev => ({ ...prev!, language: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">Select language</option>
                      {LANGUAGE_OPTIONS.map(lang => (
                        <option key={lang.code} value={lang.code}>{lang.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Keywords */}
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <h4 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Tag className="w-5 h-5" />
                Keywords
              </h4>
              
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder="Add keyword"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
                  />
                  <button
                    onClick={addKeyword}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {editedMetadata.keywords.map((keyword, index) => (
                    <span
                      key={index}
                      className="flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded-full text-sm"
                    >
                      {keyword}
                      <button
                        onClick={() => removeKeyword(keyword)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <h4 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Document Dates
              </h4>
              
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Creation Date
                    </label>
                    <div className="text-sm text-gray-600 dark:text-gray-400 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                      {formatDate(editedMetadata.creationDate)}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Modification Date
                    </label>
                    <div className="text-sm text-gray-600 dark:text-gray-400 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                      {formatDate(editedMetadata.modificationDate)}
                    </div>
                  </div>
                </div>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={metadataOptions.updateDates}
                    onChange={(e) => setMetadataOptions(prev => ({ ...prev, updateDates: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Update modification date when saving
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Templates & Custom Fields */}
          <div className="lg:col-span-2 space-y-6">
            {/* Templates */}
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <h4 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Metadata Templates
              </h4>
              
              <div className="space-y-3">
                <select
                  value={selectedTemplate}
                  onChange={(e) => applyTemplate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select a template...</option>
                  {METADATA_TEMPLATES.map(template => (
                    <option key={template.name} value={template.name}>
                      {template.name}
                    </option>
                  ))}
                </select>
                
                {selectedTemplate && (
                  <div className="text-sm text-gray-600 dark:text-gray-400 p-3 bg-gray-50 dark:bg-gray-700 rounded">
                    {METADATA_TEMPLATES.find(t => t.name === selectedTemplate)?.description}
                  </div>
                )}
              </div>
            </div>

            {/* Custom Fields */}
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <h4 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Edit3 className="w-5 h-5" />
                Custom Fields
              </h4>
              
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newCustomFieldKey}
                    onChange={(e) => setNewCustomFieldKey(e.target.value)}
                    placeholder="Field name"
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <input
                    type="text"
                    value={newCustomFieldValue}
                    onChange={(e) => setNewCustomFieldValue(e.target.value)}
                    placeholder="Field value"
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <button
                  onClick={addCustomField}
                  className="w-full py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Custom Field
                </button>
                
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {Object.entries(editedMetadata.customFields).map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <input
                        type="text"
                        value={key}
                        readOnly
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                      />
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => updateCustomField(key, e.target.value)}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                      <button
                        onClick={() => removeCustomField(key)}
                        className="px-2 py-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Options */}
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <h4 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">Update Options</h4>
              
              <div className="space-y-3">
                {[
                  { key: 'preserveExisting', label: 'Preserve existing metadata when applying templates' },
                  { key: 'cleanEmptyFields', label: 'Remove empty fields from output' },
                  { key: 'includeCustomFields', label: 'Include custom fields in metadata' }
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={metadataOptions[key as keyof MetadataOptions] as boolean}
                      onChange={(e) => setMetadataOptions(prev => ({ ...prev, [key]: e.target.checked }))}
                      className="rounded mt-0.5"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {editedMetadata && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={handleSaveMetadata}
            disabled={isProcessing || !hasChanges}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {isProcessing ? 'Saving...' : hasChanges ? 'Save Metadata' : 'No Changes'}
          </button>
          
          <button
            onClick={addToBatch}
            disabled={isProcessing || !hasChanges}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Zap className="w-5 h-5" />
            Add to Batch Queue
          </button>
        </div>
      )}

      {/* Change Indicator */}
      {hasChanges && (
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">Unsaved changes detected</span>
            <span className="text-sm">•</span>
            <span className="text-sm">Click "Save Metadata" to apply changes</span>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isAnalyzing && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-blue-800 dark:text-blue-200">
              Analyzing document metadata...
            </span>
          </div>
        </div>
      )}

      {!selectedFile && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <span className="text-yellow-800 dark:text-yellow-200">
              Select a PDF file to view and edit its metadata properties.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default DocumentMetadataEditor