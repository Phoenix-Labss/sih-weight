import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Admin control-plane portal. Serves role-restricted (ADMIN) dashboards and
// connects directly to the Fastify backend admin API on port 8000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    host: true,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/health': 'http://127.0.0.1:8000',
    },
  },
  preview: {
    port: 5174,
    host: true,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/health': 'http://127.0.0.1:8000',
    },
  },
});