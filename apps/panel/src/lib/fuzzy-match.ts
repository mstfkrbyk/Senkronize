/**
 * Basit fuzzy eşleştirme — karakterler sırayla query içinde geçmeli.
 * Daha yüksek skor = daha iyi eşleşme.
 */
export function fuzzyScore(query: string, text: string): number {
  const q = query.trim().toLowerCase();
  const t = text.toLowerCase();
  if (!q) {
    return 1;
  }
  if (!t) {
    return 0;
  }
  if (t.includes(q)) {
    return 100 + (q.length / t.length) * 50;
  }

  let qi = 0;
  let score = 0;
  let consecutive = 0;
  let lastMatch = -1;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      const isWordStart = ti === 0 || /[\s\-_/]/.test(t[ti - 1] ?? '');
      if (isWordStart) {
        score += 8;
      }
      if (lastMatch === ti - 1) {
        consecutive++;
        score += consecutive * 4;
      } else {
        consecutive = 1;
      }
      if (lastMatch >= 0) {
        score -= Math.min(10, ti - lastMatch - 1);
      }
      lastMatch = ti;
      qi++;
      score += 2;
    }
  }

  if (qi < q.length) {
    return 0;
  }
  return score;
}

export function fuzzyMatch(query: string, candidates: string[]): boolean {
  if (!query.trim()) {
    return true;
  }
  return candidates.some((c) => fuzzyScore(query, c) > 0);
}
