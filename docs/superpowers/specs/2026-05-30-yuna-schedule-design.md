# Yuna Schedule — Design Spec

## Overview

필립과 워니가 유나의 주말(토/일) 수업 일정을 함께 추가·수정·조회하는 가족 공유 웹앱.
URL을 아는 사람이면 누구나 편집 가능. 비밀번호 없음.

---

## Tech Stack

- **Frontend**: React + Vite (SPA)
- **Backend**: Express.js (REST API + 정적 파일 서빙)
- **DB**: PostgreSQL (Railway 플러그인, `pg` 라이브러리)
- **Deployment**: Railway (GitHub push → 자동 재배포)

---

## Data Model

```sql
CREATE TABLE schedules (
  id         SERIAL PRIMARY KEY,
  year       INTEGER      NOT NULL,
  month      INTEGER      NOT NULL,
  week       INTEGER      NOT NULL,  -- 해당 월의 n번째 주 (1~5)
  day        VARCHAR(3)   NOT NULL,  -- 'SAT' | 'SUN'
  class_name VARCHAR(100) NOT NULL,
  location   VARCHAR(100),
  memo       TEXT,
  supplies   TEXT
);
```

주차 기준: "2026년 6월 2주차 토요일" → `year=2026, month=6, week=2, day='SAT'`

**주차 계산 규칙**: 해당 월의 n번째 토요일 = n주차. 예) 6월 첫 번째 토요일 = 1주차, 두 번째 토요일 = 2주차. 일요일도 동일 규칙 적용. 프론트엔드에서 해당 월의 모든 토/일 날짜를 계산해 드롭다운 옵션을 동적으로 생성.

---

## API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/schedules?year=&month=&week=` | 해당 주차 일정 조회 |
| POST | `/api/schedules` | 수업 추가 |
| PUT | `/api/schedules/:id` | 수업 수정 |
| DELETE | `/api/schedules/:id` | 수업 삭제 |
| GET | `/` | 헬스체크 (`{ ok: true }`) |

---

## UI

### 상단 컨트롤
- 월 드롭다운 (1~12월) + 주차 드롭다운 (1~5주)
- 기본값: 현재 월/주차 자동 선택

### 메인 레이아웃
- **토요일 / 일요일 2컬럼** 나란히
- 각 컬럼 하단에 `+ 수업 추가` 버튼
- 수업 카드: 수업명, 장소, 준비물 요약 표시

### 팝업 (추가 / 수정 공통)
- 입력 필드: 수업명, 장소, 메모, 준비물
- 버튼: 저장 / 취소
- 수정 시: 삭제 버튼 추가 노출

### 데이터 흐름
- 주차 변경 → API 조회 → 화면 즉시 갱신
- 저장/삭제 → API 호출 → 팝업 닫기 → 목록 재조회
- 다른 기기에서 새로고침하면 최신 데이터 반영
