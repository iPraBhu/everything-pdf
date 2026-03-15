import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Crop,
  Droplets,
  Edit,
  Eye,
  FileDown,
  FileText,
  FileX,
  Grid3x3,
  Hash,
  Image,
  Layers,
  Layout,
  Lock,
  Merge,
  MessageSquare,
  Minimize,
  Palette,
  PenTool,
  RefreshCw,
  RotateCw,
  Scan,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  SplitSquareHorizontal,
  Type,
  Unlock,
  Wrench,
  Zap
} from 'lucide-react'
import ViewPDFTool from '../components/tools/ViewPDFTool'
import EnhancedMergeTool from '../components/tools/EnhancedMergeTool'
import SplitTool from '../components/tools/SplitTool'
import SmartSplitterTool from '../components/tools/SmartSplitterTool'
import RotatePagesTool from '../components/tools/RotatePagesTool'
import CropPagesTool from '../components/tools/CropPagesTool'
import ReorderPagesTool from '../components/tools/ReorderPagesTool'
import ExtractPagesTool from '../components/tools/ExtractPagesTool'
import AdvancedPageExtractionTool from '../components/tools/AdvancedPageExtractionTool'
import ConvertToPDFTool from '../components/tools/ConvertToPDFTool'
import ConvertFromPDFTool from '../components/tools/ConvertFromPDFTool'
import PDFCompressionTool from '../components/tools/PDFCompressionTool'
import GrayscaleTool from '../components/tools/GrayscaleTool'
import PosterizeTool from '../components/tools/PosterizeTool'
import DocumentMetadataEditor from '../components/tools/DocumentMetadataEditor'
import FillFormsTool from '../components/tools/FillFormsTool'
import ProfessionalPageNumbersTool from '../components/tools/ProfessionalPageNumbersTool'
import HeadersFootersTool from '../components/tools/HeadersFootersTool'
import AdvancedWatermarkTool from '../components/tools/AdvancedWatermarkTool'
import NUpLayoutTool from '../components/tools/NUpLayoutTool'
import InterleaveTool from '../components/tools/InterleaveTool'
import OCRTool from '../components/tools/OCRTool'
import SearchablePDFTool from '../components/tools/SearchablePDFTool'
import TextExtractionTool from '../components/tools/TextExtractionTool'

interface Tool {
  id: string
  name: string
  description: string
  icon: any
  category: string
  component?: any
  comingSoon?: boolean
}

const tools: Tool[] = [
  { id: 'view', name: 'View PDF', description: 'Open, inspect, zoom, and search page content.', icon: Eye, category: 'viewer', component: ViewPDFTool },
  { id: 'merge', name: 'Merge PDFs', description: 'Combine multiple PDFs into a single packet.', icon: Merge, category: 'viewer', component: EnhancedMergeTool },
  { id: 'split', name: 'Split PDF', description: 'Break files into ranges or separate outputs.', icon: SplitSquareHorizontal, category: 'viewer', component: SplitTool },
  { id: 'smart-split', name: 'Smart Split', description: 'Split by size, bookmark, or text-driven sections.', icon: SplitSquareHorizontal, category: 'viewer', component: SmartSplitterTool },
  { id: 'reorder', name: 'Reorder Pages', description: 'Resequence pages visually before export.', icon: Layers, category: 'viewer', component: ReorderPagesTool },
  { id: 'extract', name: 'Extract Pages', description: 'Pull selected pages into a new document.', icon: FileDown, category: 'viewer', component: ExtractPagesTool },
  { id: 'advanced-extract', name: 'Advanced Extract', description: 'Target pages by criteria and repeated patterns.', icon: FileDown, category: 'viewer', component: AdvancedPageExtractionTool },
  { id: 'rotate', name: 'Rotate Pages', description: 'Apply page rotation in focused or bulk passes.', icon: RotateCw, category: 'edit', component: RotatePagesTool },
  { id: 'crop', name: 'Crop Pages', description: 'Trim page areas with preview-driven controls.', icon: Crop, category: 'edit', component: CropPagesTool },
  { id: 'page-numbers', name: 'Page Numbers', description: 'Stamp ordered numbering with templates and offsets.', icon: Hash, category: 'edit', component: ProfessionalPageNumbersTool },
  { id: 'headers-footers', name: 'Headers & Footers', description: 'Add repeated top and bottom metadata bands.', icon: Type, category: 'edit', component: HeadersFootersTool },
  { id: 'watermark', name: 'Watermark', description: 'Overlay text or imagery across selected pages.', icon: Droplets, category: 'edit', component: AdvancedWatermarkTool },
  { id: 'nup', name: 'N-Up Layout', description: 'Arrange many source pages onto each output sheet.', icon: Grid3x3, category: 'layout', component: NUpLayoutTool },
  { id: 'interleave', name: 'Interleave', description: 'Alternate pages from multiple documents.', icon: Layers, category: 'layout', component: InterleaveTool },
  { id: 'posterize', name: 'Posterize', description: 'Tile oversized artwork across printable sheets.', icon: Grid3x3, category: 'layout', component: PosterizeTool },
  { id: 'convert-to-pdf', name: 'Convert to PDF', description: 'Build PDFs from images, text, and DOCX input.', icon: Image, category: 'convert', component: ConvertToPDFTool },
  { id: 'convert-from-pdf', name: 'Convert from PDF', description: 'Export pages to PNG, JPEG, or WebP.', icon: Image, category: 'convert', component: ConvertFromPDFTool },
  { id: 'grayscale', name: 'Grayscale', description: 'Rebuild pages with grayscale output and preview.', icon: Palette, category: 'convert', component: GrayscaleTool },
  { id: 'fill-forms', name: 'Fill Forms', description: 'Detect and populate interactive form fields.', icon: PenTool, category: 'forms', component: FillFormsTool },
  { id: 'encrypt', name: 'Encrypt PDF', description: 'Password protection is planned once client-side support is added.', icon: Lock, category: 'security', comingSoon: true },
  { id: 'decrypt', name: 'Decrypt PDF', description: 'Password removal is planned once client-side support is added.', icon: Unlock, category: 'security', comingSoon: true },
  { id: 'security', name: 'Security Permissions', description: 'Advanced permission editing is planned.', icon: ShieldCheck, category: 'security', comingSoon: true },
  { id: 'metadata', name: 'Metadata', description: 'Review and edit document metadata fields.', icon: FileText, category: 'security', component: DocumentMetadataEditor },
  { id: 'compress', name: 'Compress PDF', description: 'Reduce weight and optimize multi-file payloads.', icon: Minimize, category: 'optimize', component: PDFCompressionTool },
  { id: 'ocr', name: 'OCR Text Recognition', description: 'Extract text from scans with confidence overlays.', icon: Scan, category: 'ocr', component: OCRTool },
  { id: 'searchable-pdf', name: 'Searchable PDF', description: 'Add OCR text layers while preserving page appearance.', icon: Search, category: 'ocr', component: SearchablePDFTool },
  { id: 'text-extraction', name: 'Text Extraction', description: 'Extract, filter, and analyze document text.', icon: FileText, category: 'ocr', component: TextExtractionTool },
  { id: 'annotations', name: 'Remove Annotations', description: 'Annotation cleanup is on the roadmap.', icon: MessageSquare, category: 'advanced', comingSoon: true },
  { id: 'remove-blank', name: 'Remove Blank Pages', description: 'Automatic blank-page cleanup is planned.', icon: FileX, category: 'advanced', comingSoon: true },
  { id: 'batch', name: 'Batch Operations', description: 'Queued multi-file pipelines are planned.', icon: Layers, category: 'advanced', comingSoon: true },
  { id: 'project', name: 'Project Snapshots', description: 'Save and restore session state in a later release.', icon: Settings, category: 'advanced', comingSoon: true }
]

const categories = [
  { id: 'all', name: 'All Tools', icon: Wrench, accent: 'Everything in one view', gradient: 'from-[#29323b] to-[#5b6978]' },
  { id: 'viewer', name: 'Viewer & Organize', icon: Eye, accent: 'Inspect and reorder', gradient: 'from-[#b24b30] to-[#d98462]' },
  { id: 'edit', name: 'Edit', icon: Edit, accent: 'Adjust page content', gradient: 'from-[#0d6662] to-[#43b8b2]' },
  { id: 'layout', name: 'Layout', icon: Layout, accent: 'Print and arrangement', gradient: 'from-[#526274] to-[#8799ab]' },
  { id: 'convert', name: 'Convert', icon: RefreshCw, accent: 'Move between formats', gradient: 'from-[#a9781b] to-[#d2aa59]' },
  { id: 'forms', name: 'Forms', icon: FileText, accent: 'Structured document input', gradient: 'from-[#6a5565] to-[#9a7f95]' },
  { id: 'security', name: 'Security', icon: Shield, accent: 'Metadata and safeguards', gradient: 'from-[#8e4b3a] to-[#c17e69]' },
  { id: 'optimize', name: 'Optimize', icon: Zap, accent: 'Reduce and streamline', gradient: 'from-[#245f49] to-[#56a37f]' },
  { id: 'ocr', name: 'OCR', icon: Scan, accent: 'Extract readable text', gradient: 'from-[#245c73] to-[#6aa8c0]' },
  { id: 'advanced', name: 'Advanced', icon: Settings, accent: 'Planned capabilities', gradient: 'from-[#50545b] to-[#8a9198]' }
]

export function Tools() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'all')
  const [searchQuery, setSearchQuery] = useState('')
  const selectedTool = searchParams.get('tool')

  const filteredTools = useMemo(() => tools.filter((tool) => {
    const matchesCategory = selectedCategory === 'all' || tool.category === selectedCategory
    const query = searchQuery.trim().toLowerCase()
    const matchesSearch = query.length === 0
      || tool.name.toLowerCase().includes(query)
      || tool.description.toLowerCase().includes(query)
    return matchesCategory && matchesSearch
  }), [searchQuery, selectedCategory])

  const activeCategory = categories.find((category) => category.id === selectedCategory) || categories[0]
  const implementedCount = tools.filter((tool) => tool.component && !tool.comingSoon).length
  const plannedCount = tools.filter((tool) => tool.comingSoon || !tool.component).length

  const handleToolClick = (tool: Tool) => {
    if (tool.comingSoon || !tool.component) return
    setSearchParams({ tool: tool.id })
  }

  const handleBackToTools = () => {
    setSearchParams({})
  }

  if (selectedTool) {
    const tool = tools.find((entry) => entry.id === selectedTool)
    if (tool?.component) {
      const ToolComponent = tool.component
      return (
        <div className="page-shell">
          <div className="card-strong overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[color:var(--line)] px-5 py-5 sm:px-7">
              <div>
                <div className="section-label mb-2">Workbench mode</div>
                <h1 className="text-3xl text-[color:var(--ink)]">{tool.name}</h1>
              </div>
              <button onClick={handleBackToTools} className="btn btn-secondary">
                <ArrowLeft className="h-4 w-4" />
                Back to tool atlas
              </button>
            </div>
            <div className="max-h-[calc(100vh-12rem)] overflow-auto">
              <ToolComponent />
            </div>
          </div>
        </div>
      )
    }
  }

  return (
    <div className="page-shell">
      <section className="hero-panel mb-6 p-5 sm:p-8">
        <div className="grid gap-8 xl:grid-cols-[1.18fr_0.82fr]">
          <div className="space-y-5">
            <div className="section-label">Tool atlas</div>
            <div className="max-w-3xl">
              <h1 className="text-balance text-4xl leading-none text-[color:var(--ink)] sm:text-5xl lg:text-6xl">
                Find the right PDF tool quickly, with clearer categories and fewer distractions.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[color:var(--ink-muted)] sm:text-lg">
                Browse by task, search by name, and open implemented tools directly. Planned items stay visible, but they are clearly separated from what works today.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="card p-4">
                <div className="text-3xl font-semibold text-[color:var(--ink)]">{implementedCount}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.24em] text-[color:var(--ink-muted)]">Live tools</div>
              </div>
              <div className="card p-4">
                <div className="text-3xl font-semibold text-[color:var(--ink)]">{plannedCount}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.24em] text-[color:var(--ink-muted)]">Planned lanes</div>
              </div>
              <div className="card p-4">
                <div className="text-3xl font-semibold text-[color:var(--ink)]">{filteredTools.length}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.24em] text-[color:var(--ink-muted)]">Current view</div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <div className="card p-5">
                <div className={`mb-4 inline-flex rounded-full bg-gradient-to-r ${activeCategory.gradient} px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-white`}>
                  Active category
                </div>
                <h2 className="mb-2 text-2xl text-[color:var(--ink)]">{activeCategory.name}</h2>
                <p className="text-sm leading-6 text-[color:var(--ink-muted)]">{activeCategory.accent}</p>
            </div>
            <div className="card p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[color:var(--ink)]">
                <Search className="h-4 w-4 text-[color:var(--accent)]" />
                Search the workshop
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Try OCR, merge, crop, metadata…"
                className="input"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="space-y-3 xl:sticky xl:top-6 xl:self-start">
          {categories.map((category) => {
            const Icon = category.icon
            const active = selectedCategory === category.id
            const count = category.id === 'all'
              ? tools.length
              : tools.filter((tool) => tool.category === category.id).length

            return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`tool-tile w-full ${active ? 'border-[color:var(--accent-2)] ring-2 ring-[rgba(13,102,98,0.12)]' : ''}`}
                  >
                <div className="flex items-start gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-[16px] bg-gradient-to-r ${category.gradient} text-white shadow-lg`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-lg text-[color:var(--ink)]">{category.name}</h2>
                      <span className="pill shrink-0">{count}</span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-[color:var(--ink-muted)]">{category.accent}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </aside>

        <div className="space-y-4">
          <div className="card-strong p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="section-label mb-2">Current lane</div>
                <h2 className="text-3xl text-[color:var(--ink)]">{activeCategory.name}</h2>
              </div>
              <div className="pill">{filteredTools.filter((tool) => tool.component && !tool.comingSoon).length} ready now</div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {filteredTools.map((tool) => {
                const Icon = tool.icon
                const category = categories.find((entry) => entry.id === tool.category) || categories[0]
                const isAvailable = !!tool.component && !tool.comingSoon

                return (
                  <button
                    key={tool.id}
                    onClick={() => handleToolClick(tool)}
                    disabled={!isAvailable}
                    className={`tool-tile ${!isAvailable ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                  >
                    <div className="mb-5 flex items-start justify-between gap-3">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-[16px] bg-gradient-to-r ${category.gradient} text-white shadow-lg`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] ${
                        isAvailable
                          ? 'bg-[rgba(13,102,98,0.12)] text-[color:var(--accent-2)]'
                          : 'bg-[color:var(--surface-muted)] text-[color:var(--ink-muted)]'
                      }`}>
                        {isAvailable ? 'Ready' : 'Planned'}
                      </span>
                    </div>

                    <h3 className="mb-2 text-2xl text-[color:var(--ink)]">{tool.name}</h3>
                    <p className="text-sm leading-6 text-[color:var(--ink-muted)]">{tool.description}</p>

                    <div className="mt-5 flex items-center justify-between text-xs uppercase tracking-[0.22em] text-[color:var(--ink-muted)]">
                      <span>{category.name}</span>
                      <span>{isAvailable ? 'Open' : 'Roadmap'}</span>
                    </div>
                  </button>
                )
              })}
            </div>

            {filteredTools.length === 0 && (
              <div className="rounded-[24px] border border-dashed border-[color:var(--line-strong)] p-10 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(212,93,66,0.12)] text-[color:var(--accent)]">
                  <Search className="h-6 w-6" />
                </div>
                <h3 className="text-2xl text-[color:var(--ink)]">No matches in this lane</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[color:var(--ink-muted)]">
                  Try another category or use a broader term. The atlas only shows tools whose name or description matches your query.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
