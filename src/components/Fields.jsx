import { useState } from 'react';
import { useFetch } from '../lib/hooks.js';
import { placeColor } from '../lib/colors.js';
import { COMMON_STARTS } from '../lib/constants.js';

// 자주 쓰는 시간 칩 + 직접 입력 (휠 대신 휴대폰 기본 시간 선택기)
export function TimeField({ id, label, value, onChange, options = COMMON_STARTS, extra }) {
  const custom = value && !options.includes(value);
  const [showInput, setShowInput] = useState(custom);
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>{label}{extra}</label>
      <div className="chips">
        {options.map((t) => (
          <button key={t} type="button" className="chip" aria-pressed={value === t}
            onClick={() => { setShowInput(false); onChange(t); }}>{t}</button>
        ))}
        <button type="button" className="chip dashed" aria-pressed={showInput || custom}
          onClick={() => setShowInput(true)}>직접</button>
      </div>
      {(showInput || custom) && (
        <input id={id} className="input" type="time" step="600" value={value || ''}
          onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

// 장소: 저장된 장소 목록 칩 + 직접 입력
export function PlaceField({ value, onChange }) {
  const { data } = useFetch('/api/places');
  const names = (data || []).map((p) => p.name);
  const custom = value && !names.includes(value);
  const [typing, setTyping] = useState(false);
  return (
    <div className="field">
      <label className="field-label" htmlFor="place-input">장소</label>
      <div className="chips">
        {names.map((name) => (
          <button key={name} type="button" className="chip" aria-pressed={value === name}
            onClick={() => { setTyping(false); onChange(value === name ? '' : name); }}>
            <span className="dot" style={{ background: placeColor(name) }} />{name}
          </button>
        ))}
        <button type="button" className="chip dashed" aria-pressed={typing || custom} onClick={() => setTyping(true)}>+ 직접 입력</button>
      </div>
      {(typing || custom) && (
        <input id="place-input" className="input" type="text" placeholder="예: 이마트 수지점" value={value || ''}
          onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

export function TextField({ id, label, hint, value, onChange, placeholder, multiline, ...rest }) {
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        <span>{label} {hint && <span className="field-hint">{hint}</span>}</span>
      </label>
      <Tag id={id} className="input" type={multiline ? undefined : 'text'} value={value || ''}
        placeholder={placeholder} onChange={(e) => onChange(e.target.value)} {...rest} />
    </div>
  );
}
