import React from 'react'
import { Combine, AlertCircle } from 'lucide-react'

const MergeTool: React.FC = () => {
  return (
    <div className="h-full flex flex-col items-center justify-center">
      <div className="text-center max-w-md">
        <Combine className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Merge PDF Tool</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          This tool is currently under development. The PDF processing pipeline is being optimized.
        </p>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-blue-400 mr-2 flex-shrink-0" />
            <p className="text-sm text-blue-700 dark:text-blue-300">
              This feature will allow you to combine multiple PDF files into a single document with page reordering and range selection.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MergeTool