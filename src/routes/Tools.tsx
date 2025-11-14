import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { 
  Eye, 
  Edit, 
  Layout, 
  RefreshCw, 
  FileText, 
  Shield, 
  Zap, 
  Scan,
  Settings,
  Merge,
  SplitSquareHorizontal,
  FileDown,
  RotateCw,
  Crop,
  Hash,
  Type,
  Grid3x3,
  Layers,
  Droplets,
  Palette,
  BookOpen,
  CheckSquare,
  MessageSquare,
  FileX,
  Image,
  Minimize,
  Wrench,
  Lock,
  Unlock,
  ShieldCheck,
  PenTool,
  EyeOff,
  Trash,
  Info,
  ArrowLeft
} from 'lucide-react'
import EnhancedMergeTool from '../components/tools/EnhancedMergeTool'
import SplitTool from '../components/tools/SplitTool'
import WatermarkTool from '../components/tools/WatermarkTool'
import NUpTool from '../components/tools/NUpTool'
import PosterizeTool from '../components/tools/PosterizeTool'
import InterleaveTool from '../components/tools/InterleaveTool'
import SmartSplitterTool from '../components/tools/SmartSplitterTool'
import AdvancedWatermarkTool from '../components/tools/AdvancedWatermarkTool'
import ProfessionalPageNumbersTool from '../components/tools/ProfessionalPageNumbersTool'

import AdvancedPageExtractionTool from '../components/tools/AdvancedPageExtractionTool'
import NUpLayoutTool from '../components/tools/NUpLayoutTool'

import DisabledToolStub from '../components/tools/DisabledToolStub'
import DocumentMetadataEditor from '../components/tools/DocumentMetadataEditor'
import PDFCompressionTool from '../components/tools/PDFCompressionTool'
import PDFSecurityTool from '../components/tools/PDFSecurityTool'
// Temporarily disable these tools until PDF utility methods are implemented
// import PageNumbersTool from '../components/tools/PageNumbersTool'
// import RotationTool from '../components/tools/RotationTool'

interface Tool {
  id: string
  name: string
  description: string
  icon: React.ComponentType<any>
  category: string
  comingSoon?: boolean
  component?: React.ComponentType
}

const tools: Tool[] = [
  // Viewer & Organize
  { id: 'view', name: 'View PDF', description: 'Open and view PDF files', icon: Eye, category: 'viewer' },
  { id: 'merge', name: 'Merge PDFs', description: 'Combine multiple PDF files into one', icon: Merge, category: 'viewer', component: EnhancedMergeTool },
  { id: 'enhanced-merge', name: 'Enhanced Merge', description: 'Advanced merge with compression and optimization', icon: Layers, category: 'viewer', component: EnhancedMergeTool },
  { id: 'split', name: 'Split PDF', description: 'Split PDF into multiple files', icon: SplitSquareHorizontal, category: 'viewer', component: SplitTool },
  { id: 'smart-split', name: 'Smart Splitter', description: 'AI-powered splitting with content analysis', icon: Scan, category: 'viewer', component: SmartSplitterTool },
  { id: 'extract', name: 'Extract Pages', description: 'Extract specific pages', icon: FileDown, category: 'viewer' },
  { id: 'advanced-extract', name: 'Advanced Page Extraction', description: 'Professional page selection with thumbnails and filtering', icon: FileText, category: 'viewer', component: AdvancedPageExtractionTool },
  { id: 'reorder', name: 'Reorder Pages', description: 'Reorder pages', icon: RefreshCw, category: 'viewer' },
  { id: 'rotate', name: 'Rotate Pages', description: 'Rotate pages', icon: RotateCw, category: 'viewer' },

  // Edit
  { id: 'crop', name: 'Crop Pages', description: 'Crop pages', icon: Crop, category: 'edit' },
  { id: 'page-numbers', name: 'Page Numbers', description: 'Add page numbers', icon: Hash, category: 'edit' },
  { id: 'professional-page-numbers', name: 'Professional Page Numbers', description: 'Advanced page numbering with custom formats and positioning', icon: Type, category: 'edit', component: ProfessionalPageNumbersTool },
  { id: 'headers-footers', name: 'Headers & Footers', description: 'Add headers and footers', icon: Type, category: 'edit' },
  { id: 'watermark', name: 'Watermark', description: 'Add watermarks', icon: Droplets, category: 'edit', component: WatermarkTool },
  { id: 'advanced-watermark', name: 'Advanced Watermark', description: 'Professional watermarking with templates and live preview', icon: Palette, category: 'edit', component: AdvancedWatermarkTool },
  { id: 'invert', name: 'Invert Colors', description: 'Invert colors', icon: RefreshCw, category: 'edit' },
  { id: 'background', name: 'Background Color', description: 'Change background color', icon: Palette, category: 'edit' },
  { id: 'text-color', name: 'Text Color', description: 'Change text color', icon: Palette, category: 'edit' },
  { id: 'bookmarks', name: 'Bookmarks', description: 'Manage bookmarks', icon: BookOpen, category: 'edit' },

  // Layout
  { id: 'nup', name: 'N-Up Layout', description: 'Multiple pages per sheet', icon: Grid3x3, category: 'layout', component: NUpTool },
  { id: 'nup-layout', name: 'Professional N-Up Layout', description: 'Advanced N-Up layouts with custom spacing and scaling', icon: Layout, category: 'layout', component: NUpLayoutTool },
  { id: 'poster', name: 'Posterize', description: 'Split large pages into tiles', icon: Layers, category: 'layout', component: PosterizeTool },
  { id: 'interleave', name: 'Interleave Pages', description: 'Mix pages from multiple documents', icon: Layers, category: 'layout', component: InterleaveTool },

  // Convert
  { id: 'convert-to', name: 'Convert to PDF', description: 'Convert images/text to PDF', icon: FileText, category: 'convert' },
  { id: 'convert-from', name: 'PDF to Images', description: 'Convert PDF to images', icon: Image, category: 'convert' },
  { id: 'grayscale', name: 'Grayscale', description: 'Convert to grayscale', icon: Palette, category: 'convert' },

  // Forms
  { id: 'fill-forms', name: 'Fill Forms', description: 'Fill forms', icon: CheckSquare, category: 'forms' },
  { id: 'flatten-forms', name: 'Flatten Forms', description: 'Flatten forms', icon: CheckSquare, category: 'forms' },
  { id: 'form-designer', name: 'Form Designer', description: 'Create forms', icon: Edit, category: 'forms', comingSoon: true },

  // Security
  { id: 'encrypt', name: 'Encrypt PDF', description: 'Password protect', icon: Lock, category: 'security' },
  { id: 'decrypt', name: 'Decrypt PDF', description: 'Remove password', icon: Unlock, category: 'security' },
  { id: 'pdf-security', name: 'PDF Security & Encryption', description: 'Advanced security with permissions and vulnerability analysis', icon: ShieldCheck, category: 'security', component: PDFSecurityTool },
  { id: 'permissions', name: 'Set Permissions', description: 'Set permissions', icon: ShieldCheck, category: 'security' },
  { id: 'sign', name: 'Digital Signature', description: 'Digital signature', icon: PenTool, category: 'security' },
  { id: 'redact', name: 'Redact Text', description: 'Redact sensitive information', icon: EyeOff, category: 'security' },

  // Optimize
  { id: 'compress', name: 'Compress PDF', description: 'Reduce file size', icon: Minimize, category: 'optimize' },
  { id: 'pdf-compression', name: 'Advanced PDF Compression', description: 'Professional compression with quality presets and analysis', icon: Zap, category: 'optimize', component: PDFCompressionTool },
  { id: 'repair', name: 'Repair PDF', description: 'Repair damaged PDFs', icon: Wrench, category: 'optimize' },
  { id: 'sanitize', name: 'Sanitize PDF', description: 'Remove metadata and scripts', icon: Trash, category: 'optimize' },
  { id: 'metadata', name: 'Edit Metadata', description: 'Edit document information', icon: Info, category: 'optimize' },
  { id: 'metadata-editor', name: 'Document Metadata Editor', description: 'Comprehensive metadata editing with templates and custom fields', icon: Settings, category: 'optimize', component: DocumentMetadataEditor },
  { id: 'linearize', name: 'Linearize PDF', description: 'Optimize for web viewing', icon: Zap, category: 'optimize' },

  // OCR
  { id: 'ocr', name: 'OCR Text Layer', description: 'Add searchable text layer', icon: Scan, category: 'ocr' },

  // Advanced
  { id: 'annotations', name: 'Remove Annotations', description: 'Remove annotations', icon: MessageSquare, category: 'advanced' },
  { id: 'remove-blank', name: 'Remove Blank Pages', description: 'Remove blank pages', icon: FileX, category: 'advanced' },
  { id: 'batch', name: 'Batch Operations', description: 'Process multiple files', icon: Layers, category: 'advanced' },
  { id: 'project', name: 'Project Snapshots', description: 'Save/load project state', icon: Settings, category: 'advanced' }
]

const categories = [
  { id: 'viewer', name: 'Viewer & Organize', icon: Eye, color: 'bg-blue-500' },
  { id: 'edit', name: 'Edit', icon: Edit, color: 'bg-green-500' },
  { id: 'layout', name: 'Layout', icon: Layout, color: 'bg-purple-500' },
  { id: 'convert', name: 'Convert', icon: RefreshCw, color: 'bg-orange-500' },
  { id: 'forms', name: 'Forms', icon: FileText, color: 'bg-pink-500' },
  { id: 'security', name: 'Security', icon: Shield, color: 'bg-red-500' },
  { id: 'optimize', name: 'Optimize', icon: Zap, color: 'bg-yellow-500' },
  { id: 'ocr', name: 'OCR', icon: Scan, color: 'bg-indigo-500' },
  { id: 'advanced', name: 'Advanced', icon: Settings, color: 'bg-gray-500' }
]

export function Tools() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'all')
  const [searchQuery, setSearchQuery] = useState('')
  const selectedTool = searchParams.get('tool')

  const filteredTools = tools.filter(tool => {
    const matchesCategory = selectedCategory === 'all' || tool.category === selectedCategory
    const matchesSearch = tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tool.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const handleToolClick = (tool: Tool) => {
    if (tool.comingSoon || !tool.component) {
      return
    }
    // Navigate to the specific tool
    setSearchParams({ tool: tool.id })
  }

  const handleBackToTools = () => {
    setSearchParams({})
  }

  // If a tool is selected and has a component, render it
  if (selectedTool) {
    const tool = tools.find(t => t.id === selectedTool)
    if (tool?.component) {
      const ToolComponent = tool.component
      return (
        <div className="h-full flex flex-col">
          {/* Breadcrumb */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <nav className="flex items-center space-x-2 text-sm">
              <button
                onClick={handleBackToTools}
                className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Tools</span>
              </button>
              <span className="text-gray-400">/</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {tool.name}
              </span>
            </nav>
          </div>
          
          {/* Tool Component */}
          <div className="flex-1 overflow-auto">
            <ToolComponent />
          </div>
        </div>
      )
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          PDF Tools
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Choose from our comprehensive collection of PDF manipulation tools
        </p>
      </div>

      {/* Search and Filter */}
      <div className="mb-8 space-y-4">
        <div className="relative max-w-md">
          <input
            type="text"
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === 'all'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            All Tools
          </button>
          {categories.map((category) => {
            const Icon = category.icon
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{category.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredTools.map((tool) => {
          const Icon = tool.icon
          const category = categories.find(c => c.id === tool.category)
          const isAvailable = !!tool.component && !tool.comingSoon
          
          return (
            <button
              key={tool.id}
              onClick={() => handleToolClick(tool)}
              disabled={!isAvailable}
              className={`card p-6 text-left transition-all hover:shadow-lg group relative ${
                !isAvailable 
                  ? 'opacity-60 cursor-not-allowed' 
                  : 'hover:scale-105 cursor-pointer'
              }`}
            >
              {tool.comingSoon && (
                <div className="absolute top-2 right-2 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-medium rounded">
                  Soon
                </div>
              )}
              
              {!tool.comingSoon && !tool.component && (
                <div className="absolute top-2 right-2 px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-medium rounded">
                  Planned
                </div>
              )}
              
              <div className={`w-12 h-12 ${category?.color} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <Icon className="h-6 w-6 text-white" />
              </div>
              
              <h3 className={`font-semibold text-gray-900 dark:text-white mb-2 transition-colors ${
                isAvailable ? 'group-hover:text-primary-600 dark:group-hover:text-primary-400' : ''
              }`}>
                {tool.name}
              </h3>
              
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {tool.description}
              </p>
              
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                  {tool.category}
                </span>
                <div className="flex items-center space-x-2">
                  {isAvailable && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                      Available
                    </span>
                  )}
                  {isAvailable && (
                    <svg className="h-4 w-4 text-gray-400 group-hover:text-primary-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {filteredTools.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            No tools found
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Try adjusting your search or filter criteria
          </p>
        </div>
      )}
    </div>
  )
}