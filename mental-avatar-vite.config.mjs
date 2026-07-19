import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const frontendRoot = 'D:/MyWork/mental-avatar/frontend'

export default defineConfig({
  root: frontendRoot,
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(frontendRoot, './src') },
  },
  optimizeDeps: {
    exclude: ['@met4citizen/talkinghead'],
  },
  server: { port: 5174 },
})
