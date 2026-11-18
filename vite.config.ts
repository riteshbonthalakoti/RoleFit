import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { cpSync, existsSync, mkdirSync } from 'fs';

const ROOT = import.meta.dirname;

function bundleExtensionAssets() {
  return {
    name: 'rolefit-extension-assets',
    writeBundle() {
      const dist = resolve(ROOT, 'dist');
      const assetsDir = resolve(dist, 'assets');
      const iconsDir = resolve(dist, 'icons');

      mkdirSync(assetsDir, { recursive: true });
      mkdirSync(iconsDir, { recursive: true });

      cpSync(resolve(ROOT, 'public/manifest.json'), resolve(dist, 'manifest.json'));
      cpSync(resolve(ROOT, 'public/icons'), iconsDir, { recursive: true });

      // Bundle pdf.js worker locally (MV3 forbids remote CDN workers)
      const workerCandidates = [
        resolve(ROOT, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs'),
        resolve(ROOT, 'node_modules/pdfjs-dist/build/pdf.worker.mjs'),
      ];
      const workerSrc = workerCandidates.find((p) => existsSync(p));
      if (workerSrc) {
        cpSync(workerSrc, resolve(assetsDir, 'pdf.worker.min.mjs'));
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), bundleExtensionAssets()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        popup: resolve(ROOT, 'popup.html'),
        report: resolve(ROOT, 'report.html'),
        content: resolve(ROOT, 'src/content/extractor.ts'),
        worker: resolve(ROOT, 'src/background/worker.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'content' || chunkInfo.name === 'worker') {
            return '[name].js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
});
