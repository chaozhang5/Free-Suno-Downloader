import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { vitePrerenderPlugin } from 'vite-prerender-plugin';
import { routes } from './scripts/route-data.mjs';

export default defineConfig({
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react-vendor';
          if (/\/node_modules\/@remix-run\/router\//.test(id) || /\/node_modules\/react-router(-dom)?\//.test(id)) return 'router-vendor';
        },
      },
    },
  },
  plugins: [
    react(),
    vitePrerenderPlugin({
      renderTarget: '#root',
      prerenderScript: resolve(fileURLToPath(new URL('.', import.meta.url)), 'src/entry-prerender.tsx'),
      additionalPrerenderRoutes: routes.map(({ path }: { path: string }) => path).filter((path: string) => path !== '/'),
    }),
  ],
  resolve: { alias: { '@suno/i18n': resolve(fileURLToPath(new URL('.', import.meta.url)), 'src/i18n') } },
});
