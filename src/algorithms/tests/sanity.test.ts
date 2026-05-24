import { describe, expect, it } from 'vitest';
import { boyerMooreMatcher, kmpMatcher, levenshteinMatcher, regexMatcher } from '../index';

describe('algorithm module wiring', () => {
  it('exports matchers with correct names', () => {
    expect(kmpMatcher.name).toBe('KMP');
    expect(boyerMooreMatcher.name).toBe('BoyerMoore');
    expect(regexMatcher.name).toBe('RegEx');
    expect(levenshteinMatcher.name).toBe('Levenshtein');
  });
});
