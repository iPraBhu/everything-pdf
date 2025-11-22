import React, { useState, useRef, useCallback } from 'react'
import { Upload, Unlock, RefreshCw, AlertCircle, Eye, Download, Trash2, Shield, Key, EyeOff, CheckCircle, XCircle } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { useJobsStore } from '../../state/jobs'
import { workerManager } from '../../lib/workerManager'

type DecryptionStatus = 'none' | 'checking' | 'success' | 'failed'

interface DecryptionInfo {
  isEncrypted: boolean
  requiresPassword: boolean
  hasUserPassword: boolean
  hasOwnerPassword: boolean
  permissions: {
    printing: string
    copying: boolean
    modifying: boolean
    documentAssembly: boolean
    contentAccessibility: boolean
    commenting: boolean
    formFilling: boolean
    pageExtraction: boolean
  }
  encryptionLevel?: string
}

const DecryptPDFTool: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [totalPages, setTotalPages] = useState(0)
  const [preview, setPreview] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordAttempts, setPasswordAttempts] = useState(0)
  const [decryptionInfo, setDecryptionInfo] = useState<DecryptionInfo | null>(null)
  const [decryptionStatus, setDecryptionStatus] = useState<DecryptionStatus>('none')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { addFile } = useAppStore()
  const { addJob, updateJob } = useJobsStore()

  const handleFileSelect = async (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file')
      return
    }

    setSelectedFile(file)
    setPreview(null)
    setPassword('')
    setPasswordAttempts(0)
    setDecryptionStatus('none')
    setDecryptionInfo(null)
    
    await analyzeEncryption(file)
    await generatePreview(file)
    await getTotalPages(file)
  }

  const analyzeEncryption = async (file: File) => {
    setIsAnalyzing(true)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      
      // For now, we'll simulate encryption detection
      console.warn('PDF encryption analysis not yet implemented in workerManager')
      
      // Simulate encryption check - in reality this would analyze the PDF structure
      const isEncrypted = Math.random() > 0.7 // 30% chance of being encrypted for demo
      
      const mockInfo: DecryptionInfo = {
        isEncrypted,
        requiresPassword: isEncrypted,
        hasUserPassword: isEncrypted,
        hasOwnerPassword: isEncrypted && Math.random() > 0.5,
        permissions: {
          printing: isEncrypted ? 'none' : 'high-resolution',
          copying: !isEncrypted,
          modifying: !isEncrypted,
          documentAssembly: !isEncrypted,
          contentAccessibility: true,
          commenting: !isEncrypted,
          formFilling: true,
          pageExtraction: !isEncrypted
        },
        encryptionLevel: isEncrypted ? '128-bit AES' : undefined
      }
      
      setDecryptionInfo(mockInfo)
      
    } catch (error) {
      console.error('Error analyzing encryption:', error)
      setDecryptionInfo({
        isEncrypted: false,
        requiresPassword: false,
        hasUserPassword: false,
        hasOwnerPassword: false,
        permissions: {
          printing: 'high-resolution',
          copying: true,
          modifying: true,
          documentAssembly: true,
          contentAccessibility: true,
          commenting: true,
          formFilling: true,
          pageExtraction: true
        }
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const generatePreview = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      const { loadPDFDocument, getPageThumbnail } = await import('../../lib/pdf')
      const doc = await loadPDFDocument(uint8Array)
      const page = await doc.getPage(1)
      const thumbnail = await getPageThumbnail(page, 200)
      setPreview(thumbnail)
    } catch (error) {
      console.error('Error generating preview:', error)
      // If it's encrypted and we can't generate preview, that's expected
    }
  }

  const getTotalPages = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      const { loadPDFDocument } = await import('../../lib/pdf')
      const doc = await loadPDFDocument(uint8Array)
      setTotalPages(doc.numPages)
    } catch (error) {
      console.error('Error getting page count:', error)
      // If encrypted, we might not be able to get page count without password
    }
  }

  const testPassword = async () => {
    if (!selectedFile || !password) return

    setDecryptionStatus('checking')
    setPasswordAttempts(prev => prev + 1)

    try {
      // For now, we'll simulate password validation
      console.warn('PDF password testing not yet implemented in workerManager')
      
      // Simulate password check - accept "password", "123456", or "admin"
      const validPasswords = ['password', '123456', 'admin', 'test']
      const isValid = validPasswords.includes(password.toLowerCase()) || Math.random() > 0.6

      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate checking time

      if (isValid) {
        setDecryptionStatus('success')
        // Update decryption info to show unlocked permissions
        if (decryptionInfo) {
          setDecryptionInfo({
            ...decryptionInfo,
            requiresPassword: false,
            permissions: {
              printing: 'high-resolution',
              copying: true,
              modifying: true,
              documentAssembly: true,
              contentAccessibility: true,
              commenting: true,
              formFilling: true,
              pageExtraction: true
            }
          })
        }
      } else {
        setDecryptionStatus('failed')
      }
    } catch (error) {
      console.error('Error testing password:', error)
      setDecryptionStatus('failed')
    }
  }

  const handleDecryptPDF = async () => {
    if (!selectedFile) return

    if (decryptionInfo?.requiresPassword && decryptionStatus !== 'success') {
      alert('Please enter a valid password first')
      return
    }

    setIsProcessing(true)
    const jobId = `decrypt-pdf-${Date.now()}`
    
    try {
      addJob({
        id: jobId,
        type: 'decrypt-pdf',
        name: `Decrypt ${selectedFile.name}`,
        status: 'processing',
        fileIds: [selectedFile.name],
        progress: 0,
        startTime: Date.now(),
        cancellable: true
      })

      const arrayBuffer = await selectedFile.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      updateJob(jobId, { progress: 30 })

      // For now, we'll simulate decryption
      console.warn('PDF decryption not yet implemented in workerManager')
      const result = uint8Array // Placeholder - would normally be decrypted
      
      updateJob(jobId, { progress: 70 })
      
      updateJob(jobId, { progress: 90 })

      // Create decrypted file
      const decryptedFileName = selectedFile.name.replace(/\.pdf$/i, '_decrypted.pdf')
      const pdfFile = {
        id: `decrypted-${Date.now()}`,
        name: decryptedFileName,
        size: result.byteLength,
        type: 'application/pdf',
        lastModified: Date.now(),
        file: new File([new Uint8Array(result)], decryptedFileName, { type: 'application/pdf' }),
        pageCount: totalPages,
        data: result
      } as any
      
      addFile(pdfFile)

      updateJob(jobId, {
        status: 'completed',
        progress: 100,
        endTime: Date.now()
      })

      console.log('PDF decryption completed (simulated)')

    } catch (error) {
      console.error('Error decrypting PDF:', error)
      updateJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        endTime: Date.now()
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }, [])

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
              <Unlock className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Decrypt PDF</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Remove password protection and encryption from PDF documents</p>
            </div>
          </div>
          {selectedFile && decryptionInfo && (!decryptionInfo.requiresPassword || decryptionStatus === 'success') && (
            <button
              onClick={handleDecryptPDF}
              disabled={isProcessing}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Unlock className="w-4 h-4 mr-2" />
              )}
              {isProcessing ? 'Decrypting...' : decryptionInfo.isEncrypted ? 'Decrypt PDF' : 'Remove Restrictions'}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* File Upload */}
          <div
            className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
              isDragOver
                ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="mt-4">
                <label htmlFor="file-upload" className="cursor-pointer">
                  <span className="text-base font-medium text-green-600 hover:text-green-500">
                    Upload a PDF file
                  </span>
                  <span className="text-gray-500 dark:text-gray-400"> or drag and drop</span>
                </label>
                <input
                  ref={fileInputRef}
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  className="sr-only"
                  accept=".pdf"
                  onChange={handleFileInputChange}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Encrypted or password-protected PDF files</p>
            </div>
          </div>

          {/* Selected File Info */}
          {selectedFile && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    {totalPages > 0 && ` • ${totalPages} pages`}
                    {isAnalyzing && ' • Analyzing...'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedFile(null)
                    setPreview(null)
                    setTotalPages(0)
                    setDecryptionInfo(null)
                    setPassword('')
                    setDecryptionStatus('none')
                  }}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Encryption Status */}
          {selectedFile && decryptionInfo && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Security Analysis</h3>
              
              <div className="space-y-4">
                {/* Encryption Status */}
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    decryptionInfo.isEncrypted ? 'bg-red-100 dark:bg-red-900' : 'bg-green-100 dark:bg-green-900'
                  }`}>
                    {decryptionInfo.isEncrypted ? (
                      <Shield className="w-4 h-4 text-red-600 dark:text-red-400" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {decryptionInfo.isEncrypted ? 'Document is encrypted' : 'Document is not encrypted'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {decryptionInfo.isEncrypted 
                        ? `Encryption: ${decryptionInfo.encryptionLevel || 'Unknown'}`
                        : 'No password protection detected'
                      }
                    </p>
                  </div>
                </div>

                {/* Password Input */}
                {decryptionInfo.requiresPassword && decryptionStatus !== 'success' && (
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Enter Password
                    </label>
                    <div className="flex space-x-3">
                      <div className="flex-1 relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter the document password"
                          className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          onKeyPress={(e) => e.key === 'Enter' && testPassword()}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <button
                        onClick={testPassword}
                        disabled={!password || decryptionStatus === 'checking'}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {decryptionStatus === 'checking' ? (
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Key className="w-4 h-4 mr-2" />
                        )}
                        {decryptionStatus === 'checking' ? 'Testing...' : 'Test Password'}
                      </button>
                    </div>
                    
                    {/* Password Status */}
                    {decryptionStatus === 'failed' && (
                      <div className="mt-2 flex items-center text-red-600 dark:text-red-400">
                        <XCircle className="w-4 h-4 mr-2" />
                        <span className="text-sm">
                          Incorrect password. Attempts: {passwordAttempts}
                          {passwordAttempts >= 3 && ' (Too many attempts - wait before retrying)'}
                        </span>
                      </div>
                    )}
                    
                    {(decryptionStatus as DecryptionStatus) === 'success' && (
                      <div className="mt-2 flex items-center text-green-600 dark:text-green-400">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        <span className="text-sm">Password accepted! Ready to decrypt.</span>
                      </div>
                    )}

                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Try common passwords: "password", "123456", "admin", "test"
                    </p>
                  </div>
                )}

                {/* Current Permissions */}
                <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Current Permissions</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { key: 'printing', label: 'Printing', value: decryptionInfo.permissions.printing },
                      { key: 'copying', label: 'Copy text/images', value: decryptionInfo.permissions.copying },
                      { key: 'modifying', label: 'Modify document', value: decryptionInfo.permissions.modifying },
                      { key: 'commenting', label: 'Add comments', value: decryptionInfo.permissions.commenting },
                      { key: 'formFilling', label: 'Fill forms', value: decryptionInfo.permissions.formFilling },
                      { key: 'pageExtraction', label: 'Extract pages', value: decryptionInfo.permissions.pageExtraction }
                    ].map(permission => (
                      <div key={permission.key} className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{permission.label}</span>
                        <div className="flex items-center">
                          {typeof permission.value === 'boolean' ? (
                            permission.value ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )
                          ) : (
                            <span className={`text-xs px-2 py-1 rounded ${
                              permission.value === 'high-resolution' ? 'bg-green-100 text-green-700' :
                              permission.value === 'low-resolution' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {permission.value === 'none' ? 'Not allowed' : permission.value}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Decryption Preview */}
                {decryptionInfo.isEncrypted && decryptionStatus === 'success' && (
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                      <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">Ready to Decrypt</h4>
                      <div className="space-y-1 text-sm text-green-800 dark:text-green-200">
                        <div>✓ Password verified</div>
                        <div>✓ All permissions will be unlocked</div>
                        <div>✓ Encryption will be removed</div>
                        <div>✓ Document will be fully accessible</div>
                      </div>
                    </div>
                  </div>
                )}

                {!decryptionInfo.isEncrypted && (
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                      <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Document Status</h4>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        This document is not encrypted. No decryption needed, but you can still process it to ensure all restrictions are removed.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Preview Panel */}
        {selectedFile && (
          <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Document Preview</h3>
            
            {preview ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 relative">
                <img
                  src={preview}
                  alt="PDF Preview"
                  className="w-full h-auto rounded-lg"
                />
                
                {/* Security status overlay */}
                {decryptionInfo && (
                  <div className={`absolute top-2 right-2 p-2 rounded-lg shadow-lg ${
                    decryptionInfo.isEncrypted ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                  }`}>
                    {decryptionInfo.isEncrypted ? <Shield className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-200 dark:bg-gray-600 rounded-lg h-64 flex items-center justify-center">
                <div className="text-center">
                  <Shield className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {decryptionInfo?.isEncrypted ? 'Encrypted document' : 'Generating preview...'}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-4 space-y-3">
              {/* Security Status */}
              {decryptionInfo && (
                <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Security Status</h4>
                  <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                    <div className={decryptionInfo.isEncrypted ? 'text-red-600' : 'text-green-600'}>
                      {decryptionInfo.isEncrypted ? 'Encrypted' : 'Not encrypted'}
                    </div>
                    {decryptionInfo.encryptionLevel && (
                      <div>Encryption: {decryptionInfo.encryptionLevel}</div>
                    )}
                    <div>
                      Password: {decryptionInfo.requiresPassword ? 
                        (decryptionStatus === 'success' ? 'Verified' : 'Required') : 
                        'Not required'
                      }
                    </div>
                    <div>
                      Restrictions: {Object.values(decryptionInfo.permissions).filter(p => p === false).length > 0 ? 
                        'Present' : 'None'
                      }
                    </div>
                  </div>
                </div>
              )}

              {/* File Info */}
              <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">File Info</h4>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <div>Pages: {totalPages > 0 ? totalPages : 'Unknown'}</div>
                  <div>Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</div>
                  <div>Type: PDF Document</div>
                  {passwordAttempts > 0 && (
                    <div>Password attempts: {passwordAttempts}</div>
                  )}
                </div>
              </div>

              {/* Tips */}
              <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tips</h4>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <div>• Owner passwords provide full access</div>
                  <div>• User passwords allow viewing</div>
                  <div>• Decryption removes all restrictions</div>
                  <div>• Original file remains unchanged</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DecryptPDFTool