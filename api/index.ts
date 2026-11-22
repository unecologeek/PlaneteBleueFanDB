import fs from 'node:fs';
import path from 'node:path';
import { createApp } from '../server/app.ts';

const bundledDbHint = path.join(process.cwd(), 'data', 'planete_bleue.db');
if (!fs.existsSync(bundledDbHint)) {
  console.warn('Bundled SQLite DB not found at:', bundledDbHint);
}

const app = createApp();

export default app;
