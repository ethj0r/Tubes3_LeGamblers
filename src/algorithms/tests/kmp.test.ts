import { describe, expect, it } from 'vitest';
import { computeLPS, kmpMatcher, kmpSearchSingle } from '../kmp';

describe('computeLPS', () => {
  it('returns empty lps for empty pattern', () => {
    const { lps, comparisons } = computeLPS('');
    expect(lps).toEqual([]);
    expect(comparisons).toBe(0);
  });

  it('returns all zeros for single-char pattern', () => {
    expect(computeLPS('a').lps).toEqual([0]);
  });

  it('handles pattern with no proper prefix-suffix', () => {
    expect(computeLPS('abcdef').lps).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('handles repeating prefix pattern', () => {
    expect(computeLPS('aaaa').lps).toEqual([0, 1, 2, 3]);
  });

  it('computes textbook example aabaabaaa', () => {
    expect(computeLPS('aabaabaaa').lps).toEqual([0, 1, 0, 1, 2, 3, 4, 5, 2]);
  });

  it('computes abab-style pattern', () => {
    expect(computeLPS('abab').lps).toEqual([0, 0, 1, 2]);
  });

  it('counts comparisons during build', () => {
    expect(computeLPS('abab').comparisons).toBeGreaterThan(0);
  });
});

describe('kmpSearchSingle', () => {
  it('returns no hits for empty pattern', () => {
    expect(kmpSearchSingle('hello', '').hits).toEqual([]);
  });

  it('returns no hits when text shorter than pattern', () => {
    expect(kmpSearchSingle('ab', 'abcdef').hits).toEqual([]);
  });

  it('finds single match', () => {
    const { hits } = kmpSearchSingle('hello world', 'world');
    expect(hits).toHaveLength(1);
    expect(hits[0].startIndex).toBe(6);
  });

  it('finds multiple non-overlapping matches', () => {
    const { hits } = kmpSearchSingle('abab cdef abab', 'abab');
    expect(hits.map((h) => h.startIndex)).toEqual([0, 10]);
  });

  it('finds overlapping matches', () => {
    const { hits } = kmpSearchSingle('aaaa', 'aa');
    expect(hits.map((h) => h.startIndex)).toEqual([0, 1, 2]);
  });

  it('is case-insensitive by default', () => {
    const { hits } = kmpSearchSingle('Gacor99 is here', 'GACOR99');
    expect(hits).toHaveLength(1);
    expect(hits[0].startIndex).toBe(0);
  });

  it('respects case-sensitive mode when requested', () => {
    const { hits } = kmpSearchSingle('Gacor99', 'GACOR99', { caseInsensitive: false });
    expect(hits).toHaveLength(0);
  });

  it('counts comparisons monotonically across hits', () => {
    const { hits } = kmpSearchSingle('slot slot slot', 'slot');
    expect(hits).toHaveLength(3);
    expect(hits[0].comparisonsSoFar).toBeLessThan(hits[1].comparisonsSoFar);
    expect(hits[1].comparisonsSoFar).toBeLessThan(hits[2].comparisonsSoFar);
  });

  it('reports zero comparisons for no-op searches', () => {
    expect(kmpSearchSingle('', 'pattern').totalComparisons).toBe(0);
    expect(kmpSearchSingle('text', '').totalComparisons).toBe(0);
  });
});

describe('kmpMatcher.search', () => {
  it('returns empty for empty patterns list', () => {
    expect(kmpMatcher.search('any text', [])).toEqual([]);
  });

  it('skips empty patterns without throwing', () => {
    const text = 'find slot here';
    const results = kmpMatcher.search(text, ['', 'slot']);
    expect(results).toHaveLength(1);
    expect(results[0].keyword).toBe('slot');
  });

  it('preserves original-case keyword in result', () => {
    const results = kmpMatcher.search('the gacor99 site', ['GACOR99']);
    expect(results[0].keyword).toBe('GACOR99');
  });

  it('returns matchedText with original casing from input text', () => {
    const results = kmpMatcher.search('the Gacor99 site', ['gacor99']);
    expect(results[0].matchedText).toBe('Gacor99');
  });

  it('sets correct startIndex and endIndex', () => {
    const text = 'find slot here';
    const results = kmpMatcher.search(text, ['slot']);
    expect(results[0].startIndex).toBe(5);
    expect(results[0].endIndex).toBe(9);
    expect(text.slice(results[0].startIndex, results[0].endIndex)).toBe('slot');
  });

  it('marks results as non-fuzzy and stamps algorithm name', () => {
    const results = kmpMatcher.search('slot', ['slot']);
    expect(results[0].isFuzzy).toBe(false);
    expect(results[0].algorithm).toBe('KMP');
    expect(results[0].similarity).toBeUndefined();
  });

  it('handles multiple keywords in one call', () => {
    const text = 'slot machine gacor99';
    const results = kmpMatcher.search(text, ['slot', 'gacor99']);
    expect(results.map((r) => r.keyword).sort()).toEqual(['gacor99', 'slot']);
  });

  it('reports positive comparisonCount on every match', () => {
    const results = kmpMatcher.search('slot slot', ['slot']);
    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(r.comparisonCount).toBeGreaterThan(0);
    }
  });
});
