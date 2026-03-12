import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  base: './',
  plugins: [preact()],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    rollupOptions: {
      input: 'index.html',
    },
  },
});
