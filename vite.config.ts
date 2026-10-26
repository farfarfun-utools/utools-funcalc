import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: './',
  plugins: [vue()],
  build: { target: 'chrome108', outDir: 'utools/dist', emptyOutDir: true },
})
