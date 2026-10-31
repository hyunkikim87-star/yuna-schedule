import { useCallback, useEffect, useRef, useState } from 'react';
import { api, setUnauthorizedHandler } from './lib/api.js';
import { useHashPath } from './lib/hooks.js';
import PinScreen from './components/PinScreen.jsx';
import TabBar from './components/TabBar.jsx';
import ClassForm from './components/ClassForm.jsx';
import { Plus } from './components/Icons.jsx';
import HomePage from './pages/HomePage.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import ClassesPage from './pages/ClassesPage.jsx';
import ClassDetailPage from './pages/ClassDetailPage.jsx';
import OneDayDetailPage from './pages/OneDayDetailPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

export default function App() {
  const [auth, setAuth] = useState({ checked: false, loggedIn: false, pinLength: 4 });
  const [path, go] = useHashPath();
  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState(null); // { kind, initial } 수업 추가·수정 시트
  const [toast, setToast] = useState(null);

  const checkAuth = useCallback(() => api.get('/api/auth/status')
    .then((s) => setAuth({ checked: true, loggedIn: s.logged_in, pinLength: s.pin_length || 4 }))
    .catch(() => setAuth((a) => ({ ...a, checked: true }))), []);

  useEffect(() => {
    setUnauthorizedHandler(() => setAuth((a) => ({ ...a, loggedIn: false })));
    checkAuth();
  }, [checkAuth]);

  // 앱으로 돌아오면(다른 앱·탭에 있다가) 다시 불러온다: 다른 폰에서 바꾼 내용이 바로 보이게. 너무 잦지 않게 20초 간격.
  const lastRefresh = useRef(0);
  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastRefresh.current < 20_000) return;
      lastRefresh.current = Date.now();
      setRefreshKey((k) => k + 1);
    };
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    return () => {
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
    };
  }, []);

  // 알림 한 줄. action({ label, run })이 있으면 버튼을 붙이고 조금 더 오래 보여준다 (예: 휴강 취소).
  const toastTimer = useRef(null);
  const notify = useCallback((text, action) => {
    clearTimeout(toastTimer.current);
    setToast({ text, action });
    toastTimer.current = setTimeout(() => setToast(null), action ? 5000 : 2200);
  }, []);

  // 저장·삭제 뒤 모든 화면 다시 불러오기
  const changed = useCallback((text, action) => {
    setRefreshKey((k) => k + 1);
    if (text) notify(text, action);
  }, [notify]);

  if (!auth.checked) return <div className="loading">불러오는 중…</div>;
  if (!auth.loggedIn) return <PinScreen length={auth.pinLength} onSuccess={checkAuth} />;

  const ctx = { refreshKey, changed, notify, go, openForm: setForm };
  const detailMatch = path.match(/^\/classes\/(\d+)$/);
  const oneDayMatch = path.match(/^\/one-day\/(\d+)$/);

  let page;
  if (detailMatch) page = <ClassDetailPage id={Number(detailMatch[1])} {...ctx} />;
  else if (oneDayMatch) page = <OneDayDetailPage id={Number(oneDayMatch[1])} {...ctx} />;
  else if (path.startsWith('/calendar')) page = <CalendarPage {...ctx} />;
  else if (path.startsWith('/classes')) page = <ClassesPage {...ctx} />;
  else if (path.startsWith('/settings')) page = <SettingsPage {...ctx} onLogout={checkAuth} />;
  else page = <HomePage {...ctx} />;

  const showFab = !detailMatch && !oneDayMatch && !path.startsWith('/settings');

  return (
    <div className="app">
      <main>{page}</main>
      {showFab && (
        <button type="button" className="fab" aria-label="수업 추가" onClick={() => setForm({ kind: 'class' })}>
          <Plus size={26} stroke={2.4} />
        </button>
      )}
      <TabBar path={path} />
      {form && (
        <ClassForm
          {...form}
          onClose={() => setForm(null)}
          onSaved={(text, saved) => {
            setForm(null);
            changed(text);
            if (saved?.goTo) go(saved.goTo);
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <span>{toast.text}</span>
          {toast.action && (
            <button type="button" className="toast-action" onClick={() => { setToast(null); toast.action.run(); }}>
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
