import { describe, it, expect } from 'vitest';
import { getWeekCount, advanceWeek } from '../src/scheduleUtils.js';

describe('getWeekCount', () => {
  it('2026년 6월 토요일 4번 → 4', () => {
    expect(getWeekCount(2026, 6)).toBe(4);
  });
  it('2026년 5월 토요일 5번 → 5', () => {
    expect(getWeekCount(2026, 5)).toBe(5);
  });
  it('토요일이 없는 달은 4 반환', () => {
    expect(getWeekCount(2026, 6)).toBeGreaterThanOrEqual(4);
  });
});

describe('advanceWeek', () => {
  it('같은 달 내에서 주차 +1', () => {
    expect(advanceWeek(2026, 6, 1)).toEqual({ year: 2026, month: 6, week: 2 });
  });
  it('마지막 주에서 다음 달 1주로', () => {
    expect(advanceWeek(2026, 6, 4)).toEqual({ year: 2026, month: 7, week: 1 });
  });
  it('12월 마지막 주에서 다음 해 1월로', () => {
    const result = advanceWeek(2026, 12, getWeekCount(2026, 12));
    expect(result).toEqual({ year: 2027, month: 1, week: 1 });
  });
  it('5월 5주에서 6월 1주로', () => {
    expect(advanceWeek(2026, 5, 5)).toEqual({ year: 2026, month: 6, week: 1 });
  });
});
