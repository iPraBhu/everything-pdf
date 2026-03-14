import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig(() => {
  const isToolTestMode = process.env.TOOL_TEST_MODE === '1'

  return {
  resolve: {
    alias: isToolTestMode
      ? {
          'virtual:pwa-register': '/src/tool-tests/pwaRegisterStub.ts'
        }
      : undefined
  },
  plugins: [
    react(),
    ...(!isToolTestMode ? [VitePWA({
      devOptions: {
        enabled: true,
      },
      injectRegister: false,
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'favicon-16x16.png',
        'favicon-32x32.png',
        'apple-touch-icon.png',
        'logo.png'
      ],
      manifest: {
        id: '/',
        name: 'Free Everything PDF',
        short_name: 'Free PDF',
        description: 'Free online PDF tools for viewing, editing, OCR, conversion, and document layout entirely in your browser',
        theme_color: '#d45d42',
        background_color: '#fffaf1',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm,webmanifest}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB for large WASM files
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdn-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ]
      }
    })] : [])
  ],
  worker: {
    format: 'es'
  },
  optimizeDeps: {
    include: ['pdf-lib', 'pdfjs-dist/build/pdf', 'comlink', 'tesseract.js']
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        toolTest: 'tool-test-shell.html'
      },
      output: {
        manualChunks: {
          'pdf-libs': ['pdf-lib', 'pdfjs-dist'],
          'ocr': ['tesseract.js'],
          'workers': ['comlink'],
          'ui': ['react', 'react-dom', 'react-router-dom']
        }
      }
    }
  },
  define: {
    global: 'globalThis',
  }
}
})
