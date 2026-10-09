import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // Saat development, request /api diteruskan ke backend (ubah target sesuai port backend Anda).
  server: { proxy: { '/api': { target: 'http://localhost:8000', changeOrigin: true }, '/uploads': { target: 'http://localhost:8000', changeOrigin: true } } },
})
