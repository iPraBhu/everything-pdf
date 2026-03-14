import { useCallback, useMemo, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  CloudUpload,
  Eye,
  FileText,
  Layers,
  Lock,
  ScanLine,
  Sparkles,
  SplitSquareHorizontal,
  Wrench,
  Zap
} from 'lucide-react'
import { useAppStore } from '../state/store'
import { useToast } from '../components/Toast'
import { BrandMark } from '../components/BrandMark'
import { fileToUint8Array, isValidPDFFile, formatFileSize } from '../lib/fileUtils'
import { loadPDFDocument, getPDFInfo, getPageThumbnail } from '../lib/pdf'
import type { PDFFile } from '../state/store'

const spotlightTools = [
  {
    title: 'Merge Stack',
    detail: 'Assemble multi-file packets with visual order control.',
    route: '/tools?tool=merge',
    accent: 'from-[#d45d42] to-[#f1996b]'
  },
  {
    title: 'Searchable Scan',
    detail: 'Run OCR and add a text layer without leaving the browser.',
    route: '/tools?tool=searchable-pdf',
    accent: 'from-[#0f9f9b] to-[#65d8c4]'
  },
  {
    title: 'Layout Lab',
    detail: 'Posterize, n-up, crop, reorder, and build print-ready sets.',
    route: '/tools?tool=nup',
    accent: 'from-[#4831a5] to-[#7a68df]'
  }
]

const trustNotes = [
  {
    icon: Lock,
    title: 'No uploads, no account walls',
    description: 'Every document stays on-device, inside the browser session.'
  },
  {
    icon: Zap,
    title: 'Worker-powered processing',
    description: 'Heavy PDF tasks run off the main thread so the interface stays responsive.'
  },
  {
    icon: Wrench,
    title: 'Workbench, not wizard',
    description: 'Use direct tools for organization, OCR, metadata, forms, and layout.'
  }
]

export function Home() {
  const navigate = useNavigate()
  const { addFile, files } = useAppStore()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsLoading(true)

    for (const file of acceptedFiles) {
      if (!isValidPDFFile(file)) {
        toast.error('Invalid file type', `${file.name} is not a valid PDF file`)
        continue
      }

      try {
        const data = await fileToUint8Array(file)
        const doc = await loadPDFDocument(data)
        const info = await getPDFInfo(doc)

        let thumbnail: string | undefined
        try {
          const firstPage = await doc.getPage(1)
          thumbnail = await getPageThumbnail(firstPage)
        } catch (error) {
          console.warn('Failed to generate thumbnail:', error)
        }

        const pdfFile: PDFFile = {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          size: file.size,
          pageCount: info.pageCount,
          data,
          lastModified: file.lastModified,
          thumbnail
        }

        addFile(pdfFile)
        toast.success('File loaded', `${file.name} (${info.pageCount} pages)`)
      } catch (error) {
        console.error('Failed to load PDF:', error)
        toast.error(
          'Failed to load PDF',
          error instanceof Error ? error.message : 'Unknown error occurred'
        )
      }
    }

    setIsLoading(false)
  }, [addFile, toast])

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: true,
    noClick: true
  })

  const stats = useMemo(() => {
    const totalPages = files.reduce((sum, file) => sum + file.pageCount, 0)
    const totalSize = files.reduce((sum, file) => sum + file.size, 0)

    return [
      { label: 'Loaded files', value: String(files.length).padStart(2, '0') },
      { label: 'Pages in session', value: String(totalPages || 0).padStart(2, '0') },
      { label: 'Local payload', value: files.length > 0 ? formatFileSize(totalSize) : '0 B' }
    ]
  }, [files])

  return (
    <div className="page-shell">
      <section className="hero-panel animate-rise mb-6 p-5 sm:p-8">
        <div className="grid gap-8 xl:grid-cols-[1.25fr_0.85fr]">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[18px] border border-[color:var(--line)] bg-white/65 shadow-sm dark:bg-white/5">
                <BrandMark className="h-9 w-9" />
              </div>
              <div className="section-label">
                <Sparkles className="h-3.5 w-3.5" />
                Editorial PDF workbench
              </div>
            </div>

            <div className="max-w-3xl space-y-4">
              <h1 className="text-balance text-4xl leading-none text-[color:var(--ink)] sm:text-5xl lg:text-7xl">
                Free Everything PDF is a browser-native studio that feels like a desk, not a dashboard.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-[color:var(--ink-muted)] sm:text-lg">
                Load files, arrange pages, run OCR, export layouts, and keep everything local. The interface is built for focused document work on mobile and desktop instead of checkbox-style SaaS chrome.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button onClick={open} className="btn btn-primary px-5 py-3">
                <CloudUpload className="h-4 w-4" />
                Load PDFs
              </button>
              <button onClick={() => navigate('/tools')} className="btn btn-secondary px-5 py-3">
                Explore tools
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="feature-grid">
              {stats.map((item) => (
                <div key={item.label} className="card p-4">
                  <div className="text-3xl font-semibold text-[color:var(--ink)]">{item.value}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.24em] text-[color:var(--ink-muted)]">
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
            {spotlightTools.map((tool, index) => (
              <button
                key={tool.title}
                onClick={() => navigate(tool.route)}
                className="tool-tile min-h-[150px]"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <div className={`mb-4 inline-flex rounded-full bg-gradient-to-r ${tool.accent} px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-white`}>
                  Tool Lane
                </div>
                <h2 className="mb-2 text-2xl text-[color:var(--ink)]">{tool.title}</h2>
                <p className="max-w-sm text-sm leading-6 text-[color:var(--ink-muted)]">{tool.detail}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mb-6 grid gap-6 lg:grid-cols-[1.12fr_0.88fr]">
        <div
          {...getRootProps()}
          className={`card-strong relative overflow-hidden p-5 sm:p-7 ${
            isDragActive ? 'ring-4 ring-[rgba(212,93,66,0.18)]' : ''
          } ${isLoading ? 'pointer-events-none opacity-70' : ''}`}
        >
          <input {...getInputProps()} />
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <div className="section-label mb-2">Drop Deck</div>
              <h2 className="text-3xl text-[color:var(--ink)]">Bring in your pages</h2>
            </div>
            <div className="hidden h-14 w-14 items-center justify-center rounded-[18px] border border-[color:var(--line)] bg-white/60 md:flex dark:bg-white/5">
              <FileText className="h-6 w-6" />
            </div>
          </div>

          <div className="rounded-[26px] border border-dashed border-[color:var(--line-strong)] bg-white/45 p-6 text-center dark:bg-white/5 sm:p-10">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--accent),var(--accent-2))] text-white shadow-lg">
              <CloudUpload className="h-7 w-7" />
            </div>
            <p className="text-lg font-semibold text-[color:var(--ink)]">
              {isLoading ? 'Loading PDF files…' : isDragActive ? 'Release files to add them to the workbench' : 'Drop files here or tap to browse'}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[color:var(--ink-muted)]">
              Built for touch and keyboard. Start with a single PDF or a stack of scans and jump straight into merge, split, OCR, and cleanup flows.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <span className="pill">PDF only</span>
              <span className="pill">Multiple files</span>
              <span className="pill">Zero uploads</span>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          {trustNotes.map((note) => {
            const Icon = note.icon
            return (
              <div key={note.title} className="card p-5">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[16px] bg-[rgba(212,93,66,0.12)] text-[color:var(--accent)]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-xl text-[color:var(--ink)]">{note.title}</h3>
                <p className="text-sm leading-6 text-[color:var(--ink-muted)]">{note.description}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="mb-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <div className="section-label mb-2">Quick starts</div>
            <h2 className="text-3xl text-[color:var(--ink)]">Jump into a focused flow</h2>
          </div>
          <button onClick={() => navigate('/tools')} className="btn btn-ghost hidden sm:inline-flex">
            All tools
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { name: 'Open & Review', detail: 'View pages, zoom, and inspect file structure.', route: '/tools?tool=view', icon: Eye },
            { name: 'Merge Packet', detail: 'Assemble multiple PDFs into one delivery set.', route: '/tools?tool=merge', icon: Layers },
            { name: 'Split Logic', detail: 'Break documents into ranges or smart sections.', route: '/tools?tool=smart-split', icon: SplitSquareHorizontal },
            { name: 'OCR Pass', detail: 'Extract text and make scans searchable.', route: '/tools?tool=ocr', icon: ScanLine }
          ].map((item) => {
            const Icon = item.icon
            return (
              <button key={item.name} onClick={() => navigate(item.route)} className="tool-tile">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[16px] border border-[color:var(--line)] bg-white/65 dark:bg-white/5">
                  <Icon className="h-5 w-5 text-[color:var(--accent)]" />
                </div>
                <h3 className="mb-2 text-xl text-[color:var(--ink)]">{item.name}</h3>
                <p className="text-sm leading-6 text-[color:var(--ink-muted)]">{item.detail}</p>
              </button>
            )
          })}
        </div>
      </section>

      {files.length > 0 && (
        <section className="card-strong p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <div className="section-label mb-2">Current session</div>
              <h2 className="text-3xl text-[color:var(--ink)]">Loaded documents</h2>
            </div>
            <button onClick={() => navigate('/editor')} className="btn btn-secondary">
              Open editor
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {files.slice(0, 6).map((file) => (
              <button
                key={file.id}
                onClick={() => navigate('/editor')}
                className="card flex items-center gap-4 p-4 text-left transition hover:-translate-y-1"
              >
                {file.thumbnail ? (
                  <img
                    src={file.thumbnail}
                    alt={file.name}
                    className="h-20 w-16 rounded-[16px] border border-[color:var(--line)] object-cover shadow-sm"
                  />
                ) : (
                  <div className="flex h-20 w-16 items-center justify-center rounded-[16px] border border-[color:var(--line)] bg-white/70 dark:bg-white/5">
                    <FileText className="h-6 w-6 text-[color:var(--accent)]" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-semibold text-[color:var(--ink)]">{file.name}</div>
                  <div className="mt-1 text-sm text-[color:var(--ink-muted)]">
                    {file.pageCount} pages
                  </div>
                  <div className="mt-3 inline-flex rounded-full border border-[color:var(--line)] px-3 py-1 text-xs uppercase tracking-[0.22em] text-[color:var(--ink-muted)]">
                    {formatFileSize(file.size)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
