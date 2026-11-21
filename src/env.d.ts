/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface Window {
  funcalc?: {
    onEnter(callback: (action: { code: string; payload: unknown }) => void): () => void
    saveExport(text: string): boolean
  }
}
