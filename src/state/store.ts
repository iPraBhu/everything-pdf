import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export interface PDFFile {
  id: string
  name: string
  size: number
  pageCount: number
  data: Uint8Array
  lastModified: number
  thumbnail?: string
}

export interface PDFPage {
  fileId: string
  pageIndex: number
  rotation: number
  selected: boolean
}

export interface AppState {
  // Files
  files: PDFFile[]
  activeFileId: string | null
  
  // UI State
  theme: 'light' | 'dark' | 'system'
  sidebarCollapsed: boolean
  currentTool: string | null
  
  // Viewer State
  viewerZoom: number
  viewerFitMode: 'width' | 'page' | 'custom'
  viewerPage: number
  
  // Selection
  selectedPages: PDFPage[]
  selectionMode: 'single' | 'range' | 'multiple'
  
  // Search
  searchQuery: string
  searchResults: Array<{ fileId: string; pageIndex: number; matches: number }>
  
  // Actions
  addFile: (file: PDFFile) => void
  removeFile: (fileId: string) => void
  setActiveFile: (fileId: string | null) => void
  updateFile: (fileId: string, updates: Partial<PDFFile>) => void
  
  // UI Actions
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setCurrentTool: (tool: string | null) => void
  
  // Viewer Actions
  setViewerZoom: (zoom: number) => void
  setViewerFitMode: (mode: 'width' | 'page' | 'custom') => void
  setViewerPage: (page: number) => void
  
  // Selection Actions
  selectPage: (page: PDFPage) => void
  selectPages: (pages: PDFPage[]) => void
  selectPageRange: (startPage: PDFPage, endPage: PDFPage) => void
  clearSelection: () => void
  setSelectionMode: (mode: 'single' | 'range' | 'multiple') => void
  
  // Search Actions
  setSearchQuery: (query: string) => void
  setSearchResults: (results: Array<{ fileId: string; pageIndex: number; matches: number }>) => void
}

export const useAppStore = create<AppState>()(
  devtools(
    (set, get) => ({
      // Initial state
      files: [],
      activeFileId: null,
      theme: 'system',
      sidebarCollapsed: false,
      currentTool: null,
      viewerZoom: 1,
      viewerFitMode: 'width',
      viewerPage: 1,
      selectedPages: [],
      selectionMode: 'single',
      searchQuery: '',
      searchResults: [],
      
      // File actions
      addFile: (file) => set((state) => ({
        files: [...state.files, file],
        activeFileId: state.activeFileId || file.id
      })),
      
      removeFile: (fileId) => set((state) => ({
        files: state.files.filter(f => f.id !== fileId),
        activeFileId: state.activeFileId === fileId ? 
          (state.files.find(f => f.id !== fileId)?.id || null) : 
          state.activeFileId,
        selectedPages: state.selectedPages.filter(p => p.fileId !== fileId)
      })),
      
      setActiveFile: (fileId) => set({ activeFileId: fileId }),
      
      updateFile: (fileId, updates) => set((state) => ({
        files: state.files.map(f => 
          f.id === fileId ? { ...f, ...updates } : f
        )
      })),
      
      // UI actions
      setTheme: (theme) => set({ theme }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setCurrentTool: (tool) => set({ currentTool: tool }),
      
      // Viewer actions
      setViewerZoom: (zoom) => set({ viewerZoom: zoom }),
      setViewerFitMode: (mode) => set({ viewerFitMode: mode }),
      setViewerPage: (page) => set({ viewerPage: page }),
      
      // Selection actions
      selectPage: (page) => {
        const state = get()
        if (state.selectionMode === 'single') {
          set({ selectedPages: [page] })
        } else if (state.selectionMode === 'multiple') {
          const existing = state.selectedPages.find(
            p => p.fileId === page.fileId && p.pageIndex === page.pageIndex
          )
          if (existing) {
            set({ 
              selectedPages: state.selectedPages.filter(
                p => !(p.fileId === page.fileId && p.pageIndex === page.pageIndex)
              )
            })
          } else {
            set({ selectedPages: [...state.selectedPages, page] })
          }
        }
      },
      
      selectPages: (pages) => set({ selectedPages: pages }),
      
      selectPageRange: (startPage, endPage) => {
        const state = get()
        const file = state.files.find(f => f.id === startPage.fileId)
        if (!file) return
        
        const start = Math.min(startPage.pageIndex, endPage.pageIndex)
        const end = Math.max(startPage.pageIndex, endPage.pageIndex)
        
        const pages: PDFPage[] = []
        for (let i = start; i <= end; i++) {
          pages.push({
            fileId: startPage.fileId,
            pageIndex: i,
            rotation: 0,
            selected: true
          })
        }
        
        set({ selectedPages: pages })
      },
      
      clearSelection: () => set({ selectedPages: [] }),
      setSelectionMode: (mode) => set({ selectionMode: mode }),
      
      // Search actions
      setSearchQuery: (query) => set({ searchQuery: query }),
      setSearchResults: (results) => set({ searchResults: results })
    }),
    { name: 'app-store' }
  )
)