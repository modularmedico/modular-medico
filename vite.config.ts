import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        // Keep big, rarely-needed libraries out of the startup bundle. Previously every
        // node_module went into one "vendor" chunk that loaded on every page, which pulled
        // in recharts (only used by Profile + Admin) for everyone.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('recharts') || id.includes('/d3-') || id.includes('victory-vendor')) return 'charts'
          if (id.includes('firebase') || id.includes('@firebase')) return 'firebase'
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'react'
          return undefined
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Modular Medico',
        short_name: 'Medico',
        description: 'MBBS MCQ Practice App',
        theme_color: '#8A5CFF',
        background_color: '#F4F2FA',
        display: 'standalone',
        icons: [
          {
            src: 'icon.png', // Fallback, no real icon yet
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon.png',
            sizes: '512x512',
            type: 'image/png',
          }
        ]
      }
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
})
