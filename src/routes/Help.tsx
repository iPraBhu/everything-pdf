import { Shield, Zap, Eye, FileText, Globe, Code, Heart } from 'lucide-react'

export function Help() {
  const features = [
    {
      title: 'View & Organize',
      description: 'Open, view, and organize PDF files with comprehensive page management.',
      items: [
        'Open and view PDF files with zoom and navigation',
        'Merge multiple PDFs into one document',
        'Split PDFs into separate files',
        'Extract specific pages from documents',
        'Reorder, rotate, and duplicate pages',
        'Drag-and-drop page management'
      ]
    },
    {
      title: 'Editing Tools',
      description: 'Professional PDF editing capabilities for text and layout.',
      items: [
        'Add page numbers with customizable format',
        'Insert headers and footers with variables',
        'Add text or image watermarks',
        'Crop pages to specific dimensions',
        'Invert colors and adjust appearance',
        'Manage bookmarks and document outline'
      ]
    },
    {
      title: 'Layout Tools',
      description: 'Advanced layout manipulation for specialized printing needs.',
      items: [
        'N-Up layouts (2-up, 4-up) for efficient printing',
        'Posterize large pages into printable tiles',
        'Interleave pages from multiple documents',
        'Custom spacing and margin controls',
        'Multiple fit modes and scaling options'
      ]
    },
    {
      title: 'Conversion',
      description: 'Convert between PDF and other formats with high fidelity.',
      items: [
        'Convert images (JPG, PNG, WebP, etc.) to PDF',
        'Convert Markdown and text files to PDF',
        'Export PDF pages as images',
        'Convert to grayscale',
        'OCR to add searchable text layer'
      ]
    },
    {
      title: 'Forms & Annotations',
      description: 'Work with interactive forms and document annotations.',
      items: [
        'Fill AcroForm fields with validation',
        'Flatten forms to prevent editing',
        'Basic form designer for simple fields',
        'Remove annotations and comments',
        'Remove blank pages automatically'
      ]
    },
    {
      title: 'Security & Optimization',
      description: 'Protect your documents and optimize file sizes.',
      items: [
        'Password protect PDFs with encryption',
        'Set document permissions',
        'Digital signatures with PKCS#12 support',
        'Compress files to reduce size',
        'Redact sensitive information',
        'Sanitize metadata and scripts',
        'Repair corrupted PDF files'
      ]
    }
  ]

  const privacyPoints = [
    'All PDF processing happens locally in your browser',
    'No files are ever uploaded to any servers',
    'No accounts or registration required',
    'Works completely offline once loaded',
    'No tracking, analytics, or data collection',
    'Open source code available for audit'
  ]

  const limitations = [
    {
      title: 'Large File Handling',
      description: 'Very large PDFs (>100MB) may be slow to process due to browser memory limitations.'
    },
    {
      title: 'Complex Forms',
      description: 'Advanced form features like JavaScript validation are not supported.'
    },
    {
      title: 'Font Embedding',
      description: 'Some text editing operations may not preserve custom fonts perfectly.'
    },
    {
      title: 'OCR Accuracy',
      description: 'OCR quality depends on image resolution and text clarity. Best results with high-DPI scans.'
    },
    {
      title: 'DOCX Export',
      description: 'PDF to DOCX conversion is experimental and may not preserve complex layouts.'
    },
    {
      title: 'Browser Compatibility',
      description: 'Requires a modern browser with WebAssembly support. Some features may be limited on mobile.'
    }
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Help & Documentation
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Everything you need to know about Free PDF Tools
        </p>
      </div>

      {/* Quick Start */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
          <Zap className="h-6 w-6 mr-2 text-primary-600" />
          Quick Start
        </h2>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <ol className="space-y-3 text-gray-800 dark:text-gray-200">
            <li className="flex">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white text-sm font-medium rounded-full flex items-center justify-center mr-3">1</span>
              <span><strong>Open PDF files:</strong> Drag & drop PDF files onto the homepage or use the file picker</span>
            </li>
            <li className="flex">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white text-sm font-medium rounded-full flex items-center justify-center mr-3">2</span>
              <span><strong>Choose a tool:</strong> Navigate to the Tools page and select the operation you want to perform</span>
            </li>
            <li className="flex">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white text-sm font-medium rounded-full flex items-center justify-center mr-3">3</span>
              <span><strong>Configure settings:</strong> Adjust tool-specific options in the properties panel</span>
            </li>
            <li className="flex">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white text-sm font-medium rounded-full flex items-center justify-center mr-3">4</span>
              <span><strong>Process & download:</strong> Run the operation and download your processed file</span>
            </li>
          </ol>
        </div>
      </section>

      {/* Privacy Section */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
          <Shield className="h-6 w-6 mr-2 text-green-600" />
          Your Privacy is Guaranteed
        </h2>
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 mb-6">
          <p className="text-gray-800 dark:text-gray-200 mb-4">
            Free PDF Tools operates entirely in your browser using modern web technologies. This means:
          </p>
          <ul className="space-y-2">
            {privacyPoints.map((point, index) => (
              <li key={index} className="flex items-start">
                <div className="flex-shrink-0 w-5 h-5 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mt-0.5 mr-3">
                  <div className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full"></div>
                </div>
                <span className="text-gray-700 dark:text-gray-300">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Features */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
          <FileText className="h-6 w-6 mr-2 text-primary-600" />
          Features Overview
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          {features.map((feature, index) => (
            <div key={index} className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
                {feature.description}
              </p>
              <ul className="space-y-1">
                {feature.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="text-sm text-gray-700 dark:text-gray-300 flex items-start">
                    <div className="flex-shrink-0 w-1.5 h-1.5 bg-primary-600 rounded-full mt-2 mr-2"></div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Keyboard Shortcuts */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
          <Code className="h-6 w-6 mr-2 text-purple-600" />
          Keyboard Shortcuts
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Navigation</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Next page</span>
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">→</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Previous page</span>
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">←</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">First page</span>
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Home</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Last page</span>
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">End</kbd>
              </div>
            </div>
          </div>
          
          <div className="card p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">View Controls</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Zoom in</span>
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Ctrl +</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Zoom out</span>
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Ctrl -</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Fit width</span>
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Ctrl 1</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Fit page</span>
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Ctrl 0</kbd>
              </div>
            </div>
          </div>
          
          <div className="card p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">General</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Search</span>
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Ctrl F</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Close dialogs</span>
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Esc</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Clear toasts</span>
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Esc</kbd>
              </div>
            </div>
          </div>
          
          <div className="card p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Selection</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Select all</span>
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Ctrl A</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Multiple select</span>
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Ctrl + Click</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Range select</span>
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Shift + Click</kbd>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Limitations */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
          <Eye className="h-6 w-6 mr-2 text-orange-600" />
          Known Limitations
        </h2>
        <div className="space-y-4">
          {limitations.map((limitation, index) => (
            <div key={index} className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <h3 className="font-semibold text-orange-900 dark:text-orange-100 mb-1">
                {limitation.title}
              </h3>
              <p className="text-orange-700 dark:text-orange-200 text-sm">
                {limitation.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Browser Requirements */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
          <Globe className="h-6 w-6 mr-2 text-blue-600" />
          Browser Requirements
        </h2>
        <div className="card p-6">
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Free PDF Tools requires a modern browser with the following features:
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Required</h3>
              <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>• WebAssembly support</li>
                <li>• ES2020+ JavaScript</li>
                <li>• Web Workers</li>
                <li>• File API</li>
                <li>• Canvas 2D API</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Recommended</h3>
              <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>• Chrome 90+ / Firefox 88+ / Safari 14+</li>
                <li>• 4GB+ RAM for large files</li>
                <li>• Desktop for best experience</li>
                <li>• File System Access API (optional)</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Support */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
          <Heart className="h-6 w-6 mr-2 text-red-600" />
          Support & Feedback
        </h2>
        <div className="card p-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Getting Help</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                If you encounter issues or have questions:
              </p>
              <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                <li>• Check this documentation first</li>
                <li>• Try refreshing the page</li>
                <li>• Clear browser cache and data</li>
                <li>• Try a different browser</li>
                <li>• Report bugs on our GitHub repository</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Contributing</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                Free PDF Tools is open source and welcomes contributions:
              </p>
              <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                <li>• Report bugs and request features</li>
                <li>• Improve documentation</li>
                <li>• Submit pull requests</li>
                <li>• Help with translations</li>
                <li>• Share with others</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <div className="text-center border-t border-gray-200 dark:border-gray-700 pt-8">
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Free PDF Tools - Privacy-first PDF manipulation in your browser
        </p>
      </div>
    </div>
  )
}