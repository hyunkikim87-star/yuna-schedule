// preview.js가 만든 migration_plan.json을 v2 서버의 API로 넣고, 넣은 뒤 회차를 다시 읽어 원본과 대조한다.
// 사용법: node scripts/migrate/import.js <서버 주소> backup/migration_plan.json   (PIN은 화면에 보이지 않게 입력)
// - 운영 주소로는 실행하지 않는다. 대상에 이미 수업이 있으면 멈춘다 (덮어쓰지 않음).
// - DB에 직접 접근하지 않고, 예전 schedules 테이블은 읽지도 바꾸지도 않는다.
import { readFileSync } from 'node:fs';
import { addDays } from '../../lib/sessions.js';
import { askHidden } from '../lib/prompt.js';

const PRODUCTION_HOSTS = ['yuna-schedule-production.up.railway.app'];
const MAX_RANGE_DAYS = 400;
const CLASS_FIELDS = ['name', 'weekday', 'start_time', 'end_time', 'location', 'start_date', 'end_date', 'supplies', 'memo', 'term'];
const EVENT_FIELDS = ['name', 'date', 'start_time', 'end_time', 'location', 'supplies', 'memo'];
const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k] ?? null]));

const [base, planPath] = process.argv.slice(2);
if (!base || !planPath) {
  console.error('사용법: node scripts/migrate/import.js <서버 주소> backup/migration_plan.json');
  process.exit(1);
}
const url = new URL(base);
if (PRODUCTION_HOSTS.includes(url.hostname)) {
  console.error(`운영 주소(${url.hostname})에는 넣지 않아요. 테스트 서버 주소를 주세요.`);
  process.exit(1);
}
const plan = JSON.parse(readFileSync(planPath, 'utf8'));
if (!plan.renames_confirmed) {
  console.error('이름·장소 통일이 확인되지 않았어요 (scripts/migrate/renames.json의 confirmed). preview.js를 다시 돌려주세요.');
  process.exit(1);
}

let cookie = '';
async function call(method, path, body) {
  const res = await fetch(new URL(path, url), {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, res };
}
async function must(method, path, body) {
  const r = await call(method, path, body);
  if (r.status >= 400) throw new Error(`${method} ${path} → ${r.status} ${r.data.error || ''}`);
  return r.data;
}

// 파이프로 PIN을 받을 때 process.exit()로 끊으면 Windows에서 stdin 정리 중 오류가 나서, 종료 코드만 정한다.
async function main() {
  // 1) 로그인
  const status = await must('GET', '/api/auth/status');
  if (status.auth_enabled) {
    const pin = await askHidden('테스트 서버 PIN: ');
    const r = await call('POST', '/api/auth/login', { pin });
    if (r.status !== 200) {
      console.error(`로그인 실패: ${r.data.error || r.status}`);
      return 1;
    }
    cookie = r.res.headers.get('set-cookie').split(';')[0];
  }

  // 2) 비어 있는지 확인
  const [existingClasses, existingEvents] = await Promise.all([must('GET', '/api/classes'), must('GET', '/api/one-day-events')]);
  if (existingClasses.length || existingEvents.length) {
    console.error(`대상 서버에 이미 정규 ${existingClasses.length}개, 원데이 ${existingEvents.length}개가 있어요. 빈 DB에만 넣어요.`);
    return 1;
  }

  // 3) 넣기
  let placeCount = 0;
  for (const p of plan.places) {
    const r = await call('POST', '/api/places', p);
    if (r.status === 201) placeCount++;
    else if (r.status !== 409) throw new Error(`장소 '${p.name}' → ${r.status} ${r.data.error || ''}`);
  }
  let exceptionCount = 0;
  for (const c of plan.classes) {
    const created = await must('POST', '/api/classes', pick(c, CLASS_FIELDS));
    for (const e of c.exceptions) {
      await must('POST', `/api/classes/${created.id}/exceptions`, e);
      exceptionCount++;
    }
  }
  for (const e of plan.one_day_events) {
    await must('POST', '/api/one-day-events', pick(e, EVENT_FIELDS));
  }
  console.log(`넣음: 장소 ${placeCount}, 정규 수업 ${plan.classes.length} (예외 ${exceptionCount}), 원데이 ${plan.one_day_events.length}`);

  // 4) 대조: 서버가 계산한 회차 = 원본(합친 뒤)
  const expected = plan.expected_sessions;
  const from = expected[0].date;
  const to = expected.at(-1).date;
  const got = [];
  for (let start = from; start <= to; start = addDays(start, MAX_RANGE_DAYS + 1)) {
    const end = addDays(start, MAX_RANGE_DAYS) < to ? addDays(start, MAX_RANGE_DAYS) : to;
    got.push(...await must('GET', `/api/sessions?from=${start}&to=${end}`));
  }
  const key = (s) => `${s.date}|${s.name}|${s.start_time}`;
  const want = new Set(expected.map(key));
  const have = new Set(got.map(key));
  const missing = [...want].filter((k) => !have.has(k));
  const extra = [...have].filter((k) => !want.has(k));
  console.log(`대조: 원본 ${want.size}개 / 서버 ${have.size}개`);
  for (const k of missing) console.log(`  빠짐: ${k}`);
  for (const k of extra) console.log(`  더 생김: ${k}`);
  if (missing.length || extra.length) return 2;
  console.log('차이 없음');
  return 0;
}

process.exitCode = await main();
