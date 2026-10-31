import { useState } from 'react';
import { api } from '../lib/api.js';
import { mapUrl, sessionColor } from '../lib/colors.js';
import { dateLabel, splitSupplies } from '../lib/time.js';
import Sheet from './Sheet.jsx';
import ChangeForm from './ChangeForm.jsx';

// 회차 하나를 눌렀을 때: 정보 + 휴강 / 이 날만 변경 / 수업 정보, 원데이는 수정 / 삭제
export default function SessionSheet({ session: s, onClose, onChanged, onEditOneDay, go }) {
  const [mode, setMode] = useState('view');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function run(fn, text) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged(text);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  const cancelDay = () => run(
    () => api.post(`/api/classes/${s.source_id}/exceptions`, { date: s.date, type: 'cancel' }),
    `${dateLabel(s.date)} 휴강으로 바꿨어요`
  );
  const undoChange = () => run(
    () => api.del(`/api/classes/${s.source_id}/exceptions/${s.exception_id}`),
    '원래 시간으로 되돌렸어요'
  );
  const deleteOneDay = () => {
    if (!window.confirm(`'${s.name}'을(를) 지울까요?`)) return;
    run(() => api.del(`/api/one-day-events/${s.source_id}`), '지웠어요');
  };

  if (mode === 'change') {
    return (
      <Sheet title={`${dateLabel(s.date)}만 변경`} onClose={onClose}>
        <p className="page-sub">{s.name} · 원래 {s.start_time}{s.end_time ? `–${s.end_time}` : ''}</p>
        <ChangeForm classId={s.source_id} date={s.date} defaults={s} onDone={onChanged} />
      </Sheet>
    );
  }

  const supplies = splitSupplies(s.supplies);
  return (
    <Sheet title={s.name} onClose={onClose}>
      <dl className="info" style={{ margin: '12px 0 0', background: 'var(--fill)' }}>
        <div className="info-row"><dt>날짜</dt><dd>{dateLabel(s.date)}</dd></div>
        <div className="info-row"><dt>시간</dt><dd>{s.start_time}{s.end_time ? ` – ${s.end_time}` : ''}</dd></div>
        {s.location && (
          <div className="info-row"><dt>장소</dt>
            <dd><a className="place-link" href={mapUrl(s.location)} target="_blank" rel="noreferrer" style={{ color: 'var(--ink)', fontWeight: 600, fontSize: 15 }}>
              <span className="dot" style={{ background: sessionColor(s) }} />{s.location}
            </a></dd>
          </div>
        )}
        {supplies.length > 0 && <div className="info-row"><dt>준비물</dt><dd>{supplies.join(', ')}</dd></div>}
        {s.memo && <div className="info-row"><dt>메모</dt><dd style={{ fontWeight: 500 }}>{s.memo}</dd></div>}
      </dl>
      {s.overlap && <p className="form-error">같은 시간에 다른 수업이 있어요</p>}
      {error && <p className="form-error" role="alert">{error}</p>}

      {s.kind === 'class' ? (
        <>
          <div className="grid-2" style={{ marginTop: 20 }}>
            <button type="button" className="ghost-btn red" style={{ marginTop: 0 }} disabled={busy} onClick={cancelDay}>이 날 휴강</button>
            {s.changed
              ? <button type="button" className="ghost-btn" style={{ marginTop: 0 }} disabled={busy} onClick={undoChange}>변경 되돌리기</button>
              : <button type="button" className="ghost-btn" style={{ marginTop: 0 }} disabled={busy} onClick={() => setMode('change')}>이 날만 변경</button>}
          </div>
          <button type="button" className="primary-btn" style={{ marginTop: 8 }} onClick={() => go(`/classes/${s.source_id}`)}>정규 수업 정보 보기</button>
        </>
      ) : (
        <div className="grid-2" style={{ marginTop: 20 }}>
          <button type="button" className="ghost-btn red" style={{ marginTop: 0 }} disabled={busy} onClick={deleteOneDay}>삭제</button>
          <button type="button" className="ghost-btn" style={{ marginTop: 0 }} disabled={busy}
            onClick={() => onEditOneDay({
              id: s.source_id, name: s.name, date: s.date, start_time: s.start_time, end_time: s.end_time,
              location: s.location, supplies: s.supplies, memo: s.memo, color: s.color,
            })}>수정</button>
        </div>
      )}
    </Sheet>
  );
}
