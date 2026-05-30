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
