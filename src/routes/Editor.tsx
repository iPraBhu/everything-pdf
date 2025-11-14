import React, { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Sidebar, PanelLeft, PanelRight, FileText, Upload, Settings } from 'lucide-react'
import { useAppStore, type PDFFile } from '../state/store'
import PDFViewer from '../components/PDFViewer'
import PageOrganizer from '../components/PageOrganizer'

const Editor: React.FC = () => {
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [activeLeftTab, setActiveLeftTab] = useState('files')
  const [activeRightTab, setActiveRightTab] = useState('properties')

  const { 
    files, 
    activeFileId, 
    addFile, 
    setActiveFile, 
    viewerZoom,
    viewerPage,
    viewerFitMode
  } = useAppStore()

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        try {
          const arrayBuffer = await file.arrayBuffer()
          const data = new Uint8Array(arrayBuffer)
          
          const fileData: PDFFile = {
            id: Math.random().toString(36).substring(2, 9),
            name: file.name,
            size: file.size,
            pageCount: 1, // Will be updated when PDF is loaded
            data: data,
            lastModified: file.lastModified
          }
          
          addFile(fileData)
          
          if (!activeFileId) {
            setActiveFile(fileData.id)
          }
        } catch (error) {
          console.error('Error loading PDF file:', error)
        }
      }
    }
  }, [addFile, activeFileId, setActiveFile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: true
  })

  const selectedFile = files.find((f: PDFFile) => f.id === activeFileId)

  const handlePageSelectionChange = useCallback((selectedPages: number[]) => {
    console.log('Selected pages:', selectedPages)
  }, [])

  const handlePagesChange = useCallback((pages: number[]) => {
    console.log('Pages order changed:', pages)
  }, [])

  // Convert PDFFile data to File object for PDF viewer
  const selectedFileAsFile = React.useMemo(() => {
    if (!selectedFile) return undefined
    
    const blob = new Blob([selectedFile.data.buffer as ArrayBuffer], { type: 'application/pdf' })
    const file = new File([blob], selectedFile.name, {
      type: 'application/pdf',
      lastModified: selectedFile.lastModified
    })
    return file
  }, [selectedFile])

  return (
    <div className="flex h-full bg-gray-100 dark:bg-gray-900">
      {/* Left Panel */}
      {leftPanelOpen && (
        <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          {/* Left Panel Header */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveLeftTab('files')}
              className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 ${
                activeLeftTab === 'files'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <FileText className="w-4 h-4 inline-block mr-2" />
              Files
            </button>
            <button
              onClick={() => setActiveLeftTab('pages')}
              className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 ${
                activeLeftTab === 'pages'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Sidebar className="w-4 h-4 inline-block mr-2" />
              Pages
            </button>
          </div>

          {/* Left Panel Content */}
          <div className="flex-1 overflow-auto">
            {activeLeftTab === 'files' ? (
              <div className="p-4">
                {/* File Upload Area */}
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    isDragActive
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {isDragActive ? 'Drop PDF files here...' : 'Drop PDF files or click to browse'}
                  </p>
                </div>

                {/* File List */}
                {files.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Files ({files.length})</h3>
                    {files.map((file: PDFFile) => (
                      <div
                        key={file.id}
                        onClick={() => setActiveFile(file.id)}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          activeFileId === file.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500'
                        }`}
                      >
                        <div className="flex items-center">
                          <FileText className="w-4 h-4 mr-2 text-red-500" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{file.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {(file.size / 1024 / 1024).toFixed(1)} MB • {file.pageCount} pages
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <PageOrganizer 
                file={selectedFileAsFile}
                onSelectionChange={handlePageSelectionChange}
                onPagesChange={handlePagesChange}
              />
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Main Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setLeftPanelOpen(!leftPanelOpen)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Toggle left panel"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {selectedFile ? selectedFile.name : 'No file selected'}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Toggle right panel"
            >
              <PanelRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* PDF Viewer Area */}
        <div className="flex-1">
          <PDFViewer 
            file={selectedFileAsFile}
            className="h-full"
            onPageChange={(page) => console.log('Page changed to:', page)}
            onZoomChange={(zoom) => console.log('Zoom changed to:', zoom)}
          />
        </div>
      </div>

      {/* Right Panel */}
      {rightPanelOpen && (
        <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col">
          {/* Right Panel Header */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveRightTab('properties')}
              className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 ${
                activeRightTab === 'properties'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Settings className="w-4 h-4 inline-block mr-2" />
              Properties
            </button>
          </div>

          {/* Right Panel Content */}
          <div className="flex-1 overflow-auto p-4">
            {selectedFile ? (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">File Information</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Name:</span>
                      <span className="text-gray-900 dark:text-white font-mono text-xs">{selectedFile.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Size:</span>
                      <span className="text-gray-900 dark:text-white">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Pages:</span>
                      <span className="text-gray-900 dark:text-white">{selectedFile.pageCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Modified:</span>
                      <span className="text-gray-900 dark:text-white text-xs">{new Date(selectedFile.lastModified).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Viewer Settings</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Current Page:</span>
                      <span className="text-gray-900 dark:text-white">{viewerPage}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Zoom:</span>
                      <span className="text-gray-900 dark:text-white">{Math.round(viewerZoom * 100)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Fit Mode:</span>
                      <span className="text-gray-900 dark:text-white">{viewerFitMode}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                Select a PDF file to view its properties
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Editor