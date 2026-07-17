import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@client\/(.*)\.js$/,
        replacement: `${fileURLToPath(new URL('./src/client', import.meta.url))}/$1`,
      },
      {
        find: /^@shared\/(.*)\.js$/,
        replacement: `${fileURLToPath(new URL('./src/shared', import.meta.url))}/$1`,
      },
      { find: '@client', replacement: fileURLToPath(new URL('./src/client', import.meta.url)) },
      { find: '@shared', replacement: fileURLToPath(new URL('./src/shared', import.meta.url)) },
    ],
  },
  build: { outDir: 'dist/client', emptyOutDir: true },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },
});
