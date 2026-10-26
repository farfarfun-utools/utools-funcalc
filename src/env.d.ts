/// <reference types="vite/client" />

interface Window {
  funcalc?: {
    onEnter(callback: (action: { code: string; payload: unknown }) => void): void
    saveExport(text: string): boolean
  }
}
