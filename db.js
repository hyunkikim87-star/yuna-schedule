import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schedules (
      id         SERIAL PRIMARY KEY,
      year       INTEGER      NOT NULL,
      month      INTEGER      NOT NULL,
      week       INTEGER      NOT NULL,
      day        VARCHAR(3)   NOT NULL,
      class_name VARCHAR(100) NOT NULL,
      location   VARCHAR(100),
      memo       TEXT,
      supplies   TEXT
    )
  `);
}

export default pool;
