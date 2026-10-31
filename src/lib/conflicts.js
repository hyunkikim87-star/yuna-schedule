// 저장 전 겹침 확인: 새로 넣으려는 수업과 시간이 겹치는 기존 회차를 찾는다.
// target: 원데이 { kind: 'one_day', date, start_time, end_time, id? }
//         정규   { kind: 'class', weekday, start_date, end_date, start_time, end_time, id? }
// id가 있으면(수정) 자기 자신의 회차는 뺀다.
import { toMinutes, weekdayOf } from './time.js';

function range(start, end) {
  const s = toMinutes(start);
  return [s, end ? toMinutes(end) : s];
}

function overlaps(a, b) {
  if (a[0] === b[0]) return true;
  return a[0] < b[1] && b[0] < a[1];
}

export function findConflicts(sessions, target) {
  if (!target.start_time) return [];
  const mine = range(target.start_time, target.end_time);
  return sessions.filter((s) => {
    if (target.id && s.kind === target.kind && s.source_id === target.id) return false;
    if (target.kind === 'one_day') {
      if (s.date !== target.date) return false;
    } else if (weekdayOf(s.date) !== target.weekday || s.date < target.start_date || s.date > target.end_date) {
      return false;
    }
    return overlaps(mine, range(s.start_time, s.end_time));
  });
}

// '11월 7일 (토) 15:30 쿠키 만들기 체험 외 2회'
export function conflictSummary(list, dateLabel) {
  if (!list.length) return '';
  const first = list[0];
  const rest = list.length - 1;
  return `${dateLabel(first.date)} ${first.start_time} ${first.name}${rest ? ` 외 ${rest}회` : ''}`;
}
