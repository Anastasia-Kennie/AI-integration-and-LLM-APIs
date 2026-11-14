import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiTarget = process.env.VITE_API_TARGET ?? 'http://localhost:8001'
const wsTarget = apiTarget.replace(/^http/, 'ws')

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/ws':  { target: wsTarget, ws: true },
    },
  },
})
