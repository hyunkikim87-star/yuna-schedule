import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import { initDb } from './db.js';
import schedulesRouter from './routes/schedules.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (_req, res) => res.json({ ok: true }));

app.use('/api/schedules', schedulesRouter);

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

if (process.env.NODE_ENV !== 'test') {
  initDb().then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  });
}

export default app;
