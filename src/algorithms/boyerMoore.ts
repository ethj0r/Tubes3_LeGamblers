import type { MatchResult, PatternMatcher } from '../types';

export function computeLastOccurrence(pattern: string): Map<number, number> {
  const table = new Map<number, number>();
  for (let i = 0; i < pattern.length; i++) {
    table.set(pattern.charCodeAt(i), i);
  }
  return table;
}

export interface BmSearchHit {
  startIndex: number;
  comparisonsSoFar: number;
}

export interface BmSingleSearchResult {
  hits: BmSearchHit[];
  totalComparisons: number;
}

export function boyerMooreSearchSingle(
  text: string,
  pattern: string,
  options?: { caseInsensitive?: boolean },
): BmSingleSearchResult {
  const caseInsensitive = options?.caseInsensitive ?? true;
  const hits: BmSearchHit[] = [];

  const m = pattern.length;
  const n = text.length;
  if (m === 0 || n < m) {
    return { hits, totalComparisons: 0 };
  }

  const t = caseInsensitive ? text.toLowerCase() : text;
  const p = caseInsensitive ? pattern.toLowerCase() : pattern;

  const last = computeLastOccurrence(p);
  let comparisons = 0;

  let i = 0;
  while (i <= n - m) {
    let j = m - 1;
    while (j >= 0) {
      comparisons++;
      if (p.charCodeAt(j) !== t.charCodeAt(i + j)) break;
      j--;
    }

    if (j < 0) {
      hits.push({ startIndex: i, comparisonsSoFar: comparisons });
      i++;
    } else {
      const badCharLast = last.get(t.charCodeAt(i + j)) ?? -1;
      const shift = j - badCharLast;
      i += shift > 0 ? shift : 1;
    }
  }

  return { hits, totalComparisons: comparisons };
}

export const boyerMooreMatcher: PatternMatcher = {
  name: 'BoyerMoore',
  search(text: string, patterns: string[]): MatchResult[] {
    const results: MatchResult[] = [];

    for (const pattern of patterns) {
      if (pattern.length === 0) continue;

      const { hits } = boyerMooreSearchSingle(text, pattern);
      for (const hit of hits) {
        const startIndex = hit.startIndex;
        const endIndex = startIndex + pattern.length;
        results.push({
          keyword: pattern,
          matchedText: text.slice(startIndex, endIndex),
          algorithm: 'BoyerMoore',
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
