import { describe, it, expect } from 'vitest';
import {
  addMinutes, classStatus, dateLabel, durationLabel, gapLabel, gapsBetween, monthRange,
  nowInSeoul, shiftMonth, splitSupplies, weekendStatus, weekendTitle, withRo,
} from '../src/lib/time.js';
import { placeColor } from '../src/lib/colors.js';

// 날짜·시각은 모두 고정값
const sat = [
  { date: '2026-10-31', start_time: '10:00', end_time: '11:20', name: '와이즈미술학원', location: '파크뷰 상가' },
  { date: '2026-10-31', start_time: '15:10', end_time: '15:50', name: '점프홀릭 유아체육', location: '스타필드 위례' },
  { date: '2026-10-31', start_time: '16:10', end_time: '17:00', name: '동화읽고 과학놀이', location: '스타필드 위례' },
];
const sun = [{ date: '2026-11-01', start_time: '13:00', end_time: '15:00', name: '컬러 몬스터', location: 'ak플라자 분당' }];

describe('nowInSeoul', () => {
  it('UTC 시각을 한국 날짜·시각으로 바꾼다', () => {
    expect(nowInSeoul(new Date('2026-10-31T01:27:00Z'))).toEqual({ date: '2026-10-31', time: '10:27' });
    expect(nowInSeoul(new Date('2026-10-31T15:30:00Z'))).toEqual({ date: '2026-11-01', time: '00:30' });
  });
});

describe('시간 계산', () => {
  it('시작 + 길이 = 끝 시간, 자정 넘으면 null', () => {
    expect(addMinutes('10:00', 80)).toBe('11:20');
    expect(addMinutes('23:30', 40)).toBeNull();
  });

  it('길이 표시', () => {
    expect(durationLabel(50)).toBe('50분');
    expect(durationLabel(120)).toBe('2시간');
    expect(durationLabel(230)).toBe('3시간 50분');
  });

  it('날짜 표시', () => {
    expect(dateLabel('2026-10-31')).toBe('10월 31일 (토)');
  });

  it('달 범위와 달 이동', () => {
    expect(monthRange(2026, 2)).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthRange(2026, 12)).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });
});

describe('수업 사이 간격', () => {
  it('빈 시간과 장소 이동을 계산한다', () => {
    const gaps = gapsBetween(sat);
    expect(gaps).toEqual([
      { minutes: 230, moved: true, to: '스타필드 위례' },
      { minutes: 20, moved: false, to: '스타필드 위례' },
    ]);
    expect(gapLabel(gaps[0])).toBe('3시간 50분 · 스타필드 위례로 이동');
    expect(gapLabel(gaps[1])).toBe('20분 · 같은 장소');
  });

  it('받침에 맞춰 로/으로', () => {
    expect(withRo('파크뷰 상가')).toBe('파크뷰 상가로');
    expect(withRo('이마트 수지점')).toBe('이마트 수지점으로');
    expect(withRo('판교 어린이도서관')).toBe('판교 어린이도서관으로');
    expect(withRo('AK플라자 분당')).toBe('AK플라자 분당으로');
    expect(withRo('서울')).toBe('서울로');
    expect(withRo('CGV')).toBe('CGV로');
  });

  it('겹치면 겹친다고 표시', () => {
    expect(gapLabel({ minutes: -20, moved: false })).toBe('시간이 겹쳐요');
  });
});

describe('weekendStatus', () => {
  const all = [...sat, ...sun];

  it('수업 중이면 지금 수업과 남은 시간, 다음 수업', () => {
    const st = weekendStatus(all, { date: '2026-10-31', time: '10:27' });
    expect(st.current.session.name).toBe('와이즈미술학원');
    expect(st.current.leftMinutes).toBe(53);
    expect(st.next.session.name).toBe('점프홀릭 유아체육');
    expect(st.next.inMinutes).toBe(283);
  });

  it('수업 전이면 다음 수업만', () => {
    const st = weekendStatus(all, { date: '2026-10-31', time: '08:00' });
    expect(st.current).toBeNull();
    expect(st.next.session.name).toBe('와이즈미술학원');
  });

  it('다음 수업이 다른 날이면 inMinutes 없음', () => {
    const st = weekendStatus(all, { date: '2026-10-31', time: '18:00' });
    expect(st.next.session.name).toBe('컬러 몬스터');
    expect(st.next.inMinutes).toBeNull();
  });

  it('주말이 끝나면 둘 다 없음', () => {
    expect(weekendStatus(all, { date: '2026-11-01', time: '16:00' })).toEqual({ current: null, next: null });
  });
});

describe('기타', () => {
  it('준비물은 쉼표로 나눈다', () => {
    expect(splitSupplies('실내용 운동화, 물통 ,')).toEqual(['실내용 운동화', '물통']);
    expect(splitSupplies(null)).toEqual([]);
  });

  it('수업 기간 상태', () => {
    const c = { start_date: '2026-09-05', end_date: '2026-11-28' };
    expect(classStatus(c, '2026-10-31')).toBe('active');
    expect(classStatus(c, '2026-12-01')).toBe('ended');
    expect(classStatus(c, '2026-09-01')).toBe('upcoming');
  });

  it('주말 제목', () => {
    expect(weekendTitle(0)).toBe('이번 주말');
    expect(weekendTitle(1)).toBe('다음 주말');
    expect(weekendTitle(3)).toBe('3주 뒤 주말');
  });

  it('장소 색은 이름이 같으면 같다', () => {
    expect(placeColor('스타필드 위례')).toBe('#3182F6');
    expect(placeColor('어린이 도서관')).toBe(placeColor('어린이 도서관'));
    expect(placeColor(null)).toBe('#8B95A1');
  });
});
