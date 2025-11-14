import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Navigation } from './components/Navigation'
import { Home } from './routes/Home'
import { Tools } from './routes/Tools'
import Editor from './routes/Editor'
import { Help } from './routes/Help'
import { ThemeProvider } from './components/ThemeProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Toast } from './components/Toast'
import BatchProcessorPanel from './components/BatchProcessorPanel'

function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <Router>
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <Navigation />
            <main className="pb-8">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/tools" element={<Tools />} />
                <Route path="/editor" element={<Editor />} />
                <Route path="/help" element={<Help />} />
              </Routes>
            </main>
            <BatchProcessorPanel />
            <Toast />
          </div>
        </Router>
      </ErrorBoundary>
    </ThemeProvider>
  )
}

export default App