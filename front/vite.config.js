import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// В dev-режиме запросы на /api автоматически проксируются на локальный бэкенд,
// поэтому CORS настраивать не нужно. Порт бэкенда можно изменить переменной VITE_PROXY_TARGET.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
