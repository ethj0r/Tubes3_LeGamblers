import type { MatchResult, PatternMatcher } from '../types';

export const levenshteinMatcher: PatternMatcher = {
  name: 'Levenshtein',
  search(_text: string, _patterns: string[]): MatchResult[] {
    throw new Error('levenshtein.search not implemented yet');
  },
};

export function weightedLevenshtein(_a: string, _b: string): { distance: number; comparisons: number } {
  throw new Error('weightedLevenshtein not implemented yet');
}
