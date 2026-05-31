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
