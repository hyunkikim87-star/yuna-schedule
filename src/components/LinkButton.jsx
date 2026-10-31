import { ArrowRight } from './Icons.jsx';

// 수업 구매·신청 페이지를 새 창으로 연다
export default function LinkButton({ href, style }) {
  let host = '';
  try { host = new URL(href).hostname.replace(/^www\./, ''); } catch { /* 주소가 이상하면 이름 없이 */ }
  return (
    <a className="link-btn" href={href} target="_blank" rel="noreferrer noopener" style={style}>
      <span className="link-btn-main">
        <span className="link-btn-title">구매 페이지 열기</span>
        {host && <span className="link-btn-host">{host}</span>}
      </span>
      <ArrowRight size={20} stroke={2.2} />
    </a>
  );
}
