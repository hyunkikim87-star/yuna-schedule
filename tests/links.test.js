import { describe, it, expect } from 'vitest';
import { matchLinks, similarName } from '../scripts/links/match.js';

const classes = [
  { id: 1, name: '아이돌 방송댄스(오데뜨)', start_date: '2026-12-05', start_time: '14:00' },
  { id: 2, name: '한우리 독서 토론 논술A', start_date: '2027-01-02', start_time: '13:00' },
];
const oneDayEvents = [
  { id: 10, name: 'AI 펭귄 보안관 (AI 상상놀이터)', date: '2027-01-03', start_time: '12:00' },
  { id: 11, name: '듀플러 레고 블럭놀이 (이글루)', date: '2027-02-14', start_time: '15:40' },
  { id: 12, name: '쿠키 만들기', date: '2027-02-14', start_time: '17:00' },
  { id: 13, name: '쿠키 만들기 B', date: '2027-02-14', start_time: '17:00' },
];
const item = (o) => ({ link: 'https://www.cultureclub.emart.com/class/x', ...o });

describe('similarName', () => {
  it('띄어쓰기·괄호·부제만 다른 이름은 같은 수업', () => {
    expect(similarName('한우리 독서 토론 논술 A', '한우리 독서 토론 논술A')).toBe(true);
    expect(similarName('AI 펭귄 보안관', 'AI 펭귄 보안관 (AI 상상놀이터)')).toBe(true);
    expect(similarName('듀플러 레고블록놀이 <이글루>', '듀플러 레고 블럭놀이 (이글루)')).toBe(true);
  });

  it('다른 수업은 아니다', () => {
    expect(similarName('컬러 몬스터', '아이돌 방송댄스')).toBe(false);
    expect(similarName('', '컬러 몬스터')).toBe(false);
  });
});

describe('matchLinks', () => {
  it('정규는 시작일+시간, 원데이는 날짜+시간으로 짝', () => {
    const { matched, skipped } = matchLinks([
      item({ kind: 'class', date: '2027-01-02', start_time: '13:00', name: '한우리 독서 토론 논술 A' }),
      item({ kind: 'one_day', date: '2027-01-03', start_time: '12:00', name: 'AI 펭귄 보안관' }),
      item({ kind: 'one_day', date: '2027-02-14', start_time: '15:40', name: '듀플러 레고블록놀이 <이글루>' }),
    ], { classes, oneDayEvents });
    expect(matched.map((m) => m.target.id)).toEqual([2, 10, 11]);
    expect(skipped).toEqual([]);
  });

  it('후보가 없거나 여러 개거나 이름이 다르면 건너뛴다', () => {
    const { matched, skipped } = matchLinks([
      item({ kind: 'one_day', date: '2027-03-01', start_time: '10:00', name: '없는 수업' }),
      item({ kind: 'one_day', date: '2027-02-14', start_time: '17:00', name: '쿠키 만들기' }),
      item({ kind: 'class', date: '2026-12-05', start_time: '14:00', name: '컬러 몬스터' }),
    ], { classes, oneDayEvents });
    expect(matched).toEqual([]);
    expect(skipped.map((s) => s.reason)).toEqual([
      '같은 날짜·시간 수업 없음', '후보 2개', '이름이 달라요 (앱: 아이돌 방송댄스(오데뜨))',
    ]);
  });
});
