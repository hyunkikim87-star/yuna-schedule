# CLAUDE.md

유나 스케줄러 (v2, 2026-10-31 운영 전환). 근거 문서: `docs/01_서비스_기획서.md`, `docs/02_작업지시서_0-1단계.md`

## 작업 규칙
- master = 운영. master에 병합하면 Railway(`faithful-wonder` 프로젝트 `yuna-schedule` 서비스)가 바로 운영 주소에 배포한다.
  작업은 브랜치에서 → 테스트 서버에서 확인 → PR → 사용자 확인 후 병합.
- 테스트 서버: Railway `yuna-schedule-v2-test` 프로젝트 `web` 서비스 (GitHub 연결 없음, `railway up --service web`으로 올림). 운영과 DB가 따로다.
- 단계마다: 계획 보여주기 → 진행 → 테스트·체크리스트 보고 → 커밋·push → 멈춤. 애매하면 물어보기.
- 테스트와 빌드가 성공해야만 커밋·push. `&&`로만 연결하고 `| tail` 같은 걸로 실패 코드를 가리지 않는다.
- 테스트는 실제 시계에 기대지 않는다 (날짜 고정).
- 운영 데이터를 지우거나 바꾸는 코드·명령은 사용자 확인 없이 넣거나 실행하지 않는다.
- 예전 `schedules` 테이블과 `/api/schedules`는 되돌리기용으로 남겨 둠. 2026-11 중순 이후 사용자 확인 받고 정리.
- PIN 값은 코드·로그·채팅에 남기지 않는다 (해시는 환경변수 `APP_PIN_HASH`).
- `backup/`(운영 데이터 백업)은 git에 올리지 않는다.

## 구조
- 백엔드: Node + Express 5 (`server.js`, `routes/`), DB: PostgreSQL (`DATABASE_URL`, `db.js`)
- 프론트: Vite + React 19 (`src/`), 빌드 결과 `dist/`를 Express가 정적 서빙
  - 해시 라우팅(`#/`, `#/calendar`, `#/classes`, `#/classes/:id`, `#/one-day/:id`, `#/settings`), 화면은 `src/pages/`, 공용은 `src/components/`
  - 날짜 계산은 서버와 같은 `lib/sessions.js`를 import, 화면용 도우미는 `src/lib/time.js` (현재 시각은 인자로)
  - 스타일은 `src/styles.css` 한 곳 (가계부 v2 토스 스타일 색·간격)
- 배포: Railway, `railway.json` (NIXPACKS, `npm run build` → `node server.js`, 헬스체크 `/api/health`). Node 22 이상.
- 테스트: `npm test` (vitest), 빌드: `npm run build`
- PIN을 잊었을 때: Railway 서비스에 `APP_PIN_RESET=true`를 넣고 재시작 → 앱에서 바꾼 PIN(DB)이 지워지고 `APP_PIN_HASH` PIN으로 돌아감 → 그 변수는 바로 삭제
- 데이터 옮기기(전환 때 1회, 완료): `npm run migrate:preview -- backup/schedules_*.json` → 표 확인 → `npm run migrate:import -- <주소> backup/migration_plan.json [--production]`
  - 이름·장소 통일 목록은 `scripts/migrate/renames.json`, import는 비어 있지 않은 DB에서 멈춘다
- 구매 링크 일괄 넣기: `node scripts/links/apply.js <주소> backup/links_*.json [--production]` (날짜·시간·이름으로 짝, 애매하면 건너뜀)
