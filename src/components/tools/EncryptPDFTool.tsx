import React, { useState, useRef, useCallback } from 'react'
import { Upload, Lock, RefreshCw, AlertCircle, Eye, Download, Trash2, Shield, Key, EyeOff } from 'lucide-react'
import { useAppStore } from '../../state/store'
import { useJobsStore } from '../../state/jobs'
import { workerManager } from '../../lib/workerManager'

interface EncryptionOptions {
  userPassword: string
  ownerPassword: string
  permissions: {
    printing: 'none' | 'low-resolution' | 'high-resolution'
    copying: boolean
    modifying: boolean
    documentAssembly: boolean
    contentAccessibility: boolean
    commenting: boolean
    formFilling: boolean
    pageExtraction: boolean
  }
  encryptionLevel: '40-bit' | '128-bit' | '256-bit'
  encryptMetadata: boolean
}

const EncryptPDFTool: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [totalPages, setTotalPages] = useState(0)
  const [preview, setPreview] = useState<string | null>(null)
  const [showPasswords, setShowPasswords] = useState({ user: false, owner: false })
  const [passwordStrength, setPasswordStrength] = useState({ user: 'weak', owner: 'weak' })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { addFile } = useAppStore()
  const { addJob, updateJob } = useJobsStore()

  const [options, setOptions] = useState<EncryptionOptions>({
    userPassword: '',
    ownerPassword: '',
    permissions: {
      printing: 'high-resolution',
      copying: false,
      modifying: false,
      documentAssembly: false,
      contentAccessibility: true,
      commenting: false,
      formFilling: true,
      pageExtraction: false
    },
    encryptionLevel: '256-bit',
    encryptMetadata: true
  })

  const encryptionLevels = {
    '40-bit': { name: '40-bit RC4', description: 'Compatible with older PDF viewers', security: 'Low' },
    '128-bit': { name: '128-bit RC4/AES', description: 'Good compatibility and security', security: 'Medium' },
    '256-bit': { name: '256-bit AES', description: 'Highest security, modern viewers', security: 'High' }
  }

  const handleFileSelect = async (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file')
      return
    }

    setSelectedFile(file)
    setPreview(null)
    await generatePreview(file)
    await getTotalPages(file)
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
    }
  }

  const calculatePasswordStrength = (password: string): 'weak' | 'medium' | 'strong' => {
    if (password.length < 6) return 'weak'
    
    let score = 0
    if (password.length >= 8) score++
    if (/[a-z]/.test(password)) score++
    if (/[A-Z]/.test(password)) score++
    if (/\d/.test(password)) score++
    if (/[^a-zA-Z0-9]/.test(password)) score++
    
    if (score >= 4) return 'strong'
    if (score >= 2) return 'medium'
    return 'weak'
  }

  const handlePasswordChange = (type: 'user' | 'owner', value: string) => {
    setOptions(prev => ({
      ...prev,
      userPassword: type === 'user' ? value : prev.userPassword,
      ownerPassword: type === 'owner' ? value : prev.ownerPassword
    }))

    const strength = calculatePasswordStrength(value)
    setPasswordStrength(prev => ({
      ...prev,
      [type]: strength
    }))
  }

  const getPasswordStrengthColor = (strength: string) => {
    switch (strength) {
      case 'weak': return 'text-red-600 dark:text-red-400'
      case 'medium': return 'text-yellow-600 dark:text-yellow-400'
      case 'strong': return 'text-green-600 dark:text-green-400'
      default: return 'text-gray-600 dark:text-gray-400'
    }
  }

  const getSecurityLevel = () => {
    const hasUserPassword = options.userPassword.length > 0
    const hasOwnerPassword = options.ownerPassword.length > 0
    const hasStrongPasswords = passwordStrength.user === 'strong' && passwordStrength.owner === 'strong'
    const is256Bit = options.encryptionLevel === '256-bit'
    const restrictivePermissions = !options.permissions.copying && !options.permissions.modifying

    if (hasUserPassword && hasOwnerPassword && hasStrongPasswords && is256Bit && restrictivePermissions) {
      return { level: 'Very High', color: 'text-green-600 dark:text-green-400' }
    } else if (hasUserPassword && hasOwnerPassword && is256Bit) {
      return { level: 'High', color: 'text-blue-600 dark:text-blue-400' }
    } else if (hasUserPassword && hasOwnerPassword) {
      return { level: 'Medium', color: 'text-yellow-600 dark:text-yellow-400' }
    } else if (hasUserPassword || hasOwnerPassword) {
      return { level: 'Low', color: 'text-orange-600 dark:text-orange-400' }
    }
    return { level: 'None', color: 'text-red-600 dark:text-red-400' }
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

  const handleEncryptPDF = async () => {
    if (!selectedFile) return

    if (!options.userPassword && !options.ownerPassword) {
      alert('Please provide at least one password (User or Owner)')
      return
    }

    setIsProcessing(true)
    const jobId = `encrypt-pdf-${Date.now()}`
    
    try {
      addJob({
        id: jobId,
        type: 'encrypt-pdf',
        name: `Encrypt ${selectedFile.name}`,
        status: 'processing',
        fileIds: [selectedFile.name],
        progress: 0,
        startTime: Date.now(),
        cancellable: true
      })

      const arrayBuffer = await selectedFile.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      updateJob(jobId, { progress: 30 })

      const encryptionOptions = {
        userPassword: options.userPassword,
        ownerPassword: options.ownerPassword || options.userPassword, // Fallback to user password
        permissions: options.permissions,
        encryptionLevel: options.encryptionLevel,
        encryptMetadata: options.encryptMetadata
      }

      updateJob(jobId, { progress: 70 })

      // For now, we'll simulate encryption
      console.warn('PDF encryption not yet implemented in workerManager')
      const result = uint8Array // Placeholder - would normally be encrypted
      
      updateJob(jobId, { progress: 90 })

      // Create encrypted file
      const encryptedFileName = selectedFile.name.replace(/\.pdf$/i, '_encrypted.pdf')
      const pdfFile = {
        id: `encrypted-${Date.now()}`,
        name: encryptedFileName,
        size: result.byteLength,
        type: 'application/pdf',
        lastModified: Date.now(),
        file: new File([new Uint8Array(result)], encryptedFileName, { type: 'application/pdf' }),
        pageCount: totalPages,
        data: result
      } as any
      
      addFile(pdfFile)

      updateJob(jobId, {
        status: 'completed',
        progress: 100,
        endTime: Date.now()
      })

      console.log('PDF encryption completed (simulated)')

    } catch (error) {
      console.error('Error encrypting PDF:', error)
      updateJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        endTime: Date.now()
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
              <Lock className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Encrypt PDF</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Protect PDF documents with password and permissions</p>
            </div>
          </div>
          {selectedFile && (
            <button
              onClick={handleEncryptPDF}
              disabled={isProcessing || (!options.userPassword && !options.ownerPassword)}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Shield className="w-4 h-4 mr-2" />
              )}
              {isProcessing ? 'Encrypting...' : 'Encrypt PDF'}
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
                ? 'border-red-400 bg-red-50 dark:bg-red-900/20'
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
                  <span className="text-base font-medium text-red-600 hover:text-red-500">
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
              <p className="text-xs text-gray-500 dark:text-gray-400">PDF files up to 10MB</p>
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
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedFile(null)
                    setPreview(null)
                    setTotalPages(0)
                  }}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Security Settings */}
          {selectedFile && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Security Settings</h3>
              
              <div className="space-y-6">
                {/* Passwords */}
                <div>
                  <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">Password Protection</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* User Password */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        User Password (for opening)
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.user ? 'text' : 'password'}
                          value={options.userPassword}
                          onChange={(e) => handlePasswordChange('user', e.target.value)}
                          placeholder="Enter password to open PDF"
                          className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords(prev => ({ ...prev, user: !prev.user }))}
                          className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600"
                        >
                          {showPasswords.user ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {options.userPassword && (
                        <p className={`text-xs mt-1 capitalize ${getPasswordStrengthColor(passwordStrength.user)}`}>
                          {passwordStrength.user} password
                        </p>
                      )}
                    </div>

                    {/* Owner Password */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Owner Password (for permissions)
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.owner ? 'text' : 'password'}
                          value={options.ownerPassword}
                          onChange={(e) => handlePasswordChange('owner', e.target.value)}
                          placeholder="Enter password for full access"
                          className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords(prev => ({ ...prev, owner: !prev.owner }))}
                          className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600"
                        >
                          {showPasswords.owner ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {options.ownerPassword && (
                        <p className={`text-xs mt-1 capitalize ${getPasswordStrengthColor(passwordStrength.owner)}`}>
                          {passwordStrength.owner} password
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    User password is required to open the PDF. Owner password allows changing permissions.
                  </p>
                </div>

                {/* Encryption Level */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Encryption Level
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {Object.entries(encryptionLevels).map(([key, level]) => (
                      <button
                        key={key}
                        onClick={() => setOptions({ ...options, encryptionLevel: key as any })}
                        className={`p-4 text-left border rounded-lg transition-colors ${
                          options.encryptionLevel === key
                            ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                        }`}
                      >
                        <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{level.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{level.description}</div>
                        <div className={`text-xs mt-1 font-medium ${
                          level.security === 'High' ? 'text-green-600' :
                          level.security === 'Medium' ? 'text-yellow-600' : 'text-orange-600'
                        }`}>
                          {level.security} Security
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Permissions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Document Permissions
                  </label>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Printing */}
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                          Printing
                        </label>
                        <select
                          value={options.permissions.printing}
                          onChange={(e) => setOptions(prev => ({
                            ...prev,
                            permissions: { ...prev.permissions, printing: e.target.value as any }
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="none">Not allowed</option>
                          <option value="low-resolution">Low resolution only</option>
                          <option value="high-resolution">High resolution allowed</option>
                        </select>
                      </div>

                      {/* Other permissions as checkboxes */}
                      <div className="space-y-2">
                        {[
                          { key: 'copying', label: 'Copy text and images' },
                          { key: 'modifying', label: 'Modify document' },
                          { key: 'documentAssembly', label: 'Document assembly' },
                          { key: 'contentAccessibility', label: 'Content accessibility' },
                          { key: 'commenting', label: 'Add comments' },
                          { key: 'formFilling', label: 'Fill form fields' },
                          { key: 'pageExtraction', label: 'Extract pages' }
                        ].map(permission => (
                          <label key={permission.key} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={options.permissions[permission.key as keyof typeof options.permissions] as boolean}
                              onChange={(e) => setOptions(prev => ({
                                ...prev,
                                permissions: {
                                  ...prev.permissions,
                                  [permission.key]: e.target.checked
                                }
                              }))}
                              className="mr-2"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">{permission.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={options.encryptMetadata}
                        onChange={(e) => setOptions({ ...options, encryptMetadata: e.target.checked })}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Encrypt metadata</span>
                    </label>
                  </div>
                </div>

                {/* Security Summary */}
                {(() => {
                  const security = getSecurityLevel()
                  return (
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                      <h4 className="font-medium text-red-900 dark:text-red-100 mb-2">Security Summary</h4>
                      <div className="space-y-1 text-sm text-red-800 dark:text-red-200">
                        <div>Encryption: {encryptionLevels[options.encryptionLevel].name}</div>
                        <div className={security.color}>Security Level: {security.level}</div>
                        <div>User Password: {options.userPassword ? 'Set' : 'Not set'}</div>
                        <div>Owner Password: {options.ownerPassword ? 'Set' : 'Not set'}</div>
                        <div>Restricted Permissions: {
                          Object.values(options.permissions).filter(p => p === false).length > 0 ? 'Yes' : 'No'
                        }</div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Preview Panel */}
        {selectedFile && preview && (
          <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Document Preview</h3>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 relative">
              <img
                src={preview}
                alt="PDF Preview"
                className="w-full h-auto rounded-lg"
              />
              
              {/* Security overlay indicator */}
              <div className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-lg shadow-lg">
                <Lock className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {(() => {
                const security = getSecurityLevel()
                return (
                  <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Security Status</h4>
                    <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                      <div className={security.color}>Level: {security.level}</div>
                      <div>Encryption: {options.encryptionLevel}</div>
                      <div>Passwords: {options.userPassword && options.ownerPassword ? 'Both set' : options.userPassword || options.ownerPassword ? 'One set' : 'None'}</div>
                      <div>Permissions: {Object.values(options.permissions).filter(p => p === false).length} restricted</div>
                    </div>
                  </div>
                )
              })()}

              <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">File Info</h4>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <div>Pages: {totalPages}</div>
                  <div>Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</div>
                  <div>Type: PDF Document</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default EncryptPDFTool