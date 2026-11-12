// 예전 앱(v1, 주차 기반)을 PC에서 다시 띄운다. 영상 녹화·비교 자료용. 운영·테스트 서버와 상관없다.
// 사용법: npm run archive:v1 [-- 백업.json] [--port 3200]
// - 예전 코드: git 태그 v1-final을 옆 폴더(../yuna-schedule-v1)에 꺼낸다 (처음 한 번 설치·빌드)
// - 데이터: 백업 JSON(예전 /api/schedules 형식)을 메모리 DB에 넣는다. 끄면 사라진다 (원본 파일은 그대로).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { register } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const v1Dir = resolve(repo, '../yuna-schedule-v1');
const args = process.argv.slice(2);
const portIdx = args.indexOf('--port');
const port = portIdx >= 0 ? args[portIdx + 1] : '3200';
const backupArg = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--port');
const backupPath = resolve(repo, backupArg || 'backup/schedules_2026-10-31_golive.json');

if (!existsSync(backupPath)) {
  console.error(`백업 파일이 없어요: ${backupPath}`);
  console.error('문서 폴더 2026-11_유나 스케줄러 개편\\backup\\ 의 JSON 경로를 넘겨 주세요.');
  process.exit(1);
}

const run = (cmd, cmdArgs, cwd) => execFileSync(cmd, cmdArgs, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
if (!existsSync(v1Dir)) {
  console.log('예전 코드(v1-final)를 꺼내는 중…');
  run('git', ['worktree', 'add', '--detach', v1Dir, 'v1-final'], repo);
}
if (!existsSync(join(v1Dir, 'node_modules'))) run('npm', ['ci', '--no-audit', '--no-fund'], v1Dir);
if (!existsSync(join(v1Dir, 'dist'))) run('npm', ['run', 'build'], v1Dir);

register('./hooks.mjs', import.meta.url);
process.env.PORT = port;
process.env.NODE_ENV = 'development';
await import(pathToFileURL(join(v1Dir, 'server.js')).href);

// 서버가 테이블을 만든 뒤 백업을 넣는다
const { pool } = await import('./pg-shim.mjs');
await new Promise((r) => setTimeout(r, 500));
// id는 DB가 새로 매기게 둔다 (원래 순서대로 넣어서 화면 순서는 같고, 화면에서 새로 등록해도 번호가 안 겹친다)
const rows = JSON.parse(readFileSync(backupPath, 'utf8')).schedules.sort((a, b) => a.id - b.id);
for (const r of rows) {
  await pool.query(
    `INSERT INTO schedules (year, month, week, day, class_name, location, memo, supplies, start_time, end_time)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [r.year, r.month, r.week, r.day, r.class_name, r.location, r.memo, r.supplies, r.start_time, r.end_time]
  );
}
console.log(`예전 앱(v1): http://localhost:${port}  (백업 ${rows.length}건, 끄려면 Ctrl+C)`);
