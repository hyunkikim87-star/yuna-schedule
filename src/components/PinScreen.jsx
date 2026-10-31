import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Backspace } from './Icons.jsx';

const PIN_LENGTH = 4;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

// PIN 로그인. 4자리를 누르면 바로 확인한다 (PIN을 4자리보다 길게 바꾸면 길이도 같이 바뀌어야 함 → length prop).
export default function PinScreen({ onSuccess, length = PIN_LENGTH }) {
  const [typed, setTyped] = useState('');
  const [message, setMessage] = useState({ text: '한 번 입력하면 30일 동안 묻지 않아요', error: false });
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(pin) {
    setBusy(true);
    try {
      await api.post('/api/auth/login', { pin });
      onSuccess();
    } catch (e) {
      setMessage({ text: e.message, error: true });
      setShake(true);
      setTimeout(() => setShake(false), 400);
      setTyped('');
    } finally {
      setBusy(false);
    }
  }

  function press(k) {
    if (busy) return;
    if (k === 'del') return setTyped((t) => t.slice(0, -1));
    const next = (typed + k).slice(0, length);
    setTyped(next);
    if (next.length === length) submit(next);
  }

  useEffect(() => {
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <main className="pin">
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>PIN을 입력해 주세요</h1>
      <p className={`pin-msg${message.error ? ' err' : ''}`} role="status">{message.text}</p>
      <div className={`pin-dots${shake ? ' shake' : ''}`} aria-label={`${typed.length}자리 입력됨`} role="img">
        {Array.from({ length }, (_, i) => <span key={i} className={i < typed.length ? 'on' : ''} />)}
      </div>
      <div className="pin-pad">
        {KEYS.map((k, i) => (k === ''
          ? <span key={i} />
          : (
            <button key={i} type="button" onClick={() => press(k)} aria-label={k === 'del' ? '지우기' : k} disabled={busy}>
              {k === 'del' ? <Backspace size={26} stroke={1.8} /> : k}
            </button>
          )))}
      </div>
    </main>
  );
}
