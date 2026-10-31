import Sheet from './Sheet.jsx';

// 지우기 같은 되돌리기 어려운 일을 하기 전 확인 (브라우저 기본 확인 창 대신)
export default function ConfirmSheet({ title, message, confirmLabel = '지우기', busy, onConfirm, onClose }) {
  return (
    <Sheet title={title} onClose={onClose}>
      {message && <p className="page-sub" style={{ marginTop: 4, lineHeight: 1.5 }}>{message}</p>}
      <div className="grid-2" style={{ marginTop: 24 }}>
        <button type="button" className="ghost-btn" style={{ marginTop: 0 }} onClick={onClose} disabled={busy}>취소</button>
        <button type="button" className="ghost-btn red" style={{ marginTop: 0, background: 'var(--danger)', color: '#FFFFFF' }}
          onClick={onConfirm} disabled={busy}>{confirmLabel}</button>
      </div>
    </Sheet>
  );
}
