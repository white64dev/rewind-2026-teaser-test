import { defineConfig } from 'vite';

export default defineConfig({
  // main.js uses top-level await (manifest + fonts before the scene is built)
  build: { target: 'es2022', assetsInlineLimit: 0, assetsDir: 'bundle', chunkSizeWarningLimit: 800 },   // public/assets keeps the art
  server: { host: true },
});
