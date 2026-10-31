import { useMemo, useState } from 'react';
import { useFetch, useNow } from '../lib/hooks.js';
import { addDays, dateLabel, monthRange, nowInSeoul, shiftMonth, weekdayOf, WEEKDAYS } from '../lib/time.js';
import { sessionColor } from '../lib/colors.js';
import { getHolidayMap } from '../holidays.js';
import { ChevronLeft, ChevronRight } from '../components/Icons.jsx';

export default function CalendarPage({ refreshKey, go }) {
  const today = nowInSeoul(useNow()).date;
  const [ym, setYm] = useState(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }));
  const [picked, setPicked] = useState(today);
  const { from, to } = monthRange(ym.year, ym.month);
  const { data, error } = useFetch(`/api/sessions?from=${from}&to=${to}`, refreshKey);
  const holidays = useMemo(() => getHolidayMap(ym.year), [ym.year]);

  const byDate = useMemo(() => {
    const m = {};
    for (const s of data || []) (m[s.date] = m[s.date] || []).push(s);
    return m;
  }, [data]);

  // 이 달에 나온 장소 색 범례
  const legend = useMemo(() => {
    const seen = new Map();
    for (const s of data || []) if (s.location && !seen.has(s.location)) seen.set(s.location, sessionColor(s));
    return [...seen].slice(0, 6);
  }, [data]);

  const lead = weekdayOf(from);
  const days = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);

  function move(n) {
    const next = shiftMonth(ym, n);
    setYm(next);
    const r = monthRange(next.year, next.month);
    setPicked(today >= r.from && today <= r.to ? today : r.from);
  }

  const pickedList = byDate[picked] || [];

  return (
    <>
      <header className="page-head" style={{ alignItems: 'center' }}>
        <h1 className="page-title">{ym.year}년 {ym.month}월</h1>
        <div className="row" style={{ gap: 4 }}>
          <button type="button" className="round-btn" aria-label="지난 달" onClick={() => move(-1)}><ChevronLeft size={20} stroke={2.2} /></button>
          <button type="button" className="round-btn" aria-label="다음 달" onClick={() => move(1)}><ChevronRight size={20} stroke={2.2} /></button>
        </div>
      </header>

      {legend.length > 0 && (
        <div className="legend">
          {legend.map(([name, color]) => <span key={name}><span className="dot" style={{ background: color }} />{name}</span>)}
        </div>
      )}
      {error && <p className="empty" style={{ marginTop: 16 }}>{error.message}</p>}

      <section className="cal" aria-label={`${ym.year}년 ${ym.month}월 달력`}>
        <div className="cal-grid">
          {WEEKDAYS.map((w, i) => <span key={w} className={`cal-head${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}`}>{w}</span>)}
          {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
          {days.map((d) => {
            const list = byDate[d] || [];
            const wd = weekdayOf(d);
            const colors = [...new Set(list.map(sessionColor))].slice(0, 3);
            const cls = ['cal-day', list.length && 'has', wd === 0 && 'sun', wd === 6 && 'sat', holidays[d] && 'holiday', d === today && 'today', d < today && 'past']
              .filter(Boolean).join(' ');
            const label = `${dateLabel(d)}${holidays[d] ? `, ${holidays[d]}` : ''}${list.length ? `, 수업 ${list.length}개` : ''}`;
            return (
              <button key={d} type="button" className={cls} aria-pressed={d === picked} aria-label={label} onClick={() => setPicked(d)}>
                <span className="cal-num">{Number(d.slice(8))}</span>
                <span className="cal-dots">{colors.map((c) => <span key={c} className="dot" style={{ background: c }} />)}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="day-panel" aria-label="선택한 날짜의 수업">
        <div className="handle" />
        <div style={{ padding: '16px 0 12px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <h2 className="section-title">{dateLabel(picked)}{holidays[picked] && <span className="tag red" style={{ marginLeft: 8, verticalAlign: 'middle' }}>{holidays[picked]}</span>}</h2>
          <span className="section-meta">{pickedList.length ? `수업 ${pickedList.length}개` : ''}</span>
        </div>
        {data && pickedList.length === 0 && <p style={{ padding: '20px 0 28px', textAlign: 'center', fontSize: 15, color: 'var(--sub)' }}>수업 없는 날이에요</p>}
        {pickedList.map((s) => (
          <button key={`${s.kind}-${s.source_id}`} type="button" className="day-item" onClick={() => go(s.kind === 'class' ? `/classes/${s.source_id}` : `/one-day/${s.source_id}`)}>
            <span className="session-time" style={{ width: 48 }}>
              <span className="session-start" style={{ fontSize: 16 }}>{s.start_time}</span>
              {s.end_time && <span className="session-end" style={{ fontSize: 13 }}>{s.end_time}</span>}
            </span>
            <span className="list-main" style={{ gap: 4 }}>
              <span className="session-name-row">
                <span className="list-title">{s.name}</span>
                {s.kind === 'one_day' && <span className="tag">원데이</span>}
                {s.changed && <span className="tag blue">이 날만 변경</span>}
                {s.overlap && <span className="tag red">시간 겹침</span>}
              </span>
              {s.location && <span className="list-desc" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span className="dot" style={{ background: sessionColor(s) }} />{s.location}</span>}
              {s.supplies && <span style={{ fontSize: 13, color: 'var(--primary-text)' }}>준비물 · {s.supplies}</span>}
              {s.memo && <span className="list-meta">{s.memo}</span>}
            </span>
          </button>
        ))}
      </section>
    </>
  );
}
