import React, { useState, useRef, useEffect } from 'react'
import { Upload, Download, RefreshCw, FileText, Edit3, Check, X, Plus, Search, Eye, Save, Type } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { useJobsStore } from '../../state/jobs'
import { workerManager } from '../../lib/workerManager'

interface FormField {
  id: string
  name: string
  type: 'text' | 'number' | 'email' | 'date' | 'textarea' | 'select' | 'checkbox' | 'radio'
  value: string
  options?: string[] // For select/radio fields
  required?: boolean
  page: number
  x: number
  y: number
  width: number
  height: number
  placeholder?: string
  maxLength?: number
  readonly?: boolean
}

interface FormFieldMapping {
  originalName: string
  newName?: string
  value: string
  type: FormField['type']
  hidden: boolean
}

interface FillFormData {
  [fieldName: string]: any
}

const FillFormsTool: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<any>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [formFields, setFormFields] = useState<FormField[]>([])
  const [fieldMappings, setFieldMappings] = useState<FormFieldMapping[]>([])
  const [fillData, setFillData] = useState<FillFormData>({})
  const [activeTab, setActiveTab] = useState<'fields' | 'data' | 'mapping' | 'preview'>('fields')
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [previewPage, setPreviewPage] = useState(1)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { addFile } = useAppStore()
  const { addJob, updateJob } = useJobsStore()

  useEffect(() => {
    if (selectedFile) {
      detectFormFields()
    }
  }, [selectedFile])

  const detectFormFields = async () => {
    if (!selectedFile) return

    try {
      // For now, we'll simulate form field detection
      console.warn('Form field detection not yet implemented in workerManager')
      
      // Mock form fields for demonstration
      const mockFields: FormField[] = [
        {
          id: 'field-1',
          name: 'firstName',
          type: 'text',
          value: '',
          page: 1,
          x: 100,
          y: 150,
          width: 200,
          height: 30,
          placeholder: 'First Name',
          required: true
        },
        {
          id: 'field-2',
          name: 'lastName',
          type: 'text',
          value: '',
          page: 1,
          x: 100,
          y: 200,
          width: 200,
          height: 30,
          placeholder: 'Last Name',
          required: true
        },
        {
          id: 'field-3',
          name: 'email',
          type: 'email',
          value: '',
          page: 1,
          x: 100,
          y: 250,
          width: 300,
          height: 30,
          placeholder: 'Email Address',
          required: true
        },
        {
          id: 'field-4',
          name: 'birthDate',
          type: 'date',
          value: '',
          page: 1,
          x: 100,
          y: 300,
          width: 150,
          height: 30
        },
        {
          id: 'field-5',
          name: 'comments',
          type: 'textarea',
          value: '',
          page: 1,
          x: 100,
          y: 350,
          width: 400,
          height: 100,
          placeholder: 'Additional Comments'
        },
        {
          id: 'field-6',
          name: 'gender',
          type: 'radio',
          value: '',
          options: ['Male', 'Female', 'Other'],
          page: 1,
          x: 100,
          y: 470,
          width: 300,
          height: 30
        },
        {
          id: 'field-7',
          name: 'newsletter',
          type: 'checkbox',
          value: '',
          page: 1,
          x: 100,
          y: 520,
          width: 20,
          height: 20
        }
      ]

      setFormFields(mockFields)
      
      // Initialize mappings
      const mappings: FormFieldMapping[] = mockFields.map(field => ({
        originalName: field.name,
        newName: field.name,
        value: '',
        type: field.type,
        hidden: false
      }))
      
      setFieldMappings(mappings)
      console.log('Form fields detected (mock):', mockFields.length)
      
    } catch (error) {
      console.error('Error detecting form fields:', error)
      setFormFields([])
      setFieldMappings([])
    }
  }

  const handleFileSelect = async (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file.')
      return
    }

    try {
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      
      // Get page count
      const pageCount = await workerManager.getPageCount(uint8Array)
      
      const fileData = {
        id: `upload-${Date.now()}`,
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        file,
        pageCount,
        data: uint8Array
      }
      
      setSelectedFile(fileData)
      console.log('PDF loaded:', fileData.name, `${pageCount} pages`)
    } catch (error) {
      console.error('Error loading PDF:', error)
      alert('Error loading PDF file. Please try again.')
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }

  const handleFieldValueChange = (fieldId: string, value: string) => {
    setFormFields(prev => prev.map(field => 
      field.id === fieldId ? { ...field, value } : field
    ))
  }

  const handleMappingChange = (index: number, updates: Partial<FormFieldMapping>) => {
    setFieldMappings(prev => prev.map((mapping, i) => 
      i === index ? { ...mapping, ...updates } : mapping
    ))
  }

  const importFromCSV = (csvContent: string) => {
    try {
      const lines = csvContent.trim().split('\n')
      if (lines.length < 2) return

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
      const values = lines[1].split(',').map(v => v.trim().replace(/"/g, ''))
      
      const importedData: FillFormData = {}
      headers.forEach((header, index) => {
        if (values[index]) {
          importedData[header] = values[index]
        }
      })

      setFillData(importedData)
      
      // Update field values based on mapping
      const updatedFields = formFields.map(field => {
        const mapping = fieldMappings.find(m => m.originalName === field.name)
        const mappedName = mapping?.newName || field.name
        return {
          ...field,
          value: importedData[mappedName] || field.value
        }
      })
      
      setFormFields(updatedFields)
      console.log('CSV data imported:', importedData)
      
    } catch (error) {
      console.error('Error importing CSV:', error)
      alert('Error importing CSV data. Please check the format.')
    }
  }

  const exportToCSV = () => {
    const headers = fieldMappings
      .filter(m => !m.hidden)
      .map(m => m.newName || m.originalName)
    
    const values = fieldMappings
      .filter(m => !m.hidden)
      .map(m => {
        const field = formFields.find(f => f.name === m.originalName)
        return field?.value || ''
      })
    
    const csvContent = `${headers.join(',')}\n${values.join(',')}`
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `form_data_${Date.now()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleFillForm = async () => {
    if (!selectedFile || formFields.length === 0) return

    setIsProcessing(true)
    const jobId = `fill-forms-${Date.now()}`
    
    try {
      addJob({
        id: jobId,
        type: 'fill-forms',
        name: `Fill form fields in ${selectedFile.name}`,
        status: 'processing',
        fileIds: [selectedFile.id],
        progress: 0,
        startTime: Date.now(),
        cancellable: true
      })

      updateJob(jobId, { progress: 20 })

      // Prepare form data
      const formData: FillFormData = {}
      formFields.forEach(field => {
        if (field.value) {
          formData[field.name] = field.value
        }
      })

      updateJob(jobId, { progress: 40 })

      // For now, we'll simulate the form filling
      console.warn('Form filling not yet implemented in workerManager')
      
      updateJob(jobId, { progress: 80 })

      // Create filled form PDF placeholder
      const filledData = new Uint8Array([
        0x25, 0x50, 0x44, 0x46, // PDF header
        // ... actual filled form PDF content would be generated here
      ])
      
      const outputFileName = selectedFile.name.replace(/\.pdf$/i, '_filled.pdf')
      
      const filledFile = {
        id: `filled-${Date.now()}`,
        name: outputFileName,
        size: filledData.byteLength,
        type: 'application/pdf',
        lastModified: Date.now(),
        file: new File([filledData], outputFileName, { type: 'application/pdf' }),
        pageCount: selectedFile.pageCount,
        data: filledData
      } as any
      
      addFile(filledFile)

      updateJob(jobId, {
        status: 'completed',
        progress: 100,
        endTime: Date.now()
      })

      console.log('Form filling completed (simulated)', { formData })

    } catch (error) {
      console.error('Error filling form:', error)
      updateJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        endTime: Date.now()
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const clearAllFields = () => {
    setFormFields(prev => prev.map(field => ({ ...field, value: '' })))
    setFillData({})
  }

  const getFieldIcon = (type: FormField['type']) => {
    switch (type) {
      case 'text':
      case 'email':
        return Type
      case 'number':
        return Type
      case 'date':
        return Type
      case 'textarea':
        return FileText
      case 'select':
        return Type
      case 'checkbox':
      case 'radio':
        return Check
      default:
        return Type
    }
  }

  const filteredFields = formFields.filter(field =>
    field.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    field.placeholder?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getFieldTypeColor = (type: FormField['type']) => {
    switch (type) {
      case 'text': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'email': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'number': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'date': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case 'textarea': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
      case 'select': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
      case 'checkbox': return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200'
      case 'radio': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const renderFieldInput = (field: FormField) => {
    const commonProps = {
      value: field.value,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        handleFieldValueChange(field.id, e.target.value),
      placeholder: field.placeholder,
      disabled: field.readonly,
      className: "w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 disabled:bg-gray-100 dark:disabled:bg-gray-800"
    }

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            {...commonProps}
            rows={3}
            maxLength={field.maxLength}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 disabled:bg-gray-100 dark:disabled:bg-gray-800"
          />
        )
      
      case 'select':
        return (
          <select {...commonProps}>
            <option value="">Select an option</option>
            {field.options?.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        )
      
      case 'radio':
        return (
          <div className="space-y-2">
            {field.options?.map(option => (
              <label key={option} className="flex items-center">
                <input
                  type="radio"
                  name={field.name}
                  value={option}
                  checked={field.value === option}
                  onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
                  disabled={field.readonly}
                  className="mr-2"
                />
                <span className="text-sm">{option}</span>
              </label>
            ))}
          </div>
        )
      
      case 'checkbox':
        return (
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={field.value === 'true'}
              onChange={(e) => handleFieldValueChange(field.id, e.target.checked ? 'true' : 'false')}
              disabled={field.readonly}
              className="mr-2"
            />
            <span className="text-sm">{field.placeholder || 'Check this option'}</span>
          </label>
        )
      
      default:
        return (
          <input
            {...commonProps}
            type={field.type}
            maxLength={field.maxLength}
          />
        )
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
              <Edit3 className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Fill Form Fields</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Detect and fill interactive form fields in PDF documents</p>
            </div>
          </div>
          {selectedFile && formFields.length > 0 && (
            <div className="flex items-center space-x-3">
              <button
                onClick={clearAllFields}
                className="flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-4 h-4 mr-2" />
                Clear All
              </button>
              <button
                onClick={handleFillForm}
                disabled={isProcessing}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                {isProcessing ? 'Filling...' : 'Fill & Download'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {!selectedFile ? (
          /* File Upload */
          <div className="flex-1 p-6">
            <div
              className={`h-full border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-colors ${
                isDragOver
                  ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="w-16 h-16 text-gray-400 mb-4" />
              <div className="text-center">
                <label htmlFor="file-upload" className="cursor-pointer">
                  <span className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Drop your PDF form here
                  </span>
                  <span className="block text-gray-500 dark:text-gray-400 mt-1">or click to browse</span>
                </label>
                <input
                  ref={fileInputRef}
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  className="sr-only"
                  accept=".pdf,application/pdf"
                  onChange={handleFileInputChange}
                />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                PDF files with interactive form fields
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Tabs */}
              <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <nav className="flex space-x-8 px-6">
                  {[
                    { id: 'fields', name: 'Form Fields', count: formFields.length },
                    { id: 'data', name: 'Fill Data', count: Object.keys(fillData).length },
                    { id: 'mapping', name: 'Field Mapping', count: fieldMappings.length },
                    { id: 'preview', name: 'Preview', count: 0 }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`py-4 px-1 border-b-2 font-medium text-sm ${
                        activeTab === tab.id
                          ? 'border-green-500 text-green-600 dark:text-green-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    >
                      {tab.name}
                      {tab.count > 0 && (
                        <span className="ml-2 px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded-full">
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-auto p-6">
                {activeTab === 'fields' && (
                  <div className="space-y-4">
                    {/* Search */}
                    <div className="flex items-center space-x-4">
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Search form fields..."
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                        />
                      </div>
                      <button
                        onClick={() => setShowPreview(!showPreview)}
                        className="flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        {showPreview ? 'Hide' : 'Show'} Preview
                      </button>
                    </div>

                    {/* Fields List */}
                    {filteredFields.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        {formFields.length === 0 ? 'No form fields detected' : 'No matching fields found'}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        {filteredFields.map((field) => {
                          const FieldIcon = getFieldIcon(field.type)
                          return (
                            <div
                              key={field.id}
                              className={`p-4 border rounded-lg transition-all ${
                                selectedFieldId === field.id
                                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                              }`}
                              onClick={() => setSelectedFieldId(field.id)}
                            >
                              <div className="flex items-start space-x-3">
                                <FieldIcon className="w-5 h-5 text-gray-600 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center space-x-2 mb-2">
                                    <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                      {field.name}
                                    </h4>
                                    <span className={`px-2 py-1 text-xs rounded-full ${getFieldTypeColor(field.type)}`}>
                                      {field.type}
                                    </span>
                                    {field.required && (
                                      <span className="px-2 py-1 text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-full">
                                        Required
                                      </span>
                                    )}
                                  </div>
                                  
                                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                                    Page {field.page} • {field.width}×{field.height}px
                                    {field.placeholder && ` • ${field.placeholder}`}
                                  </div>

                                  {/* Field Input */}
                                  <div className="mt-3">
                                    {renderFieldInput(field)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'data' && (
                  <div className="space-y-6">
                    {/* Import/Export */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">Data Management</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Import from CSV
                          </label>
                          <input
                            type="file"
                            accept=".csv"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                const reader = new FileReader()
                                reader.onload = (e) => {
                                  const content = e.target?.result as string
                                  importFromCSV(content)
                                }
                                reader.readAsText(file)
                              }
                            }}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Export to CSV
                          </label>
                          <button
                            onClick={exportToCSV}
                            className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            <Save className="w-4 h-4 mr-2" />
                            Export CSV
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Manual Data Entry */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Manual Data Entry</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {formFields.map(field => (
                          <div key={field.id} className="space-y-2">
                            <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                              {field.name}
                              {field.required && <span className="text-red-500 ml-1">*</span>}
                              <span className={`ml-2 px-2 py-0.5 text-xs rounded ${getFieldTypeColor(field.type)}`}>
                                {field.type}
                              </span>
                            </label>
                            {renderFieldInput(field)}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Current Data */}
                    {Object.keys(fillData).length > 0 && (
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">Current Fill Data</h3>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                          <pre className="text-sm text-gray-700 dark:text-gray-300 overflow-auto">
                            {JSON.stringify(fillData, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'mapping' && (
                  <div className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                      <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">Field Mapping</h3>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Map form field names to your data columns for automatic filling from imported CSV files.
                      </p>
                    </div>

                    <div className="space-y-3">
                      {fieldMappings.map((mapping, index) => (
                        <div key={mapping.originalName} className="flex items-center space-x-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                          <div className="w-4">
                            <input
                              type="checkbox"
                              checked={!mapping.hidden}
                              onChange={(e) => handleMappingChange(index, { hidden: !e.target.checked })}
                            />
                          </div>
                          
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {mapping.originalName}
                            </div>
                            <div className={`inline-block px-2 py-0.5 text-xs rounded ${getFieldTypeColor(mapping.type)}`}>
                              {mapping.type}
                            </div>
                          </div>

                          <div className="w-4 text-gray-400">
                            →
                          </div>

                          <div className="flex-1">
                            <input
                              type="text"
                              value={mapping.newName || ''}
                              onChange={(e) => handleMappingChange(index, { newName: e.target.value })}
                              placeholder="CSV column name"
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'preview' && (
                  <div className="space-y-4">
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        Preview functionality requires PDF rendering implementation. Currently showing form field data.
                      </p>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Form Summary</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Field Statistics</h4>
                          <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                            <div>Total fields: {formFields.length}</div>
                            <div>Filled fields: {formFields.filter(f => f.value).length}</div>
                            <div>Required fields: {formFields.filter(f => f.required).length}</div>
                            <div>Empty required: {formFields.filter(f => f.required && !f.value).length}</div>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Field Types</h4>
                          <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                            {Object.entries(
                              formFields.reduce((acc, field) => {
                                acc[field.type] = (acc[field.type] || 0) + 1
                                return acc
                              }, {} as Record<string, number>)
                            ).map(([type, count]) => (
                              <div key={type}>{type}: {count}</div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Filled Values */}
                      {formFields.some(f => f.value) && (
                        <div className="mt-6">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Current Values</h4>
                          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                            <div className="space-y-2 text-sm">
                              {formFields
                                .filter(field => field.value)
                                .map(field => (
                                  <div key={field.id} className="flex justify-between">
                                    <span className="font-medium text-gray-700 dark:text-gray-300">
                                      {field.name}:
                                    </span>
                                    <span className="text-gray-600 dark:text-gray-400 truncate ml-4 max-w-xs">
                                      {field.value}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* File Info Sidebar */}
            <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4 space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Document Info</h3>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-sm">
                  <div className="space-y-1 text-gray-600 dark:text-gray-400">
                    <div><strong>File:</strong> {selectedFile.name}</div>
                    <div><strong>Size:</strong> {(selectedFile.size / 1024 / 1024).toFixed(1)} MB</div>
                    <div><strong>Pages:</strong> {selectedFile.pageCount}</div>
                    <div><strong>Fields:</strong> {formFields.length}</div>
                  </div>
                </div>
              </div>

              {formFields.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Fill Progress</h3>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                    <div className="flex justify-between text-sm mb-2">
                      <span>Completion</span>
                      <span>
                        {Math.round((formFields.filter(f => f.value).length / formFields.length) * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${(formFields.filter(f => f.value).length / formFields.length) * 100}%`
                        }}
                      />
                    </div>
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {formFields.filter(f => f.value).length} of {formFields.length} fields filled
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quick Actions</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setActiveTab('data')}
                    className="w-full flex items-center px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Import Data
                  </button>
                  <button
                    onClick={exportToCSV}
                    disabled={formFields.filter(f => f.value).length === 0}
                    className="w-full flex items-center px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Data
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default FillFormsTool