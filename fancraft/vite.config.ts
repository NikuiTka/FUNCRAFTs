import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Встановлюється як додаток; після першого відкриття працює повністю офлайн:
    // код, воркер верстки, pdf.js і всі шрифти кешуються service worker'ом.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'FANCRAFTs',
        short_name: 'FANCRAFTs',
        description: 'Рукопис → зошити для друку на офісному лазері й ручного шиття',
        lang: 'uk',
        display: 'standalone',
        background_color: '#f6f5f2',
        theme_color: '#8a3b12',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,ttf}'],
        // Воркер верстки з fontkit і pdf-lib — близько 1,2 МБ.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
})
