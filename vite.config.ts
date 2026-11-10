import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
const native = process.env.POCKET_NATIVE === '1';
const base = native ? '/' : process.env.POCKET_BASE_PATH || '/';
if(!base.startsWith('/')||!base.endsWith('/')||base.startsWith('//'))throw new Error('POCKET_BASE_PATH must be an absolute path ending in /, such as /hanzi-pocket-web/.');

export default defineConfig({
  base,
  build: { outDir: native ? 'dist-native' : 'dist' },
  plugins: [react(), VitePWA({
    disable: native,
    scope: base,
    registerType: 'prompt',
    includeAssets: ['apple-touch-icon.png', 'app-icon.png'],
    manifest: {
      name: 'Hanzi Pocket', short_name: 'Hanzi Pocket',
      description: 'A personal offline Chinese vocabulary companion.',
      theme_color: '#F5F0E7', background_color: '#F5F0E7',
      id: base, display: 'standalone', start_url: base, scope: base, lang: 'en',
      icons: [{src:`${base}app-icon.png`,sizes:'1254x1254',type:'image/png',purpose:'any maskable'}]
    },
    workbox: {
      clientsClaim: true,
      globPatterns: ['**/*.{js,css,html,png,svg,json,txt,woff2,webmanifest}'],
      maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
      navigateFallback: `${base}index.html`, cleanupOutdatedCaches: true,
      runtimeCaching: []
    },
    devOptions: { enabled: false }
  })],
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], restoreMocks: true }
});
