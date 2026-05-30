import ScheduleCard from './ScheduleCard';

export default function ScheduleColumn({ label, items, onAdd, onEdit }) {
  return (
    <div className="schedule-column">
      <div className="column-header">{label}</div>
      <div className="column-body">
        {items.map(item => (
          <ScheduleCard key={item.id} item={item} onEdit={onEdit} />
        ))}
        <button className="add-btn" onClick={onAdd}>+ 수업 추가</button>
      </div>
    </div>
  );
}
