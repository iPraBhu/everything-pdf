import { useState } from 'react'
import { useAppStore } from '../state/store'
import { useJobsStore } from '../state/jobs'
import { 
  Sidebar, 
  ZoomIn, 
  ZoomOut, 
  Search, 
  Grid,
  List,
  X
} from 'lucide-react'

export function Editor() {
  const { 
    files, 
    activeFileId, 
    sidebarCollapsed, 
    setSidebarCollapsed,
    viewerZoom,
    setViewerZoom,
    viewerFitMode,
    setViewerFitMode,
    viewerPage,
    setViewerPage
  } = useAppStore()
  
  const { jobs, cancelJob } = useJobsStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [thumbnailView, setThumbnailView] = useState<'grid' | 'list'>('grid')

  const activeFile = files.find(f => f.id === activeFileId)
  const runningJobs = jobs.filter(job => job.status === 'running' || job.status === 'pending')

  const handleZoomIn = () => {
    setViewerZoom(Math.min(viewerZoom * 1.2, 5))
    setViewerFitMode('custom')
  }

  const handleZoomOut = () => {
    setViewerZoom(Math.max(viewerZoom / 1.2, 0.1))
    setViewerFitMode('custom')
  }

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-0' : 'w-80'} transition-all duration-300 overflow-hidden flex-shrink-0`}>
        <div className="h-full border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          {/* Files Panel */}
          <div className="h-1/2 border-b border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">Files</h2>
            </div>
            <div className="p-4 space-y-2 overflow-auto h-full">
              {files.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                  No files loaded
                </p>
              ) : (
                files.map((file) => (
                  <div
                    key={file.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      file.id === activeFileId
                        ? 'border-primary-200 bg-primary-50 dark:border-primary-800 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      {file.thumbnail ? (
                        <img 
                          src={file.thumbnail} 
                          alt={file.name}
                          className="w-8 h-10 object-cover rounded border"
                        />
                      ) : (
                        <div className="w-8 h-10 bg-gray-100 dark:bg-gray-700 rounded border"></div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {file.pageCount} pages
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Operations Panel */}
          <div className="h-1/2">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">Operations</h2>
            </div>
            <div className="p-4 space-y-2 overflow-auto h-full">
              {runningJobs.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                  No active operations
                </p>
              ) : (
                runningJobs.map((job) => (
                  <div
                    key={job.id}
                    className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        {job.name}
                      </span>
                      {job.cancellable && (
                        <button
                          onClick={() => cancelJob(job.id)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {job.progress && (
                      <>
                        <div className="progress-bar mb-1">
                          <div 
                            className="progress-fill"
                            style={{ width: `${(job.progress.current / job.progress.total) * 100}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-blue-700 dark:text-blue-300">
                          <span>{job.progress.message}</span>
                          <span>{Math.round((job.progress.current / job.progress.total) * 100)}%</span>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Sidebar Toggle */}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <Sidebar className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>

              {/* Zoom Controls */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleZoomOut}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                </button>
                
                <select
                  value={viewerFitMode}
                  onChange={(e) => setViewerFitMode(e.target.value as 'width' | 'page' | 'custom')}
                  className="text-sm bg-transparent border-none focus:ring-0 text-gray-600 dark:text-gray-400"
                >
                  <option value="width">Fit Width</option>
                  <option value="page">Fit Page</option>
                  <option value="custom">{Math.round(viewerZoom * 100)}%</option>
                </select>
                
                <button
                  onClick={handleZoomIn}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                </button>
              </div>

              {/* Page Navigation */}
              {activeFile && (
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={viewerPage}
                    onChange={(e) => setViewerPage(Math.max(1, Math.min(parseInt(e.target.value) || 1, activeFile.pageCount)))}
                    className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    min="1"
                    max={activeFile.pageCount}
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    / {activeFile.pageCount}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search in document..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-64"
                />
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>

              {/* Thumbnail View Toggle */}
              <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setThumbnailView('grid')}
                  className={`p-1 rounded ${thumbnailView === 'grid' ? 'bg-white dark:bg-gray-600 shadow-sm' : ''}`}
                >
                  <Grid className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                </button>
                <button
                  onClick={() => setThumbnailView('list')}
                  className={`p-1 rounded ${thumbnailView === 'list' ? 'bg-white dark:bg-gray-600 shadow-sm' : ''}`}
                >
                  <List className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Editor Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Viewer */}
          <div className="flex-1 bg-gray-100 dark:bg-gray-900 overflow-auto">
            {activeFile ? (
              <div className="h-full flex items-center justify-center p-8">
                <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8 max-w-4xl w-full">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {activeFile.name}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      {activeFile.pageCount} pages • Page {viewerPage}
                    </p>
                    {activeFile.thumbnail && (
                      <img 
                        src={activeFile.thumbnail}
                        alt={`Page ${viewerPage}`}
                        className="max-w-full h-auto border rounded shadow"
                        style={{ zoom: viewerZoom }}
                      />
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No document selected
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Open a PDF file to start editing
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Properties Panel */}
          <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-auto">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">Properties</h2>
            </div>
            <div className="p-4">
              {activeFile ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Document
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">{activeFile.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Pages
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">{activeFile.pageCount}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      File Size
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {(activeFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Last Modified
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {new Date(activeFile.lastModified).toLocaleString()}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Select a document to view properties
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Thumbnails Bar */}
        {activeFile && (
          <div className="h-32 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 overflow-auto">
            <div className="p-4">
              <div className="flex space-x-2">
                {Array.from({ length: activeFile.pageCount }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setViewerPage(i + 1)}
                    className={`flex-shrink-0 w-16 h-20 border-2 rounded transition-colors ${
                      viewerPage === i + 1
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="w-full h-full bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{i + 1}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}