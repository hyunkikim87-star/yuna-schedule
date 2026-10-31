// 수업 색: 수업에 color가 있으면 그 색, 없으면 장소별 색. 장소 이름이 같으면 항상 같은 색.
const KNOWN = [
  [/파크뷰/, '#EA580C'],
  [/스타필드|위례/, '#3182F6'],
  [/ak|AK|에이케이/, '#7C3AED'],
  [/수지/, '#15803D'],
  [/현대/, '#B45309'],
  [/분당|성남/, '#0E7490'],
];

const PALETTE = ['#DB2777', '#4F46E5', '#0F766E', '#A16207', '#BE123C', '#475569'];

export function placeColor(location) {
  if (!location) return '#8B95A1';
  for (const [re, color] of KNOWN) if (re.test(location)) return color;
  let h = 0;
  for (const ch of location) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function sessionColor(s) {
  return s.color || placeColor(s.location);
}

export function mapUrl(location) {
  return `https://map.naver.com/p/search/${encodeURIComponent(location)}`;
}
