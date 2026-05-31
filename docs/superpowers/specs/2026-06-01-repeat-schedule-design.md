# 반복 스케줄 등록 + SAT/SUN 날짜 표시 설계

## 개요

두 가지 기능을 추가한다:
1. SAT/SUN 컬럼 헤더에 실제 날짜 표시 (예: `6/14(토)`)
2. SAT/SUN 수업을 N회 연속 주차에 자동 등록

## 변경 범위

### 1. `src/holidays.js`
- `getNthSaturday` 함수를 `export` 추가

### 2. `src/App.jsx`
- `getNthSaturday`를 import해서 `satDate`, `sunDate` 계산
- `WeekView`에 `satDate`, `sunDate` props 전달
- `advanceWeek(y, m, w)` 헬퍼 추가: 현재 주차에서 다음 주차로 이동
- `handleSave`에서 `repeatCount`만큼 루프로 POST 반복, 매 반복마다 `advanceWeek` 호출

```js
function advanceWeek(y, m, w) {
  const wc = getWeekCount(y, m);
  if (w < wc) return { year: y, month: m, week: w + 1 };
  if (m === 12) return { year: y + 1, month: 1, week: 1 };
  return { year: y, month: m + 1, week: 1 };
}
```

### 3. `src/components/WeekView.jsx`
- `satDate`, `sunDate` props 추가 (Date | null)
- SAT/SUN 컬럼의 label을 `'6/14(토)'` 형식으로 포맷
- holidays 컬럼은 기존 방식 유지

### 4. `src/components/EventModal.jsx`
- `repeatCount` state 추가 (기본값 1)
- `form.day === 'SAT' || form.day === 'SUN'` 일 때만 **등록 횟수** 입력 표시
- 입력: number, min=1, max=52
- `onSave` 호출 시 `repeatCount` 포함 (holidays 선택 시 항상 1로 강제)

## 데이터 흐름

```
EventModal
  └─ onSave({ ...form, repeatCount })
       └─ App.handleSave(data)
            ├─ repeatCount = data.day이 SAT/SUN이면 data.repeatCount, 아니면 1
            └─ for i in 0..repeatCount-1:
                 POST /api/schedules { ...scheduleData, year, month, week }
                 advanceWeek(year, month, week)
```

## 제약 및 결정 사항

- **반복 간격**: 매주 고정 (1주 간격)
- **반복 대상**: SAT/SUN 전용 (공휴일 컬럼은 날짜가 고정이므로 반복 불가)
- **서버 변경 없음**: 기존 POST 엔드포인트 N회 호출
- **실패 처리**: 중간 실패 시 일부 저장될 수 있으나 가족 앱 규모에서 허용
- **최대 횟수**: 52회 (1년치)
