import React, { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { PanelLeft, PanelRight, FileText, Upload, Settings, LayoutPanelTop, Layers3 } from 'lucide-react'
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

  useEffect(() => {
    if (window.innerWidth < 1024) {
      setLeftPanelOpen(false)
      setRightPanelOpen(false)
    }
  }, [])

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
            pageCount: 1,
            data,
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

  const selectedFile = files.find((file: PDFFile) => file.id === activeFileId)

  const handlePageSelectionChange = useCallback((selectedPages: number[]) => {
    console.log('Selected pages:', selectedPages)
  }, [])

  const handlePagesChange = useCallback((pages: number[]) => {
    console.log('Pages order changed:', pages)
  }, [])

  const selectedFileAsFile = React.useMemo(() => {
    if (!selectedFile) return undefined

    const blob = new Blob([selectedFile.data.buffer as ArrayBuffer], { type: 'application/pdf' })
    return new File([blob], selectedFile.name, {
      type: 'application/pdf',
      lastModified: selectedFile.lastModified
    })
  }, [selectedFile])

  return (
    <div className="page-shell pt-4">
      <div className="editor-surface flex min-h-[calc(100vh-10rem)] overflow-hidden">
        {leftPanelOpen && (
          <aside className="fixed inset-x-4 bottom-4 top-24 z-20 flex flex-col rounded-[28px] border bg-[color:var(--bg-elevated)] shadow-2xl backdrop-blur-xl lg:static lg:inset-auto lg:z-0 lg:w-80 lg:rounded-none lg:border-0 lg:border-r lg:border-[color:var(--line)] lg:bg-transparent lg:shadow-none lg:backdrop-blur-0">
            <div className="flex border-b border-[color:var(--line)]">
              <button
                onClick={() => setActiveLeftTab('files')}
                className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 ${
                  activeLeftTab === 'files'
                    ? 'border-[color:var(--accent)] text-[color:var(--ink)]'
                    : 'border-transparent text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]'
                }`}
              >
                <LayoutPanelTop className="mr-2 inline-block h-4 w-4" />
                Files
              </button>
              <button
                onClick={() => setActiveLeftTab('pages')}
                className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 ${
                  activeLeftTab === 'pages'
                    ? 'border-[color:var(--accent)] text-[color:var(--ink)]'
                    : 'border-transparent text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]'
                }`}
              >
                <Layers3 className="mr-2 inline-block h-4 w-4" />
                Pages
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {activeLeftTab === 'files' ? (
                <div className="p-4">
                  <div
                    {...getRootProps()}
                    className={`rounded-[24px] border-2 border-dashed p-6 text-center transition-colors ${
                      isDragActive
                        ? 'border-[color:var(--accent)] bg-white/70'
                        : 'border-[color:var(--line-strong)] bg-white/35 hover:border-[color:var(--accent)] dark:bg-white/5'
                    }`}
                  >
                    <input {...getInputProps()} />
                    <Upload className="mx-auto mb-2 h-8 w-8 text-[color:var(--ink-muted)]" />
                    <p className="text-sm text-[color:var(--ink-muted)]">
                      {isDragActive ? 'Drop PDF files here…' : 'Drop PDF files or click to browse'}
                    </p>
                  </div>

                  {files.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <h3 className="text-sm font-semibold text-[color:var(--ink)]">Files ({files.length})</h3>
                      {files.map((file: PDFFile) => (
                        <button
                          key={file.id}
                          onClick={() => setActiveFile(file.id)}
                          className={`w-full rounded-[20px] border p-3 text-left transition-colors ${
                            activeFileId === file.id
                              ? 'border-[color:var(--accent)] bg-white/75'
                              : 'border-[color:var(--line)] bg-white/40 hover:border-[color:var(--accent)] dark:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center">
                            <FileText className="mr-2 h-4 w-4 text-[color:var(--accent)]" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-[color:var(--ink)]">{file.name}</p>
                              <p className="text-xs text-[color:var(--ink-muted)]">
                                {(file.size / 1024 / 1024).toFixed(1)} MB • {file.pageCount} pages
                              </p>
                            </div>
                          </div>
                        </button>
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
          </aside>
        )}

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--line)] px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLeftPanelOpen((value) => !value)}
                className="btn btn-secondary h-10 w-10 rounded-full p-0"
                title="Toggle left panel"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
              <div>
                <div className="section-label mb-1">Editor</div>
                <div className="text-sm text-[color:var(--ink-muted)]">
                  {selectedFile ? selectedFile.name : 'No file selected'}
                </div>
              </div>
            </div>

            <button
              onClick={() => setRightPanelOpen((value) => !value)}
              className="btn btn-secondary h-10 w-10 rounded-full p-0"
              title="Toggle right panel"
            >
              <PanelRight className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1">
            <PDFViewer
              file={selectedFileAsFile}
              className="h-full"
              onPageChange={(page) => console.log('Page changed to:', page)}
              onZoomChange={(zoom) => console.log('Zoom changed to:', zoom)}
            />
          </div>
        </section>

        {rightPanelOpen && (
          <aside className="fixed inset-x-4 bottom-4 top-24 z-20 flex flex-col rounded-[28px] border bg-[color:var(--bg-elevated)] shadow-2xl backdrop-blur-xl lg:static lg:inset-auto lg:z-0 lg:w-80 lg:rounded-none lg:border-0 lg:border-l lg:border-[color:var(--line)] lg:bg-transparent lg:shadow-none lg:backdrop-blur-0">
            <div className="flex border-b border-[color:var(--line)]">
              <button
                onClick={() => setActiveRightTab('properties')}
                className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 ${
                  activeRightTab === 'properties'
                    ? 'border-[color:var(--accent)] text-[color:var(--ink)]'
                    : 'border-transparent text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]'
                }`}
              >
                <Settings className="mr-2 inline-block h-4 w-4" />
                Properties
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {selectedFile ? (
                <div className="space-y-6">
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-[color:var(--ink)]">File Information</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-[color:var(--ink-muted)]">Name</span>
                        <span className="truncate text-right font-mono text-xs text-[color:var(--ink)]">{selectedFile.name}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-[color:var(--ink-muted)]">Size</span>
                        <span className="text-[color:var(--ink)]">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-[color:var(--ink-muted)]">Pages</span>
                        <span className="text-[color:var(--ink)]">{selectedFile.pageCount}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-[color:var(--ink-muted)]">Modified</span>
                        <span className="text-[color:var(--ink)]">{new Date(selectedFile.lastModified).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-[color:var(--ink)]">Viewer State</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-[color:var(--ink-muted)]">Current Page</span>
                        <span className="text-[color:var(--ink)]">{viewerPage}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-[color:var(--ink-muted)]">Zoom</span>
                        <span className="text-[color:var(--ink)]">{Math.round(viewerZoom * 100)}%</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-[color:var(--ink-muted)]">Fit Mode</span>
                        <span className="text-[color:var(--ink)]">{viewerFitMode}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-[color:var(--ink-muted)]">
                  Select a PDF file to view its properties.
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}

export default Editor
