import { defineConfig } from 'vite';

// Absolute URLs for canonical / Open Graph. Set SITE_URL (e.g. https://rewind.wmata.com) at launch;
// on Vercel the production domain is picked up automatically. Without either, the URL tags are dropped
// and og:image falls back to a relative path.
const site = (process.env.SITE_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
  || '').replace(/\/$/, '');

const siteUrl = () => ({
  name: 'site-url',
  transformIndexHtml(html) {
    if (!site) html = html.replace(/^.*(rel="canonical"|property="og:url").*\n/gm, '');
    return html.replaceAll('%SITE_URL%', site);
  },
});

export default defineConfig({
  plugins: [siteUrl()],
  // main.js uses top-level await (manifest + fonts before the scene is built)
  build: { target: 'es2022', assetsInlineLimit: 0, assetsDir: 'bundle', chunkSizeWarningLimit: 800 },   // public/assets keeps the art
  server: { host: true },
});
