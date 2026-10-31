import { useState } from 'react';
import { useFetch, useLocalState } from '../lib/hooks.js';
import { classStatus, dateLabel, nowInSeoul, shortDate, WEEKDAYS } from '../lib/time.js';
import { placeColor } from '../lib/colors.js';
import { ChevronDown, ChevronRight } from '../components/Icons.jsx';

function Group({ title, items, render }) {
  if (!items.length) return null;
  return (
    <>
      <div className="section-head" style={{ paddingTop: 24, paddingBottom: 10 }}>
        <h2 className="section-title sm">{title}</h2>
        <span className="section-meta">{items.length}개</span>
      </div>
      <div className="list">{items.map(render)}</div>
    </>
  );
}

const timeRange = (x) => `${x.start_time}${x.end_time ? `–${x.end_time}` : ''}`;

export default function ClassesPage({ refreshKey, go, openSession }) {
  const today = nowInSeoul().date;
  const [tab, setTab] = useLocalState('yuna.classes-tab', 'class');
  const [showPast, setShowPast] = useState(false);
  const { data: classes } = useFetch('/api/classes', refreshKey);
  const { data: events } = useFetch('/api/one-day-events', refreshKey);

  const classRow = (c) => (
    <button key={c.id} type="button" className="list-item" onClick={() => go(`/classes/${c.id}`)}>
      <span className="dot lg" style={{ background: c.color || placeColor(c.location) }} />
      <span className="list-main">
        <span className="list-title">{c.name}</span>
        <span className="list-desc">매주 {WEEKDAYS[c.weekday]} {timeRange(c)}{c.term ? ` · ${c.term}` : ''}</span>
        <span className="list-meta">{[c.location, `${shortDate(c.start_date)} – ${shortDate(c.end_date)}`].filter(Boolean).join(' · ')}</span>
      </span>
      <ChevronRight size={18} color="#8B95A1" />
    </button>
  );

  const eventRow = (e) => (
    <button key={e.id} type="button" className="list-item"
      onClick={() => openSession({ ...e, kind: 'one_day', source_id: e.id, exception_id: null, changed: false, overlap: false })}>
      <span className="dot lg" style={{ background: e.color || placeColor(e.location) }} />
      <span className="list-main">
        <span className="list-title">{e.name}</span>
        <span className="list-desc">{dateLabel(e.date)} {timeRange(e)}</span>
        {e.location && <span className="list-meta">{e.location}{e.supplies ? ' · 준비물 있음' : ''}</span>}
      </span>
      <ChevronRight size={18} color="#8B95A1" />
    </button>
  );

  let body = null;
  if (tab === 'class' && classes) {
    // 요일·시작 시간 순
    const by = (st) => classes.filter((c) => classStatus(c, today) === st)
      .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));
    const ended = by('ended').sort((a, b) => b.end_date.localeCompare(a.end_date));
    body = (
      <>
        <Group title="진행 중" items={by('active')} render={classRow} />
        <Group title="시작 전" items={by('upcoming').sort((a, b) => a.start_date.localeCompare(b.start_date))} render={classRow} />
        {!classes.length && <p className="empty" style={{ marginTop: 20 }}>아직 등록한 정규 수업이 없어요.<br />+ 버튼으로 추가해 보세요</p>}
        {ended.length > 0 && (showPast
          ? <Group title="끝난 수업" items={ended} render={classRow} />
          : <button type="button" className="more-btn" onClick={() => setShowPast(true)}>끝난 정규 수업 보기 ({ended.length}개)<ChevronDown size={18} /></button>)}
      </>
    );
  }
  if (tab === 'one_day' && events) {
    const upcoming = events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
    const past = events.filter((e) => e.date < today);
    const months = [];
    for (const e of upcoming) {
      const key = e.date.slice(0, 7);
      let g = months.find((m) => m.key === key);
      if (!g) months.push((g = { key, title: `${Number(key.slice(0, 4))}년 ${Number(key.slice(5))}월`, items: [] }));
      g.items.push(e);
    }
    body = (
      <>
        {months.map((m) => <Group key={m.key} title={m.title} items={m.items} render={eventRow} />)}
        {!upcoming.length && <p className="empty" style={{ marginTop: 20 }}>다가오는 원데이 수업이 없어요</p>}
        {past.length > 0 && (showPast
          ? <Group title="지난 원데이 수업" items={past} render={eventRow} />
          : <button type="button" className="more-btn" onClick={() => setShowPast(true)}>지난 원데이 수업 보기 ({past.length}개)<ChevronDown size={18} /></button>)}
      </>
    );
  }

  return (
    <>
      <header className="page-head"><h1 className="page-title">수업</h1></header>
      <div className="segment" role="tablist" aria-label="수업 종류" style={{ margin: '16px 20px 0' }}>
        <button type="button" role="tab" aria-selected={tab === 'class'} onClick={() => { setTab('class'); setShowPast(false); }}>정규 수업</button>
        <button type="button" role="tab" aria-selected={tab === 'one_day'} onClick={() => { setTab('one_day'); setShowPast(false); }}>원데이</button>
      </div>
      {body || <p className="loading">불러오는 중…</p>}
    </>
  );
}
