// src/components/WeekView.jsx
import EventBlock from './EventBlock';

const HOURS = Array.from({ length: 9 }, (_, i) => i + 9); // 9~17
const DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];

function fmtDate(d) {
  if (!d) return null;
  return `${d.getMonth() + 1}/${d.getDate()}(${DOW_KO[d.getDay()]})`;
}

export default function WeekView({ schedules, holidays, satDate, sunDate, onEdit }) {
  const columns = [
    ...holidays.map(h => ({ key: h.date, day: h.date, label: h.name, cls: 'holiday', dateStr: h.date })),
    { key: 'SAT', day: 'SAT', label: fmtDate(satDate) || '토요일', cls: 'sat' },
    { key: 'SUN', day: 'SUN', label: fmtDate(sunDate) || '일요일', cls: 'sun' },
  ];

  const timedSchedules = schedules.filter(s => s.start_time && s.end_time);
  const untimedSchedules = schedules.filter(s => !s.start_time || !s.end_time);

  function getDateLabel(col) {
    if (!col.dateStr) return null;
    const d = new Date(col.dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}(${DOW_KO[d.getDay()]})`;
  }

  return (
    <div className="week-view">
      {untimedSchedules.length > 0 && (
        <div className="allday-row">
          <div className="allday-label">시간 미정</div>
          <div className="allday-items">
            {untimedSchedules.map(s => (
              <div key={s.id} className="allday-item" onClick={() => onEdit(s)}>
                {s.class_name}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="calendar">
        <div className="day-headers">
          <div className="time-gutter" />
          {columns.map(col => (
            <div key={col.key} className={`day-col-header ${col.cls}`}>
              {getDateLabel(col) && <span className="day-date-label">{getDateLabel(col)}</span>}
              <span className="day-name-label">{col.label}</span>
            </div>
          ))}
        </div>

        <div className="grid-body">
          <div className="time-col">
            {HOURS.map(h => <div key={h} className="time-slot">{h}시</div>)}
          </div>
          {columns.map(col => (
            <div key={col.key} className="day-col">
              {HOURS.map(h => <div key={h} className="slot-line" />)}
              {timedSchedules
                .filter(s => s.day === col.day)
                .map(s => <EventBlock key={s.id} item={s} onEdit={onEdit} />)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
