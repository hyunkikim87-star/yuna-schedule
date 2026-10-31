import { useState } from 'react';
import { api } from '../lib/api.js';
import { addMinutes, toMinutes } from '../lib/time.js';
import { PlaceField, TextField, TimeField } from './Fields.jsx';

// 정규 수업의 '이 날만 변경'. 비워 둔 칸은 원래 값 그대로.
export default function ChangeForm({ classId, date, defaults, onDone }) {
  const [start, setStart] = useState(defaults.start_time || '');
  const [end, setEnd] = useState(defaults.end_time || '');
  // 시작 시간을 바꾸면 수업 길이는 그대로 두고 끝 시간을 같이 옮긴다
  const length = defaults.start_time && defaults.end_time
    ? toMinutes(defaults.end_time) - toMinutes(defaults.start_time) : null;
  const changeStart = (t) => {
    setStart(t);
    if (length) setEnd(addMinutes(t, length) || '');
  };
  const [location, setLocation] = useState(defaults.location || '');
  const [memo, setMemo] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/classes/${classId}/exceptions`, {
        date, type: 'change', start_time: start, end_time: end, location, memo,
      });
      onDone('이 날만 바꿨어요');
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <>
      <TimeField id="change-start" label="시작 시간" value={start} onChange={changeStart} />
      <div className="field">
        <label className="field-label" htmlFor="change-end">끝 시간</label>
        <input id="change-end" className="input" type="time" step="600" value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>
      <PlaceField value={location} onChange={setLocation} />
      <TextField id="change-memo" label="메모" hint="(선택)" value={memo} onChange={setMemo} placeholder="예: 강의실 변경" />
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="button" className="primary-btn" disabled={busy} onClick={save}>이 날만 바꾸기</button>
    </>
  );
}
