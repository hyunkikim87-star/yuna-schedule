# Yuna Schedule — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 유나의 주말 수업 일정을 필립과 워니가 URL 하나로 함께 추가·수정·조회하는 공유 웹앱을 구축하고 Railway에 배포한다.

**Architecture:** React + Vite SPA + Express REST API + Railway PostgreSQL. 개발 시 Vite dev server가 `/api` 요청을 Express(3000)로 프록시. 프로덕션에서는 Express가 `dist/`를 정적 서빙.

**Tech Stack:** React 19, Vite 8, Express 5, pg (node-postgres), vitest, supertest, Railway

---

## File Map

| 파일 | 변경 | 역할 |
|------|------|------|
| `package.json` | modify | pg, vitest, supertest 의존성 추가 |
| `vite.config.js` | modify | 개발 중 /api 프록시 추가 |
| `railway.json` | create | Railway 빌드/시작 명령 |
| `db.js` | create | pg Pool + initDb() |
| `routes/schedules.js` | create | CRUD 라우트 |
| `server.js` | rewrite | 기존 JSON 로직 제거, DB 라우트 연결 |
| `tests/schedules.test.js` | create | API 테스트 (vitest + supertest) |
| `src/App.jsx` | rewrite | 월/주차 셀렉터 + 레이아웃 |
| `src/App.css` | rewrite | 전체 스타일 |
| `src/components/ScheduleCard.jsx` | create | 수업 카드 |
| `src/components/ScheduleColumn.jsx` | create | 토/일 컬럼 |
| `src/components/ScheduleModal.jsx` | create | 추가/수정 팝업 |

---

### Task 1: 의존성 + 설정 파일

**Files:**
- Modify: `package.json`
- Modify: `vite.config.js`
- Create: `railway.json`

- [ ] **Step 1: pg, vitest, supertest 설치**

```bash
cd C:\Users\ttl22\Downloads\yuna-schedule\yuna-schedule
npm install pg
npm install --save-dev vitest supertest
```

- [ ] **Step 2: package.json scripts에 test 추가**

`package.json`의 `"scripts"` 블록:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "start": "node server.js",
  "build:start": "npm run build && node server.js",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 3: vite.config.js 교체**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
})
```

- [ ] **Step 4: railway.json 생성**

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "node server.js",
    "healthcheckPath": "/"
  }
}
```

- [ ] **Step 5: 커밋**

```bash
git add package.json package-lock.json vite.config.js railway.json
git commit -m "chore: add pg, vitest, supertest and railway/vite config"
```

---

### Task 2: DB 모듈

**Files:**
- Create: `db.js`

- [ ] **Step 1: db.js 작성**

```js
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
```

- [ ] **Step 2: 커밋**

```bash
git add db.js
git commit -m "feat: add db module with pg pool and table init"
```

---

### Task 3: API 라우트

**Files:**
- Create: `routes/schedules.js`

- [ ] **Step 1: routes 디렉토리 생성**

```bash
mkdir routes
```

- [ ] **Step 2: routes/schedules.js 작성**

```js
import { Router } from 'express';
import pool from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  const { year, month, week } = req.query;
  const { rows } = await pool.query(
    'SELECT * FROM schedules WHERE year=$1 AND month=$2 AND week=$3 ORDER BY day, id',
    [Number(year), Number(month), Number(week)]
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { year, month, week, day, class_name, location, memo, supplies } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO schedules (year, month, week, day, class_name, location, memo, supplies)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [year, month, week, day, class_name, location || null, memo || null, supplies || null]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { class_name, location, memo, supplies } = req.body;
  const { rows } = await pool.query(
    `UPDATE schedules SET class_name=$1, location=$2, memo=$3, supplies=$4
     WHERE id=$5 RETURNING *`,
    [class_name, location || null, memo || null, supplies || null, Number(req.params.id)]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM schedules WHERE id=$1', [Number(req.params.id)]);
  res.json({ ok: true });
});

export default router;
```

- [ ] **Step 3: 커밋**

```bash
git add routes/schedules.js
git commit -m "feat: add schedules CRUD routes"
```

---

### Task 4: server.js 재작성

**Files:**
- Rewrite: `server.js`

- [ ] **Step 1: server.js 전체 교체**

기존 JSON 파일 로직을 모두 제거하고 DB 기반으로 교체:

```js
import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import { initDb } from './db.js';
import schedulesRouter from './routes/schedules.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (_req, res) => res.json({ ok: true }));

app.use('/api/schedules', schedulesRouter);

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

if (process.env.NODE_ENV !== 'test') {
  initDb().then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  });
}

export default app;
```

- [ ] **Step 2: 커밋**

```bash
git add server.js
git commit -m "feat: rewrite server.js with PostgreSQL routes"
```

---

### Task 5: 백엔드 테스트

**Files:**
- Create: `tests/schedules.test.js`

- [ ] **Step 1: tests 디렉토리 생성**

```bash
mkdir tests
```

- [ ] **Step 2: tests/schedules.test.js 작성**

```js
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
```

- [ ] **Step 3: 테스트 실행 확인**

```bash
npm test
```

Expected: 7개 테스트 모두 PASS

- [ ] **Step 4: 커밋**

```bash
git add tests/schedules.test.js
git commit -m "test: add API tests with mocked pg pool"
```

---

### Task 6: App.jsx

**Files:**
- Rewrite: `src/App.jsx`

- [ ] **Step 1: src/App.jsx 전체 교체**

```jsx
import { useState, useEffect, useCallback } from 'react';
import ScheduleColumn from './components/ScheduleColumn';
import ScheduleModal from './components/ScheduleModal';
import './App.css';

function getWeekCount(year, month) {
  const date = new Date(year, month - 1, 1);
  let count = 0;
  while (date.getMonth() === month - 1) {
    if (date.getDay() === 6) count++;
    date.setDate(date.getDate() + 1);
  }
  return count || 4;
}

function getCurrentWeek(year, month) {
  const today = new Date();
  if (today.getFullYear() !== year || today.getMonth() + 1 !== month) return 1;
  const date = new Date(year, month - 1, 1);
  let weekNum = 0;
  while (date.getMonth() === month - 1) {
    if (date.getDay() === 6) {
      weekNum++;
      if (date >= today) return weekNum;
    }
    date.setDate(date.getDate() + 1);
  }
  return Math.max(1, weekNum);
}

export default function App() {
  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [week, setWeek] = useState(() => getCurrentWeek(now.getFullYear(), now.getMonth() + 1));
  const [schedules, setSchedules] = useState([]);
  const [modal, setModal] = useState(null); // null | { mode: 'add'|'edit', day: 'SAT'|'SUN', item?: {} }

  const weekCount = getWeekCount(year, month);

  const fetchSchedules = useCallback(async () => {
    const res = await fetch(`/api/schedules?year=${year}&month=${month}&week=${week}`);
    setSchedules(await res.json());
  }, [year, month, week]);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  async function handleSave(data) {
    if (data.id) {
      await fetch(`/api/schedules/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } else {
      await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, year, month, week }),
      });
    }
    setModal(null);
    fetchSchedules();
  }

  async function handleDelete(id) {
    await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
    setModal(null);
    fetchSchedules();
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>유나 주말 일정</h1>
        <div className="selectors">
          <select value={month} onChange={e => { setMonth(Number(e.target.value)); setWeek(1); }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{m}월</option>
            ))}
          </select>
          <select value={week} onChange={e => setWeek(Number(e.target.value))}>
            {Array.from({ length: weekCount }, (_, i) => i + 1).map(w => (
              <option key={w} value={w}>{w}주차</option>
            ))}
          </select>
        </div>
      </header>

      <main className="schedule-grid">
        <ScheduleColumn
          label="토요일"
          items={schedules.filter(s => s.day === 'SAT')}
          onAdd={() => setModal({ mode: 'add', day: 'SAT' })}
          onEdit={item => setModal({ mode: 'edit', day: item.day, item })}
        />
        <ScheduleColumn
          label="일요일"
          items={schedules.filter(s => s.day === 'SUN')}
          onAdd={() => setModal({ mode: 'add', day: 'SUN' })}
          onEdit={item => setModal({ mode: 'edit', day: item.day, item })}
        />
      </main>

      {modal && (
        <ScheduleModal
          mode={modal.mode}
          day={modal.day}
          item={modal.item}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/App.jsx
git commit -m "feat: App.jsx with month/week selector and schedule state"
```

---

### Task 7: ScheduleCard + ScheduleColumn 컴포넌트

**Files:**
- Create: `src/components/ScheduleCard.jsx`
- Create: `src/components/ScheduleColumn.jsx`

- [ ] **Step 1: src/components 디렉토리 생성**

```bash
mkdir src\components
```

- [ ] **Step 2: src/components/ScheduleCard.jsx 작성**

```jsx
const COLORS = ['#fff3cd', '#d1ecf1', '#d4edda', '#f8d7da', '#e2d9f3', '#fde2c8'];

export default function ScheduleCard({ item, onEdit }) {
  const bg = COLORS[item.id % COLORS.length];
  return (
    <div
      className="schedule-card"
      style={{ background: bg, borderLeftColor: bg }}
      onClick={() => onEdit(item)}
    >
      <div className="card-title">{item.class_name}</div>
      {item.location && <div className="card-meta">📍 {item.location}</div>}
      {item.supplies && <div className="card-meta">🎒 {item.supplies}</div>}
      {item.memo && <div className="card-meta">📝 {item.memo}</div>}
    </div>
  );
}
```

- [ ] **Step 3: src/components/ScheduleColumn.jsx 작성**

```jsx
import ScheduleCard from './ScheduleCard';

export default function ScheduleColumn({ label, items, onAdd, onEdit }) {
  return (
    <div className="schedule-column">
      <div className="column-header">{label}</div>
      <div className="column-body">
        {items.map(item => (
          <ScheduleCard key={item.id} item={item} onEdit={onEdit} />
        ))}
        <button className="add-btn" onClick={onAdd}>+ 수업 추가</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 커밋**

```bash
git add src/components/ScheduleCard.jsx src/components/ScheduleColumn.jsx
git commit -m "feat: ScheduleCard and ScheduleColumn components"
```

---

### Task 8: ScheduleModal 컴포넌트

**Files:**
- Create: `src/components/ScheduleModal.jsx`

- [ ] **Step 1: src/components/ScheduleModal.jsx 작성**

```jsx
import { useState } from 'react';

const LABELS = { class_name: '수업명', location: '장소', supplies: '준비물', memo: '메모' };

export default function ScheduleModal({ mode, day, item, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({
    class_name: item?.class_name ?? '',
    location: item?.location ?? '',
    memo: item?.memo ?? '',
    supplies: item?.supplies ?? '',
  });

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  function handleSave() {
    if (!form.class_name.trim()) return;
    onSave({ ...form, id: item?.id, day });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">
          {mode === 'add' ? `${day === 'SAT' ? '토요일' : '일요일'} 수업 추가` : '수업 수정'}
        </div>

        {['class_name', 'location', 'supplies', 'memo'].map(field => (
          <label key={field} className="modal-field">
            <span>{LABELS[field]}</span>
            <input
              name={field}
              value={form[field]}
              onChange={handleChange}
              placeholder={field === 'class_name' ? '필수' : ''}
            />
          </label>
        ))}

        <div className="modal-actions">
          <button className="btn-save" onClick={handleSave}>저장</button>
          <button className="btn-cancel" onClick={onClose}>취소</button>
          {mode === 'edit' && (
            <button className="btn-delete" onClick={() => onDelete(item.id)}>삭제</button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/ScheduleModal.jsx
git commit -m "feat: ScheduleModal add/edit/delete popup"
```

---

### Task 9: 스타일

**Files:**
- Rewrite: `src/App.css`

- [ ] **Step 1: src/App.css 전체 교체**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #f0f2f5;
  color: #212529;
  min-height: 100vh;
}

.app {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px 16px;
}

.app-header {
  text-align: center;
  margin-bottom: 24px;
}

.app-header h1 {
  font-size: 1.6rem;
  font-weight: 700;
  margin-bottom: 12px;
  color: #343a40;
}

.selectors {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.selectors select {
  padding: 8px 14px;
  border: 1px solid #ced4da;
  border-radius: 8px;
  background: white;
  font-size: 1rem;
  cursor: pointer;
}

.schedule-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

@media (max-width: 500px) {
  .schedule-grid { grid-template-columns: 1fr; }
}

.schedule-column {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}

.column-header {
  background: #343a40;
  color: white;
  padding: 12px 16px;
  font-weight: 700;
  font-size: 0.95rem;
}

.column-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.schedule-card {
  border-radius: 8px;
  padding: 12px;
  border-left: 4px solid;
  cursor: pointer;
  transition: opacity 0.15s;
}

.schedule-card:hover { opacity: 0.75; }

.card-title {
  font-weight: 700;
  font-size: 0.95rem;
  margin-bottom: 4px;
}

.card-meta {
  font-size: 0.8rem;
  color: #495057;
  margin-top: 2px;
}

.add-btn {
  width: 100%;
  padding: 10px;
  border: 1.5px dashed #ced4da;
  background: transparent;
  border-radius: 8px;
  color: #adb5bd;
  font-size: 0.9rem;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.add-btn:hover { border-color: #868e96; color: #495057; }

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 16px;
}

.modal {
  background: white;
  border-radius: 12px;
  padding: 24px;
  width: 100%;
  max-width: 360px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
}

.modal-title {
  font-size: 1.05rem;
  font-weight: 700;
  margin-bottom: 16px;
  color: #343a40;
}

.modal-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.modal-field span {
  font-size: 0.8rem;
  color: #6c757d;
  font-weight: 600;
}

.modal-field input {
  padding: 8px 10px;
  border: 1px solid #ced4da;
  border-radius: 6px;
  font-size: 0.95rem;
}

.modal-field input:focus { outline: none; border-color: #343a40; }

.modal-actions {
  display: flex;
  gap: 8px;
  margin-top: 20px;
}

.btn-save {
  flex: 1;
  padding: 10px;
  background: #343a40;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-cancel {
  flex: 1;
  padding: 10px;
  background: #f1f3f5;
  color: #495057;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  cursor: pointer;
}

.btn-delete {
  padding: 10px 14px;
  background: #f8d7da;
  color: #842029;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  cursor: pointer;
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/App.css
git commit -m "feat: add full stylesheet"
```

---

### Task 10: Railway 배포

- [ ] **Step 1: GitHub repo 생성 + push**

```bash
cd C:\Users\ttl22\Downloads\yuna-schedule\yuna-schedule
gh repo create yuna-schedule --public --source=. --remote=origin --push
```

- [ ] **Step 2: Railway 프로젝트 연결**

1. [railway.app](https://railway.app) → **New Project**
2. **Deploy from GitHub repo** → `yuna-schedule` 선택
3. **Deploy Now**

- [ ] **Step 3: PostgreSQL 플러그인 추가**

Railway 대시보드:
1. **New** → **Database** → **Add PostgreSQL**
2. PostgreSQL 서비스 생성 완료되면 `DATABASE_URL`이 앱에 자동 주입됨 (별도 설정 불필요)

- [ ] **Step 4: 배포 완료 + 도메인 발급**

1. Deployments 탭에서 빌드 로그 확인 (3~5분 소요)
2. 빌드 완료 후 **Settings → Networking → Generate Domain** 클릭
3. 발급된 URL 브라우저에서 열기 → `{"ok":true}` 확인

- [ ] **Step 5: 동작 확인**

1. URL 접속 → 유나 주말 일정 화면 로드
2. 월/주차 드롭다운 변경 → 일정 로드
3. `+ 수업 추가` → 팝업 → 저장 → 카드 노출
4. 카드 클릭 → 수정 → 삭제 동작
5. 다른 기기에서 같은 URL 접속 → 일정 공유 확인
