// 정규 수업(요일·기간) + 예외(휴강·이 날만 변경) + 원데이 → 실제 날짜 기준 회차 목록.
// 날짜는 'YYYY-MM-DD' 문자열, 시간은 'HH:MM' 문자열. 시간대 영향을 받지 않도록 UTC로만 계산한다.

const DAY_MS = 24 * 60 * 60 * 1000;

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function isValidTime(s) {
  return typeof s === 'string' && TIME_RE.test(s);
}

function toUtc(s) {
  return Date.parse(`${s}T00:00:00Z`);
}

function fromUtc(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(s, n) {
  return fromUtc(toUtc(s) + n * DAY_MS);
}

export function weekdayOf(s) {
  return new Date(toUtc(s)).getUTCDay();
}

export function daysBetween(from, to) {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

// 그 날짜가 속한 주말(토~일). 월~토는 그 주 토요일, 일요일은 전날 토요일 기준.
export function weekendOf(s) {
  const wd = weekdayOf(s);
  const sat = wd === 0 ? addDays(s, -1) : addDays(s, 6 - wd);
  return { sat, sun: addDays(sat, 1) };
}

function minutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function overlaps(a, b) {
  if (a.date !== b.date) return false;
  const aStart = minutes(a.start_time);
  const bStart = minutes(b.start_time);
  if (aStart === bStart) return true;
  // 끝 시간이 없으면 시작 시각 한 점으로 본다.
  const aEnd = a.end_time ? minutes(a.end_time) : aStart;
  const bEnd = b.end_time ? minutes(b.end_time) : bStart;
  return aStart < bEnd && bStart < aEnd;
}

export function computeSessions({ classes = [], exceptions = [], oneDayEvents = [], from, to }) {
  const exByKey = new Map(exceptions.map((e) => [`${e.class_id}|${e.date}`, e]));
  const sessions = [];

  for (const c of classes) {
    const start = c.start_date > from ? c.start_date : from;
    const end = c.end_date < to ? c.end_date : to;
    if (start > end) continue;
    // 기간 안의 첫 해당 요일부터 7일씩.
    let date = addDays(start, (c.weekday - weekdayOf(start) + 7) % 7);
    for (; date <= end; date = addDays(date, 7)) {
      const ex = exByKey.get(`${c.id}|${date}`);
      if (ex?.type === 'cancel') continue;
      const changed = ex?.type === 'change';
      sessions.push({
        date,
        weekday: c.weekday,
        start_time: (changed && ex.start_time) || c.start_time,
        end_time: (changed && ex.end_time) || c.end_time || null,
        name: c.name,
        location: (changed && ex.location) || c.location || null,
        supplies: (changed && ex.supplies) || c.supplies || null,
        memo: (changed && ex.memo) || c.memo || null,
        color: c.color || null,
        term: c.term || null,
        kind: 'class',
        source_id: c.id,
        exception_id: ex ? ex.id : null,
        changed,
      });
    }
  }

  for (const e of oneDayEvents) {
    if (e.date < from || e.date > to) continue;
    sessions.push({
      date: e.date,
      weekday: weekdayOf(e.date),
      start_time: e.start_time,
      end_time: e.end_time || null,
      name: e.name,
      location: e.location || null,
      supplies: e.supplies || null,
      memo: e.memo || null,
      color: e.color || null,
      term: null,
      kind: 'one_day',
      source_id: e.id,
      exception_id: null,
      changed: false,
    });
  }

  sessions.sort((a, b) =>
    a.date.localeCompare(b.date) ||
    a.start_time.localeCompare(b.start_time) ||
    a.name.localeCompare(b.name, 'ko'));

  for (const s of sessions) {
    s.overlap = sessions.some((o) => o !== s && overlaps(s, o));
  }
  return sessions;
}
