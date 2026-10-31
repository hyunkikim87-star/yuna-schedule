import { Router } from 'express';
import pool from '../db.js';
import { parseId, parseOneDayEvent } from '../lib/validate.js';

const router = Router();

const COLUMNS = ['name', 'date', 'start_time', 'end_time', 'location', 'supplies', 'memo', 'color'];

router.get('/', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM one_day_events ORDER BY date DESC, start_time, id');
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { value, error } = parseOneDayEvent(req.body);
  if (error) return res.status(400).json({ error });
  const { rows } = await pool.query(
    `INSERT INTO one_day_events (${COLUMNS.join(', ')})
     VALUES (${COLUMNS.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`,
    COLUMNS.map((c) => value[c])
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Not found' });
  const { value, error } = parseOneDayEvent(req.body);
  if (error) return res.status(400).json({ error });
  const { rows } = await pool.query(
    `UPDATE one_day_events SET ${COLUMNS.map((c, i) => `${c}=$${i + 1}`).join(', ')}
     WHERE id=$${COLUMNS.length + 1} RETURNING *`,
    [...COLUMNS.map((c) => value[c]), id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Not found' });
  await pool.query('DELETE FROM one_day_events WHERE id=$1', [id]);
  res.json({ ok: true });
});

export default router;
