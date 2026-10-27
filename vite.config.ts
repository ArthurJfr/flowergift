import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { slotCss } from './src/engine/catalog.ts';

const rootDir = import.meta.dirname;

function bouquetColors(): Plugin {
  return {
    name: 'bouquet-colors',
    transform(code, id) {
      const file = id.split('?')[0] ?? id;
      if (!file.endsWith('/admin/styles.css') && !file.endsWith('/gift/styles.css')) return null;
      return `${slotCss()}\n${code}`;
    },
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const path = req.url?.split('?')[0] ?? '';
        const accept = req.headers.accept ?? '';
        if (path.startsWith('/g/') && accept.includes('text/html')) req.url = '/gift/index.html';
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [bouquetColors()],
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
      '/api': { target: 'http://127.0.0.1:3000', headers: { origin: 'http://localhost:3000' } },
    },
  },
});
