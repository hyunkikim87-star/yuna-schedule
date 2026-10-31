import { Router } from 'express';
import pool from '../db.js';
import { weekdayOf } from '../lib/sessions.js';
import { parseClass, parseException, parseId } from '../lib/validate.js';

const router = Router();

const COLUMNS = ['name', 'weekday', 'start_time', 'end_time', 'location', 'start_date', 'end_date', 'supplies', 'memo', 'color', 'term', 'link'];

router.get('/', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM classes ORDER BY start_date DESC, weekday, start_time, id');
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Not found' });
  const { rows } = await pool.query('SELECT * FROM classes WHERE id=$1', [id]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  const ex = await pool.query('SELECT * FROM class_exceptions WHERE class_id=$1 ORDER BY date', [id]);
  res.json({ ...rows[0], exceptions: ex.rows });
});

router.post('/', async (req, res) => {
  const { value, error } = parseClass(req.body);
  if (error) return res.status(400).json({ error });
  const { rows } = await pool.query(
    `INSERT INTO classes (${COLUMNS.join(', ')})
     VALUES (${COLUMNS.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`,
    COLUMNS.map((c) => value[c])
  );
  res.status(201).json(rows[0]);
});

// 기간 연장은 end_date만 바꿔 PUT하면 된다.
router.put('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Not found' });
  const { value, error } = parseClass(req.body);
  if (error) return res.status(400).json({ error });
  const { rows } = await pool.query(
    `UPDATE classes SET ${COLUMNS.map((c, i) => `${c}=$${i + 1}`).join(', ')}
     WHERE id=$${COLUMNS.length + 1} RETURNING *`,
    [...COLUMNS.map((c) => value[c]), id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Not found' });
  await pool.query('DELETE FROM classes WHERE id=$1', [id]);
  res.json({ ok: true });
});

// 휴강(cancel) 또는 이 날만 변경(change). 같은 날 예외가 이미 있으면 덮어쓴다.
router.post('/:id/exceptions', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Not found' });
  const { value, error } = parseException(req.body);
  if (error) return res.status(400).json({ error });
  const { rows: found } = await pool.query('SELECT * FROM classes WHERE id=$1', [id]);
  if (!found.length) return res.status(404).json({ error: 'Not found' });
  const c = found[0];
  if (value.date < c.start_date || value.date > c.end_date || weekdayOf(value.date) !== c.weekday) {
    return res.status(400).json({ error: '그 날짜에는 이 수업이 없어요' });
  }
  const { rows } = await pool.query(
    `INSERT INTO class_exceptions (class_id, date, type, start_time, end_time, location, memo, supplies)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (class_id, date) DO UPDATE SET
       type=EXCLUDED.type, start_time=EXCLUDED.start_time, end_time=EXCLUDED.end_time,
       location=EXCLUDED.location, memo=EXCLUDED.memo, supplies=EXCLUDED.supplies
     RETURNING *`,
    [id, value.date, value.type, value.start_time, value.end_time, value.location, value.memo, value.supplies]
  );
  res.status(201).json(rows[0]);
});

router.delete('/:id/exceptions/:exceptionId', async (req, res) => {
  const id = parseId(req.params.id);
  const exceptionId = parseId(req.params.exceptionId);
  if (!id || !exceptionId) return res.status(404).json({ error: 'Not found' });
  await pool.query('DELETE FROM class_exceptions WHERE id=$1 AND class_id=$2', [exceptionId, id]);
  res.json({ ok: true });
});

export default router;
