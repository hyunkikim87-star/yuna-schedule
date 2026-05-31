import { Router } from 'express';
import pool from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  const { year, month, week } = req.query;
  const { rows } = await pool.query(
    'SELECT * FROM schedules WHERE year=$1 AND month=$2 AND week=$3 ORDER BY day, id',
    [Number(year), Number(month), Number(week)]
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { year, month, week, day, class_name, location, memo, supplies, start_time, end_time } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO schedules (year, month, week, day, class_name, location, memo, supplies, start_time, end_time)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [year, month, week, day, class_name, location || null, memo || null, supplies || null, start_time || null, end_time || null]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { class_name, location, memo, supplies, start_time, end_time } = req.body;
  const { rows } = await pool.query(
    `UPDATE schedules SET class_name=$1, location=$2, memo=$3, supplies=$4, start_time=$5, end_time=$6
     WHERE id=$7 RETURNING *`,
    [class_name, location || null, memo || null, supplies || null, start_time || null, end_time || null, Number(req.params.id)]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM schedules WHERE id=$1', [Number(req.params.id)]);
  res.json({ ok: true });
});

export default router;
