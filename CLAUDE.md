# CLAUDE.md

유나 스케줄러 개편(v2) 작업 규칙. 근거 문서: `docs/01_서비스_기획서.md`, `docs/02_작업지시서_0-1단계.md`

## 작업 규칙
- 지금 운영 앱(master)과 운영 DB는 건드리지 않는다. master 변경·배포 금지. 작업은 `v2` 브랜치에서.
- 단계마다: 계획 보여주기 → 진행 → 테스트·체크리스트 보고 → 커밋·push → 멈춤. 애매하면 물어보기.
- 테스트와 빌드가 성공해야만 커밋·push. `&&`로만 연결하고 `| tail` 같은 걸로 실패 코드를 가리지 않는다.
- 테스트는 실제 시계에 기대지 않는다 (날짜 고정).
- 기존 데이터를 지우거나 바꾸는 코드는 1-3의 '테스트 DB 옮기기' 외엔 넣지 않는다.
- PIN 값은 코드·로그·채팅에 남기지 않는다 (해시는 환경변수 `APP_PIN_HASH`).
- `backup/`(운영 데이터 백업)은 git에 올리지 않는다.

## 구조
- 백엔드: Node + Express 5 (`server.js`, `routes/`), DB: PostgreSQL (`DATABASE_URL`, `db.js`)
- 프론트: Vite + React 19 (`src/`), 빌드 결과 `dist/`를 Express가 정적 서빙
  - 해시 라우팅(`#/`, `#/calendar`, `#/classes`, `#/classes/:id`, `#/settings`), 화면은 `src/pages/`, 공용은 `src/components/`
  - 날짜 계산은 서버와 같은 `lib/sessions.js`를 import, 화면용 도우미는 `src/lib/time.js` (현재 시각은 인자로)
  - 스타일은 `src/styles.css` 한 곳 (가계부 v2 토스 스타일 색·간격)
- 배포: Railway, `railway.json` (NIXPACKS, `npm run build` → `node server.js`, 헬스체크 `/api/health`)
- 테스트: `npm test` (vitest), 빌드: `npm run build`
- 데이터 옮기기(1-3): `npm run migrate:preview -- backup/schedules_*.json` → 표 확인 → `npm run migrate:import -- <테스트 서버 주소> backup/migration_plan.json`
  - 이름·장소 통일 목록은 `scripts/migrate/renames.json` (사용자 확인 후 `confirmed: true`), import는 운영 주소·비어 있지 않은 DB에서 멈춘다
