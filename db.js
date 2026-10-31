import pg from 'pg';
const { Pool, types } = pg;

// DATE 열은 JS Date(시간대 변환)로 바꾸지 않고 'YYYY-MM-DD' 문자열 그대로 받는다.
types.setTypeParser(1082, (v) => v);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected DB error:', err);
  process.exit(-1);
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schedules (
      id         SERIAL PRIMARY KEY,
      year       INTEGER      NOT NULL,
      month      INTEGER      NOT NULL,
      week       INTEGER      NOT NULL,
      day        VARCHAR(10)  NOT NULL,
      class_name VARCHAR(100) NOT NULL,
      location   VARCHAR(100),
      memo       TEXT,
      supplies   TEXT,
      start_time VARCHAR(5),
      end_time   VARCHAR(5)
    )
  `);
  await pool.query(`ALTER TABLE schedules ADD COLUMN IF NOT EXISTS start_time VARCHAR(5)`);
  await pool.query(`ALTER TABLE schedules ADD COLUMN IF NOT EXISTS end_time VARCHAR(5)`);
  await pool.query(`ALTER TABLE schedules ALTER COLUMN day TYPE VARCHAR(10)`);

  // v2: 정규 수업 + 예외 + 원데이. 회차는 DB에 만들어 두지 않고 lib/sessions.js에서 계산한다.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS classes (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(100) NOT NULL,
      weekday    SMALLINT     NOT NULL CHECK (weekday BETWEEN 0 AND 6),
      start_time VARCHAR(5)   NOT NULL,
      end_time   VARCHAR(5),
      location   VARCHAR(100),
      start_date DATE         NOT NULL,
      end_date   DATE         NOT NULL,
      supplies   TEXT,
      memo       TEXT,
      color      VARCHAR(20),
      term       VARCHAR(50),
      created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
      CHECK (start_date <= end_date)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS class_exceptions (
      id         SERIAL PRIMARY KEY,
      class_id   INTEGER      NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      date       DATE         NOT NULL,
      type       VARCHAR(10)  NOT NULL CHECK (type IN ('cancel', 'change')),
      start_time VARCHAR(5),
      end_time   VARCHAR(5),
      location   VARCHAR(100),
      memo       TEXT,
      UNIQUE (class_id, date)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS one_day_events (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(100) NOT NULL,
      date       DATE         NOT NULL,
      start_time VARCHAR(5)   NOT NULL,
      end_time   VARCHAR(5),
      location   VARCHAR(100),
      supplies   TEXT,
      memo       TEXT,
      color      VARCHAR(20),
      created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS places (
      id      SERIAL PRIMARY KEY,
      name    VARCHAR(100) NOT NULL UNIQUE,
      map_url TEXT
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key   VARCHAR(50) PRIMARY KEY,
      value TEXT        NOT NULL
    )
  `);

  // 나중에 추가한 열. 테이블을 모두 만든 뒤에 둔다 (빈 DB에서도 순서대로 동작하게).
  // 그 날만 다른 준비물 (예: 첫 날만 '체스판')
  await pool.query(`ALTER TABLE class_exceptions ADD COLUMN IF NOT EXISTS supplies TEXT`);
  // 수업 구매·신청 페이지 주소
  await pool.query(`ALTER TABLE classes ADD COLUMN IF NOT EXISTS link TEXT`);
  await pool.query(`ALTER TABLE one_day_events ADD COLUMN IF NOT EXISTS link TEXT`);
}

export default pool;
