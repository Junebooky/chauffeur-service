import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://127.0.0.1:3001',
      '^/(?:ko/)?journal(?:/|$)': {
        target: 'http://127.0.0.1:3001',
        rewrite: path => {
          const url = new URL(path, 'http://localhost')
          const parts = url.pathname.split('/').filter(Boolean)
          if (parts[0] === 'journal' && parts[1] === 'sitemap.xml') return '/api/journal?format=sitemap'
          const ko = parts[0] === 'ko'
          const slug = parts[ko ? 2 : 1]
          return '/api/journal?lang=' + (ko ? 'ko' : 'en') + (slug ? '&slug=' + encodeURIComponent(slug) : '')
        },
      },
    },
  },
})
