import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { TEST_PIN, setTestAuthEnv } from './helpers.js';

vi.mock('../db.js', () => ({
  default: { query: vi.fn() },
  initDb: vi.fn().mockResolvedValue(undefined),
}));

setTestAuthEnv();
const { default: app } = await import('../server.js');
const { default: pool } = await import('../db.js');
const auth = await import('../lib/auth.js');

const NOW = new Date('2026-10-31T09:00:00+09:00');

function login(pin, agent = request(app)) {
  return agent.post('/api/auth/login').send({ pin });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  auth.resetLock();
  auth.setStoredHash(null);
});

afterEach(() => vi.useRealTimers());

describe('PIN 잠금', () => {
  it('PIN 없이 API 호출 → 401', async () => {
    for (const path of ['/api/sessions?from=2026-10-31&to=2026-11-01', '/api/classes', '/api/schedules?year=2026&month=10&week=5']) {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
    }
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('health와 status는 로그인 없이 열린다', async () => {
    expect((await request(app).get('/api/health')).status).toBe(200);
    const res = await request(app).get('/api/auth/status');
    expect(res.body).toMatchObject({ auth_enabled: true, logged_in: false, pin_length: 4 });
  });

  it('PIN을 6자리로 바꾸면 status의 pin_length도 6', async () => {
    auth.setStoredHash(auth.hashPin('135790'));
    expect((await request(app).get('/api/auth/status')).body.pin_length).toBe(6);
  });

  it('맞는 PIN → 30일짜리 HttpOnly 쿠키, 이후 API 사용 가능', async () => {
    const agent = request.agent(app);
    const res = await login(TEST_PIN, agent);
    expect(res.status).toBe(200);
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/yuna_session=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Max-Age=2592000/);
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect((await agent.get('/api/classes')).status).toBe(200);
  });

  it('30일이 지나면 쿠키가 만료된다', async () => {
    const agent = request.agent(app);
    await login(TEST_PIN, agent);
    vi.setSystemTime(new Date(NOW.getTime() + 29 * 24 * 3600 * 1000));
    expect((await agent.get('/api/auth/status')).body.logged_in).toBe(true);
    vi.setSystemTime(new Date(NOW.getTime() + 30 * 24 * 3600 * 1000 + 1000));
    expect((await agent.get('/api/auth/status')).body.logged_in).toBe(false);
  });

  it('틀린 PIN → 401, 응답에 PIN이 들어가지 않는다', async () => {
    const res = await login('0000');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('PIN이 맞지 않아요');
    expect(JSON.stringify(res.body)).not.toContain('0000');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('5번 틀리면 5분 잠금 (맞는 PIN도 거부), 5분 뒤 풀림', async () => {
    for (let i = 0; i < 4; i++) expect((await login('0000')).status).toBe(401);
    const fifth = await login('0000');
    expect(fifth.status).toBe(429);
    expect(fifth.body.retry_after).toBe(300);
    expect((await login(TEST_PIN)).status).toBe(429);
    vi.setSystemTime(new Date(NOW.getTime() + 5 * 60 * 1000 + 1000));
    expect((await login(TEST_PIN)).status).toBe(200);
  });

  it('위조한 쿠키는 거부한다', async () => {
    const res = await request(app).get('/api/classes').set('Cookie', 'yuna_session=eyJleHAiOjl9.fake');
    expect(res.status).toBe(401);
  });

  it('로그아웃하면 쿠키를 지운다', async () => {
    const agent = request.agent(app);
    await login(TEST_PIN, agent);
    await agent.post('/api/auth/logout');
    expect((await agent.get('/api/auth/status')).body.logged_in).toBe(false);
  });
});

describe('PIN 변경', () => {
  it('지금 PIN 확인 후 새 PIN 저장 → 예전 PIN·다른 기기 쿠키 거부, 새 PIN 통과', async () => {
    const me = request.agent(app);
    const spouse = request.agent(app);
    await login(TEST_PIN, me);
    await login(TEST_PIN, spouse);

    pool.query.mockResolvedValueOnce({ rows: [] }); // app_settings 저장
    const res = await me.post('/api/auth/change-pin').send({ current_pin: TEST_PIN, new_pin: '135790' });
    expect(res.status).toBe(200);

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO app_settings/);
    expect(params[0]).toMatch(/^scrypt\$/);
    expect(params[0]).not.toContain('135790');

    expect((await me.get('/api/auth/status')).body.logged_in).toBe(true); // 바꾼 사람은 새 쿠키
    expect((await spouse.get('/api/auth/status')).body.logged_in).toBe(false);
    expect((await login(TEST_PIN)).status).toBe(401);
    expect((await login('135790')).status).toBe(200);
  });

  it('지금 PIN이 틀리면 바꾸지 않는다', async () => {
    const me = request.agent(app);
    await login(TEST_PIN, me);
    const res = await me.post('/api/auth/change-pin').send({ current_pin: '0000', new_pin: '135790' });
    expect(res.status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('새 PIN은 숫자 4~6자리만', async () => {
    const me = request.agent(app);
    await login(TEST_PIN, me);
    for (const new_pin of ['12', '1234567', 'abcd']) {
      expect((await me.post('/api/auth/change-pin').send({ current_pin: TEST_PIN, new_pin })).status).toBe(400);
    }
  });

  it('로그인하지 않으면 PIN 변경 불가', async () => {
    const res = await request(app).post('/api/auth/change-pin').send({ current_pin: TEST_PIN, new_pin: '135790' });
    expect(res.status).toBe(401);
  });

  it('APP_PIN_RESET=true면 앱에서 바꾼 PIN을 지우고 환경변수 PIN으로 돌아간다', async () => {
    auth.setStoredHash(auth.hashPin('8642'));
    process.env.APP_PIN_RESET = 'true';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      pool.query.mockResolvedValueOnce({ rows: [] });
      const { loadStoredPinHash } = await import('../routes/auth.js');
      await loadStoredPinHash();
      expect(pool.query.mock.calls[0][0]).toMatch(/DELETE FROM app_settings WHERE key = 'pin_hash'/);
      expect((await login('8642')).status).toBe(401);
      expect((await login(TEST_PIN)).status).toBe(200);
    } finally {
      delete process.env.APP_PIN_RESET;
      warn.mockRestore();
    }
  });

  it('앱에서 바꾼 PIN(DB 값)이 환경변수보다 우선한다', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ value: auth.hashPin('8642') }] });
    const { loadStoredPinHash } = await import('../routes/auth.js');
    await loadStoredPinHash();
    expect((await login(TEST_PIN)).status).toBe(401);
    expect((await login('8642')).status).toBe(200);
  });
});
