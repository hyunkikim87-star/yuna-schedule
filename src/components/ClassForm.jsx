import { useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/hooks.js';
import {
  addDays, addMinutes, dateLabel, durationLabel, nowInSeoul, toMinutes, weekdayOf, WEEKDAYS,
} from '../lib/time.js';
import { daysBetween } from '../../lib/sessions.js';
import { conflictSummary, findConflicts } from '../lib/conflicts.js';
import Sheet from './Sheet.jsx';
import { PlaceField, TextField, TimeField } from './Fields.jsx';
import { COMMON_DURATIONS } from '../lib/constants.js';

function nextWeekday(from, weekday) {
  return addDays(from, (weekday - weekdayOf(from) + 7) % 7);
}

// 수업 추가·수정. kind: 'class'(정규, 매주) | 'one_day'(하루). initial이 있으면 수정.
export default function ClassForm({ kind: initialKind = 'class', initial, onClose, onSaved }) {
  const editing = Boolean(initial?.id);
  const today = nowInSeoul().date;
  const [kind, setKind] = useState(initialKind);
  const [name, setName] = useState(initial?.name || '');
  const [weekday, setWeekday] = useState(initial?.weekday ?? 6);
  const [date, setDate] = useState(initial?.date || nextWeekday(today, 6));
  const [start, setStart] = useState(initial?.start_time || '10:00');
  const initialDur = initial?.end_time && initial?.start_time
    ? toMinutes(initial.end_time) - toMinutes(initial.start_time) : 50;
  const [dur, setDur] = useState(COMMON_DURATIONS.includes(initialDur) ? initialDur : null);
  const [endTyped, setEndTyped] = useState(initial?.end_time || '');
  const [location, setLocation] = useState(initial?.location || '');
  const [startDate, setStartDate] = useState(initial?.start_date || nextWeekday(today, initial?.weekday ?? 6));
  const [endDate, setEndDate] = useState(initial?.end_date || addDays(nextWeekday(today, initial?.weekday ?? 6), 7 * 11));
  const [term, setTerm] = useState(initial?.term || '');
  const [supplies, setSupplies] = useState(initial?.supplies || '');
  const [memo, setMemo] = useState(initial?.memo || '');
  const [link, setLink] = useState(initial?.link || '');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const { data: classes } = useFetch(kind === 'class' ? '/api/classes' : null);
  const terms = useMemo(() => [...new Set((classes || []).map((c) => c.term).filter(Boolean))], [classes]);

  const end = dur ? addMinutes(start, dur) : endTyped;
  const isClass = kind === 'class';

  function pickWeekday(i) {
    setWeekday(i);
    // 시작일을 그 요일로 맞춘다 (새로 만들 때만)
    if (!editing) {
      const s = nextWeekday(today, i);
      setStartDate(s);
      setEndDate(addDays(s, 7 * 11));
    }
  }

  // 겹침 경고: 시간·날짜를 그대로 둔 채 한 번 더 누르면 그래도 저장한다
  const conflictKey = [kind, weekday, date, startDate, endDate, start, end].join('|');
  const [conflict, setConflict] = useState(null); // { key, text }
  const conflictShown = conflict && conflict.key === conflictKey ? conflict : null;

  async function checkConflicts() {
    const from = isClass ? startDate : date;
    const to = isClass ? (daysBetween(startDate, endDate) > 400 ? addDays(startDate, 400) : endDate) : date;
    const sessions = await api.get(`/api/sessions?from=${from}&to=${to}`);
    const list = findConflicts(sessions, isClass
      ? { kind: 'class', id: initial?.id, weekday, start_date: startDate, end_date: endDate, start_time: start, end_time: end }
      : { kind: 'one_day', id: initial?.id, date, start_time: start, end_time: end });
    return conflictSummary(list, dateLabel);
  }

  async function save() {
    setError(null);
    if (!name.trim()) return setError('수업명을 입력해 주세요');
    setBusy(true);
    const common = { name, start_time: start, end_time: end || null, location, supplies, memo, link };
    try {
      if (!conflictShown) {
        const text = await checkConflicts().catch(() => '');
        if (text) {
          setConflict({ key: conflictKey, text });
          setBusy(false);
          return;
        }
      }
      let saved;
      if (isClass) {
        const body = { ...common, weekday, start_date: startDate, end_date: endDate, term, color: initial?.color || null };
        saved = editing ? await api.put(`/api/classes/${initial.id}`, body) : await api.post('/api/classes', body);
        onSaved(editing ? '수업을 고쳤어요' : '정규 수업을 등록했어요', editing ? null : { goTo: `/classes/${saved.id}` });
      } else {
        const body = { ...common, date, color: initial?.color || null };
        saved = editing ? await api.put(`/api/one-day-events/${initial.id}`, body) : await api.post('/api/one-day-events', body);
        onSaved(editing ? '수업을 고쳤어요' : '원데이 수업을 등록했어요');
      }
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Sheet title={editing ? '수업 수정' : '수업 추가'} onClose={onClose}>
      {!editing && (
        <div className="segment light" role="tablist" aria-label="수업 종류" style={{ marginTop: 8 }}>
          <button type="button" role="tab" aria-selected={isClass} onClick={() => setKind('class')}>정규 (매주)</button>
          <button type="button" role="tab" aria-selected={!isClass} onClick={() => setKind('one_day')}>원데이 (하루)</button>
        </div>
      )}

      <TextField id="class-name" label="수업명" value={name} onChange={setName} placeholder="예: 와이즈미술학원" autoComplete="off"
        autoFocus={!editing} />

      {isClass ? (
        <div className="field">
          <span className="field-label">요일</span>
          <div className="weekdays">
            {WEEKDAYS.map((w, i) => (
              <button key={w} type="button" className="chip" aria-pressed={weekday === i} onClick={() => pickWeekday(i)}>{w}</button>
            ))}
          </div>
        </div>
      ) : (
        <div className="field">
          <label className="field-label" htmlFor="one-day-date">날짜</label>
          <input id="one-day-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      )}

      <TimeField id="start-time" label="시작 시간" value={start} onChange={setStart}
        extra={<em>{end ? `${start} – ${end}` : start}</em>} />

      <div className="field">
        <label className="field-label" htmlFor="end-time">수업 길이</label>
        <div className="chips">
          {COMMON_DURATIONS.map((m) => (
            <button key={m} type="button" className="chip" aria-pressed={dur === m} onClick={() => setDur(m)}>{durationLabel(m)}</button>
          ))}
          <button type="button" className="chip dashed" aria-pressed={dur === null} onClick={() => { setDur(null); setEndTyped(end || ''); }}>끝 시간 직접</button>
        </div>
        {dur === null && (
          <input id="end-time" className="input" type="time" step="600" value={endTyped} onChange={(e) => setEndTyped(e.target.value)} />
        )}
      </div>

      <PlaceField value={location} onChange={setLocation} />

      {isClass && (
        <>
          <div className="field">
            <span className="field-label">기간</span>
            <div className="grid-2">
              <label className="sr-only" htmlFor="start-date">시작일</label>
              <input id="start-date" className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} aria-label="시작일" />
              <label className="sr-only" htmlFor="end-date">종료일</label>
              <input id="end-date" className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} aria-label="종료일" />
            </div>
          </div>
          <TextField id="term" label="학기" hint="(선택)" value={term} onChange={setTerm} placeholder="예: 겨울학기" list="term-options" autoComplete="off" />
          {terms.length > 0 && (
            <datalist id="term-options">{terms.map((t) => <option key={t} value={t} />)}</datalist>
          )}
        </>
      )}

      <TextField id="supplies" label="준비물" hint="(쉼표로 구분)" value={supplies} onChange={setSupplies} placeholder="예: 실내용 운동화, 물통" />
      <TextField id="memo" label="메모" hint="(선택)" value={memo} onChange={setMemo} multiline placeholder="예: 보호자 1인 동반" />
      <TextField id="link" label="구매·신청 링크" hint="(선택)" value={link} onChange={setLink}
        placeholder="https://" type="url" inputMode="url" autoComplete="off" />

      {conflictShown && (
        <p className="warn-box" role="alert">
          <strong>같은 시간에 다른 수업이 있어요</strong>
          {conflictShown.text}
        </p>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="button" className="primary-btn" disabled={busy} onClick={save}>
        {conflictShown ? '겹쳐도 저장' : editing ? '저장' : isClass ? '매주 반복으로 저장' : '이 날짜에 저장'}
      </button>
    </Sheet>
  );
}
