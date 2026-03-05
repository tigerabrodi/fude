import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Use package source directly in the example app for live DX.
      fude: fileURLToPath(
        new URL('../../packages/fude/src/index.ts', import.meta.url)
      ),
    },
  },
})
