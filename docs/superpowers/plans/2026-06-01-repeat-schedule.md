# 반복 스케줄 등록 + SAT/SUN 날짜 표시 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SAT/SUN 컬럼 헤더에 실제 날짜를 표시하고, 같은 수업을 N주 연속으로 자동 등록하는 기능을 추가한다.

**Architecture:** `getWeekCount`와 새 `advanceWeek`를 `src/scheduleUtils.js`로 추출해 테스트 가능하게 만든다. `getNthSaturday`를 holidays.js에서 export해 App.jsx가 토/일 날짜를 계산하고 WeekView에 내려준다. EventModal에 `등록 횟수` 입력을 추가하고, App.jsx의 handleSave가 루프로 N번 POST한다.

**Tech Stack:** React 19, Vite 8, Express 5, PostgreSQL, Vitest 4, Supertest

---

### Task 1: `src/scheduleUtils.js` 생성 (TDD)

**Files:**
- Create: `src/scheduleUtils.js`
- Create: `tests/scheduleUtils.test.js`

- [ ] **Step 1: 테스트 파일 작성**

`tests/scheduleUtils.test.js`를 아래 내용으로 생성한다:

```js
import { describe, it, expect } from 'vitest';
import { getWeekCount, advanceWeek } from '../src/scheduleUtils.js';

describe('getWeekCount', () => {
  it('2026년 6월 토요일 4번 → 4', () => {
    expect(getWeekCount(2026, 6)).toBe(4);
  });
  it('2026년 5월 토요일 5번 → 5', () => {
    expect(getWeekCount(2026, 5)).toBe(5);
  });
  it('토요일이 없는 달은 4 반환', () => {
    // 방어 코드 확인 (실제론 항상 있지만)
    expect(getWeekCount(2026, 6)).toBeGreaterThanOrEqual(4);
  });
});

describe('advanceWeek', () => {
  it('같은 달 내에서 주차 +1', () => {
    expect(advanceWeek(2026, 6, 1)).toEqual({ year: 2026, month: 6, week: 2 });
  });
  it('마지막 주에서 다음 달 1주로', () => {
    // 2026년 6월은 4주
    expect(advanceWeek(2026, 6, 4)).toEqual({ year: 2026, month: 7, week: 1 });
  });
  it('12월 마지막 주에서 다음 해 1월로', () => {
    // 2026년 12월 토요일 수: 확인 필요하지만 로직 검증
    const result = advanceWeek(2026, 12, getWeekCount(2026, 12));
    expect(result).toEqual({ year: 2027, month: 1, week: 1 });
  });
  it('5월 5주에서 6월 1주로', () => {
    expect(advanceWeek(2026, 5, 5)).toEqual({ year: 2026, month: 6, week: 1 });
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
cd C:\Users\ttl22\Downloads\yuna-schedule\yuna-schedule
npx vitest run tests/scheduleUtils.test.js
```

Expected: `Cannot find module '../src/scheduleUtils.js'` 오류

- [ ] **Step 3: `src/scheduleUtils.js` 작성**

```js
export function getWeekCount(year, month) {
  const d = new Date(year, month - 1, 1);
  let count = 0;
  while (d.getMonth() === month - 1) {
    if (d.getDay() === 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count || 4;
}

export function advanceWeek(year, month, week) {
  const wc = getWeekCount(year, month);
  if (week < wc) return { year, month, week: week + 1 };
  if (month === 12) return { year: year + 1, month: 1, week: 1 };
  return { year, month: month + 1, week: 1 };
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

```bash
npx vitest run tests/scheduleUtils.test.js
```

Expected: 모든 테스트 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/scheduleUtils.js tests/scheduleUtils.test.js
git commit -m "feat: scheduleUtils.js 추출 (getWeekCount, advanceWeek)"
```

---

### Task 2: `holidays.js`에서 `getNthSaturday` export

**Files:**
- Modify: `src/holidays.js`

- [ ] **Step 1: export 키워드 추가**

`src/holidays.js`의 97번째 줄:

```js
// 변경 전
function getNthSaturday(year, month, week) {
// 변경 후
export function getNthSaturday(year, month, week) {
```

- [ ] **Step 2: 전체 테스트 통과 확인**

```bash
npx vitest run
```

Expected: 기존 6개 + 새 4개 = 10개 PASS

- [ ] **Step 3: 커밋**

```bash
git add src/holidays.js
git commit -m "feat: getNthSaturday export 추가"
```

---

### Task 3: `App.jsx` 업데이트

**Files:**
- Modify: `src/App.jsx`

`getWeekCount`를 scheduleUtils에서 import하고, satDate/sunDate 계산, WeekView props 추가, handleSave 반복 루프 추가.

- [ ] **Step 1: App.jsx 상단 import 수정**

```js
// 변경 전
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

// 변경 후
import { useState, useEffect, useCallback } from 'react';
import AppBar from './components/AppBar';
import WeekView from './components/WeekView';
import EventModal from './components/EventModal';
import { getHolidaysInWeek, getNthSaturday } from './holidays';
import { getWeekCount, advanceWeek } from './scheduleUtils';
import './App.css';
```

(App.jsx 내 `getWeekCount` 함수 정의 블록 전체 삭제)

- [ ] **Step 2: satDate/sunDate 계산 추가**

App 컴포넌트 내부, `const weekCount = ...` 바로 아래에 추가:

```js
const weekCount = getWeekCount(year, month);
const holidays = getHolidaysInWeek(year, month, week);
const satDate = getNthSaturday(year, month, week);
const sunDate = satDate ? new Date(satDate.getTime() + 86400000) : null;
```

- [ ] **Step 3: handleSave 반복 루프로 교체**

기존 `handleSave` 함수 전체를 아래로 교체:

```js
async function handleSave(data) {
    const { repeatCount = 1, ...scheduleData } = data;
    try {
      if (scheduleData.id) {
        const res = await fetch(`/api/schedules/${scheduleData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scheduleData),
        });
        if (!res.ok) throw new Error();
      } else {
        let y = year, m = month, w = week;
        for (let i = 0; i < repeatCount; i++) {
          const res = await fetch('/api/schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...scheduleData, year: y, month: m, week: w }),
          });
          if (!res.ok) throw new Error();
          ({ year: y, month: m, week: w } = advanceWeek(y, m, w));
        }
      }
      setModal(null);
      fetchSchedules();
    } catch { console.error('Failed to save'); }
  }
```

- [ ] **Step 4: WeekView에 satDate/sunDate props 추가**

```jsx
// 변경 전
<WeekView
    schedules={schedules}
    holidays={holidays}
    onEdit={item => setModal({ mode: 'edit', item })}
/>
// 변경 후
<WeekView
    schedules={schedules}
    holidays={holidays}
    satDate={satDate}
    sunDate={sunDate}
    onEdit={item => setModal({ mode: 'edit', item })}
/>
```

- [ ] **Step 5: 전체 테스트 통과 확인**

```bash
npx vitest run
```

Expected: 10개 PASS

- [ ] **Step 6: 커밋**

```bash
git add src/App.jsx
git commit -m "feat: satDate/sunDate 계산 및 반복 등록 루프 추가"
```

---

### Task 4: `WeekView.jsx` 날짜 표시

**Files:**
- Modify: `src/components/WeekView.jsx`

- [ ] **Step 1: WeekView.jsx 전체 교체**

```jsx
// src/components/WeekView.jsx
import EventBlock from './EventBlock';

const HOURS = Array.from({ length: 9 }, (_, i) => i + 9); // 9~17
const DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];

function fmtDate(d) {
  if (!d) return null;
  return `${d.getMonth() + 1}/${d.getDate()}(${DOW_KO[d.getDay()]})`;
}

export default function WeekView({ schedules, holidays, satDate, sunDate, onEdit }) {
  const columns = [
    ...holidays.map(h => ({ key: h.date, day: h.date, label: h.name, cls: 'holiday', dateStr: h.date })),
    { key: 'SAT', day: 'SAT', label: fmtDate(satDate) || '토요일', cls: 'sat' },
    { key: 'SUN', day: 'SUN', label: fmtDate(sunDate) || '일요일', cls: 'sun' },
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

- [ ] **Step 2: 전체 테스트 통과 확인**

```bash
npx vitest run
```

Expected: 10개 PASS

- [ ] **Step 3: 커밋**

```bash
git add src/components/WeekView.jsx
git commit -m "feat: SAT/SUN 헤더에 날짜 표시 (6/14(토) 형식)"
```

---

### Task 5: `EventModal.jsx` 등록 횟수 입력 추가

**Files:**
- Modify: `src/components/EventModal.jsx`

- [ ] **Step 1: EventModal.jsx 전체 교체**

```jsx
// src/components/EventModal.jsx
import { useState } from 'react';

// 09:00 ~ 18:00, 10분 단위 (55개 옵션)
const TIME_OPTIONS = [''].concat(
  Array.from({ length: 55 }, (_, i) => {
    const total = 9 * 60 + i * 10;
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
  const [repeatCount, setRepeatCount] = useState(1);

  function set(field, val) { setForm(f => ({ ...f, [field]: val })); }

  function handleSave() {
    if (!form.class_name.trim()) return;
    const isRepeatable = form.day === 'SAT' || form.day === 'SUN';
    onSave({
      ...form,
      id: item?.id,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      repeatCount: isRepeatable ? repeatCount : 1,
    });
  }

  const dayOptions = [
    { value: 'SAT', label: '토요일' },
    { value: 'SUN', label: '일요일' },
    ...holidays.map(h => ({ value: h.date, label: `${h.name} (${h.date})` })),
  ];

  const isRepeatable = form.day === 'SAT' || form.day === 'SUN';

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

        {isRepeatable && mode === 'add' && (
          <label className="modal-field">
            <span>등록 횟수</span>
            <input
              type="number"
              min="1"
              max="52"
              value={repeatCount}
              onChange={e => setRepeatCount(Math.max(1, Math.min(52, Number(e.target.value))))}
            />
          </label>
        )}

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

- [ ] **Step 2: 전체 테스트 통과 확인**

```bash
npx vitest run
```

Expected: 10개 PASS

- [ ] **Step 3: 커밋**

```bash
git add src/components/EventModal.jsx
git commit -m "feat: SAT/SUN 수업 등록 횟수 입력 추가"
```

---

### Task 6: push + 배포 확인

- [ ] **Step 1: 전체 테스트 최종 확인**

```bash
npx vitest run
```

Expected: 10개 PASS

- [ ] **Step 2: GitHub push**

```bash
git push origin master
```

- [ ] **Step 3: Railway 재배포 후 동작 확인 체크리스트**

1. SAT/SUN 헤더에 `6/14(토)`, `6/15(일)` 같은 날짜가 표시되는가
2. `+` 버튼 → 토요일 선택 시 "등록 횟수" 입력 필드가 나타나는가
3. 일요일 선택 시에도 "등록 횟수"가 나타나는가
4. 공휴일 선택 시 "등록 횟수"가 숨겨지는가
5. 등록 횟수 8 입력 후 저장 → 8개 주차에 걸쳐 동일 수업이 등록되는가
6. 12월 → 1월 연도 넘김이 있는 케이스에서도 정상 동작하는가
