import { useState } from 'react';

const LABELS = { class_name: '수업명', location: '장소', supplies: '준비물', memo: '메모' };

export default function ScheduleModal({ mode, day, item, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({
    class_name: item?.class_name ?? '',
    location: item?.location ?? '',
    memo: item?.memo ?? '',
    supplies: item?.supplies ?? '',
  });

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  function handleSave() {
    if (!form.class_name.trim()) return;
    onSave({ ...form, id: item?.id, day });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">
          {mode === 'add' ? `${day === 'SAT' ? '토요일' : '일요일'} 수업 추가` : '수업 수정'}
        </div>

        {['class_name', 'location', 'supplies', 'memo'].map(field => (
          <label key={field} className="modal-field">
            <span>{LABELS[field]}</span>
            <input
              name={field}
              value={form[field]}
              onChange={handleChange}
              placeholder={field === 'class_name' ? '필수' : ''}
            />
          </label>
        ))}

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
