import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import pkg from './package.json'

function katexWoff2Only(): Plugin {
  return {
    name: 'katex-woff2-only',
    enforce: 'pre',
    transform(code, id) {
      if (!/[\\/]katex[\\/]dist[\\/]katex(?:\.min)?\.css(?:$|\?)/.test(id)) return null
      return code.replace(/,\s*url\([^)]+\.(?:woff|ttf)\)\s*format\(["'](?:woff|truetype)["']\)/g, '')
    },
  }
}

function devCsp(): Plugin {
  return {
    name: 'dev-csp',
    apply: 'serve',
    transformIndexHtml(html) {
      return html.replace("connect-src 'none'", "connect-src 'self' ws://127.0.0.1:* ws://localhost:*")
    },
  }
}

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [katexWoff2Only(), devCsp(), vue()],
  build: { target: 'chrome108', outDir: 'utools/dist', emptyOutDir: true },
})
