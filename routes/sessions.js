import { Router } from 'express';
import pool from '../db.js';
import { computeSessions, daysBetween, isValidDate } from '../lib/sessions.js';

const router = Router();

const MAX_RANGE_DAYS = 400;

// GET /api/sessions?from=YYYY-MM-DD&to=YYYY-MM-DD → 기간 안의 실제 회차 목록
router.get('/', async (req, res) => {
  const { from, to } = req.query;
  if (!isValidDate(from) || !isValidDate(to)) return res.status(400).json({ error: 'from, to는 YYYY-MM-DD 형식이어야 해요' });
  if (from > to) return res.status(400).json({ error: 'from이 to보다 늦어요' });
  if (daysBetween(from, to) > MAX_RANGE_DAYS) return res.status(400).json({ error: `한 번에 ${MAX_RANGE_DAYS}일까지만 조회할 수 있어요` });

  const { rows: classes } = await pool.query(
    'SELECT * FROM classes WHERE start_date <= $2 AND end_date >= $1',
    [from, to]
  );
  const ids = classes.map((c) => c.id);
  const { rows: exceptions } = ids.length
    ? await pool.query('SELECT * FROM class_exceptions WHERE class_id = ANY($1) AND date BETWEEN $2 AND $3', [ids, from, to])
    : { rows: [] };
  const { rows: oneDayEvents } = await pool.query(
    'SELECT * FROM one_day_events WHERE date BETWEEN $1 AND $2',
    [from, to]
  );
  res.json(computeSessions({ classes, exceptions, oneDayEvents, from, to }));
});

export default router;
