import type { MatchResult, PatternMatcher } from '../types';

export const kmpMatcher: PatternMatcher = {
  name: 'KMP',
  search(_text: string, _patterns: string[]): MatchResult[] {
    throw new Error('kmp.search not implemented yet');
  },
};
