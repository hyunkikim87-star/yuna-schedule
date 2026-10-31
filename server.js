import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import { initDb } from './db.js';
import schedulesRouter from './routes/schedules.js';
import authRouter, { loadStoredPinHash } from './routes/auth.js';
import classesRouter from './routes/classes.js';
import oneDayEventsRouter from './routes/oneDayEvents.js';
import placesRouter from './routes/places.js';
import sessionsRouter from './routes/sessions.js';
import { checkConfig, requireAuth } from './lib/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use(requireAuth);
app.use('/api/auth', authRouter);

app.use('/api/schedules', schedulesRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/classes', classesRouter);
app.use('/api/one-day-events', oneDayEventsRouter);
app.use('/api/places', placesRouter);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

app.use(express.static(path.join(__dirname, 'dist')));

app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

if (process.env.NODE_ENV !== 'test') {
  initDb().then(loadStoredPinHash).then(() => {
    checkConfig();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  }).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
}

export default app;
