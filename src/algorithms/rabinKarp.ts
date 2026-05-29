import type { MatchResult, PatternMatcher } from '../types';

const BASE = 256;
const MOD = 1_000_000_888;

export interface RkSearchHit {
  startIndex: number;
  comparisonsSoFar: number;
}

export interface RkSingleSearchResult {
  hits: RkSearchHit[];
  totalComparisons: number;
}

export function rabinKarpSearchSingle(
  text: string,
  pattern: string,
  options?: { caseInsensitive?: boolean },
): RkSingleSearchResult {
  const caseInsensitive = options?.caseInsensitive ?? true;
  const hits: RkSearchHit[] = [];

  const m = pattern.length;
  const n = text.length;
  if (m === 0 || n < m) {
    return { hits, totalComparisons: 0 };
  }

  const t = caseInsensitive ? text.toLowerCase() : text;
  const p = caseInsensitive ? pattern.toLowerCase() : pattern;

  // highPow = BASE^(m-1) % MOD, used to delete the leading char from rolling hash.
  let highPow = 1;
  for (let i = 0; i < m - 1; i++) {
    highPow = (highPow * BASE) % MOD;
  }

  let patternHash = 0;
  let windowHash = 0;
  for (let i = 0; i < m; i++) {
    patternHash = (patternHash * BASE + p.charCodeAt(i)) % MOD;
    windowHash = (windowHash * BASE + t.charCodeAt(i)) % MOD;
  }

  let comparisons = 0;
  for (let i = 0; i <= n - m; i++) {
    comparisons++;
    if (windowHash === patternHash) {
      // Hash match: verify character by character to confirm match due to hash collisions.
      let j = 0;
      while (j < m) {
        comparisons++;
        if (t.charCodeAt(i + j) !== p.charCodeAt(j)) break;
        j++;
      }
      if (j === m) {
        hits.push({ startIndex: i, comparisonsSoFar: comparisons });
      }
    }

    if (i < n - m) {
      windowHash =
        ((windowHash - t.charCodeAt(i) * highPow) * BASE + t.charCodeAt(i + m)) % MOD;
      if (windowHash < 0) windowHash += MOD;
    }
  }

  return { hits, totalComparisons: comparisons };
}

export const rabinKarpMatcher: PatternMatcher = {
  name: 'RabinKarp',
  search(text: string, patterns: string[]): MatchResult[] {
    const results: MatchResult[] = [];

    for (const pattern of patterns) {
      if (pattern.length === 0) continue;

      const { hits } = rabinKarpSearchSingle(text, pattern);
      for (const hit of hits) {
        const startIndex = hit.startIndex;
        const endIndex = startIndex + pattern.length;
        results.push({
          keyword: pattern,
          matchedText: text.slice(startIndex, endIndex),
          algorithm: 'RabinKarp',
          startIndex,
          endIndex,
          comparisonCount: hit.comparisonsSoFar,
          isFuzzy: false,
        });
      }
    }

    return results;
  },
};
