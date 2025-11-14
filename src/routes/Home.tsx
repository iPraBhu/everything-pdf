import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import { 
  FileText, 
  Upload, 
  Merge, 
  SplitSquareHorizontal, 
  Minimize,
  Shield,
  Zap,
  Layers
} from 'lucide-react'
import { useAppStore } from '../state/store'
import { useToast } from '../components/Toast'
import { fileToUint8Array, isValidPDFFile, formatFileSize } from '../lib/fileUtils'
import { loadPDFDocument, getPDFInfo, getPageThumbnail } from '../lib/pdf'
import type { PDFFile } from '../state/store'

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
        
        // Generate thumbnail for first page
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: true
  })

  const quickActions = [
    {
      name: 'Open PDF',
      description: 'View and organize PDF files',
      icon: FileText,
      action: () => getRootProps().onClick?.({} as any),
      color: 'bg-blue-500'
    },
    {
      name: 'Merge PDFs',
      description: 'Combine multiple PDFs into one',
      icon: Merge,
      action: () => navigate('/tools?tool=merge'),
      color: 'bg-green-500'
    },
    {
      name: 'Split PDF',
      description: 'Split PDF into multiple files',
      icon: SplitSquareHorizontal,
      action: () => navigate('/tools?tool=split'),
      color: 'bg-orange-500'
    },
    {
      name: 'Compress PDF',
      description: 'Reduce PDF file size',
      icon: Minimize,
      action: () => navigate('/tools?tool=compress'),
      color: 'bg-purple-500'
    }
  ]

  const features = [
    {
      icon: Shield,
      title: 'Complete Privacy',
      description: 'All operations happen locally in your browser. Your files never leave your device.'
    },
    {
      icon: Zap,
      title: 'Works Offline',
      description: 'Once loaded, works completely offline. No internet connection required.'
    },
    {
      icon: Layers,
      title: 'Comprehensive Tools',
      description: 'Everything you need to view, edit, convert, and manipulate PDF files.'
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-900/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Free PDF Tools
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-4">
            Privacy-first PDF manipulation studio
          </p>
          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            All processing happens in your browser. No uploads, no accounts, no servers.
          </p>
        </div>

        {/* File Drop Zone */}
        <div className="mb-16">
          <div
            {...getRootProps()}
            className={`
              relative border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
              ${isDragActive 
                ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20' 
                : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-500'
              }
              ${isLoading ? 'pointer-events-none opacity-50' : ''}
            `}
          >
            <input {...getInputProps()} />
            <Upload className={`mx-auto h-12 w-12 mb-4 ${
              isDragActive ? 'text-primary-500' : 'text-gray-400'
            }`} />
            {isLoading ? (
              <p className="text-lg text-gray-600 dark:text-gray-300">
                Loading PDF files...
              </p>
            ) : (
              <>
                <p className="text-lg text-gray-600 dark:text-gray-300 mb-2">
                  {isDragActive 
                    ? 'Drop PDF files here...' 
                    : 'Drag & drop PDF files here, or click to select'
                  }
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Supports multiple files
                </p>
              </>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.name}
                  onClick={action.action}
                  className="card p-6 hover:shadow-md transition-shadow text-left group"
                >
                  <div className={`w-10 h-10 ${action.color} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    {action.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {action.description}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Features */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            Why Choose Free PDF Tools?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <div key={feature.title} className="text-center">
                  <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Icon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {feature.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent Files */}
        {files.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">
              Recent Files
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {files.slice(0, 6).map((file) => (
                <button
                  key={file.id}
                  onClick={() => navigate('/editor')}
                  className="card p-4 hover:shadow-md transition-shadow text-left group"
                >
                  <div className="flex items-center space-x-3">
                    {file.thumbnail ? (
                      <img 
                        src={file.thumbnail} 
                        alt={file.name}
                        className="w-12 h-16 object-cover rounded border"
                      />
                    ) : (
                      <div className="w-12 h-16 bg-gray-100 dark:bg-gray-800 rounded border flex items-center justify-center">
                        <FileText className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {file.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {file.pageCount} pages • {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}