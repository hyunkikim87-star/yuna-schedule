import { useState } from 'react';
import { api } from '../lib/api.js';
import { useFetch, useNow } from '../lib/hooks.js';
import { daysBetween } from '../../lib/sessions.js';
import {
  addDays, dateLabel, durationLabel, gapLabel, gapsBetween, nowInSeoul, relativeLabel,
  splitSupplies, weekdayOf, weekendOf, weekendStatus, weekendTitle, WEEKDAYS,
} from '../lib/time.js';
import SessionCard from '../components/SessionCard.jsx';
import { ChevronLeft, ChevronRight } from '../components/Icons.jsx';

// 이번 주말 수업이 없거나 다 끝났을 때: 그 뒤 첫 수업을 알려준다
function LaterCard({ later, onShowWeek }) {
  if (!later) return null;
  return (
    <section className="now-card">
      <p className="now-label">다음 수업</p>
      <p className="now-title">{later.start_time} {later.name}</p>
      <p className="now-desc">{dateLabel(later.date)}{later.location ? ` · ${later.location}` : ''}</p>
      <button type="button" className="chip" style={{ alignSelf: 'flex-start', marginTop: 8, background: 'var(--card)' }} onClick={onShowWeek}>
        그 주말 보기<ChevronRight size={16} stroke={2.2} />
      </button>
    </section>
  );
}

function StatusCard({ sessions, now, checked, later, onShowWeek }) {
  const { current, next } = weekendStatus(sessions, now);
  if (!current && !next) return <LaterCard later={later} onShowWeek={onShowWeek} />;
  const left = (s) => splitSupplies(s.supplies)
    .filter((item) => !checked[`${s.date}|${s.kind}|${s.source_id}|${item}`]).length;
  const when = (n) => (n.inMinutes == null
    ? `${WEEKDAYS[weekdayOf(n.session.date)]}요일`
    : relativeLabel(n.inMinutes));
  const nextDesc = (n) => {
    const s = n.session;
    const parts = [when(n), s.location];
    const total = splitSupplies(s.supplies).length;
    if (total) parts.push(left(s) ? `준비물 ${left(s)}개 챙겨야 해요` : '준비물 다 챙겼어요');
    return parts.filter(Boolean).join(' · ');
  };

  return (
    <section className="now-card" aria-live="polite">
      {current ? (
        <>
          <p className="now-label">지금 수업 중</p>
          <p className="now-title">{current.session.name}</p>
          <p className="now-desc">{current.session.end_time}에 끝나요 · {durationLabel(current.leftMinutes)} 남음</p>
          {next && (
            <>
              <div className="now-divider" />
              <p className="now-next">다음 · {next.session.start_time} {next.session.name}</p>
              <p className="now-next-desc">{nextDesc(next)}</p>
            </>
          )}
        </>
      ) : (
        <>
          <p className="now-label">다음 수업</p>
          <p className="now-title">{next.session.start_time} {next.session.name}</p>
          <p className="now-desc">{nextDesc(next)}</p>
        </>
      )}
    </section>
  );
}

function DaySection({ date, sessions, onOpen, checked, onToggleSupply }) {
  const gaps = gapsBetween(sessions);
  return (
    <>
      <div className="section-head">
        <h2 className="section-title">{WEEKDAYS[weekdayOf(date)]}요일 · {dateLabel(date, { weekday: false })}</h2>
        <span className="section-meta">{sessions.length ? `수업 ${sessions.length}개` : ''}</span>
      </div>
      {sessions.length === 0 ? (
        <p className="empty">수업 없는 날이에요</p>
      ) : (
        <div className="stack">
          {sessions.map((s, i) => (
            <div key={`${s.kind}-${s.source_id}-${s.date}`}>
              {i > 0 && (
                <div className={`gap${gaps[i - 1].minutes < 0 ? ' overlap' : gaps[i - 1].moved ? ' moved' : ''}`}>
                  <span>{gapLabel(gaps[i - 1])}</span>
                </div>
              )}
              <SessionCard session={s} onOpen={onOpen} checked={checked} onToggleSupply={onToggleSupply} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function HomePage({ refreshKey, go }) {
  // 정규 수업은 수업 상세로, 원데이는 원데이 상세로
  const open = (s) => go(s.kind === 'class' ? `/classes/${s.source_id}` : `/one-day/${s.source_id}`);
  const now = nowInSeoul(useNow());
  const [offset, setOffset] = useState(0);
  const { sat, sun } = weekendOf(addDays(now.date, offset * 7));
  const mon = addDays(sat, -5);
  const { data, loading, error } = useFetch(`/api/sessions?from=${mon}&to=${sun}`, refreshKey);
  // 서버에서 받은 챙김 표시 + 방금 누른 것. 방금 누른 것은 같은 데이터를 보는 동안만 쓰고,
  // 다시 불러오면(다른 폰에서 바꾼 것 포함) 서버 값을 따른다.
  const [pendingState, setPendingState] = useState({ data: null, map: {} });
  const pending = pendingState.data === data ? pendingState.map : {};
  const setPending = (fn) => setPendingState((st) => ({ data, map: fn(st.data === data ? st.map : {}) }));
  const sessions = data || [];
  const byDate = (d) => sessions.filter((s) => s.date === d);
  const weekdays = [0, 1, 2, 3, 4].map((i) => addDays(mon, i)).filter((d) => byDate(d).length);
  const weekend = sessions.filter((s) => s.date >= sat);

  const checked = { ...pending };
  for (const s of sessions) {
    for (const item of s.checked_supplies || []) {
      const key = `${s.date}|${s.kind}|${s.source_id}|${item}`;
      if (!(key in pending)) checked[key] = true;
    }
  }
  for (const [key, on] of Object.entries(pending)) if (!on) delete checked[key];

  const toggle = (key, on) => {
    setPending((p) => ({ ...p, [key]: on }));
    const [date, kind, sourceId, ...rest] = key.split('|');
    api.post('/api/sessions/supply-check', { date, kind, source_id: Number(sourceId), item: rest.join('|'), checked: on })
      .catch(() => setPending((p) => { const n = { ...p }; delete n[key]; return n; }));
  };

  // 이번 주말 수업이 다 끝났으면(또는 없으면) 그 뒤 90일 안의 첫 수업
  const { current, next } = weekendStatus(weekend, now);
  const needLater = offset === 0 && data && !current && !next;
  const { data: laterList } = useFetch(needLater ? `/api/sessions?from=${addDays(sun, 1)}&to=${addDays(sun, 90)}` : null, refreshKey);
  const later = needLater ? laterList?.[0] : null;
  const showLaterWeek = () => setOffset(Math.ceil(daysBetween(sun, later.date) / 7));

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">{weekendTitle(offset)}</h1>
          <p className="page-sub">{dateLabel(sat)} – {dateLabel(sun)}</p>
        </div>
        <div className="row" style={{ gap: 4 }}>
          <button type="button" className="round-btn" aria-label="지난 주말" onClick={() => setOffset((o) => o - 1)}><ChevronLeft size={20} stroke={2.2} /></button>
          <button type="button" className="round-btn" aria-label="다음 주말" onClick={() => setOffset((o) => o + 1)}><ChevronRight size={20} stroke={2.2} /></button>
        </div>
      </header>
      {offset !== 0 && (
        <div style={{ padding: '12px 20px 0' }}>
          <button type="button" className="chip" style={{ background: 'var(--card)' }} onClick={() => setOffset(0)}>
            <ChevronLeft size={16} stroke={2.2} />이번 주말로
          </button>
        </div>
      )}

      {loading && !data && <p className="loading">불러오는 중…</p>}
      {error && <p className="empty" style={{ marginTop: 20 }}>{error.message}</p>}
      {data && (
        <>
          {offset === 0 && <StatusCard sessions={weekend} now={now} checked={checked} later={later} onShowWeek={showLaterWeek} />}
          {weekdays.map((d) => (
            <DaySection key={d} date={d} sessions={byDate(d)} onOpen={open} checked={checked} onToggleSupply={toggle} />
          ))}
          <DaySection date={sat} sessions={byDate(sat)} onOpen={open} checked={checked} onToggleSupply={toggle} />
          <DaySection date={sun} sessions={byDate(sun)} onOpen={open} checked={checked} onToggleSupply={toggle} />
        </>
      )}
    </>
  );
}
