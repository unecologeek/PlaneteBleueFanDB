import express from 'express';
import path from 'node:path';
import { createApp } from './server/app.ts';
import { runCrawlSync, syncStatus } from './server/crawler.ts';
import { getStats } from './server/db.ts';

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = createApp();
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`La Planète Bleue Index server listening on http://localhost:${PORT}`);
    // Auto-crawl in background if database is empty
    const stats = getStats();
    if (stats.emissions_count === 0 && !syncStatus.running) {
      console.log('Database empty on boot — starting initial crawl...');
      runCrawlSync({ full: false }).catch((e) => console.error('Auto-crawl error:', e));
    }
  });
}

startServer();
