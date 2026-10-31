import { Router } from 'express';
import pool from '../db.js';
import { parseId, parsePlace } from '../lib/validate.js';

const router = Router();

router.get('/', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM places ORDER BY name');
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { value, error } = parsePlace(req.body);
  if (error) return res.status(400).json({ error });
  const { rows } = await pool.query(
    'INSERT INTO places (name, map_url) VALUES ($1,$2) ON CONFLICT (name) DO NOTHING RETURNING *',
    [value.name, value.map_url]
  );
  if (!rows.length) return res.status(409).json({ error: '이미 있는 장소예요' });
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Not found' });
  const { value, error } = parsePlace(req.body);
  if (error) return res.status(400).json({ error });
  const { rows } = await pool.query(
    'UPDATE places SET name=$1, map_url=$2 WHERE id=$3 RETURNING *',
    [value.name, value.map_url, id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Not found' });
  await pool.query('DELETE FROM places WHERE id=$1', [id]);
  res.json({ ok: true });
});

export default router;
