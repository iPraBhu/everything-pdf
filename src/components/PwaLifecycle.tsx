import { useEffect } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { useToastStore } from './Toast'

let hasRegisteredServiceWorker = false
let hasShownOfflineReadyToast = false
let hasShownUpdateToast = false

export function PwaLifecycle() {
  useEffect(() => {
    if (hasRegisteredServiceWorker) {
      return
    }

    hasRegisteredServiceWorker = true

    const addToast = useToastStore.getState().addToast
    const updateServiceWorker = registerSW({
      immediate: true,
      onOfflineReady() {
        if (hasShownOfflineReadyToast) {
          return
        }

        hasShownOfflineReadyToast = true
        addToast({
          type: 'success',
          title: 'Offline mode ready',
          message: 'The app shell is installed and can reopen without a connection.'
        })
      },
      onNeedRefresh() {
        if (hasShownUpdateToast) {
          return
        }

        hasShownUpdateToast = true
        addToast({
          type: 'info',
          title: 'App update available',
          message: 'Reload to apply the latest cached version.',
          duration: 0,
          action: {
            label: 'Reload',
            onClick: () => {
              hasShownUpdateToast = false
              void updateServiceWorker(true)
            }
          }
        })
      }
    })
  }, [])

  return null
}
