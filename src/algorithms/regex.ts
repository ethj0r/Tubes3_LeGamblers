import type { MatchResult, PatternMatcher } from '../types';

export const regexMatcher: PatternMatcher = {
  name: 'RegEx',
  search(_text: string, _patterns: string[]): MatchResult[] {
    throw new Error('regex.search not implemented yet');
  },
};
