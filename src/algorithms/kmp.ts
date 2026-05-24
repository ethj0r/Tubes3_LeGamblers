import type { MatchResult, PatternMatcher } from '../types';

export interface LpsResult {
  lps: number[];
  comparisons: number;
}

export function computeLPS(pattern: string): LpsResult {
  const m = pattern.length;
  const lps = new Array<number>(m).fill(0);
  let comparisons = 0;

  if (m === 0) return { lps, comparisons };

  let len = 0;
  let i = 1;
  while (i < m) {
    comparisons++;
    if (pattern.charCodeAt(i) === pattern.charCodeAt(len)) {
      len++;
      lps[i] = len;
      i++;
    } else if (len > 0) {
      len = lps[len - 1];
    } else {
      lps[i] = 0;
      i++;
    }
  }

  return { lps, comparisons };
}

export interface KmpSearchHit {
  startIndex: number;
  comparisonsSoFar: number;
}

export interface KmpSingleSearchResult {
  hits: KmpSearchHit[];
  totalComparisons: number;
}

export function kmpSearchSingle(
  text: string,
  pattern: string,
  options?: { caseInsensitive?: boolean },
): KmpSingleSearchResult {
  const caseInsensitive = options?.caseInsensitive ?? true;
  const hits: KmpSearchHit[] = [];

  if (pattern.length === 0 || text.length < pattern.length) {
    return { hits, totalComparisons: 0 };
  }

  const t = caseInsensitive ? text.toLowerCase() : text;
  const p = caseInsensitive ? pattern.toLowerCase() : pattern;

  const { lps, comparisons: lpsComparisons } = computeLPS(p);
  let comparisons = lpsComparisons;

  const n = t.length;
  const m = p.length;
  let i = 0;
  let j = 0;

  while (i < n) {
    comparisons++;
    if (t.charCodeAt(i) === p.charCodeAt(j)) {
      i++;
      j++;
      if (j === m) {
        hits.push({ startIndex: i - j, comparisonsSoFar: comparisons });
        j = lps[j - 1];
      }
    } else if (j > 0) {
      j = lps[j - 1];
    } else {
      i++;
    }
  }

  return { hits, totalComparisons: comparisons };
}

export const kmpMatcher: PatternMatcher = {
  name: 'KMP',
  search(text: string, patterns: string[]): MatchResult[] {
    const results: MatchResult[] = [];

    for (const pattern of patterns) {
      if (pattern.length === 0) continue;

      const { hits } = kmpSearchSingle(text, pattern);
      for (const hit of hits) {
        const startIndex = hit.startIndex;
        const endIndex = startIndex + pattern.length;
        results.push({
          keyword: pattern,
          matchedText: text.slice(startIndex, endIndex),
          algorithm: 'KMP',
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
