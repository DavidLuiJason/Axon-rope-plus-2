import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import { buildSnapshot } from './tools/snapshot.mjs';

function axonSnapshotPlugin(): Plugin {
  return {
    name: 'axon-verified-source-snapshot',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || new URL(req.url, 'http://localhost').pathname !== '/api/axon-source/manifest') return next();
        try {
          // AI Studio preview sees current edits; installed app sees the same format
          // generated at build time. Never read the whole dictionary into app JS.
          const manifest = buildSnapshot();
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(manifest));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: (error as Error).message }));
        }
      });
    },
  };
}
export default defineConfig(() => ({
  plugins: [react(), tailwindcss(), axonSnapshotPlugin()],
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
}));
