import pg from 'pg';
const { Pool } = pg;

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
}

export default pool;
