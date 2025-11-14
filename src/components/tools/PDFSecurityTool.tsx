import React, { useState, useRef, useCallback } from 'react'
import { FileText, RefreshCw, AlertCircle, Zap, Shield, Lock, Unlock, Key, Eye, EyeOff, Settings, CheckCircle } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { useJobsStore } from '../../state/jobs'
import { workerManager } from '../../lib/workerManager'
import { globalBatchProcessor } from '../../lib/batchProcessor'

interface SecurityOptions {
  operation: 'encrypt' | 'decrypt' | 'modify' | 'analyze'
  passwords: {
    user: string
    owner: string
    current: string
  }
  encryption: {
    level: 'standard' | 'strong' | 'maximum'
    algorithm: 'RC4-40' | 'RC4-128' | 'AES-128' | 'AES-256'
    keyLength: 40 | 128 | 256
  }
  permissions: {
    print: boolean
    printHighRes: boolean
    modify: boolean
    copy: boolean
    modifyAnnotations: boolean
    fillForms: boolean
    extractForAccessibility: boolean
    assemble: boolean
    degradedPrinting: boolean
  }
  advanced: {
    encryptMetadata: boolean
    requirePasswordForAccess: boolean
    allowPasswordRecovery: boolean
    securityHandler: 'standard' | 'public-key'
    certificateFile?: File
  }
}

interface SecurityAnalysis {
  isEncrypted: boolean
  hasUserPassword: boolean
  hasOwnerPassword: boolean
  encryptionLevel: string
  algorithm: string
  keyLength: number
  permissions: Record<string, boolean>
  securityHandler: string
  canDecrypt: boolean
  metadata: {
    encrypted: boolean
    accessible: boolean
  }
  vulnerabilities: Array<{
    type: 'weak-encryption' | 'no-owner-password' | 'permissive-permissions' | 'metadata-exposed'
    severity: 'low' | 'medium' | 'high'
    description: string
    recommendation: string
  }>
}

const ENCRYPTION_PRESETS = {
  basic: {
    level: 'standard' as const,
    algorithm: 'RC4-128' as const,
    keyLength: 128 as const,
    permissions: {
      print: true,
      printHighRes: false,
      modify: false,
      copy: false,
      modifyAnnotations: false,
      fillForms: true,
      extractForAccessibility: true,
      assemble: false,
      degradedPrinting: false
    }
  },
  secure: {
    level: 'strong' as const,
    algorithm: 'AES-128' as const,
    keyLength: 128 as const,
    permissions: {
      print: true,
      printHighRes: false,
      modify: false,
      copy: false,
      modifyAnnotations: false,
      fillForms: false,
      extractForAccessibility: true,
      assemble: false,
      degradedPrinting: false
    }
  },
  maximum: {
    level: 'maximum' as const,
    algorithm: 'AES-256' as const,
    keyLength: 256 as const,
    permissions: {
      print: false,
      printHighRes: false,
      modify: false,
      copy: false,
      modifyAnnotations: false,
      fillForms: false,
      extractForAccessibility: false,
      assemble: false,
      degradedPrinting: false
    }
  }
}

const PDFSecurityTool: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [securityAnalysis, setSecurityAnalysis] = useState<SecurityAnalysis | null>(null)
  const [showPasswords, setShowPasswords] = useState({ user: false, owner: false, current: false })
  const [securityOptions, setSecurityOptions] = useState<SecurityOptions>({
    operation: 'encrypt',
    passwords: {
      user: '',
      owner: '',
      current: ''
    },
    encryption: {
      level: 'strong',
      algorithm: 'AES-128',
      keyLength: 128
    },
    permissions: {
      print: true,
      printHighRes: false,
      modify: false,
      copy: false,
      modifyAnnotations: false,
      fillForms: true,
      extractForAccessibility: true,
      assemble: false,
      degradedPrinting: false
    },
    advanced: {
      encryptMetadata: true,
      requirePasswordForAccess: true,
      allowPasswordRecovery: false,
      securityHandler: 'standard'
    }
  })
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const certificateInputRef = useRef<HTMLInputElement>(null)
  const { addFile } = useAppStore()
  const { addJob, updateJob } = useJobsStore()

  const analyzeDocumentSecurity = useCallback(async (file: File) => {
    setIsAnalyzing(true)
    
    try {
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      const { loadPDFDocument, analyzeSecurityInfo } = await import('../../lib/pdf')
      
      let analysis: SecurityAnalysis = {
        isEncrypted: false,
        hasUserPassword: false,
        hasOwnerPassword: false,
        encryptionLevel: 'none',
        algorithm: 'none',
        keyLength: 0,
        permissions: {},
        securityHandler: 'none',
        canDecrypt: false,
        metadata: { encrypted: false, accessible: true },
        vulnerabilities: []
      }
      
      try {
        // Try to load without password first
        const doc = await loadPDFDocument(uint8Array)
        const securityInfo = await analyzeSecurityInfo(doc)
        
        analysis = {
          isEncrypted: securityInfo.isEncrypted,
          hasUserPassword: false, // Simplified
          hasOwnerPassword: false, // Simplified
          encryptionLevel: 'none',
          algorithm: 'none',
          keyLength: 0,
          permissions: securityInfo.permissions || {},
          securityHandler: 'standard',
          canDecrypt: !securityInfo.isEncrypted,
          metadata: {
            encrypted: false,
            accessible: true
          },
          vulnerabilities: []
        }
        
        // Analyze vulnerabilities
        const vulnerabilities = []
        
        if (securityInfo.isEncrypted) {
          // Basic security analysis since we only have isEncrypted and permissions
          vulnerabilities.push({
            type: 'encrypted' as const,
            severity: 'medium' as const,
            description: 'Document is encrypted',
            recommendation: 'Verify encryption strength meets your security requirements'
          })
        } else {
          vulnerabilities.push({
            type: 'no-encryption' as const,
            severity: 'medium' as const,
            description: 'Document is not encrypted',
            recommendation: 'Consider adding encryption for sensitive documents'
          })
        }
        
        const permissiveCount = Object.values(securityInfo.permissions || {}).filter(Boolean).length
        if (permissiveCount > 4) {
          vulnerabilities.push({
            type: 'permissive-permissions' as const,
            severity: 'low' as const,
            description: 'Many permissions are enabled',
            recommendation: 'Review and restrict unnecessary permissions'
          })
        }
        
        analysis.vulnerabilities = vulnerabilities
        
      } catch (error) {
        console.error('Security analysis failed:', error)
      }
      
      setSecurityAnalysis(analysis)
      
    } catch (error) {
      console.error('Security analysis failed:', error)
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
    setSecurityAnalysis(null)
    
    await analyzeDocumentSecurity(file)
  }

  const applySecurityPreset = (preset: keyof typeof ENCRYPTION_PRESETS) => {
    const presetConfig = ENCRYPTION_PRESETS[preset]
    setSecurityOptions(prev => ({
      ...prev,
      encryption: {
        ...prev.encryption,
        ...presetConfig
      },
      permissions: presetConfig.permissions
    }))
  }

  const generateSecurePassword = (type: 'user' | 'owner') => {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length))
    }
    
    setSecurityOptions(prev => ({
      ...prev,
      passwords: {
        ...prev.passwords,
        [type]: password
      }
    }))
  }

  const handleSecurityOperation = async () => {
    if (!selectedFile) return
    
    setIsProcessing(true)
    const jobId = Date.now().toString()
    
    try {
      addJob({
        id: jobId,
        type: 'security',
        name: 'Apply security to ' + selectedFile.name,
        status: 'processing',
        fileIds: [selectedFile.name],
        progress: 0,
        startTime: Date.now(),
        cancellable: true
      })

      const arrayBuffer = await selectedFile.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      
      const result = await workerManager.submitJob({
        type: 'security',
        file: uint8Array,
        options: {
          securityOptions,
          onProgress: (progress: number) => {
            updateJob(jobId, { progress })
          }
        }
      })
      
      const outputFileName = generateSecurityFileName()
      const outputFile = new File([result], outputFileName, { type: 'application/pdf' })
      const pdfFile = {
        id: Date.now().toString(),
        name: outputFile.name,
        size: outputFile.size,
        type: outputFile.type,
        lastModified: outputFile.lastModified,
        file: outputFile,
        pageCount: 1, // Would need actual page count
        data: new Uint8Array(await outputFile.arrayBuffer())
      } as any
      addFile(pdfFile)
      
      updateJob(jobId, {
        status: 'completed',
        progress: 100,
        result: {
          operation: securityOptions.operation,
          encrypted: securityOptions.operation === 'encrypt',
          algorithm: securityOptions.encryption.algorithm,
          outputSize: result.byteLength
        }
      })
      
      // Re-analyze the result if it's encryption
      if (securityOptions.operation === 'encrypt') {
        await analyzeDocumentSecurity(outputFile)
      }
      
    } catch (error) {
      console.error('Security operation failed:', error)
      updateJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const addToBatch = () => {
    if (!selectedFile) return

    globalBatchProcessor.addOperation({
      type: 'security',
      files: [selectedFile],
      options: { securityOptions },
      priority: 5,
      onComplete: async (result) => {
        const outputFileName = generateSecurityFileName()
        const outputFile = new File([result], outputFileName, { type: 'application/pdf' })
        const pdfFile = {
          id: Date.now().toString(),
          name: outputFile.name,
          size: outputFile.size,
          type: outputFile.type,
          lastModified: outputFile.lastModified,
          file: outputFile,
          pageCount: 1, // Would need actual page count
          data: new Uint8Array(await outputFile.arrayBuffer())
        } as any
        addFile(pdfFile)
      }
    })
  }

  const generateSecurityFileName = () => {
    const baseName = selectedFile?.name.replace('.pdf', '') || 'document'
    const operation = securityOptions.operation
    return `${baseName}_${operation}.pdf`
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

  const handleCertificateFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSecurityOptions(prev => ({
        ...prev,
        advanced: {
          ...prev.advanced,
          certificateFile: e.target.files![0]
        }
      }))
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-100 dark:bg-red-900 border-red-200 dark:border-red-700'
      case 'medium': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 border-yellow-200 dark:border-yellow-700'
      case 'low': return 'text-blue-600 bg-blue-100 dark:bg-blue-900 border-blue-200 dark:border-blue-700'
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-700'
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">PDF Security & Encryption</h2>
        <div className="flex items-center gap-3">
          {selectedFile && (
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
        <Shield className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-gray-100">
          {selectedFile ? selectedFile.name : 'Select a PDF file for security operations'}
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          {selectedFile 
            ? `${formatFileSize(selectedFile.size)} • Security analysis available`
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

      {/* Security Analysis */}
      {securityAnalysis && (
        <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900 dark:to-blue-900 rounded-lg border border-green-200 dark:border-green-700">
          <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Security Analysis
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 bg-white dark:bg-gray-800 rounded">
              <div className={`text-2xl font-bold ${securityAnalysis.isEncrypted ? 'text-green-600' : 'text-red-600'}`}>
                {securityAnalysis.isEncrypted ? <Lock className="w-8 h-8 mx-auto" /> : <Unlock className="w-8 h-8 mx-auto" />}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {securityAnalysis.isEncrypted ? 'Encrypted' : 'Not Encrypted'}
              </div>
            </div>
            
            <div className="text-center p-3 bg-white dark:bg-gray-800 rounded">
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {securityAnalysis.algorithm}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Algorithm</div>
            </div>
            
            <div className="text-center p-3 bg-white dark:bg-gray-800 rounded">
              <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                {securityAnalysis.keyLength || 0}-bit
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Key Length</div>
            </div>
            
            <div className="text-center p-3 bg-white dark:bg-gray-800 rounded">
              <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                {Object.values(securityAnalysis.permissions).filter(Boolean).length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Permissions</div>
            </div>
          </div>

          {/* Permissions Grid */}
          {securityAnalysis.isEncrypted && Object.keys(securityAnalysis.permissions).length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Current Permissions</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {Object.entries(securityAnalysis.permissions).map(([key, value]) => (
                  <div key={key} className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
                    value ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200' : 
                           'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200'
                  }`}>
                    {value ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                    {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vulnerabilities */}
          {securityAnalysis.vulnerabilities.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Security Issues</h4>
              <div className="space-y-2">
                {securityAnalysis.vulnerabilities.map((vuln, index) => (
                  <div key={index} className={`p-3 rounded border ${getSeverityColor(vuln.severity)}`}>
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{vuln.description}</div>
                        <div className="text-xs mt-1 opacity-80">{vuln.recommendation}</div>
                      </div>
                      <span className="text-xs font-medium px-2 py-1 rounded bg-black/10 dark:bg-white/10">
                        {vuln.severity.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedFile && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Left Column - Operation & Passwords */}
          <div className="space-y-6">
            {/* Operation Selection */}
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <h4 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">Operation</h4>
              
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'encrypt', name: 'Encrypt', icon: Lock, disabled: securityAnalysis?.isEncrypted },
                  { id: 'decrypt', name: 'Decrypt', icon: Unlock, disabled: !securityAnalysis?.isEncrypted },
                  { id: 'modify', name: 'Modify Security', icon: Settings, disabled: !securityAnalysis?.isEncrypted },
                  { id: 'analyze', name: 'Analyze Only', icon: Eye, disabled: false }
                ].map(({ id, name, icon: Icon, disabled }) => (
                  <button
                    key={id}
                    onClick={() => setSecurityOptions(prev => ({ ...prev, operation: id as any }))}
                    disabled={disabled}
                    className={`flex flex-col items-center gap-2 py-3 px-2 rounded transition-colors ${
                      securityOptions.operation === id
                        ? 'bg-blue-600 text-white shadow'
                        : disabled 
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm">{name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Passwords */}
            {(securityOptions.operation === 'encrypt' || securityOptions.operation === 'decrypt' || securityOptions.operation === 'modify') && (
              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  Passwords
                </h4>
                
                <div className="space-y-4">
                  {securityOptions.operation === 'decrypt' || securityOptions.operation === 'modify' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Current Password
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type={showPasswords.current ? 'text' : 'password'}
                            value={securityOptions.passwords.current}
                            onChange={(e) => setSecurityOptions(prev => ({
                              ...prev,
                              passwords: { ...prev.passwords, current: e.target.value }
                            }))}
                            placeholder="Enter current password"
                            className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  
                  {securityOptions.operation === 'encrypt' || securityOptions.operation === 'modify' ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          User Password (required to open document)
                        </label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <input
                              type={showPasswords.user ? 'text' : 'password'}
                              value={securityOptions.passwords.user}
                              onChange={(e) => setSecurityOptions(prev => ({
                                ...prev,
                                passwords: { ...prev.passwords, user: e.target.value }
                              }))}
                              placeholder="Enter user password"
                              className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPasswords(prev => ({ ...prev, user: !prev.user }))}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              {showPasswords.user ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <button
                            onClick={() => generateSecurePassword('user')}
                            className="px-3 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                          >
                            Generate
                          </button>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Owner Password (for permissions control)
                        </label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <input
                              type={showPasswords.owner ? 'text' : 'password'}
                              value={securityOptions.passwords.owner}
                              onChange={(e) => setSecurityOptions(prev => ({
                                ...prev,
                                passwords: { ...prev.passwords, owner: e.target.value }
                              }))}
                              placeholder="Enter owner password"
                              className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPasswords(prev => ({ ...prev, owner: !prev.owner }))}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              {showPasswords.owner ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <button
                            onClick={() => generateSecurePassword('owner')}
                            className="px-3 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                          >
                            Generate
                          </button>
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          {/* Middle Column - Encryption Settings */}
          {(securityOptions.operation === 'encrypt' || securityOptions.operation === 'modify') && (
            <div className="space-y-6">
              {/* Encryption Level */}
              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">Encryption Settings</h4>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Security Preset
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { id: 'basic', name: 'Basic Security', desc: 'RC4-128, allows printing and forms' },
                        { id: 'secure', name: 'Secure Protection', desc: 'AES-128, restricted permissions' },
                        { id: 'maximum', name: 'Maximum Security', desc: 'AES-256, all restrictions' }
                      ].map(({ id, name, desc }) => (
                        <button
                          key={id}
                          onClick={() => applySecurityPreset(id as keyof typeof ENCRYPTION_PRESETS)}
                          className="text-left p-3 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <div className="font-medium text-gray-900 dark:text-gray-100">{name}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">{desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Algorithm
                    </label>
                    <select
                      value={securityOptions.encryption.algorithm}
                      onChange={(e) => setSecurityOptions(prev => ({
                        ...prev,
                        encryption: { ...prev.encryption, algorithm: e.target.value as any }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="RC4-40">RC4 40-bit (Legacy)</option>
                      <option value="RC4-128">RC4 128-bit (Standard)</option>
                      <option value="AES-128">AES 128-bit (Recommended)</option>
                      <option value="AES-256">AES 256-bit (Maximum)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Advanced Options */}
              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">Advanced Settings</h4>
                
                <div className="space-y-3">
                  {[
                    { key: 'encryptMetadata', label: 'Encrypt document metadata' },
                    { key: 'requirePasswordForAccess', label: 'Require password for any access' },
                    { key: 'allowPasswordRecovery', label: 'Allow password recovery' }
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={securityOptions.advanced[key as keyof typeof securityOptions.advanced] as boolean}
                        onChange={(e) => setSecurityOptions(prev => ({
                          ...prev,
                          advanced: { ...prev.advanced, [key]: e.target.checked }
                        }))}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                    </label>
                  ))}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Security Handler
                    </label>
                    <select
                      value={securityOptions.advanced.securityHandler}
                      onChange={(e) => setSecurityOptions(prev => ({
                        ...prev,
                        advanced: { ...prev.advanced, securityHandler: e.target.value as any }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="standard">Standard Security</option>
                      <option value="public-key">Public Key Security</option>
                    </select>
                  </div>
                  
                  {securityOptions.advanced.securityHandler === 'public-key' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Certificate File
                      </label>
                      <input
                        ref={certificateInputRef}
                        type="file"
                        accept=".cer,.crt,.p12,.pfx"
                        onChange={handleCertificateFile}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Right Column - Permissions */}
          {(securityOptions.operation === 'encrypt' || securityOptions.operation === 'modify') && (
            <div className="space-y-6">
              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">Document Permissions</h4>
                
                <div className="space-y-3">
                  {[
                    { key: 'print', label: 'Allow printing', icon: FileText },
                    { key: 'printHighRes', label: 'Allow high-resolution printing', icon: FileText },
                    { key: 'modify', label: 'Allow document modification', icon: Settings },
                    { key: 'copy', label: 'Allow content copying', icon: FileText },
                    { key: 'modifyAnnotations', label: 'Allow annotation changes', icon: Settings },
                    { key: 'fillForms', label: 'Allow form filling', icon: FileText },
                    { key: 'extractForAccessibility', label: 'Allow text extraction for accessibility', icon: Eye },
                    { key: 'assemble', label: 'Allow document assembly', icon: Settings },
                    { key: 'degradedPrinting', label: 'Allow degraded printing', icon: FileText }
                  ].map(({ key, label, icon: Icon }) => (
                    <label key={key} className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded">
                      <input
                        type="checkbox"
                        checked={securityOptions.permissions[key as keyof typeof securityOptions.permissions]}
                        onChange={(e) => setSecurityOptions(prev => ({
                          ...prev,
                          permissions: { ...prev.permissions, [key]: e.target.checked }
                        }))}
                        className="rounded"
                      />
                      <Icon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                    </label>
                  ))}
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSecurityOptions(prev => ({
                        ...prev,
                        permissions: Object.fromEntries(
                          Object.keys(prev.permissions).map(key => [key, true])
                        ) as any
                      }))}
                      className="flex-1 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                    >
                      Allow All
                    </button>
                    <button
                      onClick={() => setSecurityOptions(prev => ({
                        ...prev,
                        permissions: Object.fromEntries(
                          Object.keys(prev.permissions).map(key => [key, false])
                        ) as any
                      }))}
                      className="flex-1 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                    >
                      Restrict All
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {selectedFile && securityOptions.operation !== 'analyze' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={handleSecurityOperation}
            disabled={isProcessing}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : securityOptions.operation === 'encrypt' ? (
              <Lock className="w-5 h-5" />
            ) : securityOptions.operation === 'decrypt' ? (
              <Unlock className="w-5 h-5" />
            ) : (
              <Settings className="w-5 h-5" />
            )}
            {isProcessing ? 'Processing...' : 
             securityOptions.operation === 'encrypt' ? 'Encrypt Document' :
             securityOptions.operation === 'decrypt' ? 'Decrypt Document' :
             'Modify Security'}
          </button>
          
          <button
            onClick={addToBatch}
            disabled={isProcessing}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Zap className="w-5 h-5" />
            Add to Batch Queue
          </button>
        </div>
      )}

      {/* Loading State */}
      {isAnalyzing && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-blue-800 dark:text-blue-200">
              Analyzing document security settings...
            </span>
          </div>
        </div>
      )}

      {!selectedFile && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <span className="text-yellow-800 dark:text-yellow-200">
              Select a PDF file to encrypt, decrypt, or analyze security settings.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default PDFSecurityTool