import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Free PDF Tools',
        short_name: 'PDF Tools',
        description: 'Privacy-first PDF manipulation studio that runs entirely in your browser',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}'],
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
    })
  ],
  worker: {
    format: 'es'
  },
  optimizeDeps: {
    include: ['pdf-lib', 'pdfjs-dist/build/pdf', 'comlink']
  },
  build: {
    rollupOptions: {
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
})