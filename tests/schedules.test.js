import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', () => ({
  default: { query: vi.fn() },
  initDb: vi.fn().mockResolvedValue(undefined),
}));

const { default: app } = await import('../server.js');
const { default: pool } = await import('../db.js');

describe('GET /', () => {
  it('returns { ok: true }', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe('GET /api/schedules', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns schedules for the given week', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, class_name: '발레', day: 'SAT', year: 2026, month: 6, week: 1 }],
    });
    const res = await request(app).get('/api/schedules?year=2026&month=6&week=1');
    expect(res.status).toBe(200);
    expect(res.body[0].class_name).toBe('발레');
  });
});

describe('POST /api/schedules', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates and returns a new schedule', async () => {
    const item = { id: 2, year: 2026, month: 6, week: 1, day: 'SAT', class_name: '미술', location: '롯데센터', memo: null, supplies: '앞치마' };
    pool.query.mockResolvedValueOnce({ rows: [item] });
    const res = await request(app).post('/api/schedules').send(item);
    expect(res.status).toBe(201);
    expect(res.body.class_name).toBe('미술');
  });

  it('start_time, end_time을 포함해 생성한다', async () => {
    const item = {
      id: 3, year: 2026, month: 6, week: 1, day: 'SAT',
      class_name: '발레', location: null, memo: null, supplies: null,
      start_time: '10:00', end_time: '11:30',
    };
    pool.query.mockResolvedValueOnce({ rows: [item] });
    const res = await request(app).post('/api/schedules').send(item);
    expect(res.status).toBe(201);
    expect(res.body.start_time).toBe('10:00');
    expect(res.body.end_time).toBe('11:30');
  });
});

describe('PUT /api/schedules/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates and returns the schedule', async () => {
    const updated = { id: 1, class_name: '발레2', location: '새 장소', memo: null, supplies: null };
    pool.query.mockResolvedValueOnce({ rows: [updated] });
    const res = await request(app).put('/api/schedules/1').send(updated);
    expect(res.status).toBe(200);
    expect(res.body.class_name).toBe('발레2');
  });

  it('start_time, end_time을 업데이트한다', async () => {
    const updated = {
      id: 1, class_name: '발레', location: null, memo: null, supplies: null,
      start_time: '14:00', end_time: '15:30',
    };
    pool.query.mockResolvedValueOnce({ rows: [updated] });
    const res = await request(app).put('/api/schedules/1').send(updated);
    expect(res.status).toBe(200);
    expect(res.body.start_time).toBe('14:00');
    expect(res.body.end_time).toBe('15:30');
  });

  it('returns 404 if not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).put('/api/schedules/999').send({ class_name: 'x' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/schedules/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes and returns { ok: true }', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).delete('/api/schedules/1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
