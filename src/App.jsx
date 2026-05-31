import { useState, useEffect, useCallback } from 'react';
import AppBar from './components/AppBar';
import WeekView from './components/WeekView';
import EventModal from './components/EventModal';
import { getHolidaysInWeek, getNthSaturday } from './holidays';
import { getWeekCount, advanceWeek } from './scheduleUtils';
import './App.css';


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
  const satDate = getNthSaturday(year, month, week);
  const sunDate = satDate ? new Date(satDate.getTime() + 86400000) : null;
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
        satDate={satDate}
        sunDate={sunDate}
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
