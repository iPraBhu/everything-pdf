import React from 'react'
import { Wrench, AlertCircle } from 'lucide-react'

const DisabledToolStub: React.FC = () => {
  return (
    <div className="p-6">
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <div className="mb-6">
            <Wrench className="w-16 h-16 mx-auto text-yellow-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Tool Temporarily Disabled
          </h2>
          <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <p className="text-yellow-800 dark:text-yellow-200">
                This tool is currently being optimized for better performance and reliability.
              </p>
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            We're working to improve this feature and it will be available again soon. 
            Please check back in a future update or use the other available tools in the meantime.
          </p>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Thank you for your patience as we enhance your PDF experience.
          </div>
        </div>
      </div>
    </div>
  )
}

export default DisabledToolStub