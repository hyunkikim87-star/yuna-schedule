import { useMemo, useState } from 'react';
import { computeSessions } from '../../lib/sessions.js';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/hooks.js';
import { addDays, dateLabel, nowInSeoul, shortDate, weekdayOf, WEEKDAYS } from '../lib/time.js';
import { mapUrl, placeColor } from '../lib/colors.js';
import Sheet from '../components/Sheet.jsx';
import ChangeForm from '../components/ChangeForm.jsx';
import LinkButton from '../components/LinkButton.jsx';
import { ArrowRight, CalendarX, ChevronLeft, Clock } from '../components/Icons.jsx';

const UPCOMING_COUNT = 6;

// 회차 날짜 고르기 (휴강·이 날만 변경용)
function DatePicker({ dates, onPick }) {
  if (!dates.length) return <p className="empty" style={{ margin: '16px 0 0' }}>남은 회차가 없어요</p>;
  return (
    <div className="chips" style={{ marginTop: 16 }}>
      {dates.map((d) => <button key={d} type="button" className="chip" onClick={() => onPick(d)}>{dateLabel(d)}</button>)}
    </div>
  );
}

export default function ClassDetailPage({ id, refreshKey, changed, go, openForm }) {
  const today = nowInSeoul().date;
  const { data: c, error } = useFetch(`/api/classes/${id}`, refreshKey);
  const [sheet, setSheet] = useState(null); // 'cancel' | 'change' | 'extend'
  const [changeDate, setChangeDate] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [extendTo, setExtendTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const sessions = useMemo(() => (c
    ? computeSessions({ classes: [c], exceptions: c.exceptions, from: c.start_date, to: c.end_date })
    : []), [c]);

  if (error) return <p className="empty" style={{ marginTop: 24 }}>{error.status === 404 ? '없는 수업이에요' : error.message}</p>;
  if (!c) return <p className="loading">불러오는 중…</p>;

  const cancels = c.exceptions.filter((e) => e.type === 'cancel').sort((a, b) => b.date.localeCompare(a.date));
  const changes = c.exceptions.filter((e) => e.type === 'change').sort((a, b) => a.date.localeCompare(b.date));
  // 오늘부터 종료일까지 이 수업 요일의 모든 날짜 (휴강 포함, 휴강 표시용)
  const futureDates = [];
  const startFrom = c.start_date > today ? c.start_date : today;
  for (let d = addDays(startFrom, (c.weekday - weekdayOf(startFrom) + 7) % 7); d <= c.end_date; d = addDays(d, 7)) {
    futureDates.push(d);
  }
  const cancelledSet = new Set(cancels.map((e) => e.date));
  const shownDates = showAll ? futureDates : futureDates.slice(0, UPCOMING_COUNT);

  async function run(fn, text) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      setSheet(null);
      setChangeDate(null);
      changed(text);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const cancelOn = (d) => run(() => api.post(`/api/classes/${c.id}/exceptions`, { date: d, type: 'cancel' }), `${dateLabel(d)} 휴강으로 바꿨어요`);
  const removeException = (e, text) => run(() => api.del(`/api/classes/${c.id}/exceptions/${e.id}`), text);
  const extend = (to) => run(() => api.put(`/api/classes/${c.id}`, { ...c, end_date: to }), `${dateLabel(to)}까지 연장했어요`);
  const remove = async () => {
    if (!window.confirm(`'${c.name}' 정규 수업과 모든 회차를 지울까요?`)) return;
    setBusy(true);
    try {
      await api.del(`/api/classes/${c.id}`);
      go('/classes');
      changed('지웠어요');
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  const exFor = (d) => c.exceptions.find((e) => e.date === d);

  return (
    <>
      <div style={{ padding: '12px 8px 0', display: 'flex', justifyContent: 'space-between' }}>
        <a href="#/classes" className="icon-btn" aria-label="수업 목록으로"><ChevronLeft size={24} stroke={2.2} /></a>
        <button type="button" className="small-btn" style={{ background: 'var(--card)', marginRight: 12, alignSelf: 'center' }}
          onClick={() => openForm({ kind: 'class', initial: c })}>수정</button>
      </div>
      <div style={{ padding: '4px 20px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="tag blue" style={{ alignSelf: 'flex-start', fontSize: 13, padding: '3px 10px' }}>{c.term ? `${c.term} · 정규` : '정규 수업'}</span>
        <h1 className="page-title">{c.name}</h1>
      </div>

      <dl className="info">
        <div className="info-row"><dt>요일·시간</dt><dd>매주 {WEEKDAYS[c.weekday]} {c.start_time}{c.end_time ? `–${c.end_time}` : ''}</dd></div>
        {c.location && (
          <div className="info-row"><dt>장소</dt>
            <dd><a className="place-link" href={mapUrl(c.location)} target="_blank" rel="noreferrer" style={{ color: 'var(--ink)', fontWeight: 600, fontSize: 15 }}>
              <span className="dot" style={{ background: c.color || placeColor(c.location) }} />{c.location}
            </a></dd>
          </div>
        )}
        <div className="info-row"><dt>기간</dt><dd>{shortDate(c.start_date)} – {shortDate(c.end_date)}</dd></div>
        <div className="info-row"><dt>회차</dt><dd>총 {sessions.length}회{cancels.length ? ` (휴강 ${cancels.length}일 제외)` : ''}</dd></div>
        {c.supplies && <div className="info-row"><dt>준비물</dt><dd>{c.supplies}</dd></div>}
        {c.memo && <div className="info-row"><dt>메모</dt><dd style={{ fontWeight: 500 }}>{c.memo}</dd></div>}
      </dl>

      {c.link && <LinkButton href={c.link} style={{ margin: '12px 20px 0' }} />}

      <div className="actions">
        <button type="button" className="action" onClick={() => setSheet('cancel')}><CalendarX size={22} color="#D22030" />휴강 추가</button>
        <button type="button" className="action" onClick={() => setSheet('change')}><Clock size={22} color="#1B64DA" />이 날만 변경</button>
        <button type="button" className="action" onClick={() => { setExtendTo(addDays(c.end_date, 28)); setSheet('extend'); }}><ArrowRight size={22} color="#15803D" />기간 연장</button>
      </div>
      {err && !sheet && <p className="form-error" style={{ margin: '12px 20px 0' }} role="alert">{err}</p>}

      <div className="section-head" style={{ paddingTop: 24, paddingBottom: 10 }}>
        <h2 className="section-title sm">다가오는 회차</h2>
        <span className="section-meta">{futureDates.length ? `${futureDates.filter((d) => !cancelledSet.has(d)).length}회 남음` : '끝난 수업'}</span>
      </div>
      {futureDates.length === 0 ? <p className="empty">남은 회차가 없어요</p> : (
        <div className="list">
          {shownDates.map((d) => {
            const ex = exFor(d);
            const off = ex?.type === 'cancel';
            const ch = ex?.type === 'change';
            const time = ch && ex.start_time ? ex.start_time : c.start_time;
            return (
              <div key={d} className="list-row">
                <span className={`list-row-label${off ? ' off' : ''}`}>{dateLabel(d)} {off ? '· 휴강' : time}</span>
                {d === today && <span className="tag blue">오늘</span>}
                {ch && <span className="tag blue">변경</span>}
                {off
                  ? <button type="button" className="small-btn" disabled={busy} onClick={() => removeException(ex, '휴강을 해제했어요')}>되돌리기</button>
                  : <button type="button" className="small-btn red" disabled={busy} onClick={() => cancelOn(d)}>휴강</button>}
              </div>
            );
          })}
        </div>
      )}
      {futureDates.length > UPCOMING_COUNT && !showAll && (
        <button type="button" className="more-btn" onClick={() => setShowAll(true)}>남은 회차 모두 보기 ({futureDates.length}개)</button>
      )}

      {changes.length > 0 && (
        <>
          <div className="section-head" style={{ paddingTop: 24, paddingBottom: 10 }}>
            <h2 className="section-title sm">이 날만 변경</h2>
            <span className="section-meta">{changes.length}일</span>
          </div>
          <div className="list">
            {changes.map((e) => (
              <div key={e.id} className="list-row">
                <span className="list-row-label" style={{ fontWeight: 500 }}>
                  {dateLabel(e.date)} · {[e.start_time && `${e.start_time}${e.end_time ? `–${e.end_time}` : ''}`, e.location, e.memo].filter(Boolean).join(' · ')}
                </span>
                <button type="button" className="small-btn" disabled={busy} onClick={() => removeException(e, '원래대로 되돌렸어요')}>해제</button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-head" style={{ paddingTop: 24, paddingBottom: 10 }}>
        <h2 className="section-title sm">휴강</h2>
        <span className="section-meta">{cancels.length}일</span>
      </div>
      {cancels.length === 0 ? <p className="empty">휴강한 날이 없어요</p> : (
        <div className="list">
          {cancels.map((e) => (
            <div key={e.id} className="list-row">
              <span className="list-row-label" style={{ fontWeight: 500, color: 'var(--ink-2)' }}>{dateLabel(e.date)}</span>
              <button type="button" className="small-btn" disabled={busy} onClick={() => removeException(e, '휴강을 해제했어요')}>해제</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: '28px 20px 0' }}>
        <button type="button" className="ghost-btn red" onClick={remove} disabled={busy}>이 정규 수업 삭제</button>
      </div>

      {sheet === 'cancel' && (
        <Sheet title="휴강할 날짜" onClose={() => setSheet(null)}>
          <p className="page-sub">{c.name} · 남은 회차 중에서 골라주세요</p>
          <DatePicker dates={futureDates.filter((d) => !cancelledSet.has(d))} onPick={cancelOn} />
          {err && <p className="form-error" role="alert">{err}</p>}
        </Sheet>
      )}
      {sheet === 'change' && (
        <Sheet title={changeDate ? `${dateLabel(changeDate)}만 변경` : '바꿀 날짜'} onClose={() => { setSheet(null); setChangeDate(null); }}>
          {changeDate ? (
            <ChangeForm classId={c.id} date={changeDate} defaults={c}
              onDone={(text) => { setSheet(null); setChangeDate(null); changed(text); }} />
          ) : (
            <>
              <p className="page-sub">{c.name} · 원래 {c.start_time}{c.end_time ? `–${c.end_time}` : ''}</p>
              <DatePicker dates={futureDates.filter((d) => !cancelledSet.has(d))} onPick={setChangeDate} />
            </>
          )}
        </Sheet>
      )}
      {sheet === 'extend' && (
        <Sheet title="기간 연장" onClose={() => setSheet(null)}>
          <p className="page-sub">지금 종료일 {dateLabel(c.end_date)}</p>
          <div className="chips" style={{ marginTop: 16 }}>
            {[4, 8, 12].map((w) => {
              const d = addDays(c.end_date, 7 * w);
              return <button key={w} type="button" className="chip" aria-pressed={extendTo === d} onClick={() => setExtendTo(d)}>{w}주 더</button>;
            })}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="extend-to">새 종료일</label>
            <input id="extend-to" className="input" type="date" value={extendTo} min={c.start_date} onChange={(e) => setExtendTo(e.target.value)} />
          </div>
          {err && <p className="form-error" role="alert">{err}</p>}
          <button type="button" className="primary-btn" disabled={busy || !extendTo} onClick={() => extend(extendTo)}>
            {extendTo ? `${dateLabel(extendTo)}까지로 바꾸기` : '날짜를 골라주세요'}
          </button>
        </Sheet>
      )}
    </>
  );
}
