import { describe, it, expect } from 'vitest';
import { computeSessions, weekendOf, isValidDate, weekdayOf } from '../lib/sessions.js';

// 날짜는 모두 고정값. 2026-10-03, 10-10, 10-17, 10-24, 10-31 = 토요일
const wise = {
  id: 1, name: '와이즈미술학원', weekday: 6, start_time: '10:00', end_time: '11:20',
  location: '파크뷰 상가', start_date: '2026-10-03', end_date: '2026-10-31',
  supplies: '앞치마', memo: null, color: null, term: '가을학기',
};

const dates = (sessions) => sessions.map((s) => s.date);

describe('날짜 도우미', () => {
  it('요일을 UTC 기준으로 계산한다', () => {
    expect(weekdayOf('2026-10-31')).toBe(6);
    expect(weekdayOf('2026-11-01')).toBe(0);
  });

  it('없는 날짜는 거부한다', () => {
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('2026-2-3')).toBe(false);
    expect(isValidDate('2026-11-01')).toBe(true);
  });

  it('달 경계(10/31 토 ~ 11/1 일)가 한 주말로 나온다', () => {
    expect(weekendOf('2026-10-31')).toEqual({ sat: '2026-10-31', sun: '2026-11-01' });
    expect(weekendOf('2026-11-01')).toEqual({ sat: '2026-10-31', sun: '2026-11-01' });
    expect(weekendOf('2026-10-28')).toEqual({ sat: '2026-10-31', sun: '2026-11-01' });
  });
});

describe('computeSessions', () => {
  it('매주 토요일 수업을 기간 안에서 매주 만든다', () => {
    const s = computeSessions({ classes: [wise], from: '2026-10-01', to: '2026-11-30' });
    expect(dates(s)).toEqual(['2026-10-03', '2026-10-10', '2026-10-17', '2026-10-24', '2026-10-31']);
    expect(s[0]).toMatchObject({ name: '와이즈미술학원', start_time: '10:00', kind: 'class', source_id: 1, changed: false });
  });

  it('휴강 1회 → 그 날짜만 빠진다', () => {
    const exceptions = [{ id: 9, class_id: 1, date: '2026-10-17', type: 'cancel' }];
    const s = computeSessions({ classes: [wise], exceptions, from: '2026-10-01', to: '2026-10-31' });
    expect(dates(s)).toEqual(['2026-10-03', '2026-10-10', '2026-10-24', '2026-10-31']);
  });

  it('이 날만 시간 변경 → 그 회차만 바뀐다', () => {
    const exceptions = [{ id: 9, class_id: 1, date: '2026-10-24', type: 'change', start_time: '13:00', end_time: '14:20' }];
    const s = computeSessions({ classes: [wise], exceptions, from: '2026-10-01', to: '2026-10-31' });
    const changed = s.filter((x) => x.changed);
    expect(changed).toHaveLength(1);
    expect(changed[0]).toMatchObject({ date: '2026-10-24', start_time: '13:00', end_time: '14:20', location: '파크뷰 상가', exception_id: 9 });
    expect(s.filter((x) => x.date !== '2026-10-24').every((x) => x.start_time === '10:00')).toBe(true);
  });

  it('종료일 연장 → 회차가 늘어난다', () => {
    const before = computeSessions({ classes: [wise], from: '2026-10-01', to: '2026-12-31' });
    const after = computeSessions({ classes: [{ ...wise, end_date: '2026-11-21' }], from: '2026-10-01', to: '2026-12-31' });
    expect(before).toHaveLength(5);
    expect(after).toHaveLength(8);
    expect(dates(after).slice(5)).toEqual(['2026-11-07', '2026-11-14', '2026-11-21']);
  });

  it('달 경계 주말을 조회하면 토·일 회차가 함께 나온다', () => {
    const sunday = { ...wise, id: 2, name: '바둑&체스교실', weekday: 0, start_time: '14:10', end_time: '15:00', start_date: '2026-10-04', end_date: '2026-11-29' };
    const s = computeSessions({ classes: [wise, sunday], from: '2026-10-31', to: '2026-11-01' });
    expect(s.map((x) => [x.date, x.name])).toEqual([
      ['2026-10-31', '와이즈미술학원'],
      ['2026-11-01', '바둑&체스교실'],
    ]);
  });

  it('같은 시간 두 수업 → 둘 다 겹침 표시', () => {
    const other = { id: 3, name: '부엉이시계만들기', date: '2026-10-31', start_time: '10:30', end_time: '11:10', location: null };
    const later = { id: 4, name: '쿠키 만들기', date: '2026-10-31', start_time: '11:20', end_time: '12:00', location: null };
    const s = computeSessions({ classes: [wise], oneDayEvents: [other, later], from: '2026-10-31', to: '2026-10-31' });
    expect(s.map((x) => [x.name, x.overlap])).toEqual([
      ['와이즈미술학원', true],
      ['부엉이시계만들기', true],
      ['쿠키 만들기', false], // 11:20 시작 = 앞 수업 끝 시간, 겹침 아님
    ]);
  });

  it('원데이 수업은 그 날짜에만 나오고 시간순으로 정렬된다', () => {
    const event = { id: 5, name: '문화센터 특강', date: '2026-10-10', start_time: '09:00', end_time: '09:50' };
    const s = computeSessions({ classes: [wise], oneDayEvents: [event], from: '2026-10-10', to: '2026-10-11' });
    expect(s.map((x) => [x.name, x.kind])).toEqual([['문화센터 특강', 'one_day'], ['와이즈미술학원', 'class']]);
  });

  it('기간이 조회 범위 밖이면 회차가 없다', () => {
    expect(computeSessions({ classes: [wise], from: '2026-12-01', to: '2026-12-31' })).toEqual([]);
  });
});
