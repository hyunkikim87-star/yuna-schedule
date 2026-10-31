import { useState } from 'react';
import { useFetch, useLocalState, useNow } from '../lib/hooks.js';
import {
  addDays, dateLabel, durationLabel, gapLabel, gapsBetween, nowInSeoul, relativeLabel,
  splitSupplies, weekdayOf, weekendOf, weekendStatus, weekendTitle, WEEKDAYS,
} from '../lib/time.js';
import SessionCard from '../components/SessionCard.jsx';
import { ChevronLeft, ChevronRight } from '../components/Icons.jsx';

function StatusCard({ sessions, now, checked }) {
  const { current, next } = weekendStatus(sessions, now);
  if (!sessions.length) return null;
  if (!current && !next) {
    return (
      <section className="now-card">
        <p className="now-title">이번 주말 수업이 모두 끝났어요</p>
      </section>
    );
  }
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

export default function HomePage({ refreshKey, openSession, go }) {
  // 정규 수업은 수업 상세로, 원데이는 회차 시트로
  const open = (s) => (s.kind === 'class' ? go(`/classes/${s.source_id}`) : openSession(s));
  const now = nowInSeoul(useNow());
  const [offset, setOffset] = useState(0);
  const [checked, setChecked] = useLocalState('yuna.supplies-checked', {});
  const { sat, sun } = weekendOf(addDays(now.date, offset * 7));
  const mon = addDays(sat, -5);
  const { data, loading, error } = useFetch(`/api/sessions?from=${mon}&to=${sun}`, refreshKey);
  const sessions = data || [];
  const byDate = (d) => sessions.filter((s) => s.date === d);
  const weekdays = [0, 1, 2, 3, 4].map((i) => addDays(mon, i)).filter((d) => byDate(d).length);
  const weekend = sessions.filter((s) => s.date >= sat);
  const toggle = (key, on) => setChecked((c) => {
    const next = { ...c };
    if (on) next[key] = true; else delete next[key];
    return next;
  });

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
          {offset === 0 && <StatusCard sessions={weekend} now={now} checked={checked} />}
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
