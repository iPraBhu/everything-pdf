import React from 'react'
import { AlertCircle } from 'lucide-react'

const ToolStub: React.FC = () => {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Advanced PDF Tool</h2>
      </div>
      
      <div className="p-8 bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg text-center">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-600" />
        <h3 className="text-lg font-medium text-yellow-800 dark:text-yellow-200 mb-2">
          Tool Under Development
        </h3>
        <p className="text-yellow-700 dark:text-yellow-300">
          This advanced PDF tool is currently being optimized for better performance. Please check back soon!
        </p>
      </div>
    </div>
  )
}

export default ToolStub