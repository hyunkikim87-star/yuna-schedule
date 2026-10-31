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
  const { rows: exceptions } = classes.length
    ? await pool.query(
      `SELECT e.* FROM class_exceptions e JOIN classes c ON c.id = e.class_id
       WHERE c.start_date <= $2 AND c.end_date >= $1 AND e.date BETWEEN $1 AND $2`,
      [from, to]
    )
    : { rows: [] };
  const { rows: oneDayEvents } = await pool.query(
    'SELECT * FROM one_day_events WHERE date BETWEEN $1 AND $2',
    [from, to]
  );
  // 준비물 챙김 표시 (두 사람이 같이 본다)
  const { rows: checks } = await pool.query(
    'SELECT date, kind, source_id, item FROM supply_checks WHERE date BETWEEN $1 AND $2',
    [from, to]
  );
  const checked = new Map();
  for (const c of checks) {
    const k = `${c.date}|${c.kind}|${c.source_id}`;
    if (!checked.has(k)) checked.set(k, []);
    checked.get(k).push(c.item);
  }
  const sessions = computeSessions({ classes, exceptions, oneDayEvents, from, to });
  for (const s of sessions) s.checked_supplies = checked.get(`${s.date}|${s.kind}|${s.source_id}`) || [];
  res.json(sessions);
});

// POST /api/sessions/supply-check { date, kind, source_id, item, checked } → 챙김 표시 켜기/끄기
router.post('/supply-check', async (req, res) => {
  const { date, kind, source_id: sourceId, item, checked } = req.body || {};
  const name = typeof item === 'string' ? item.trim() : '';
  const id = Number(sourceId);
  if (!isValidDate(date) || !['class', 'one_day'].includes(kind) || !Number.isInteger(id) || id <= 0 || !name || name.length > 100) {
    return res.status(400).json({ error: '준비물 표시 정보가 올바르지 않아요' });
  }
  if (checked) {
    await pool.query(
      `INSERT INTO supply_checks (date, kind, source_id, item) VALUES ($1,$2,$3,$4)
       ON CONFLICT (date, kind, source_id, item) DO NOTHING`,
      [date, kind, id, name]
    );
  } else {
    await pool.query('DELETE FROM supply_checks WHERE date=$1 AND kind=$2 AND source_id=$3 AND item=$4', [date, kind, id, name]);
  }
  res.json({ ok: true });
});

export default router;
