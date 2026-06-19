import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Rietveld Lattice — pinned to port 6060 (registered in dashboard/launcher.py)
export default defineConfig({
  plugins: [react()],
  server: { port: 6060, strictPort: true },
  resolve: { alias: { '@': '/src' } },
})
