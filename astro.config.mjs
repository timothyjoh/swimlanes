import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',  // SSR mode for API routes
  adapter: node({
    mode: 'standalone'
  }),
  integrations: [
    react(),
    tailwind()
  ],
  vite: {
    optimizeDeps: {
      exclude: ['better-sqlite3']  // native module, don't pre-bundle
    }
  }
});
