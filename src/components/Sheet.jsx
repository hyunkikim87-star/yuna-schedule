import { useEffect, useRef } from 'react';
import { Close } from './Icons.jsx';

// 아래에서 올라오는 시트. 바깥(어두운 부분)을 누르거나 Esc로 닫힌다.
export default function Sheet({ title, onClose, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
      prev?.focus?.();
    };
  }, []);

  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <section
        ref={ref}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <div className="handle" />
        <div className="sheet-head">
          <h2 className="sheet-title">{title}</h2>
          <button type="button" className="icon-btn" aria-label="닫기" onClick={onClose} style={{ marginRight: -10 }}>
            <Close size={22} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
