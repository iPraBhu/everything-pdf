import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

export interface ToolPreset {
  id: string
  name: string
  toolType: string
  settings: Record<string, unknown>
  description?: string
  isDefault?: boolean
  createdAt: number
  lastUsed: number
}

export interface PresetsState {
  presets: ToolPreset[]
  
  // Actions
  addPreset: (preset: Omit<ToolPreset, 'id' | 'createdAt' | 'lastUsed'>) => void
  updatePreset: (presetId: string, updates: Partial<ToolPreset>) => void
  removePreset: (presetId: string) => void
  usePreset: (presetId: string) => ToolPreset | undefined
  
  // Getters
  getPresetsByTool: (toolType: string) => ToolPreset[]
  getDefaultPreset: (toolType: string) => ToolPreset | undefined
  getMostUsedPresets: (limit?: number) => ToolPreset[]
}

const generateId = () => Math.random().toString(36).substr(2, 9)

export const usePresetsStore = create<PresetsState>()(
  devtools(
    persist(
      (set, get) => ({
        presets: [],
        
        addPreset: (preset) => {
          const newPreset: ToolPreset = {
            ...preset,
            id: generateId(),
            createdAt: Date.now(),
            lastUsed: Date.now()
          }
          set((state) => ({
            presets: [...state.presets, newPreset]
          }))
        },
        
        updatePreset: (presetId, updates) => set((state) => ({
          presets: state.presets.map(preset => 
            preset.id === presetId ? { ...preset, ...updates } : preset
          )
        })),
        
        removePreset: (presetId) => set((state) => ({
          presets: state.presets.filter(preset => preset.id !== presetId)
        })),
        
        usePreset: (presetId) => {
          const preset = get().presets.find(p => p.id === presetId)
          if (preset) {
            get().updatePreset(presetId, { lastUsed: Date.now() })
            return preset
          }
          return undefined
        },
        
        getPresetsByTool: (toolType) => 
          get().presets.filter(preset => preset.toolType === toolType)
            .sort((a, b) => b.lastUsed - a.lastUsed),
        
        getDefaultPreset: (toolType) => 
          get().presets.find(preset => 
            preset.toolType === toolType && preset.isDefault
          ),
        
        getMostUsedPresets: (limit = 5) => 
          get().presets
            .sort((a, b) => b.lastUsed - a.lastUsed)
            .slice(0, limit)
      }),
      {
        name: 'presets-store',
        partialize: (state) => ({ presets: state.presets })
      }
    ),
    { name: 'presets-store' }
  )
)