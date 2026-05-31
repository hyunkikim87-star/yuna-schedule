const FIXED = [
  { month: 1,  day: 1,  name: '신정' },
  { month: 3,  day: 1,  name: '삼일절' },
  { month: 5,  day: 1,  name: '노동절', from: 2026 },
  { month: 5,  day: 5,  name: '어린이날' },
  { month: 6,  day: 6,  name: '현충일' },
  { month: 7,  day: 17, name: '제헌절', from: 2026 },
  { month: 8,  day: 15, name: '광복절' },
  { month: 10, day: 3,  name: '개천절' },
  { month: 10, day: 9,  name: '한글날' },
  { month: 12, day: 25, name: '성탄절' },
];

const LUNAR = {
  2025: [
    { date: '2025-01-28', name: '설날 연휴' },
    { date: '2025-01-29', name: '설날' },
    { date: '2025-01-30', name: '설날 연휴' },
    { date: '2025-05-05', name: '부처님오신날' },
    { date: '2025-10-05', name: '추석 연휴' },
    { date: '2025-10-06', name: '추석' },
    { date: '2025-10-07', name: '추석 연휴' },
    { date: '2025-10-08', name: '대체공휴일' },
  ],
  2026: [
    { date: '2026-02-16', name: '설날 연휴' },
    { date: '2026-02-17', name: '설날' },
    { date: '2026-02-18', name: '설날 연휴' },
    { date: '2026-03-02', name: '대체공휴일' },
    { date: '2026-05-24', name: '부처님오신날' },
    { date: '2026-05-25', name: '부처님오신날 대체공휴일' },
    { date: '2026-08-17', name: '대체공휴일' },
    { date: '2026-09-24', name: '추석 연휴' },
    { date: '2026-09-25', name: '추석' },
    { date: '2026-09-26', name: '추석 연휴' },
    { date: '2026-10-05', name: '대체공휴일' },
  ],
  2027: [
    { date: '2027-02-06', name: '설날 연휴' },
    { date: '2027-02-07', name: '설날' },
    { date: '2027-02-08', name: '설날 연휴' },
    { date: '2027-02-09', name: '대체공휴일' },
    { date: '2027-05-03', name: '대체공휴일' },
    { date: '2027-05-13', name: '부처님오신날' },
    { date: '2027-08-16', name: '대체공휴일' },
    { date: '2027-09-14', name: '추석 연휴' },
    { date: '2027-09-15', name: '추석' },
    { date: '2027-09-16', name: '추석 연휴' },
    { date: '2027-10-04', name: '대체공휴일' },
    { date: '2027-10-11', name: '대체공휴일' },
    { date: '2027-12-27', name: '대체공휴일' },
  ],
  2028: [
    { date: '2028-01-26', name: '설날 연휴' },
    { date: '2028-01-27', name: '설날' },
    { date: '2028-01-28', name: '설날 연휴' },
    { date: '2028-05-02', name: '부처님오신날' },
    { date: '2028-10-02', name: '추석 연휴' },
    { date: '2028-10-03', name: '추석/개천절' },
    { date: '2028-10-04', name: '추석 연휴' },
    { date: '2028-10-05', name: '대체공휴일' },
  ],
  2029: [
    { date: '2029-02-12', name: '설날 연휴' },
    { date: '2029-02-13', name: '설날' },
    { date: '2029-02-14', name: '설날 연휴' },
    { date: '2029-05-07', name: '대체공휴일' },
    { date: '2029-05-20', name: '부처님오신날' },
    { date: '2029-05-21', name: '부처님오신날 대체공휴일' },
    { date: '2029-09-21', name: '추석 연휴' },
    { date: '2029-09-22', name: '추석' },
    { date: '2029-09-23', name: '추석 연휴' },
    { date: '2029-09-24', name: '대체공휴일' },
  ],
  2030: [
    { date: '2030-02-02', name: '설날 연휴' },
    { date: '2030-02-03', name: '설날' },
    { date: '2030-02-04', name: '설날 연휴' },
    { date: '2030-02-05', name: '대체공휴일' },
    { date: '2030-05-06', name: '대체공휴일' },
    { date: '2030-05-09', name: '부처님오신날' },
    { date: '2030-09-11', name: '추석 연휴' },
    { date: '2030-09-12', name: '추석' },
    { date: '2030-09-13', name: '추석 연휴' },
  ],
};

function pad(n) { return String(n).padStart(2, '0'); }

function getAllHolidays(year) {
  const fixed = FIXED
    .filter(h => !h.from || year >= h.from)
    .map(h => ({ date: `${year}-${pad(h.month)}-${pad(h.day)}`, name: h.name }));
  return [...fixed, ...(LUNAR[year] ?? [])];
}

function getNthSaturday(year, month, week) {
  const d = new Date(year, month - 1, 1);
  let count = 0;
  while (d.getMonth() === month - 1) {
    if (d.getDay() === 6) { count++; if (count === week) return new Date(d); }
    d.setDate(d.getDate() + 1);
  }
  return null;
}

// Returns array of { date: 'YYYY-MM-DD', name: '공휴일명' } for weekday holidays in the given week.
// A "week" spans Mon(sat-5) through Sun(sat+1) where sat is the Nth Saturday of the month.
export function getHolidaysInWeek(year, month, week) {
  const sat = getNthSaturday(year, month, week);
  if (!sat) return [];
  const weekStart = new Date(sat); weekStart.setDate(sat.getDate() - 5);
  const weekEnd = new Date(sat); weekEnd.setDate(sat.getDate() + 1);
  return getAllHolidays(year).filter(h => {
    const d = new Date(h.date);
    const dow = d.getDay();
    return d >= weekStart && d <= weekEnd && dow !== 0 && dow !== 6;
  });
}
