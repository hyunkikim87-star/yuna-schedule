import { useState } from 'react';
import { api } from '../lib/api.js';
import { useFetch, useNow } from '../lib/hooks.js';
import { dateLabel, nowInSeoul, splitSupplies } from '../lib/time.js';
import { mapUrl, placeColor } from '../lib/colors.js';
import LinkButton from '../components/LinkButton.jsx';
import { ChevronLeft } from '../components/Icons.jsx';

// 원데이(하루짜리) 수업 상세: 정보 + 구매 링크 + 수정·삭제
export default function OneDayDetailPage({ id, refreshKey, changed, go, openForm }) {
  const today = nowInSeoul(useNow()).date;
  const { data: e, error } = useFetch(`/api/one-day-events/${id}`, refreshKey);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const back = () => (window.history.length > 1 ? window.history.back() : go('/classes'));

  if (error) return <p className="empty" style={{ marginTop: 24 }}>{error.status === 404 ? '없는 수업이에요' : error.message}</p>;
  if (!e) return <p className="loading">불러오는 중…</p>;

  const supplies = splitSupplies(e.supplies);
  const status = e.date < today ? '지난 수업' : e.date === today ? '오늘' : null;

  async function remove() {
    if (!window.confirm(`'${e.name}'을(를) 지울까요?`)) return;
    setBusy(true);
    try {
      await api.del(`/api/one-day-events/${e.id}`);
      go('/classes');
      changed('지웠어요');
    } catch (ex) {
      setErr(ex.message);
      setBusy(false);
    }
  }

  return (
    <>
      <div style={{ padding: '12px 8px 0', display: 'flex', justifyContent: 'space-between' }}>
        <button type="button" className="icon-btn" aria-label="뒤로" onClick={back}><ChevronLeft size={24} stroke={2.2} /></button>
        <button type="button" className="small-btn" style={{ background: 'var(--card)', marginRight: 12, alignSelf: 'center' }}
          onClick={() => openForm({ kind: 'one_day', initial: e })}>수정</button>
      </div>
      <div style={{ padding: '4px 20px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="row">
          <span className="tag" style={{ fontSize: 13, padding: '3px 10px', background: 'var(--card)' }}>원데이</span>
          {status && <span className={`tag${status === '오늘' ? ' blue' : ''}`} style={{ fontSize: 13, padding: '3px 10px' }}>{status}</span>}
        </div>
        <h1 className="page-title" style={{ wordBreak: 'keep-all' }}>{e.name}</h1>
      </div>

      <dl className="info">
        <div className="info-row"><dt>날짜</dt><dd>{dateLabel(e.date)}</dd></div>
        <div className="info-row"><dt>시간</dt><dd>{e.start_time}{e.end_time ? ` – ${e.end_time}` : ''}</dd></div>
        {e.location && (
          <div className="info-row"><dt>장소</dt>
            <dd><a className="place-link" href={mapUrl(e.location)} target="_blank" rel="noreferrer" style={{ color: 'var(--ink)', fontWeight: 600, fontSize: 15 }}>
              <span className="dot" style={{ background: e.color || placeColor(e.location) }} />{e.location}
            </a></dd>
          </div>
        )}
        {supplies.length > 0 && <div className="info-row"><dt>준비물</dt><dd>{supplies.join(', ')}</dd></div>}
        {e.memo && <div className="info-row"><dt>메모</dt><dd style={{ fontWeight: 500 }}>{e.memo}</dd></div>}
      </dl>

      {e.link && <LinkButton href={e.link} style={{ margin: '12px 20px 0' }} />}
      {err && <p className="form-error" style={{ margin: '12px 20px 0' }} role="alert">{err}</p>}

      <div style={{ padding: '28px 20px 0' }}>
        <button type="button" className="ghost-btn red" onClick={remove} disabled={busy}>이 원데이 수업 삭제</button>
      </div>
    </>
  );
}
