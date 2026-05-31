// src/components/EventModal.jsx
import { useState } from 'react';

// 09:00 ~ 18:00, 10분 단위 (55개 옵션)
const TIME_OPTIONS = [''].concat(
  Array.from({ length: 55 }, (_, i) => {
    const total = 9 * 60 + i * 10;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  })
);

export default function EventModal({ mode, item, holidays, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({
    class_name: item?.class_name ?? '',
    day: item?.day ?? 'SAT',
    start_time: item?.start_time ?? '',
    end_time: item?.end_time ?? '',
    location: item?.location ?? '',
    supplies: item?.supplies ?? '',
    memo: item?.memo ?? '',
  });
  const [repeatCount, setRepeatCount] = useState(1);

  function set(field, val) { setForm(f => ({ ...f, [field]: val })); }

  function handleSave() {
    if (!form.class_name.trim()) return;
    const isRepeatable = form.day === 'SAT' || form.day === 'SUN';
    onSave({
      ...form,
      id: item?.id,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      repeatCount: isRepeatable ? repeatCount : 1,
    });
  }

  const dayOptions = [
    { value: 'SAT', label: '토요일' },
    { value: 'SUN', label: '일요일' },
    ...holidays.map(h => ({ value: h.date, label: `${h.name} (${h.date})` })),
  ];

  const isRepeatable = form.day === 'SAT' || form.day === 'SUN';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{mode === 'add' ? '수업 추가' : '수업 수정'}</div>

        <label className="modal-field">
          <span>수업명 *</span>
          <input value={form.class_name} onChange={e => set('class_name', e.target.value)} placeholder="필수" />
        </label>

        <label className="modal-field">
          <span>요일</span>
          <select value={form.day} onChange={e => set('day', e.target.value)}>
            {dayOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>

        {isRepeatable && mode === 'add' && (
          <label className="modal-field">
            <span>등록 횟수</span>
            <input
              type="number"
              min="1"
              max="52"
              value={repeatCount}
              onChange={e => setRepeatCount(Math.max(1, Math.min(52, Number(e.target.value))))}
            />
          </label>
        )}

        <div className="modal-row">
          <label className="modal-field">
            <span>시작 시간</span>
            <select value={form.start_time} onChange={e => set('start_time', e.target.value)}>
              {TIME_OPTIONS.map(t => <option key={t} value={t}>{t || '미정'}</option>)}
            </select>
          </label>
          <label className="modal-field">
            <span>종료 시간</span>
            <select value={form.end_time} onChange={e => set('end_time', e.target.value)}>
              {TIME_OPTIONS.map(t => <option key={t} value={t}>{t || '미정'}</option>)}
            </select>
          </label>
        </div>

        <label className="modal-field">
          <span>장소</span>
          <input value={form.location} onChange={e => set('location', e.target.value)} />
        </label>

        <label className="modal-field">
          <span>준비물</span>
          <input value={form.supplies} onChange={e => set('supplies', e.target.value)} />
        </label>

        <label className="modal-field">
          <span>메모</span>
          <input value={form.memo} onChange={e => set('memo', e.target.value)} />
        </label>

        <div className="modal-actions">
          <button className="btn-save" onClick={handleSave}>저장</button>
          <button className="btn-cancel" onClick={onClose}>취소</button>
          {mode === 'edit' && (
            <button className="btn-delete" onClick={() => onDelete(item.id)}>삭제</button>
          )}
        </div>
      </div>
    </div>
  );
}
