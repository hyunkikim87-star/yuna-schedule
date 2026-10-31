import { Calendar, Home, ListIcon, Settings } from './Icons.jsx';

const TABS = [
  { path: '/', label: '홈', Icon: Home },
  { path: '/calendar', label: '달력', Icon: Calendar },
  { path: '/classes', label: '수업', Icon: ListIcon },
  { path: '/settings', label: '설정', Icon: Settings },
];

export default function TabBar({ path }) {
  // 원데이 상세(#/one-day/:id)는 수업 탭에 속한다
  const active = (p) => (p === '/' ? path === '/' : path.startsWith(p) || (p === '/classes' && path.startsWith('/one-day')));
  return (
    <nav className="tabbar" aria-label="하단 탭">
      <ul>
        {TABS.map(({ path: p, label, Icon }) => (
          <li key={p}>
            <a href={`#${p}`} aria-current={active(p) ? 'page' : undefined}>
              <Icon size={24} stroke={active(p) ? 2.2 : 1.8} />
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
