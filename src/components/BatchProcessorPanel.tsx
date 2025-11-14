import React, { useState, useEffect } from 'react'
import { Play, Pause, Square, Trash2, Clock, CheckCircle, XCircle, AlertCircle, BarChart3 } from 'lucide-react'
import { globalBatchProcessor } from '../lib/batchProcessor'

interface BatchOperationStatus {
  id: string
  type: string
  files: File[]
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  error?: string
}

export const BatchProcessorPanel: React.FC = () => {
  const [operations, setOperations] = useState<BatchOperationStatus[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [globalProgress, setGlobalProgress] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    // Update global progress periodically
    const interval = setInterval(() => {
      const progress = globalBatchProcessor.getProgress()
      const status = globalBatchProcessor.getStatus()
      setGlobalProgress(progress)
      setIsProcessing(status.processing > 0 || status.queued > 0)
    }, 500)

    return () => clearInterval(interval)
  }, [])

  const handlePause = () => {
    globalBatchProcessor.pause()
    setIsProcessing(false)
  }

  const handleResume = () => {
    globalBatchProcessor.start()
    setIsProcessing(true)
  }

  const handleClear = () => {
    globalBatchProcessor.clear()
    setOperations([])
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'queued':
        return <Clock className="w-4 h-4 text-yellow-500" />
      case 'processing':
        return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />
    }
  }

  const formatDuration = (startTime?: number, endTime?: number) => {
    if (!startTime) return '-'
    const duration = (endTime || Date.now()) - startTime
    return `${Math.round(duration / 1000)}s`
  }

  const status = globalBatchProcessor.getStatus()
  const hasOperations = operations.length > 0

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Minimized View */}
      {!isOpen && (hasOperations || isProcessing) && (
        <div
          onClick={() => setIsOpen(true)}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 cursor-pointer hover:shadow-xl transition-shadow"
        >
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Batch Processing
              </span>
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span>{status.completed + status.failed}/{status.total} tasks</span>
                <div className="w-16 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${globalProgress}%` }}
                  />
                </div>
              </div>
            </div>
            {isProcessing && (
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            )}
          </div>
        </div>
      )}

      {/* Expanded View */}
      {isOpen && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl w-96 max-h-96 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Batch Processing
                </h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <Square className="w-4 h-4" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                <span>Overall Progress</span>
                <span>{globalProgress}%</span>
              </div>
              <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300"
                  style={{ width: `${globalProgress}%` }}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center justify-between mt-3 text-sm">
              <div className="flex items-center gap-4">
                <span className="text-gray-600 dark:text-gray-400">
                  Queued: <span className="font-medium text-yellow-600">{status.queued}</span>
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  Processing: <span className="font-medium text-blue-600">{status.processing}</span>
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  Complete: <span className="font-medium text-green-600">{status.completed}</span>
                </span>
                {status.failed > 0 && (
                  <span className="text-gray-600 dark:text-gray-400">
                    Failed: <span className="font-medium text-red-600">{status.failed}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
            <div className="flex items-center gap-2">
              {isProcessing ? (
                <button
                  onClick={handlePause}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors"
                >
                  <Pause className="w-3 h-3" />
                  Pause
                </button>
              ) : (
                <button
                  onClick={handleResume}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  <Play className="w-3 h-3" />
                  Resume
                </button>
              )}
              <button
                onClick={handleClear}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            </div>
          </div>

          {/* Operations List */}
          <div className="max-h-60 overflow-y-auto">
            {operations.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                No batch operations in queue
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {operations.map((operation) => (
                  <div
                    key={operation.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-750 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(operation.status)}
                      <div>
                        <div className="font-medium text-sm text-gray-900 dark:text-gray-100 capitalize">
                          {operation.type} ({operation.files.length} file{operation.files.length !== 1 ? 's' : ''})
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {operation.status === 'processing' && (
                            <>Progress: {Math.round(operation.progress)}%</>
                          )}
                          {operation.status === 'completed' && (
                            <>Completed</>
                          )}
                          {operation.status === 'failed' && (
                            <>Failed: {operation.error}</>
                          )}
                          {operation.status === 'pending' && (
                            <>Waiting to process</>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {operation.status === 'processing' && (
                      <div className="w-12 h-1 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 transition-all duration-300"
                          style={{ width: `${operation.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default BatchProcessorPanel