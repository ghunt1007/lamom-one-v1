import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: 'es2020',
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase')) return 'firebase'
          if (id.includes('node_modules/xlsx'))     return 'xlsx'
          if (id.includes('vehicleDatabase'))       return 'vehicleDatabase'
        }
      }
    }
  },
  server: {
    port: 5173,
    strictPort: false,
  },
})
