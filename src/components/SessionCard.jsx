import { mapUrl, sessionColor } from '../lib/colors.js';
import { splitSupplies } from '../lib/time.js';
import { Check, ChevronRight } from './Icons.jsx';

// 회차 카드. 카드(또는 수업명)를 누르면 onOpen, 장소를 누르면 네이버 지도, 준비물 칩은 챙김 표시.
// 키보드로는 수업명 버튼이 같은 일을 한다.
export default function SessionCard({ session: s, onOpen, checked = {}, onToggleSupply }) {
  const supplies = splitSupplies(s.supplies);
  const key = (item) => `${s.date}|${s.kind}|${s.source_id}|${item}`;
  const stop = (e) => e.stopPropagation();
  return (
    <article className="session clickable" onClick={() => onOpen(s)}>
      <div className="session-time">
        <span className="session-start">{s.start_time}</span>
        {s.end_time && <span className="session-end">{s.end_time}</span>}
      </div>
      <div className="session-body">
        <div className="session-name-row">
          <button type="button" onClick={(e) => { stop(e); onOpen(s); }}
            style={{ border: 0, background: 'transparent', padding: 0, textAlign: 'left' }}
            className="session-name">
            {s.name}
          </button>
          {s.kind === 'one_day' && <span className="tag">원데이</span>}
          {s.changed && <span className="tag blue">이 날만 변경</span>}
          {s.overlap && <span className="tag red">시간 겹침</span>}
        </div>
        {s.location && (
          <a className="place-link" href={mapUrl(s.location)} target="_blank" rel="noreferrer" onClick={stop}>
            <span className="dot" style={{ background: sessionColor(s) }} />
            {s.location}
            <ChevronRight size={14} />
          </a>
        )}
        {supplies.length > 0 && (
          <div className="chips" style={{ gap: 8, paddingTop: 2 }}>
            {supplies.map((item) => {
              const on = Boolean(checked[key(item)]);
              return (
                <button key={item} type="button" className="supply" aria-pressed={on}
                  onClick={(e) => { stop(e); onToggleSupply?.(key(item), !on); }}>
                  {on && <Check size={14} stroke={3} />}
                  {item}
                </button>
              );
            })}
          </div>
        )}
        {s.memo && <p className="session-memo">{s.memo}</p>}
      </div>
    </article>
  );
}
