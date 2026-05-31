export function getWeekCount(year, month) {
  const d = new Date(year, month - 1, 1);
  let count = 0;
  while (d.getMonth() === month - 1) {
    if (d.getDay() === 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count || 4;
}

export function advanceWeek(year, month, week) {
  const wc = getWeekCount(year, month);
  if (week < wc) return { year, month, week: week + 1 };
  if (month === 12) return { year: year + 1, month: 1, week: 1 };
  return { year, month: month + 1, week: 1 };
}
