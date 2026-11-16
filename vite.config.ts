// Build: relative base (works under GitHub Pages /<repo>/), version + commit baked in, and a
// Service Worker generated with the exact list of built files so the game runs offline.

import { execSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import pkg from './package.json' with { type: 'json' };

function commit(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'local';
  }
}

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? listFiles(p) : [p];
  });
}

function serviceWorker(version: string): Plugin {
  return {
    name: 'pbtc-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = new Set<string>(['./', ...Object.keys(bundle).map((f) => `./${f}`)]);
      for (const f of listFiles('public')) files.add(`./${relative('public', f).split('\\').join('/')}`);
      const source = `// Generated at build time. Cache-first for every file of this version.
const CACHE = 'pbtc-${version}';
const FILES = ${JSON.stringify([...files].sort(), null, 1)};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('pbtc-') && k !== CACHE).map((k) => caches.delete(k)))));
});
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./', { cacheName: CACHE, ignoreVary: true }).then((r) => r || fetch(req)));
    return;
  }
  e.respondWith(caches.match(req, { cacheName: CACHE, ignoreSearch: true, ignoreVary: true }).then((r) => r || fetch(req)));
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

const version = `${pkg.version}-${commit()}`;

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __COMMIT__: JSON.stringify(commit()),
    __TRIAL__: JSON.stringify(process.env.PBTC_TRIAL !== '0'),
  },
  build: {
    sourcemap: process.env.SOURCEMAP === '1', target: 'safari16', assetsInlineLimit: 0, chunkSizeWarningLimit: 2000 },
  plugins: [serviceWorker(version)],
});
