const COLORS = ['#fff3cd', '#d1ecf1', '#d4edda', '#f8d7da', '#e2d9f3', '#fde2c8'];

export default function ScheduleCard({ item, onEdit }) {
  const bg = COLORS[item.id % COLORS.length];
  return (
    <div
      className="schedule-card"
      style={{ background: bg, borderLeftColor: bg }}
      onClick={() => onEdit(item)}
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onEdit(item)}
    >
      <div className="card-title">{item.class_name}</div>
      {item.location && <div className="card-meta">📍 {item.location}</div>}
      {item.supplies && <div className="card-meta">🎒 {item.supplies}</div>}
      {item.memo && <div className="card-meta">📝 {item.memo}</div>}
    </div>
  );
}
