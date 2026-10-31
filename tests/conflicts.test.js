import { describe, it, expect } from 'vitest';
import { conflictSummary, findConflicts } from '../src/lib/conflicts.js';
import { dateLabel } from '../src/lib/time.js';

// 2026-11-07, 11-14 = 토요일
const sessions = [
  { date: '2026-11-07', start_time: '15:10', end_time: '15:50', name: '점프홀릭', kind: 'class', source_id: 2 },
  { date: '2026-11-07', start_time: '16:10', end_time: '17:00', name: '동화읽고', kind: 'class', source_id: 3 },
  { date: '2026-11-14', start_time: '15:10', end_time: '15:50', name: '점프홀릭', kind: 'class', source_id: 2 },
  { date: '2026-11-08', start_time: '15:00', end_time: '15:50', name: '일요 특강', kind: 'one_day', source_id: 9 },
];

describe('findConflicts', () => {
  it('원데이: 같은 날 시간이 겹치는 회차', () => {
    const c = findConflicts(sessions, { kind: 'one_day', date: '2026-11-07', start_time: '15:30', end_time: '16:20' });
    expect(c.map((s) => s.name)).toEqual(['점프홀릭', '동화읽고']);
  });

  it('끝나는 시각에 바로 시작하면 겹치지 않는다', () => {
    expect(findConflicts(sessions, { kind: 'one_day', date: '2026-11-07', start_time: '15:50', end_time: '16:10' })).toEqual([]);
  });

  it('정규: 기간 안 같은 요일의 겹치는 회차 모두', () => {
    const c = findConflicts(sessions, { kind: 'class', weekday: 6, start_date: '2026-11-01', end_date: '2026-11-30', start_time: '15:00', end_time: '15:30' });
    expect(c.map((s) => s.date)).toEqual(['2026-11-07', '2026-11-14']);
  });

  it('정규: 기간 밖이나 다른 요일은 제외', () => {
    expect(findConflicts(sessions, { kind: 'class', weekday: 6, start_date: '2026-11-10', end_date: '2026-11-12', start_time: '15:00', end_time: '16:00' })).toEqual([]);
    expect(findConflicts(sessions, { kind: 'class', weekday: 0, start_date: '2026-11-01', end_date: '2026-11-30', start_time: '15:20', end_time: '15:40' }).map((s) => s.name)).toEqual(['일요 특강']);
  });

  it('수정할 때는 자기 자신을 빼고 본다', () => {
    const c = findConflicts(sessions, { kind: 'class', id: 2, weekday: 6, start_date: '2026-11-01', end_date: '2026-11-30', start_time: '15:10', end_time: '15:50' });
    expect(c).toEqual([]);
  });

  it('요약 문구', () => {
    const c = findConflicts(sessions, { kind: 'class', weekday: 6, start_date: '2026-11-01', end_date: '2026-11-30', start_time: '15:00', end_time: '15:30' });
    expect(conflictSummary(c, dateLabel)).toBe('11월 7일 (토) 15:10 점프홀릭 외 1회');
    expect(conflictSummary([], dateLabel)).toBe('');
  });
});
