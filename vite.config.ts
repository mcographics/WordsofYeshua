import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 5000 },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
