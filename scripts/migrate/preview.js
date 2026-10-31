// 백업 → v2 변환 결과를 표로 만든다. DB·API에 접근하지 않는다.
// 사용법: node scripts/migrate/preview.js backup/schedules_YYYY-MM-DD.json
// 결과: backup/migration_plan.json (import.js 입력), backup/migration_preview.md (확인용 표)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPlan, dedupe, renameCandidates, verify } from './plan.js';

const here = dirname(fileURLToPath(import.meta.url));
const backupPath = process.argv[2];
if (!backupPath) {
  console.error('사용법: node scripts/migrate/preview.js backup/schedules_YYYY-MM-DD.json');
  process.exit(1);
}
const outDir = dirname(backupPath);
const renamesPath = join(here, 'renames.json');
const renames = JSON.parse(readFileSync(renamesPath, 'utf8'));
const backup = JSON.parse(readFileSync(backupPath, 'utf8'));
const rows = backup.schedules;

const { sessions, duplicates } = dedupe(rows, renames);
const plan = buildPlan(sessions);
const check = verify(plan, sessions);
const candidates = renameCandidates(rows);

const WD = ['일', '월', '화', '수', '목', '금', '토'];
const md = (s) => String(s ?? '').replace(/\|/g, '\\|');
const time = (x) => `${x.start_time}${x.end_time ? `–${x.end_time}` : ''}`;
const lines = [];
const out = (s = '') => lines.push(s);

out(`# 데이터 옮기기 미리보기 (${backupPath})`);
out();
out(`- 이름·장소 통일: ${renames.confirmed ? '**확인됨**' : '**확인 전 (제안 적용)**'} — scripts/migrate/renames.json`);
out(`- 원본 ${rows.length}건 → 중복 ${duplicates.length}건 합침 → **회차 ${sessions.length}개**`);
out(`- 정규 수업 ${plan.classes.length}개 (회차 ${plan.classes.reduce((n, c) => n + c.count, 0)}) · 원데이 ${plan.one_day_events.length}개 · 장소 ${plan.places.length}곳`);
out(`- 검증 (변환 결과로 다시 계산한 회차 = 원본): ${check.ok ? '**일치**' : '**차이 있음**'} (${check.rebuiltCount}개)`);
for (const k of check.missing) out(`  - 빠짐: ${k}`);
for (const k of check.extra) out(`  - 더 생김: ${k}`);
for (const k of check.fieldDiffs) out(`  - 값 다름: ${k}`);
out();

out('## 1. 이름·장소 통일');
out();
out('| 종류 | 원래 표기 | → 바꿀 표기 | 건수 |');
out('|---|---|---|---|');
for (const [from, to] of Object.entries(renames.names || {})) out(`| 수업명 | ${md(from)} | ${md(to)} | ${rows.filter((r) => r.class_name?.trim() === from).length} |`);
for (const [from, to] of Object.entries(renames.places || {})) out(`| 장소 | ${md(from)} | ${md(to)} | ${rows.filter((r) => r.location?.trim() === from).length} |`);
// 목록을 적용한 뒤에도 두 표기가 따로 남는 후보만
const pending = [...candidates.names.map((c) => ['수업명', c]), ...candidates.places.map((c) => ['장소', c])]
  .filter(([kind, c]) => {
    const map = (kind === '수업명' ? renames.names : renames.places) || {};
    return (map[c.from] ?? c.from) !== (map[c.to] ?? c.to);
  });
if (pending.length) {
  out();
  out('자동으로 찾았지만 아직 목록에 없는 후보:');
  for (const [kind, c] of pending) out(`- ${kind}: '${c.from}'(${c.count}) → '${c.to}'(${c.toCount})`);
}
out();

out('## 2. 정규 수업');
out();
out('| # | 수업명 | 요일·시간 | 장소 | 기간 | 회차 | 휴강일 | 이 날만 변경 | 준비물 | 메모 |');
out('|---|---|---|---|---|---|---|---|---|---|');
plan.classes.forEach((c, i) => {
  const cancels = c.exceptions.filter((e) => e.type === 'cancel').map((e) => e.date.slice(5)).join(', ');
  const changes = c.exceptions.filter((e) => e.type === 'change')
    .map((e) => `${e.date.slice(5)} ${[
      e.start_time && `${e.start_time}${e.end_time ? `–${e.end_time}` : ''}`, e.location,
      e.supplies && `준비물 ${e.supplies}`, e.memo && `메모 ${e.memo}`,
    ].filter(Boolean).join(' ')}`).join('; ');
  out(`| ${i + 1} | ${md(c.name)} | ${WD[c.weekday]} ${time(c)} | ${md(c.location)} | ${c.start_date} ~ ${c.end_date} | ${c.count} | ${cancels || '-'} | ${md(changes) || '-'} | ${md(c.supplies) || '-'} | ${md(c.memo) || '-'} |`);
});
const notes = plan.classes.flatMap((c) => c.notes.map((n) => `${c.name} ${n}`));
if (notes.length) {
  out();
  out('주의 (정규 수업은 준비물을 하나만 가져서, 회차마다 다른 준비물은 대표값으로 보여요):');
  for (const n of notes) out(`- ${md(n)}`);
}
out();

out('## 3. 원데이 수업');
out();
out('| 날짜 | 시간 | 수업명 | 장소 | 준비물 | 메모 |');
out('|---|---|---|---|---|---|');
for (const e of plan.one_day_events) {
  out(`| ${e.date} (${WD[new Date(`${e.date}T00:00:00Z`).getUTCDay()]}) | ${time(e)} | ${md(e.name)} | ${md(e.location) || '-'} | ${md(e.supplies) || '-'} | ${md(e.memo) || '-'} |`);
}
out();

out('## 4. 합친 중복');
out();
out('| 날짜 | 수업명 | 시작 | 합친 원본 id |');
out('|---|---|---|---|');
for (const s of sessions.filter((x) => x.ids.length > 1)) out(`| ${s.date} | ${md(s.name)} | ${s.start_time} | ${s.ids.join(', ')} |`);
out();

out('## 5. 장소 목록');
out();
out(plan.places.map((p) => p.name).join(' · '));

writeFileSync(join(outDir, 'migration_preview.md'), `${lines.join('\n')}\n`);
writeFileSync(join(outDir, 'migration_plan.json'), JSON.stringify({
  created_at: new Date().toISOString(), backup: backupPath, renames_confirmed: Boolean(renames.confirmed),
  expected_sessions: sessions.map((s) => ({ date: s.date, name: s.name, start_time: s.start_time })),
  ...plan,
}, null, 2));

console.log(lines.slice(0, 8).join('\n'));
console.log(`\n표 전체: ${join(outDir, 'migration_preview.md')}`);
if (!check.ok) process.exit(2);
