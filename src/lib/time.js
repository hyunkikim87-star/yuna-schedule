// 화면용 날짜·시간 도우미. 날짜 계산은 서버와 같은 lib/sessions.js를 쓴다.
// 현재 시각은 항상 인자로 받는다 (테스트에서 고정하려고).
import { addDays, weekdayOf, weekendOf } from '../../lib/sessions.js';

export { addDays, weekdayOf, weekendOf };

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// 한국 시간 기준 오늘 날짜와 지금 시각('HH:MM')
export function nowInSeoul(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(date).map((p) => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export function toMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function addMinutes(t, n) {
  const total = toMinutes(t) + n;
  return total >= 24 * 60 ? null : fromMinutes(total);
}

export function durationLabel(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m}분`;
  return m ? `${h}시간 ${m}분` : `${h}시간`;
}

// '10월 31일 (토)'
export function dateLabel(d, { weekday = true } = {}) {
  const [, m, day] = d.split('-').map(Number);
  return weekday ? `${m}월 ${day}일 (${WEEKDAYS[weekdayOf(d)]})` : `${m}월 ${day}일`;
}

// '2026.6.13'
export function shortDate(d) {
  const [y, m, day] = d.split('-').map(Number);
  return `${y}.${m}.${day}`;
}

export function monthRange(year, month) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  return { from, to: addDays(next, -1) };
}

export function shiftMonth({ year, month }, n) {
  const idx = year * 12 + (month - 1) + n;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

// 하루 회차 사이의 빈 시간과 장소 이동. sessions는 같은 날, 시간순.
export function gapsBetween(sessions) {
  const gaps = [];
  for (let i = 1; i < sessions.length; i++) {
    const prev = sessions[i - 1];
    const cur = sessions[i];
    const prevEnd = toMinutes(prev.end_time || prev.start_time);
    const minutes = toMinutes(cur.start_time) - prevEnd;
    const moved = Boolean(prev.location && cur.location && prev.location !== cur.location);
    gaps.push({ minutes, moved, to: cur.location });
  }
  return gaps;
}

// 받침에 맞는 '로'/'으로' (받침 없음·ㄹ 받침 → 로). 한글로 안 끝나면 '로'.
export function withRo(word) {
  const code = word.charCodeAt(word.length - 1) - 0xAC00;
  if (code < 0 || code > 11171) return `${word}로`;
  const jong = code % 28;
  return `${word}${jong === 0 || jong === 8 ? '로' : '으로'}`;
}

export function gapLabel(gap) {
  if (gap.minutes < 0) return '시간이 겹쳐요';
  const time = gap.minutes === 0 ? '바로 이어서' : durationLabel(gap.minutes);
  return gap.moved ? `${time} · ${withRo(gap.to)} 이동` : `${time} · 같은 장소`;
}

// 홈 맨 위 한 줄: 지금 수업 중인 회차, 다음 회차
export function weekendStatus(sessions, now) {
  const current = sessions.find((s) => s.date === now.date && s.start_time <= now.time
    && now.time < (s.end_time || s.start_time));
  const next = sessions.find((s) => s !== current && (s.date > now.date || (s.date === now.date && s.start_time > now.time)));
  const result = { current: null, next: null };
  if (current) {
    result.current = { session: current, leftMinutes: toMinutes(current.end_time) - toMinutes(now.time) };
  }
  if (next) {
    const sameDay = next.date === now.date;
    result.next = { session: next, inMinutes: sameDay ? toMinutes(next.start_time) - toMinutes(now.time) : null };
  }
  return result;
}

export function relativeLabel(minutes) {
  if (minutes < 1) return '곧 시작';
  return `${durationLabel(minutes)} 뒤`;
}

export function splitSupplies(s) {
  return (s || '').split(',').map((x) => x.trim()).filter(Boolean);
}

// 수업 기간 상태
export function classStatus(c, today) {
  if (c.end_date < today) return 'ended';
  if (c.start_date > today) return 'upcoming';
  return 'active';
}

export function weekendTitle(offset) {
  if (offset === 0) return '이번 주말';
  if (offset === 1) return '다음 주말';
  if (offset === -1) return '지난 주말';
  return offset > 0 ? `${offset}주 뒤 주말` : `${-offset}주 전 주말`;
}
