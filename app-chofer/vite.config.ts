import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import pkg from './package.json' with { type: 'json' }

function nativeShellVersion() {
  const configured = process.env.VITE_NATIVE_SHELL_VERSION
  if (configured) return configured
  const gradle = fs.readFileSync(new URL('./android/app/build.gradle', import.meta.url), 'utf8')
  return gradle.match(/versionName\s+"([^"]+)"/)?.[1] || 'n/a'
}

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.VITE_APP_VERSION || pkg.version),
    'import.meta.env.VITE_NATIVE_SHELL_VERSION': JSON.stringify(nativeShellVersion()),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
})
