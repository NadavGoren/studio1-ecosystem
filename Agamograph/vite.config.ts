import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Pinned port: the Studio 1 ecosystem already uses 5173/5174.
  // strictPort makes the dev URL deterministic instead of auto-incrementing.
  server: {
    port: 5180,
    strictPort: true,
  },
})
