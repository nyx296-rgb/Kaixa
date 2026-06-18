import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        ws: true,
        proxyTimeout: 600000,
        timeout: 600000,
        configure: (proxy) => {
          proxy.on('error', (err, _req, _res) => {
            console.error('[vite-proxy] error:', err.message);
          });
          proxy.on('proxyReq', (_proxyReq, req) => {
            console.log('[vite-proxy] →', req.method, req.url);
          });
        },
      },
    },
  },
});
