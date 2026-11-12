// 예전 앱(v1)의 'pg'를 메모리 DB(pg-mem)로 바꿔 끼운다. 영상·기록용으로 PC에서만 띄울 때 쓴다.
import { newDb } from 'pg-mem';
import pg from 'pg';

export const mem = newDb();
const { Pool: MemPool } = mem.adapters.createPg();

// pg-mem은 ALTER COLUMN ... TYPE을 못 해서 그 줄(예전 마이그레이션)만 건너뛴다.
class Pool {
  constructor() { this.inner = new MemPool(); }
  on() {}
  query(sql, params) {
    if (/ALTER COLUMN day TYPE/.test(sql)) return Promise.resolve({ rows: [] });
    return this.inner.query(sql, params);
  }
}

export const pool = new Pool();
export default { Pool: function SharedPool() { return pool; }, types: pg.types };
