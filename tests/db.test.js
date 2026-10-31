import { describe, it, expect, vi } from 'vitest';

// initDb의 SQL 순서 검사: 빈 DB에서 ALTER TABLE이 그 테이블의 CREATE TABLE보다 먼저 나오면 시작이 실패한다.
vi.mock('pg', () => {
  class Pool {
    constructor() { this.query = vi.fn().mockResolvedValue({ rows: [] }); }
    on() {}
  }
  return { default: { Pool, types: { setTypeParser: vi.fn() } } };
});

const { initDb, default: pool } = await import('../db.js');

describe('initDb', () => {
  it('모든 ALTER TABLE은 그 테이블을 만든 뒤에 실행된다', async () => {
    await initDb();
    const sqls = pool.query.mock.calls.map(([sql]) => sql);
    const created = new Set();
    for (const sql of sqls) {
      const create = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
      if (create) created.add(create[1]);
      const alter = sql.match(/ALTER TABLE (\w+)/);
      if (alter) expect(created.has(alter[1]), `${alter[1]}를 만들기 전에 ALTER`).toBe(true);
    }
    expect(created).toEqual(new Set(['schedules', 'classes', 'class_exceptions', 'one_day_events', 'places', 'app_settings', 'supply_checks']));
  });
});
