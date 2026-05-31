// src/components/EventBlock.jsx
const COLORS = [
  { bg: '#e8f5e9', border: '#34a853', text: '#1b5e20' },
  { bg: '#fce8e6', border: '#ea4335', text: '#b71c1c' },
  { bg: '#fff8e1', border: '#fbbc04', text: '#5d4037' },
  { bg: '#f3e5f5', border: '#9c27b0', text: '#4a148c' },
  { bg: '#e3f2fd', border: '#1976d2', text: '#0d47a1' },
];

const HOUR_HEIGHT = 56;
const GRID_START_HOUR = 9;

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function getEventStyle(start_time, end_time) {
  if (!start_time || !end_time) return null;
  const startMin = timeToMinutes(start_time);
  const endMin = timeToMinutes(end_time);
  const top = ((startMin - GRID_START_HOUR * 60) / 60) * HOUR_HEIGHT;
  const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 28);
  return { top, height };
}

export default function EventBlock({ item, onEdit }) {
  const color = COLORS[item.id % COLORS.length];
  const style = getEventStyle(item.start_time, item.end_time);
  if (!style) return null;

  return (
    <div
      className="event-block"
      style={{ top: style.top, height: style.height, background: color.bg, borderLeftColor: color.border, color: color.text }}
      onClick={() => onEdit(item)}
    >
      <div className="event-name">{item.class_name}</div>
      <div className="event-time">{item.start_time} ~ {item.end_time}</div>
      {item.location && <div className="event-loc">{item.location}</div>}
    </div>
  );
}
