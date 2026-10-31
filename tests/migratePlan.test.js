import { describe, it, expect } from 'vitest';
import { buildPlan, dedupe, renameCandidates, rowDate, verify } from '../scripts/migrate/plan.js';

// 가짜 백업 행. week = 그 달 N번째 토요일. 2026년 10월 토요일: 3, 10, 17, 24, 31
let nextId = 1;
const row = (o) => ({
  id: nextId++, year: 2026, month: 10, week: 1, day: 'SAT', class_name: '미술', location: '파크뷰 상가',
  supplies: null, memo: null, start_time: '10:00', end_time: '11:20', ...o,
});

describe('rowDate', () => {
  it('주차·요일 → 실제 날짜 (달 경계 포함)', () => {
    expect(rowDate(row({ week: 1 }))).toBe('2026-10-03');
    expect(rowDate(row({ week: 5, day: 'SUN' }))).toBe('2026-11-01');
    expect(rowDate(row({ month: 11, week: 1 }))).toBe('2026-11-07');
  });

  it('day에 날짜가 들어간 기록은 그 날짜 그대로', () => {
    expect(rowDate(row({ month: 7, week: 3, day: '2026-07-17' }))).toBe('2026-07-17');
  });

  it('없는 주차는 오류', () => {
    expect(() => rowDate(row({ week: 6 }))).toThrow();
  });
});

describe('dedupe', () => {
  it('같은 날짜·수업명·시작시간은 하나로, 준비물·메모는 합쳐서 보존', () => {
    const { sessions, duplicates } = dedupe([
      row({ supplies: '앞치마', memo: '첫 날' }),
      row({ supplies: '앞치마, 물통', memo: '주차 B2' }),
      row({ start_time: '13:00', end_time: '14:00' }),
    ]);
    expect(sessions).toHaveLength(2);
    expect(duplicates).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ supplies: '앞치마, 물통', memo: '첫 날 / 주차 B2' });
    expect(sessions[0].ids).toHaveLength(2);
  });

  it('끝 시간이 빈 기록과 합치면 있는 쪽을 쓴다', () => {
    const { sessions } = dedupe([row({ end_time: null }), row({ end_time: '11:00' })]);
    expect(sessions[0].end_time).toBe('11:00');
  });

  it('확인받은 이름·장소 통일을 먼저 적용하고 합친다', () => {
    const { sessions } = dedupe(
      [row({ class_name: '와이즈 미술학원', location: '위례스타필드' }), row({ class_name: '와이즈미술학원' })],
      { names: { '와이즈 미술학원': '와이즈미술학원' }, places: { 위례스타필드: '파크뷰 상가' } }
    );
    expect(sessions).toHaveLength(1);
    expect(sessions[0].name).toBe('와이즈미술학원');
  });
});

describe('renameCandidates', () => {
  it('띄어쓰기·웁/업만 다른 이름을 많이 쓴 표기로 제안', () => {
    const c = renameCandidates([
      row({ class_name: '자신감 웁 팡팡' }), row({ class_name: '자신감 웁 팡팡' }), row({ class_name: '자신감 업 팡팡' }),
      row({ location: 'ak플라자 분당' }), row({ location: 'AK플라자 분당' }), row({ location: 'AK플라자 분당' }),
    ]);
    expect(c.names).toEqual([{ from: '자신감 업 팡팡', to: '자신감 웁 팡팡', count: 1, toCount: 2 }]);
    expect(c.places).toEqual([{ from: 'ak플라자 분당', to: 'AK플라자 분당', count: 1, toCount: 2 }]);
  });
});

describe('buildPlan', () => {
  const weekly = (weeks, extra = {}) => weeks.map(([month, week]) => row({ month, week, ...extra }));

  it('매주 이어지는 수업 → 정규 수업 1개, 빠진 주는 휴강', () => {
    const { sessions } = dedupe(weekly([[10, 1], [10, 2], [10, 4], [10, 5]]));
    const plan = buildPlan(sessions);
    expect(plan.classes).toHaveLength(1);
    expect(plan.classes[0]).toMatchObject({
      name: '미술', weekday: 6, start_time: '10:00', end_time: '11:20',
      start_date: '2026-10-03', end_date: '2026-10-31', count: 4, term: '가을학기',
    });
    expect(plan.classes[0].exceptions).toEqual([{ date: '2026-10-17', type: 'cancel' }]);
    expect(plan.one_day_events).toEqual([]);
    expect(plan.places).toEqual([{ name: '파크뷰 상가' }]);
  });

  it('한 학기보다 길게 이어지면 학기를 붙이지 않는다', () => {
    const weeks = [];
    for (let m = 6; m <= 12; m++) for (let w = 1; w <= 4; w++) weeks.push([m, w]);
    const plan = buildPlan(dedupe(weekly(weeks)).sessions);
    expect(plan.classes).toHaveLength(1);
    expect(plan.classes[0].term).toBeNull();
  });

  it('한 주만 시간이 다르면 이 날만 변경', () => {
    const rows = weekly([[10, 1], [10, 2], [10, 3]]);
    rows[1].start_time = '13:00';
    rows[1].end_time = '14:20';
    const plan = buildPlan(dedupe(rows).sessions);
    expect(plan.classes[0].exceptions).toEqual([{ date: '2026-10-10', type: 'change', start_time: '13:00', end_time: '14:20' }]);
  });

  it('그 날만 준비물이 있으면 이 날만 변경에 준비물', () => {
    const rows = weekly([[10, 1], [10, 2], [10, 3]]);
    rows[0].supplies = '체스판';
    const plan = buildPlan(dedupe(rows).sessions);
    expect(plan.classes[0].supplies).toBeNull();
    expect(plan.classes[0].exceptions).toEqual([{ date: '2026-10-03', type: 'change', supplies: '체스판' }]);
    expect(verify(plan, dedupe(rows).sessions).ok).toBe(true);
  });

  it('회차 번호만 다른 메모는 번호를 빼고 수업 메모 하나로', () => {
    const rows = weekly([[10, 1], [10, 2]]);
    rows[0].memo = '1/2회 · 강의실 세미나';
    rows[1].memo = '2/2회 · 강의실 세미나';
    const plan = buildPlan(dedupe(rows).sessions);
    expect(plan.classes[0].memo).toBe('강의실 세미나');
    expect(plan.classes[0].exceptions).toEqual([]);
  });

  it('한 번뿐인 수업, 너무 멀리 떨어진 회차는 원데이', () => {
    const rows = [
      row({ class_name: '쿠키 만들기', week: 1, day: 'SUN' }),
      row({ class_name: '릴레이동화', month: 8, week: 1 }),
      row({ class_name: '릴레이동화', month: 11, week: 1 }),
    ];
    const plan = buildPlan(dedupe(rows).sessions);
    expect(plan.classes).toEqual([]);
    expect(plan.one_day_events.map((e) => [e.name, e.date])).toEqual([
      ['릴레이동화', '2026-08-01'], ['쿠키 만들기', '2026-10-04'], ['릴레이동화', '2026-11-07'],
    ]);
  });

  it('같은 날 같은 이름이 두 번이면 흔한 시간은 정규, 나머지는 원데이', () => {
    const rows = [...weekly([[10, 1], [10, 2]]), row({ week: 2, start_time: '16:00', end_time: '16:50' })];
    const plan = buildPlan(dedupe(rows).sessions);
    expect(plan.classes[0].count).toBe(2);
    expect(plan.one_day_events.map((e) => [e.date, e.start_time])).toEqual([['2026-10-10', '16:00']]);
  });
});

describe('verify', () => {
  it('변환 결과로 다시 계산한 회차가 원본과 같으면 ok', () => {
    const rows = [
      row({ week: 1, supplies: '앞치마' }), row({ week: 2, supplies: '앞치마' }), row({ week: 4, supplies: '앞치마' }),
      row({ week: 3, class_name: '특강', start_time: '15:00', end_time: '15:40', memo: '보호자 동반' }),
    ];
    rows[1].start_time = '10:30';
    rows[1].end_time = '11:50';
    const { sessions } = dedupe(rows);
    const result = verify(buildPlan(sessions), sessions);
    expect(result).toMatchObject({ ok: true, missing: [], extra: [], fieldDiffs: [], rebuiltCount: 4 });
  });

  it('회차가 빠지거나 더 생기면 알려준다', () => {
    const { sessions } = dedupe([row({ week: 1 }), row({ week: 2 })]);
    const plan = buildPlan(sessions);
    plan.classes[0].exceptions.push({ date: '2026-10-10', type: 'cancel' });
    const result = verify(plan, sessions);
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(['2026-10-10|미술|10:00']);
  });
});
