import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  server: {
    proxy: {
      '^/uploads/.*': {
        target: 'https://hrms.sandjglobaltech.com',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  optimizeDeps: {
    exclude: ['@capacitor/background-task', '@capacitor-community/background-geolocation']
  },
  build: {
    rollupOptions: {
      external: ['@capacitor/background-task', '@capacitor-community/background-geolocation']
    }
  }
})