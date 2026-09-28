import { defineConfig } from 'vite';

const requestedBase = process.env.VITE_BASE_PATH?.trim();
const base = requestedBase
  ? `/${requestedBase.split('/').filter(Boolean).join('/')}/`
  : '/';

export default defineConfig({
  base,
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rollupOptions: { output: { manualChunks: { three: ['three'] } } },
  },
  server: { host: '127.0.0.1', strictPort: true },
  preview: { host: '127.0.0.1', strictPort: true },
});
