import type { MatchResult, PatternMatcher } from '../types';

export const boyerMooreMatcher: PatternMatcher = {
  name: 'BoyerMoore',
  search(_text: string, _patterns: string[]): MatchResult[] {
    throw new Error('boyerMoore.search not implemented yet');
  },
};
