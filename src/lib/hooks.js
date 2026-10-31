import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

// GET 한 번 + 다시 불러오기. url이 null이면 부르지 않는다.
// 다시 불러오는 동안에는 이전 data를 그대로 보여준다 (화면 깜빡임 방지).
export function useFetch(url, refreshKey = 0) {
  const key = url ? `${url}#${refreshKey}` : null;
  const [state, setState] = useState({ key: null, data: null, error: null });

  useEffect(() => {
    if (!key) return undefined;
    let alive = true;
    api.get(url)
      .then((data) => alive && setState({ key, data, error: null }))
      .catch((error) => alive && setState({ key, data: null, error }));
    return () => { alive = false; };
  }, [key, url]);

  return { data: state.data, error: state.error, loading: Boolean(key) && state.key !== key };
}

// '#/classes/12' → '/classes/12'
function readHash() {
  const h = window.location.hash.replace(/^#/, '');
  return h.startsWith('/') ? h : '/';
}

export function useHashPath() {
  const [path, setPath] = useState(readHash);
  useEffect(() => {
    const onChange = () => { setPath(readHash()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const go = useCallback((p) => { window.location.hash = p; }, []);
  return [path, go];
}

// 이 기기에만 저장하는 작은 값 (준비물 체크 등). 저장이 막혀 있어도 화면은 돌아간다.
export function useLocalState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback((next) => {
    setValue((prev) => {
      const v = typeof next === 'function' ? next(prev) : next;
      try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* 저장 불가: 무시 */ }
      return v;
    });
  }, [key]);
  return [value, set];
}

// 1분마다 다시 그리기 (지금 수업 중 표시용)
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
