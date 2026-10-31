import { useCallback, useEffect, useState } from 'react';
import { api, setUnauthorizedHandler } from './lib/api.js';
import { useHashPath } from './lib/hooks.js';
import PinScreen from './components/PinScreen.jsx';
import TabBar from './components/TabBar.jsx';
import ClassForm from './components/ClassForm.jsx';
import SessionSheet from './components/SessionSheet.jsx';
import { Plus } from './components/Icons.jsx';
import HomePage from './pages/HomePage.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import ClassesPage from './pages/ClassesPage.jsx';
import ClassDetailPage from './pages/ClassDetailPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

export default function App() {
  const [auth, setAuth] = useState({ checked: false, loggedIn: false, pinLength: 4 });
  const [path, go] = useHashPath();
  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState(null); // { kind, initial } 수업 추가·수정 시트
  const [openSession, setOpenSession] = useState(null); // 회차 시트
  const [toast, setToast] = useState(null);

  const checkAuth = useCallback(() => api.get('/api/auth/status')
    .then((s) => setAuth({ checked: true, loggedIn: s.logged_in, pinLength: s.pin_length || 4 }))
    .catch(() => setAuth((a) => ({ ...a, checked: true }))), []);

  useEffect(() => {
    setUnauthorizedHandler(() => setAuth((a) => ({ ...a, loggedIn: false })));
    checkAuth();
  }, [checkAuth]);

  const notify = useCallback((text) => {
    setToast(text);
    setTimeout(() => setToast(null), 2200);
  }, []);

  // 저장·삭제 뒤 모든 화면 다시 불러오기
  const changed = useCallback((text) => {
    setRefreshKey((k) => k + 1);
    if (text) notify(text);
  }, [notify]);

  if (!auth.checked) return <div className="loading">불러오는 중…</div>;
  if (!auth.loggedIn) return <PinScreen length={auth.pinLength} onSuccess={checkAuth} />;

  const ctx = { refreshKey, changed, notify, go, openForm: setForm, openSession: setOpenSession };
  const detailMatch = path.match(/^\/classes\/(\d+)$/);

  let page;
  if (detailMatch) page = <ClassDetailPage id={Number(detailMatch[1])} {...ctx} />;
  else if (path.startsWith('/calendar')) page = <CalendarPage {...ctx} />;
  else if (path.startsWith('/classes')) page = <ClassesPage {...ctx} />;
  else if (path.startsWith('/settings')) page = <SettingsPage {...ctx} onLogout={checkAuth} />;
  else page = <HomePage {...ctx} />;

  const showFab = !detailMatch && !path.startsWith('/settings');

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
      {openSession && (
        <SessionSheet
          session={openSession}
          onClose={() => setOpenSession(null)}
          onChanged={(text) => { setOpenSession(null); changed(text); }}
          onEditOneDay={(ev) => { setOpenSession(null); setForm({ kind: 'one_day', initial: ev }); }}
          go={(p) => { setOpenSession(null); go(p); }}
        />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
