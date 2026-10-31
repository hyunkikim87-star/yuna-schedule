// 링크 목록(시트에서 뽑은 것) ↔ 앱의 수업 짝 맞추기. DB·API에 접근하지 않는 순수 함수.
// 정규: 시작일 + 시작 시간, 원데이: 날짜 + 시작 시간. 후보가 정확히 1개이고 이름도 비슷할 때만 짝으로 본다.

const norm = (s) => String(s || '').replace(/[\s<>()[\]!?,.:&·\-'"]/g, '').toLowerCase();

// 두 이름 중 짧은 쪽 앞 6글자가 긴 쪽에 들어 있으면 비슷하다고 본다 ('AI 펭귄 보안관' ↔ 'AI 펭귄 보안관 (AI 상상놀이터)')
export function similarName(a, b) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return long.includes(short.slice(0, 6));
}

export function matchLinks(items, { classes, oneDayEvents }) {
  const matched = [];
  const skipped = [];
  for (const it of items) {
    const cands = it.kind === 'class'
      ? classes.filter((c) => c.start_date === it.date && c.start_time === it.start_time)
      : oneDayEvents.filter((e) => e.date === it.date && e.start_time === it.start_time);
    if (cands.length !== 1) {
      skipped.push({ item: it, reason: cands.length ? `후보 ${cands.length}개` : '같은 날짜·시간 수업 없음' });
    } else if (!similarName(it.name, cands[0].name)) {
      skipped.push({ item: it, reason: `이름이 달라요 (앱: ${cands[0].name})` });
    } else {
      matched.push({ item: it, target: cands[0] });
    }
  }
  return { matched, skipped };
}
