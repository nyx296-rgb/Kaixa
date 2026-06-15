import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Increase body size limit for large mailbox uploads (default is 4MB)
    // No built-in limit in Vite dev server but http-proxy needs configured timeouts
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        ws: true,
        // Allow up to 10 minutes for large file uploads (100MB+)
        proxyTimeout: 600000,
        timeout: 600000,
        // Disable buffering so large files stream directly to backend
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
