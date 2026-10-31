// 예전 schedules(주차 기반) 백업 → v2 구조(정규 수업 + 예외 + 원데이 + 장소) 변환. DB에 접근하지 않는 순수 함수.
// 기획서 4장 '옮기기 규칙': 주차→날짜, 중복 합치기, 매주 이어지면 정규 수업, 빠진 주는 휴강, 한 번뿐이면 원데이.
import { addDays, computeSessions, daysBetween, weekdayOf } from '../../lib/sessions.js';

// 정규 수업으로 묶을 때 회차 사이 최대 간격(주). 이보다 멀면 다른 묶음.
export const MAX_GAP_WEEKS = 3;
const SESSION_NO_RE = /\s*\d+\s*\/\s*\d+\s*회\s*(·\s*)?/; // '1/12회 · ' 같은 회차 번호

function pad(n) {
  return String(n).padStart(2, '0');
}

// 예전 화면과 같은 규칙: week = 그 달의 N번째 토요일, SUN = 그 다음 날. day에 날짜가 직접 들어간 기록은 그대로.
export function rowDate(r) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(r.day)) return r.day;
  let count = 0;
  for (let d = `${r.year}-${pad(r.month)}-01`; Number(d.slice(5, 7)) === r.month; d = addDays(d, 1)) {
    if (weekdayOf(d) === 6 && ++count === r.week) return r.day === 'SUN' ? addDays(d, 1) : d;
  }
  throw new Error(`id ${r.id}: ${r.year}-${r.month} ${r.week}주차 토요일이 없어요`);
}

const clean = (s) => (s == null ? null : String(s).trim() || null);
const splitList = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);

function mode(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  let best = null;
  let bestN = -1;
  for (const [v, n] of counts) if (n > bestN) { best = v; bestN = n; }
  return best;
}

// 이름·장소 통일 후보: 띄어쓰기·대소문자·'웁/업'만 다른 표기 + 직접 지정한 의심 목록
export function renameCandidates(rows) {
  const norm = (s) => s.replace(/\s+/g, '').replace(/웁/g, '업').toLowerCase();
  const collect = (field) => {
    const byNorm = new Map();
    for (const r of rows) {
      const v = clean(r[field]);
      if (!v) continue;
      const k = norm(v);
      if (!byNorm.has(k)) byNorm.set(k, new Map());
      const m = byNorm.get(k);
      m.set(v, (m.get(v) || 0) + 1);
    }
    const out = [];
    for (const m of byNorm.values()) {
      if (m.size < 2) continue;
      const [to] = [...m].sort((a, b) => b[1] - a[1])[0];
      for (const [from, n] of m) if (from !== to) out.push({ from, to, count: n, toCount: m.get(to) });
    }
    return out;
  };
  return { names: collect('class_name'), places: collect('location') };
}

// 1) 날짜 붙이기 + 이름·장소 통일 적용 + 같은 (날짜, 수업명, 시작시간) 합치기
export function dedupe(rows, renames = { names: {}, places: {} }) {
  const merged = new Map();
  const duplicates = [];
  for (const r of [...rows].sort((a, b) => a.id - b.id)) {
    const name = renames.names?.[clean(r.class_name)] ?? clean(r.class_name);
    const location = renames.places?.[clean(r.location)] ?? clean(r.location);
    const item = {
      date: rowDate(r), name, start_time: r.start_time, end_time: clean(r.end_time),
      location, supplies: clean(r.supplies), memo: clean(r.memo), ids: [r.id],
    };
    const key = `${item.date}|${item.name}|${item.start_time}`;
    const prev = merged.get(key);
    if (!prev) { merged.set(key, item); continue; }
    duplicates.push({ key, keep: prev.ids[0], drop: r.id });
    prev.ids.push(r.id);
    prev.end_time = prev.end_time || item.end_time;
    prev.location = prev.location || item.location;
    prev.supplies = [...new Set([...splitList(prev.supplies), ...splitList(item.supplies)])].join(', ') || null;
    prev.memo = [...new Set([prev.memo, item.memo].filter(Boolean))].join(' / ') || null;
  }
  const sessions = [...merged.values()].sort((a, b) =>
    a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time) || a.name.localeCompare(b.name));
  return { sessions, duplicates };
}

// 2) 같은 이름·요일로 MAX_GAP_WEEKS 안에서 이어지는 회차 2개 이상 → 정규 수업
export function buildPlan(sessions) {
  const groups = new Map();
  for (const s of sessions) {
    const k = `${s.name}|${weekdayOf(s.date)}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(s);
  }

  const classes = [];
  const oneDay = [];
  for (const list of groups.values()) {
    // 같은 날 같은 이름이 둘 이상이면 가장 흔한 시작시간만 정규 후보, 나머지는 원데이
    const modalStart = mode(list.map((s) => s.start_time));
    const byDate = new Map();
    for (const s of list) {
      const cur = byDate.get(s.date);
      if (!cur || (cur.start_time !== modalStart && s.start_time === modalStart)) {
        if (cur) oneDay.push(cur);
        byDate.set(s.date, s);
      } else {
        oneDay.push(s);
      }
    }
    const dated = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    let run = [];
    const flush = () => {
      if (run.length >= 2) classes.push(makeClass(run));
      else oneDay.push(...run);
      run = [];
    };
    for (const s of dated) {
      if (run.length && daysBetween(run.at(-1).date, s.date) > 7 * MAX_GAP_WEEKS) flush();
      run.push(s);
    }
    flush();
  }

  classes.sort((a, b) => a.start_date.localeCompare(b.start_date) || a.name.localeCompare(b.name));
  oneDay.sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
  classes.forEach((c, i) => { c.key = `c${i + 1}`; });

  const places = [...new Set(sessions.map((s) => s.location).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
  return {
    classes,
    one_day_events: oneDay.map((s) => ({
      name: s.name, date: s.date, start_time: s.start_time, end_time: s.end_time,
      location: s.location, supplies: s.supplies, memo: s.memo, source_ids: s.ids,
    })),
    places: places.map((name) => ({ name })),
  };
}

function termOf(date) {
  const m = Number(date.slice(5, 7));
  if (m >= 3 && m <= 5) return '봄학기';
  if (m >= 6 && m <= 8) return '여름학기';
  if (m >= 9 && m <= 11) return '가을학기';
  return '겨울학기';
}

function makeClass(run) {
  const start_time = mode(run.map((s) => s.start_time));
  const end_time = mode(run.map((s) => s.end_time));
  const location = mode(run.map((s) => s.location));
  const supplies = mode(run.map((s) => s.supplies));
  const memos = run.map((s) => (s.memo ? s.memo.replace(SESSION_NO_RE, '').trim() || null : null));
  const memo = mode(memos.filter(Boolean)) || null;
  const first = run[0].date;
  const last = run.at(-1).date;
  const exceptions = [];
  const notes = [];

  const present = new Map(run.map((s, i) => [s.date, i]));
  for (let d = first; d <= last; d = addDays(d, 7)) {
    if (!present.has(d)) { exceptions.push({ date: d, type: 'cancel' }); continue; }
    const i = present.get(d);
    const s = run[i];
    const change = {};
    if (s.start_time !== start_time) change.start_time = s.start_time;
    if (s.end_time !== end_time && s.end_time) change.end_time = s.end_time;
    if (s.location !== location && s.location) change.location = s.location;
    if (memos[i] && memos[i] !== memo) change.memo = memos[i];
    if (s.supplies && s.supplies !== supplies) change.supplies = s.supplies;
    if (Object.keys(change).length) {
      // 시작만 바뀌고 끝은 그대로면 끝도 같이 적어 둔다 (끝 < 시작 방지)
      if (change.start_time && !change.end_time && s.end_time) change.end_time = s.end_time;
      exceptions.push({ date: d, type: 'change', ...change });
    }
    // 예외로는 '준비물 없음'을 표현할 수 없어서, 그 회차에는 수업 준비물이 보인다
    if (!s.supplies && supplies) notes.push(`${d}: 원본엔 준비물이 없는데 '${supplies}'로 보여요`);
  }

  return {
    name: run[0].name, weekday: weekdayOf(first), start_time, end_time, location,
    // 한 학기(약 4개월)보다 길게 이어지는 수업(와이즈미술학원 등)은 학기를 붙이지 않는다
    start_date: first, end_date: last, supplies, memo, term: daysBetween(first, last) <= 7 * 16 ? termOf(first) : null,
    exceptions, notes, count: run.length, source_ids: run.flatMap((s) => s.ids),
  };
}

// 3) 검증: 변환 결과로 회차를 다시 계산해서 원본(합친 뒤)과 날짜·수업명·시간·장소가 같은지
export function verify(plan, sessions) {
  const from = sessions[0]?.date;
  const to = sessions.at(-1)?.date;
  if (!from) return { ok: true, missing: [], extra: [], fieldDiffs: [] };
  const classes = plan.classes.map((c, i) => ({ ...c, id: i + 1 }));
  const exceptions = classes.flatMap((c) => c.exceptions.map((e, j) => ({ ...e, id: j + 1, class_id: c.id })));
  const oneDayEvents = plan.one_day_events.map((e, i) => ({ ...e, id: i + 1 }));
  const rebuilt = computeSessions({ classes, exceptions, oneDayEvents, from, to });

  const key = (s) => `${s.date}|${s.name}|${s.start_time}`;
  const want = new Map(sessions.map((s) => [key(s), s]));
  const got = new Map(rebuilt.map((s) => [key(s), s]));
  const missing = [...want.keys()].filter((k) => !got.has(k));
  const extra = [...got.keys()].filter((k) => !want.has(k));
  const fieldDiffs = [];
  for (const [k, w] of want) {
    const g = got.get(k);
    if (!g) continue;
    if ((w.end_time || null) !== (g.end_time || null)) fieldDiffs.push(`${k}: 끝 시간 ${w.end_time} → ${g.end_time}`);
    if ((w.location || null) !== (g.location || null)) fieldDiffs.push(`${k}: 장소 ${w.location} → ${g.location}`);
    for (const item of splitList(w.supplies)) {
      if (!splitList(g.supplies).includes(item)) fieldDiffs.push(`${k}: 준비물 '${item}' 빠짐`);
    }
    const wm = w.memo ? w.memo.replace(SESSION_NO_RE, '').trim() : '';
    if (wm && !(g.memo || '').includes(wm)) fieldDiffs.push(`${k}: 메모 '${wm}' 빠짐`);
  }
  return { ok: !missing.length && !extra.length && !fieldDiffs.length, missing, extra, fieldDiffs, rebuiltCount: rebuilt.length };
}
