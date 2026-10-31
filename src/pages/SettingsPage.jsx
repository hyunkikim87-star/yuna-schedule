import { useState } from 'react';
import { api } from '../lib/api.js';
import { useFetch, useNow } from '../lib/hooks.js';
import { nowInSeoul } from '../lib/time.js';
import { placeColor } from '../lib/colors.js';
import Sheet from '../components/Sheet.jsx';
import { ChevronRight } from '../components/Icons.jsx';

function PinChange({ onClose, notify }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setError(null);
    if (!/^\d{4,6}$/.test(next)) return setError('새 PIN은 숫자 4~6자리여야 해요');
    if (next !== again) return setError('새 PIN 두 개가 달라요');
    setBusy(true);
    try {
      await api.post('/api/auth/change-pin', { current_pin: current, new_pin: next });
      notify('PIN을 바꿨어요. 다른 폰에서는 새 PIN을 다시 입력해야 해요');
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  const pinInput = (id, label, value, set) => (
    <div className="field">
      <label className="field-label" htmlFor={id}>{label}</label>
      <input id={id} className="input" type="password" inputMode="numeric" autoComplete="off" maxLength={6}
        value={value} onChange={(e) => set(e.target.value.replace(/\D/g, ''))} />
    </div>
  );

  return (
    <Sheet title="PIN 변경" onClose={onClose}>
      {pinInput('pin-current', '지금 PIN', current, setCurrent)}
      {pinInput('pin-next', '새 PIN (숫자 4~6자리)', next, setNext)}
      {pinInput('pin-again', '새 PIN 한 번 더', again, setAgain)}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="button" className="primary-btn" disabled={busy || !current || !next} onClick={save}>바꾸기</button>
    </Sheet>
  );
}

function Places({ refreshKey, changed, onClose }) {
  const { data } = useFetch('/api/places', refreshKey);
  const [name, setName] = useState('');
  const [error, setError] = useState(null);

  async function add() {
    setError(null);
    try {
      await api.post('/api/places', { name });
      setName('');
      changed('장소를 추가했어요');
    } catch (e) {
      setError(e.message);
    }
  }
  async function remove(p) {
    if (!window.confirm(`'${p.name}'을(를) 목록에서 뺄까요? 이미 등록한 수업은 그대로예요`)) return;
    await api.del(`/api/places/${p.id}`);
    changed('목록에서 뺐어요');
  }

  return (
    <Sheet title="자주 가는 장소" onClose={onClose}>
      <p className="page-sub">수업을 추가할 때 칩으로 바로 고를 수 있어요</p>
      <div style={{ marginTop: 12 }}>
        {(data || []).map((p) => (
          <div key={p.id} className="list-row" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <span className="dot lg" style={{ background: placeColor(p.name) }} />
            <span className="list-row-label">{p.name}</span>
            <button type="button" className="small-btn" onClick={() => remove(p)}>빼기</button>
          </div>
        ))}
      </div>
      <div className="field">
        <label className="field-label" htmlFor="new-place">새 장소</label>
        <div className="row">
          <input id="new-place" className="input" type="text" value={name} placeholder="예: 롯데백화점 분당점"
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && name.trim() && add()} />
          <button type="button" className="small-btn" style={{ height: 52, background: 'var(--ink)', color: '#fff' }} disabled={!name.trim()} onClick={add}>추가</button>
        </div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </Sheet>
  );
}

export default function SettingsPage({ refreshKey, changed, notify, onLogout }) {
  const [sheet, setSheet] = useState(null);
  const today = nowInSeoul(useNow()).date;

  async function exportBackup() {
    try {
      const [classes, oneDayEvents, places] = await Promise.all([
        api.get('/api/classes'), api.get('/api/one-day-events'), api.get('/api/places'),
      ]);
      const details = await Promise.all(classes.map((c) => api.get(`/api/classes/${c.id}`)));
      const body = { exported_at: new Date().toISOString(), classes: details, one_day_events: oneDayEvents, places };
      const url = URL.createObjectURL(new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `yuna-schedule-backup-${today}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      notify(e.message);
    }
  }

  async function logout() {
    await api.post('/api/auth/logout');
    onLogout();
  }

  const item = (label, desc, onClick) => (
    <button type="button" className="list-item" style={{ minHeight: 64 }} onClick={onClick}>
      <span className="list-main"><span className="list-title" style={{ fontWeight: 600 }}>{label}</span>{desc && <span className="list-meta">{desc}</span>}</span>
      <ChevronRight size={18} color="#8B95A1" />
    </button>
  );

  return (
    <>
      <header className="page-head"><h1 className="page-title">설정</h1></header>
      <div className="list" style={{ marginTop: 20 }}>
        {item('자주 가는 장소', '수업 추가할 때 고르는 장소 목록', () => setSheet('places'))}
        {item('PIN 변경', '바꾸면 다른 폰은 다시 로그인해요', () => setSheet('pin'))}
        {item('백업 내려받기', '정규·원데이 수업과 장소를 JSON 파일로', exportBackup)}
      </div>
      <div className="list" style={{ marginTop: 12 }}>
        <button type="button" className="list-item" style={{ minHeight: 56, color: 'var(--danger)', fontWeight: 600 }} onClick={logout}>이 폰에서 로그아웃</button>
      </div>
      {sheet === 'pin' && <PinChange onClose={() => setSheet(null)} notify={notify} />}
      {sheet === 'places' && <Places refreshKey={refreshKey} changed={changed} onClose={() => setSheet(null)} />}
    </>
  );
}
