import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  server: {
    proxy: {
      '^/uploads/.*': {
        target: 'https://hrm-production.onrender.com',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})