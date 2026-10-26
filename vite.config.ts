import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const rootDir = import.meta.dirname;

export default defineConfig({
  root: resolve(rootDir, 'src/web'),
  build: {
    outDir: resolve(rootDir, 'dist/web'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        admin: resolve(rootDir, 'src/web/admin/index.html'),
        gift: resolve(rootDir, 'src/web/gift/index.html'),
        dev: resolve(rootDir, 'src/web/dev/index.html'),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/healthz': 'http://127.0.0.1:3000',
      '/api': 'http://127.0.0.1:3000',
    },
  },
});
