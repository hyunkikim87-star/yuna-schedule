import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { loggedInAgent, setTestAuthEnv } from './helpers.js';

vi.mock('../db.js', () => ({
  default: { query: vi.fn() },
  initDb: vi.fn().mockResolvedValue(undefined),
}));

setTestAuthEnv();
const { default: app } = await import('../server.js');
const { default: pool } = await import('../db.js');

let agent;
beforeAll(async () => {
  agent = await loggedInAgent(request, app);
});
beforeEach(() => vi.clearAllMocks());

const wise = {
  id: 1, name: '와이즈미술학원', weekday: 6, start_time: '10:00', end_time: '11:20',
  location: '파크뷰 상가', start_date: '2026-10-03', end_date: '2026-10-31',
};

describe('GET /api/sessions', () => {
  it('정규 수업 + 예외 + 원데이를 합쳐 회차 목록을 돌려준다', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [wise] })
      .mockResolvedValueOnce({ rows: [{ id: 7, class_id: 1, date: '2026-10-24', type: 'cancel' }] })
      .mockResolvedValueOnce({ rows: [{ id: 3, name: '특강', date: '2026-10-25', start_time: '15:00', end_time: null }] })
      .mockResolvedValueOnce({ rows: [{ date: '2026-10-31', kind: 'class', source_id: 1, item: '앞치마' }] });
    const res = await agent.get('/api/sessions?from=2026-10-24&to=2026-11-01');
    expect(res.status).toBe(200);
    expect(res.body.map((s) => [s.date, s.name, s.kind, s.checked_supplies])).toEqual([
      ['2026-10-25', '특강', 'one_day', []],
      ['2026-10-31', '와이즈미술학원', 'class', ['앞치마']],
    ]);
    expect(pool.query.mock.calls[0][1]).toEqual(['2026-10-24', '2026-11-01']);
  });

  it('수업이 없으면 예외 조회를 건너뛴다', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
    const res = await agent.get('/api/sessions?from=2026-10-31&to=2026-11-01');
    expect(res.body).toEqual([]);
    expect(pool.query).toHaveBeenCalledTimes(3);
  });

  it('준비물 챙김 켜기/끄기, 잘못된 값은 400', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const on = await agent.post('/api/sessions/supply-check').send({ date: '2026-10-31', kind: 'class', source_id: 1, item: ' 물통 ', checked: true });
    expect(on.status).toBe(200);
    expect(pool.query.mock.calls[0][0]).toMatch(/INSERT INTO supply_checks/);
    expect(pool.query.mock.calls[0][1]).toEqual(['2026-10-31', 'class', 1, '물통']);
    const off = await agent.post('/api/sessions/supply-check').send({ date: '2026-10-31', kind: 'class', source_id: 1, item: '물통', checked: false });
    expect(off.status).toBe(200);
    expect(pool.query.mock.calls[1][0]).toMatch(/DELETE FROM supply_checks/);
    for (const bad of [{ kind: 'x' }, { source_id: 0 }, { item: '' }, { date: '2026-13-01' }]) {
      const res = await agent.post('/api/sessions/supply-check').send({ date: '2026-10-31', kind: 'class', source_id: 1, item: '물통', checked: true, ...bad });
      expect(res.status).toBe(400);
    }
    expect(pool.query).toHaveBeenCalledTimes(2);
    pool.query.mockReset();
  });

  it('날짜 형식이 틀리거나 범위가 거꾸로면 400', async () => {
    expect((await agent.get('/api/sessions?from=2026-10&to=2026-11-01')).status).toBe(400);
    expect((await agent.get('/api/sessions?from=2026-11-02&to=2026-11-01')).status).toBe(400);
    expect((await agent.get('/api/sessions?from=2026-01-01&to=2027-12-31')).status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('/api/classes', () => {
  it('정규 수업을 등록한다', async () => {
    pool.query.mockResolvedValueOnce({ rows: [wise] });
    const res = await agent.post('/api/classes').send({ ...wise, id: undefined });
    expect(res.status).toBe(201);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO classes/);
    expect(params.slice(0, 7)).toEqual(['와이즈미술학원', 6, '10:00', '11:20', '파크뷰 상가', '2026-10-03', '2026-10-31']);
  });

  it('잘못된 입력은 400', async () => {
    const bad = [
      { ...wise, name: ' ' },
      { ...wise, weekday: 7 },
      { ...wise, start_time: '25:00' },
      { ...wise, end_time: '09:00' },
      { ...wise, start_date: '2026-11-01', end_date: '2026-10-01' },
    ];
    for (const body of bad) expect((await agent.post('/api/classes').send(body)).status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('구매 링크는 http(s) 주소만 저장하고, 비우면 null', async () => {
    pool.query.mockResolvedValueOnce({ rows: [wise] });
    await agent.post('/api/classes').send({ ...wise, link: ' https://www.cultureclass.example/class/123 ' });
    expect(pool.query.mock.calls[0][1].at(-1)).toBe('https://www.cultureclass.example/class/123');

    pool.query.mockResolvedValueOnce({ rows: [wise] });
    await agent.post('/api/classes').send({ ...wise, link: '' });
    expect(pool.query.mock.calls[1][1].at(-1)).toBeNull();

    for (const link of ['javascript:alert(1)', 'ftp://x.example/a', '그냥 글자']) {
      const res = await agent.post('/api/classes').send({ ...wise, link });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/구매 링크/);
    }
    const ev = await agent.post('/api/one-day-events').send({ name: '특강', date: '2026-11-07', start_time: '11:00', link: 'javascript:alert(1)' });
    expect(ev.status).toBe(400);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it('기간 연장 = 종료일만 바꿔 PUT', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ ...wise, end_date: '2026-12-26' }] });
    const res = await agent.put('/api/classes/1').send({ ...wise, end_date: '2026-12-26' });
    expect(res.status).toBe(200);
    expect(res.body.end_date).toBe('2026-12-26');
  });

  it('없는 수업 수정 → 404', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect((await agent.put('/api/classes/999').send(wise)).status).toBe(404);
  });

  it('상세에는 예외 목록이 함께 온다', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [wise] })
      .mockResolvedValueOnce({ rows: [{ id: 7, class_id: 1, date: '2026-10-24', type: 'cancel' }] });
    const res = await agent.get('/api/classes/1');
    expect(res.body.exceptions).toHaveLength(1);
  });
});

describe('/api/classes/:id/exceptions', () => {
  it('휴강 추가', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [wise] })
      .mockResolvedValueOnce({ rows: [{ id: 7, class_id: 1, date: '2026-10-17', type: 'cancel' }] });
    const res = await agent.post('/api/classes/1/exceptions').send({ date: '2026-10-17', type: 'cancel' });
    expect(res.status).toBe(201);
    expect(pool.query.mock.calls[1][1].slice(0, 3)).toEqual([1, '2026-10-17', 'cancel']);
  });

  it('이 날만 변경에는 바꿀 내용이 필요하다', async () => {
    const res = await agent.post('/api/classes/1/exceptions').send({ date: '2026-10-17', type: 'change' });
    expect(res.status).toBe(400);
  });

  it('수업이 없는 날짜(요일·기간 밖)는 400', async () => {
    pool.query.mockResolvedValueOnce({ rows: [wise] });
    expect((await agent.post('/api/classes/1/exceptions').send({ date: '2026-10-18', type: 'cancel' })).status).toBe(400);
    pool.query.mockResolvedValueOnce({ rows: [wise] });
    expect((await agent.post('/api/classes/1/exceptions').send({ date: '2026-11-07', type: 'cancel' })).status).toBe(400);
  });

  it('예외 삭제(휴강 해제)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await agent.delete('/api/classes/1/exceptions/7');
    expect(res.status).toBe(200);
    expect(pool.query.mock.calls[0][1]).toEqual([7, 1]);
  });
});

describe('/api/one-day-events, /api/places', () => {
  it('원데이 수업 등록', async () => {
    const event = { name: '문화센터 특강', date: '2026-11-07', start_time: '11:00', end_time: '11:50' };
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, ...event }] });
    const res = await agent.post('/api/one-day-events').send(event);
    expect(res.status).toBe(201);
    expect((await agent.post('/api/one-day-events').send({ ...event, date: '2026-13-01' })).status).toBe(400);
  });

  it('원데이 수업 하나 조회, 없으면 404', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 3, name: '컬러 몬스터', date: '2026-11-01' }] });
    const res = await agent.get('/api/one-day-events/3');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('컬러 몬스터');
    expect(pool.query.mock.calls[0][1]).toEqual([3]);
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect((await agent.get('/api/one-day-events/999')).status).toBe(404);
    expect((await agent.get('/api/one-day-events/abc')).status).toBe(404);
  });

  it('장소 등록, 같은 이름이면 409', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, name: '이마트 수지', map_url: null }] });
    expect((await agent.post('/api/places').send({ name: '이마트 수지' })).status).toBe(201);
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect((await agent.post('/api/places').send({ name: '이마트 수지' })).status).toBe(409);
  });

  it('없는 API 경로는 404 JSON', async () => {
    const res = await agent.get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });
});
