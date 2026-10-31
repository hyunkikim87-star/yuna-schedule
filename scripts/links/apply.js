// 링크 목록 JSON을 v2 서버의 수업에 넣는다 (수업마다 PUT으로 link만 바꿈).
// 사용법: node scripts/links/apply.js <서버 주소> backup/links_from_sheet.json   (PIN은 화면에 보이지 않게 입력)
// 목록 형식: { items: [{ kind: 'class'|'one_day', date, start_time, name, link }] }
// - 운영 주소로는 실행하지 않는다. 짝이 애매한 항목은 건너뛰고 목록으로 알려준다.
import { readFileSync } from 'node:fs';
import { askHidden } from '../lib/prompt.js';
import { matchLinks } from './match.js';

const PRODUCTION_HOSTS = ['yuna-schedule-production.up.railway.app'];
const CLASS_FIELDS = ['name', 'weekday', 'start_time', 'end_time', 'location', 'start_date', 'end_date', 'supplies', 'memo', 'color', 'term'];
const EVENT_FIELDS = ['name', 'date', 'start_time', 'end_time', 'location', 'supplies', 'memo', 'color'];
const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k] ?? null]));

const [base, listPath] = process.argv.slice(2);
if (!base || !listPath) {
  console.error('사용법: node scripts/links/apply.js <서버 주소> backup/links_from_sheet.json');
  process.exit(1);
}
const url = new URL(base);
if (PRODUCTION_HOSTS.includes(url.hostname)) {
  console.error(`운영 주소(${url.hostname})에는 넣지 않아요. 테스트 서버 주소를 주세요.`);
  process.exit(1);
}
const { items } = JSON.parse(readFileSync(listPath, 'utf8'));

let cookie = '';
async function call(method, path, body) {
  const res = await fetch(new URL(path, url), {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status >= 400) throw new Error(`${method} ${path} → ${res.status} ${data.error || ''}`);
  return { data, res };
}

// 파이프로 PIN을 받을 때 process.exit()로 끊으면 Windows에서 stdin 정리 중 오류가 나서, 종료 코드만 정한다.
async function main() {
  const { data: status } = await call('GET', '/api/auth/status');
  if (status.auth_enabled) {
    const pin = await askHidden('테스트 서버 PIN: ');
    try {
      const { res } = await call('POST', '/api/auth/login', { pin });
      cookie = res.headers.get('set-cookie').split(';')[0];
    } catch (e) {
      console.error(`로그인 실패: ${e.message}`);
      return 1;
    }
  }

  const [{ data: classes }, { data: oneDayEvents }] = await Promise.all([
    call('GET', '/api/classes'), call('GET', '/api/one-day-events'),
  ]);
  const { matched, skipped } = matchLinks(items, { classes, oneDayEvents });

  let changed = 0;
  for (const { item, target } of matched) {
    if (target.link === item.link) {
      console.log(`  그대로  ${item.date} ${item.start_time} ${target.name}`);
      continue;
    }
    if (item.kind === 'class') {
      await call('PUT', `/api/classes/${target.id}`, { ...pick(target, CLASS_FIELDS), link: item.link });
    } else {
      await call('PUT', `/api/one-day-events/${target.id}`, { ...pick(target, EVENT_FIELDS), link: item.link });
    }
    changed++;
    console.log(`  넣음    ${item.date} ${item.start_time} ${target.name}`);
  }
  for (const { item, reason } of skipped) console.log(`  건너뜀  ${item.date} ${item.start_time} ${item.name} — ${reason}`);
  console.log(`링크: ${items.length}개 중 짝 ${matched.length}개 (새로 넣음 ${changed}), 건너뜀 ${skipped.length}개`);
  return skipped.length ? 2 : 0;
}

process.exitCode = await main();
