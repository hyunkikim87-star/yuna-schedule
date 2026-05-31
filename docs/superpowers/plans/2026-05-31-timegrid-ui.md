# Timegrid UI 개편 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 카드뷰를 모바일 타임그리드(구글 캘린더형)로 전면 개편하고 공휴일 컬럼 자동 추가.

**Architecture:** Express 백엔드에 `start_time`/`end_time` 컬럼을 추가하고, React 프론트엔드를 AppBar + WeekView + EventModal 구조로 재작성한다. 공휴일 데이터는 `src/holidays.js`에 하드코딩해 프론트엔드에서만 처리한다.

**Tech Stack:** React 19, Vite, Express 5, PostgreSQL (`pg`), Vitest + Supertest

---

## 파일 구조

**생성:**
- `src/holidays.js` — 2025~2030 한국 공휴일 데이터 + `getHolidaysInWeek()` 유틸
- `src/components/AppBar.jsx` — 년/월 드롭다운 + ◀▶ 주 이동
- `src/components/EventBlock.jsx` — 타임그리드 내 수업 블록
- `src/components/WeekView.jsx` — 타임그리드 전체 (헤더 + 시간축 + 컬럼)
- `src/components/EventModal.jsx` — 추가/수정 팝업 (시간·요일 포함)

**수정:**
- `db.js` — `start_time`, `end_time` 컬럼 마이그레이션 추가
- `routes/schedules.js` — POST/PUT에 `start_time`, `end_time` 처리
- `src/App.jsx` — 전면 재작성 (WeekView + AppBar + EventModal)
- `src/App.css` — 타임그리드 스타일로 전면 교체
- `tests/schedules.test.js` — 헬스체크 경로 수정 + 시간 필드 테스트 추가

**삭제:**
- `src/components/ScheduleColumn.jsx`
- `src/components/ScheduleCard.jsx`
- `src/components/ScheduleModal.jsx`

---

## Task 1: DB 마이그레이션 — start_time, end_time 추가

**Files:**
- Modify: `db.js`

- [ ] **Step 1: `db.js`의 `initDb()` 업데이트**

```js
// db.js — initDb() 전체 교체
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
  await pool.query(`
    ALTER TABLE schedules
      ADD COLUMN IF NOT EXISTS start_time VARCHAR(5),
      ADD COLUMN IF NOT EXISTS end_time   VARCHAR(5)
  `);
}
```

- [ ] **Step 2: 커밋**

```bash
git add db.js
git commit -m "feat: add start_time and end_time columns to schedules"
```

---

## Task 2: 백엔드 — schedules API에 시간 필드 추가

**Files:**
- Modify: `routes/schedules.js`
- Modify: `tests/schedules.test.js`

- [ ] **Step 1: `tests/schedules.test.js` — 실패 테스트 추가**

기존 `POST /api/schedules` describe 블록 안에 테스트를 추가한다:

```js
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
```

기존 `PUT /api/schedules/:id` describe 블록에도 테스트 추가:

```js
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
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npm test
```

Expected: 두 신규 테스트 FAIL

- [ ] **Step 3: `routes/schedules.js` — POST 업데이트**

```js
// router.post 전체 교체
router.post('/', async (req, res) => {
  const { year, month, week, day, class_name, location, memo, supplies, start_time, end_time } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO schedules (year, month, week, day, class_name, location, memo, supplies, start_time, end_time)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [year, month, week, day, class_name, location || null, memo || null, supplies || null, start_time || null, end_time || null]
  );
  res.status(201).json(rows[0]);
});
```

- [ ] **Step 4: `routes/schedules.js` — PUT 업데이트**

```js
// router.put 전체 교체
router.put('/:id', async (req, res) => {
  const { class_name, location, memo, supplies, start_time, end_time } = req.body;
  const { rows } = await pool.query(
    `UPDATE schedules SET class_name=$1, location=$2, memo=$3, supplies=$4, start_time=$5, end_time=$6
     WHERE id=$7 RETURNING *`,
    [class_name, location || null, memo || null, supplies || null, start_time || null, end_time || null, Number(req.params.id)]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
npm test
```

Expected: 전체 PASS

- [ ] **Step 6: 커밋**

```bash
git add routes/schedules.js tests/schedules.test.js
git commit -m "feat: add start_time and end_time to schedules API"
```

---

## Task 3: 헬스체크 테스트 수정 + src/holidays.js 생성

**Files:**
- Modify: `tests/schedules.test.js`
- Create: `src/holidays.js`

- [ ] **Step 1: 헬스체크 테스트 수정**

`tests/schedules.test.js`에서 `GET /` describe 블록을 수정한다:

```js
// 기존: describe('GET /', () => { ... request(app).get('/') ... })
// 변경 후:
describe('GET /api/health', () => {
  it('returns { ok: true }', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: 테스트 통과 확인**

```bash
npm test
```

Expected: 전체 PASS

- [ ] **Step 3: `src/holidays.js` 생성**

```js
// src/holidays.js
const FIXED = [
  { month: 1,  day: 1,  name: '신정' },
  { month: 3,  day: 1,  name: '삼일절' },
  { month: 5,  day: 5,  name: '어린이날' },
  { month: 6,  day: 6,  name: '현충일' },
  { month: 8,  day: 15, name: '광복절' },
  { month: 10, day: 3,  name: '개천절' },
  { month: 10, day: 9,  name: '한글날' },
  { month: 12, day: 25, name: '성탄절' },
];

const LUNAR = {
  2025: [
    { date: '2025-01-28', name: '설날 연휴' },
    { date: '2025-01-29', name: '설날' },
    { date: '2025-01-30', name: '설날 연휴' },
    { date: '2025-05-05', name: '부처님오신날' },
    { date: '2025-10-05', name: '추석 연휴' },
    { date: '2025-10-06', name: '추석' },
    { date: '2025-10-07', name: '추석 연휴' },
    { date: '2025-10-08', name: '대체공휴일' },
  ],
  2026: [
    { date: '2026-02-16', name: '설날 연휴' },
    { date: '2026-02-17', name: '설날' },
    { date: '2026-02-18', name: '설날 연휴' },
    { date: '2026-05-24', name: '부처님오신날' },
    { date: '2026-09-24', name: '추석 연휴' },
    { date: '2026-09-25', name: '추석' },
    { date: '2026-09-26', name: '추석 연휴' },
  ],
  2027: [
    { date: '2027-02-06', name: '설날 연휴' },
    { date: '2027-02-07', name: '설날' },
    { date: '2027-02-08', name: '설날 연휴' },
    { date: '2027-05-13', name: '부처님오신날' },
    { date: '2027-10-14', name: '추석 연휴' },
    { date: '2027-10-15', name: '추석' },
    { date: '2027-10-16', name: '추석 연휴' },
  ],
  2028: [
    { date: '2028-01-26', name: '설날 연휴' },
    { date: '2028-01-27', name: '설날' },
    { date: '2028-01-28', name: '설날 연휴' },
    { date: '2028-05-02', name: '부처님오신날' },
    { date: '2028-10-02', name: '추석 연휴' },
    { date: '2028-10-03', name: '추석/개천절' },
    { date: '2028-10-04', name: '추석 연휴' },
  ],
  2029: [
    { date: '2029-02-12', name: '설날 연휴' },
    { date: '2029-02-13', name: '설날' },
    { date: '2029-02-14', name: '설날 연휴' },
    { date: '2029-05-20', name: '부처님오신날' },
    { date: '2029-09-21', name: '추석 연휴' },
    { date: '2029-09-22', name: '추석' },
    { date: '2029-09-23', name: '추석 연휴' },
  ],
  2030: [
    { date: '2030-02-02', name: '설날 연휴' },
    { date: '2030-02-03', name: '설날' },
    { date: '2030-02-04', name: '설날 연휴' },
    { date: '2030-05-09', name: '부처님오신날' },
    { date: '2030-09-11', name: '추석 연휴' },
    { date: '2030-09-12', name: '추석' },
    { date: '2030-09-13', name: '추석 연휴' },
  ],
};

function pad(n) { return String(n).padStart(2, '0'); }

function getAllHolidays(year) {
  const fixed = FIXED.map(h => ({ date: `${year}-${pad(h.month)}-${pad(h.day)}`, name: h.name }));
  return [...fixed, ...(LUNAR[year] ?? [])];
}

function getNthSaturday(year, month, week) {
  const d = new Date(year, month - 1, 1);
  let count = 0;
  while (d.getMonth() === month - 1) {
    if (d.getDay() === 6) { count++; if (count === week) return new Date(d); }
    d.setDate(d.getDate() + 1);
  }
  return null;
}

// Returns array of { date: 'YYYY-MM-DD', name: '공휴일명' } for weekday holidays in the given week.
// A "week" spans Mon(sat-5) through Sun(sat+1) where sat is the Nth Saturday of the month.
export function getHolidaysInWeek(year, month, week) {
  const sat = getNthSaturday(year, month, week);
  if (!sat) return [];
  const weekStart = new Date(sat); weekStart.setDate(sat.getDate() - 5);
  const weekEnd = new Date(sat); weekEnd.setDate(sat.getDate() + 1);
  return getAllHolidays(year).filter(h => {
    const d = new Date(h.date);
    const dow = d.getDay();
    return d >= weekStart && d <= weekEnd && dow !== 0 && dow !== 6;
  });
}
```

- [ ] **Step 4: 커밋**

```bash
git add tests/schedules.test.js src/holidays.js
git commit -m "feat: add holidays utility and fix health check test"
```

---

## Task 4: AppBar 컴포넌트

**Files:**
- Create: `src/components/AppBar.jsx`

- [ ] **Step 1: `src/components/AppBar.jsx` 생성**

```jsx
// src/components/AppBar.jsx
import { useMemo } from 'react';

function getWeekCount(year, month) {
  const d = new Date(year, month - 1, 1);
  let count = 0;
  while (d.getMonth() === month - 1) {
    if (d.getDay() === 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count || 4;
}

function getNthSaturday(year, month, week) {
  const d = new Date(year, month - 1, 1);
  let count = 0;
  while (d.getMonth() === month - 1) {
    if (d.getDay() === 6) { count++; if (count === week) return new Date(d); }
    d.setDate(d.getDate() + 1);
  }
  return null;
}

function getWeekLabel(year, month, week) {
  const sat = getNthSaturday(year, month, week);
  if (!sat) return '';
  const sun = new Date(sat); sun.setDate(sat.getDate() + 1);
  const fmt = d => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${week}주차 · ${fmt(sat)}(토) ~ ${fmt(sun)}(일)`;
}

export default function AppBar({ year, month, week, onYearChange, onMonthChange, onPrevWeek, onNextWeek }) {
  const now = new Date();
  const label = useMemo(() => getWeekLabel(year, month, week), [year, month, week]);

  return (
    <header className="appbar">
      <div className="appbar-title">유나 수업 일정</div>
      <div className="appbar-nav">
        <select value={year} onChange={e => onYearChange(Number(e.target.value))}>
          {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
            <option key={y} value={y}>{y}년</option>
          ))}
        </select>
        <select value={month} onChange={e => onMonthChange(Number(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <option key={m} value={m}>{m}월</option>
          ))}
        </select>
        <button className="nav-btn" onClick={onPrevWeek}>◀</button>
        <button className="nav-btn" onClick={onNextWeek}>▶</button>
      </div>
      <div className="appbar-week-label">{label}</div>
    </header>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/AppBar.jsx
git commit -m "feat: add AppBar component with week navigation"
```

---

## Task 5: EventBlock 컴포넌트

**Files:**
- Create: `src/components/EventBlock.jsx`

- [ ] **Step 1: `src/components/EventBlock.jsx` 생성**

```jsx
// src/components/EventBlock.jsx
const COLORS = [
  { bg: '#e8f5e9', border: '#34a853', text: '#1b5e20' },
  { bg: '#fce8e6', border: '#ea4335', text: '#b71c1c' },
  { bg: '#fff8e1', border: '#fbbc04', text: '#5d4037' },
  { bg: '#f3e5f5', border: '#9c27b0', text: '#4a148c' },
  { bg: '#e3f2fd', border: '#1976d2', text: '#0d47a1' },
];

const HOUR_HEIGHT = 56;
const GRID_START_HOUR = 9;

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function getEventStyle(start_time, end_time) {
  if (!start_time || !end_time) return null;
  const startMin = timeToMinutes(start_time);
  const endMin = timeToMinutes(end_time);
  const top = ((startMin - GRID_START_HOUR * 60) / 60) * HOUR_HEIGHT;
  const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 28);
  return { top, height };
}

export default function EventBlock({ item, onEdit }) {
  const color = COLORS[item.id % COLORS.length];
  const style = getEventStyle(item.start_time, item.end_time);
  if (!style) return null;

  return (
    <div
      className="event-block"
      style={{ top: style.top, height: style.height, background: color.bg, borderLeftColor: color.border, color: color.text }}
      onClick={() => onEdit(item)}
    >
      <div className="event-name">{item.class_name}</div>
      <div className="event-time">{item.start_time} ~ {item.end_time}</div>
      {item.location && <div className="event-loc">{item.location}</div>}
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/EventBlock.jsx
git commit -m "feat: add EventBlock component for time grid"
```

---

## Task 6: WeekView 컴포넌트

**Files:**
- Create: `src/components/WeekView.jsx`

- [ ] **Step 1: `src/components/WeekView.jsx` 생성**

```jsx
// src/components/WeekView.jsx
import EventBlock from './EventBlock';

const HOURS = Array.from({ length: 9 }, (_, i) => i + 9); // 9~17
const DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];

export default function WeekView({ schedules, holidays, onEdit }) {
  const columns = [
    ...holidays.map(h => ({ key: h.date, day: h.date, label: h.name, cls: 'holiday', dateStr: h.date })),
    { key: 'SAT', day: 'SAT', label: '토요일', cls: 'sat' },
    { key: 'SUN', day: 'SUN', label: '일요일', cls: 'sun' },
  ];

  const timedSchedules = schedules.filter(s => s.start_time && s.end_time);
  const untimedSchedules = schedules.filter(s => !s.start_time || !s.end_time);

  function getDateLabel(col) {
    if (!col.dateStr) return null;
    const d = new Date(col.dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}(${DOW_KO[d.getDay()]})`;
  }

  return (
    <div className="week-view">
      {untimedSchedules.length > 0 && (
        <div className="allday-row">
          <div className="allday-label">시간 미정</div>
          <div className="allday-items">
            {untimedSchedules.map(s => (
              <div key={s.id} className="allday-item" onClick={() => onEdit(s)}>
                {s.class_name}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="calendar">
        <div className="day-headers">
          <div className="time-gutter" />
          {columns.map(col => (
            <div key={col.key} className={`day-col-header ${col.cls}`}>
              {getDateLabel(col) && <span className="day-date-label">{getDateLabel(col)}</span>}
              <span className="day-name-label">{col.label}</span>
            </div>
          ))}
        </div>

        <div className="grid-body">
          <div className="time-col">
            {HOURS.map(h => <div key={h} className="time-slot">{h}시</div>)}
          </div>
          {columns.map(col => (
            <div key={col.key} className="day-col">
              {HOURS.map(h => <div key={h} className="slot-line" />)}
              {timedSchedules
                .filter(s => s.day === col.day)
                .map(s => <EventBlock key={s.id} item={s} onEdit={onEdit} />)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/WeekView.jsx
git commit -m "feat: add WeekView time grid component"
```

---

## Task 7: EventModal 컴포넌트

**Files:**
- Create: `src/components/EventModal.jsx`

- [ ] **Step 1: `src/components/EventModal.jsx` 생성**

```jsx
// src/components/EventModal.jsx
import { useState } from 'react';

// 09:00 ~ 18:00, 30분 단위 (19개 옵션)
const TIME_OPTIONS = [''].concat(
  Array.from({ length: 19 }, (_, i) => {
    const total = 9 * 60 + i * 30;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  })
);

export default function EventModal({ mode, item, holidays, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({
    class_name: item?.class_name ?? '',
    day: item?.day ?? 'SAT',
    start_time: item?.start_time ?? '',
    end_time: item?.end_time ?? '',
    location: item?.location ?? '',
    supplies: item?.supplies ?? '',
    memo: item?.memo ?? '',
  });

  function set(field, val) { setForm(f => ({ ...f, [field]: val })); }

  function handleSave() {
    if (!form.class_name.trim()) return;
    onSave({
      ...form,
      id: item?.id,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
    });
  }

  const dayOptions = [
    { value: 'SAT', label: '토요일' },
    { value: 'SUN', label: '일요일' },
    ...holidays.map(h => ({ value: h.date, label: `${h.name} (${h.date})` })),
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{mode === 'add' ? '수업 추가' : '수업 수정'}</div>

        <label className="modal-field">
          <span>수업명 *</span>
          <input value={form.class_name} onChange={e => set('class_name', e.target.value)} placeholder="필수" />
        </label>

        <label className="modal-field">
          <span>요일</span>
          <select value={form.day} onChange={e => set('day', e.target.value)}>
            {dayOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>

        <div className="modal-row">
          <label className="modal-field">
            <span>시작 시간</span>
            <select value={form.start_time} onChange={e => set('start_time', e.target.value)}>
              {TIME_OPTIONS.map(t => <option key={t} value={t}>{t || '미정'}</option>)}
            </select>
          </label>
          <label className="modal-field">
            <span>종료 시간</span>
            <select value={form.end_time} onChange={e => set('end_time', e.target.value)}>
              {TIME_OPTIONS.map(t => <option key={t} value={t}>{t || '미정'}</option>)}
            </select>
          </label>
        </div>

        <label className="modal-field">
          <span>장소</span>
          <input value={form.location} onChange={e => set('location', e.target.value)} />
        </label>

        <label className="modal-field">
          <span>준비물</span>
          <input value={form.supplies} onChange={e => set('supplies', e.target.value)} />
        </label>

        <label className="modal-field">
          <span>메모</span>
          <input value={form.memo} onChange={e => set('memo', e.target.value)} />
        </label>

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
git add src/components/EventModal.jsx
git commit -m "feat: add EventModal with time and day selector"
```

---

## Task 8: App.jsx 재작성

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: `src/App.jsx` 전체 교체**

```jsx
// src/App.jsx
import { useState, useEffect, useCallback } from 'react';
import AppBar from './components/AppBar';
import WeekView from './components/WeekView';
import EventModal from './components/EventModal';
import { getHolidaysInWeek } from './holidays';
import './App.css';

function getWeekCount(year, month) {
  const d = new Date(year, month - 1, 1);
  let count = 0;
  while (d.getMonth() === month - 1) {
    if (d.getDay() === 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count || 4;
}

function getCurrentWeek(year, month) {
  const today = new Date();
  if (today.getFullYear() !== year || today.getMonth() + 1 !== month) return 1;
  const d = new Date(year, month - 1, 1);
  let weekNum = 0;
  while (d.getMonth() === month - 1) {
    if (d.getDay() === 6) { weekNum++; if (d >= today) return weekNum; }
    d.setDate(d.getDate() + 1);
  }
  return Math.max(1, weekNum);
}

export default function App() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [week, setWeek] = useState(() => getCurrentWeek(now.getFullYear(), now.getMonth() + 1));
  const [schedules, setSchedules] = useState([]);
  const [modal, setModal] = useState(null); // null | { mode: 'add'|'edit', item?: {} }

  const weekCount = getWeekCount(year, month);
  const holidays = getHolidaysInWeek(year, month, week);

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch(`/api/schedules?year=${year}&month=${month}&week=${week}`);
      if (!res.ok) throw new Error();
      setSchedules(await res.json());
    } catch { console.error('Failed to fetch schedules'); }
  }, [year, month, week]);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  function prevWeek() {
    if (week > 1) { setWeek(w => w - 1); return; }
    const nm = month === 1 ? 12 : month - 1;
    const ny = month === 1 ? year - 1 : year;
    setYear(ny); setMonth(nm); setWeek(getWeekCount(ny, nm));
  }

  function nextWeek() {
    if (week < weekCount) { setWeek(w => w + 1); return; }
    const nm = month === 12 ? 1 : month + 1;
    const ny = month === 12 ? year + 1 : year;
    setYear(ny); setMonth(nm); setWeek(1);
  }

  async function handleSave(data) {
    try {
      let res;
      if (data.id) {
        res = await fetch(`/api/schedules/${data.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } else {
        res = await fetch('/api/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, year, month, week }),
        });
      }
      if (!res.ok) throw new Error();
      setModal(null);
      fetchSchedules();
    } catch { console.error('Failed to save'); }
  }

  async function handleDelete(id) {
    try {
      const res = await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setModal(null);
      fetchSchedules();
    } catch { console.error('Failed to delete'); }
  }

  return (
    <div className="app">
      <AppBar
        year={year} month={month} week={week}
        onYearChange={y => { setYear(y); setWeek(1); }}
        onMonthChange={m => { setMonth(m); setWeek(1); }}
        onPrevWeek={prevWeek}
        onNextWeek={nextWeek}
      />
      <WeekView
        schedules={schedules}
        holidays={holidays}
        onEdit={item => setModal({ mode: 'edit', item })}
      />
      <button className="fab" onClick={() => setModal({ mode: 'add' })}>+</button>
      {modal && (
        <EventModal
          mode={modal.mode}
          item={modal.item}
          holidays={holidays}
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
git commit -m "feat: rewrite App with AppBar, WeekView, EventModal"
```

---

## Task 9: App.css 전면 교체

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: `src/App.css` 전체 교체**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #f0f2f5;
  color: #212529;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  max-width: 600px;
  margin: 0 auto;
  background: #fff;
}

/* ── AppBar ── */
.appbar {
  background: #4285f4;
  color: #fff;
  padding: 14px 16px 10px;
  flex-shrink: 0;
}

.appbar-title { font-size: 16px; font-weight: 700; margin-bottom: 8px; }

.appbar-nav { display: flex; align-items: center; gap: 8px; }

.appbar-nav select {
  background: rgba(255,255,255,0.2);
  border: none;
  color: #fff;
  font-size: 13px;
  padding: 5px 8px;
  border-radius: 6px;
  flex: 1;
  -webkit-appearance: none;
}
.appbar-nav select option { color: #333; background: #fff; }

.nav-btn {
  background: rgba(255,255,255,0.2);
  border: none;
  color: #fff;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  flex-shrink: 0;
}

.appbar-week-label { font-size: 12px; opacity: 0.85; margin-top: 6px; }

/* ── WeekView ── */
.week-view { flex: 1; overflow-y: auto; position: relative; }

.allday-row {
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
  padding: 8px 8px 8px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.allday-label {
  font-size: 10px;
  color: #999;
  width: 44px;
  text-align: right;
  flex-shrink: 0;
  padding-right: 6px;
}

.allday-items { display: flex; flex-wrap: wrap; gap: 4px; }

.allday-item {
  background: #e9ecef;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
}

/* ── Calendar Grid ── */
.calendar { overflow: hidden; }

.day-headers {
  display: flex;
  position: sticky;
  top: 0;
  z-index: 10;
  background: #fff;
  border-bottom: 2px solid #e0e0e0;
}

.time-gutter { width: 44px; flex-shrink: 0; }

.day-col-header {
  flex: 1;
  text-align: center;
  padding: 7px 4px;
  border-left: 1px solid #f0f0f0;
}

.day-date-label { display: block; font-size: 11px; font-weight: 600; }
.day-name-label { display: block; font-size: 11px; }

.day-col-header.sat .day-name-label { color: #4285f4; font-weight: 700; }
.day-col-header.sun .day-name-label { color: #ea4335; font-weight: 700; }
.day-col-header.holiday { background: #fff8f8; }
.day-col-header.holiday .day-name-label { color: #ea4335; font-size: 10px; }

/* ── Grid Body ── */
.grid-body { display: flex; }

.time-col { width: 44px; flex-shrink: 0; }

.time-slot {
  height: 56px;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 3px 6px 0 0;
  font-size: 10px;
  color: #999;
  border-top: 1px solid #f0f0f0;
}

.day-col {
  flex: 1;
  border-left: 1px solid #f0f0f0;
  position: relative;
}

.slot-line { height: 56px; border-top: 1px solid #f0f0f0; }

/* ── Event Block ── */
.event-block {
  position: absolute;
  left: 3px;
  right: 3px;
  border-radius: 6px;
  border-left: 3px solid;
  padding: 4px 6px;
  font-size: 11px;
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.event-name { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.event-time { font-size: 10px; opacity: 0.8; margin-top: 1px; }
.event-loc { font-size: 10px; opacity: 0.7; }

/* ── FAB ── */
.fab {
  position: fixed;
  bottom: 24px;
  right: max(24px, calc(50vw - 276px));
  width: 52px;
  height: 52px;
  background: #4285f4;
  color: #fff;
  border: none;
  border-radius: 50%;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(66,133,244,0.45);
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Modal ── */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: #fff;
  border-radius: 16px 16px 0 0;
  padding: 20px 20px 32px;
  width: 100%;
  max-width: 600px;
  box-shadow: 0 -4px 24px rgba(0,0,0,0.15);
  max-height: 85vh;
  overflow-y: auto;
}

.modal-title { font-size: 1rem; font-weight: 700; margin-bottom: 16px; }

.modal-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }

.modal-field span { font-size: 0.75rem; color: #6c757d; font-weight: 600; }

.modal-field input, .modal-field select {
  padding: 8px 10px;
  border: 1px solid #ced4da;
  border-radius: 6px;
  font-size: 0.95rem;
  background: #fff;
}

.modal-field input:focus, .modal-field select:focus {
  outline: none;
  border-color: #4285f4;
}

.modal-row { display: flex; gap: 12px; }
.modal-row .modal-field { flex: 1; }

.modal-actions { display: flex; gap: 8px; margin-top: 20px; }

.btn-save {
  flex: 1;
  padding: 12px;
  background: #4285f4;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-cancel {
  flex: 1;
  padding: 12px;
  background: #f1f3f5;
  color: #495057;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  cursor: pointer;
}

.btn-delete {
  padding: 12px 16px;
  background: #fce8e6;
  color: #c62828;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  cursor: pointer;
}

.btn-save:hover { background: #3367d6; }
.btn-cancel:hover { background: #e9ecef; }
.btn-delete:hover { background: #f5c2c7; }
```

- [ ] **Step 2: 커밋**

```bash
git add src/App.css
git commit -m "feat: replace App.css with timegrid styles"
```

---

## Task 10: 구버전 컴포넌트 삭제 + 최종 확인

**Files:**
- Delete: `src/components/ScheduleColumn.jsx`
- Delete: `src/components/ScheduleCard.jsx`
- Delete: `src/components/ScheduleModal.jsx`

- [ ] **Step 1: 구버전 컴포넌트 삭제**

```bash
git rm src/components/ScheduleColumn.jsx src/components/ScheduleCard.jsx src/components/ScheduleModal.jsx
```

- [ ] **Step 2: 전체 테스트 통과 확인**

```bash
npm test
```

Expected: 전체 PASS

- [ ] **Step 3: 로컬 빌드 확인**

```bash
npm run build
```

Expected: 에러 없이 `dist/` 생성

- [ ] **Step 4: 로컬 개발 서버에서 동작 확인**

```bash
npm run dev
```

브라우저에서 `http://localhost:5173` 접속 후 확인:
1. 타임그리드가 렌더링되는가
2. + 버튼 → 팝업 → 수업 추가되는가
3. 수업 블록 탭 → 수정/삭제되는가
4. ◀▶ 버튼으로 주 이동되는가

- [ ] **Step 5: GitHub push → Railway 자동 재배포**

```bash
git push
```

- [ ] **Step 6: 최종 커밋 (삭제 포함)**

```bash
git add -A
git commit -m "feat: complete timegrid UI — remove old card components"
git push
```
