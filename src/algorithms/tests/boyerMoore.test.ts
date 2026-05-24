import { describe, expect, it } from 'vitest';
import { boyerMooreMatcher, boyerMooreSearchSingle, computeLastOccurrence } from '../boyerMoore';
import { kmpSearchSingle } from '../kmp';

describe('computeLastOccurrence', () => {
  it('returns empty map for empty pattern', () => {
    expect(computeLastOccurrence('').size).toBe(0);
  });

  it('stores rightmost index of each character', () => {
    const table = computeLastOccurrence('abcab');
    expect(table.get('a'.charCodeAt(0))).toBe(3);
    expect(table.get('b'.charCodeAt(0))).toBe(4);
    expect(table.get('c'.charCodeAt(0))).toBe(2);
  });

  it('collapses repeated characters to last position', () => {
    expect(computeLastOccurrence('aaaa').get('a'.charCodeAt(0))).toBe(3);
  });

  it('treats upper and lower case as distinct', () => {
    const table = computeLastOccurrence('Aa');
    expect(table.get('A'.charCodeAt(0))).toBe(0);
    expect(table.get('a'.charCodeAt(0))).toBe(1);
  });
});

describe('boyerMooreSearchSingle', () => {
  it('returns no hits for empty pattern', () => {
    expect(boyerMooreSearchSingle('hello', '').hits).toEqual([]);
  });

  it('returns no hits when text shorter than pattern', () => {
    expect(boyerMooreSearchSingle('ab', 'abcdef').hits).toEqual([]);
  });

  it('finds single match', () => {
    const { hits } = boyerMooreSearchSingle('hello world', 'world');
    expect(hits).toHaveLength(1);
    expect(hits[0].startIndex).toBe(6);
  });

  it('finds multiple non-overlapping matches', () => {
    const { hits } = boyerMooreSearchSingle('abab cdef abab', 'abab');
    expect(hits.map((h) => h.startIndex)).toEqual([0, 10]);
  });

  it('finds overlapping matches', () => {
    const { hits } = boyerMooreSearchSingle('aaaa', 'aa');
    expect(hits.map((h) => h.startIndex)).toEqual([0, 1, 2]);
  });

  it('is case-insensitive by default', () => {
    const { hits } = boyerMooreSearchSingle('Gacor99 is here', 'GACOR99');
    expect(hits).toHaveLength(1);
    expect(hits[0].startIndex).toBe(0);
  });

  it('respects case-sensitive mode when requested', () => {
    const { hits } = boyerMooreSearchSingle('Gacor99', 'GACOR99', { caseInsensitive: false });
    expect(hits).toHaveLength(0);
  });

  it('jumps far on mismatched chars not in pattern', () => {
    const { totalComparisons } = boyerMooreSearchSingle('xxxxxxxxxxxxxxxxxxxxxxxxxxxabc', 'abc');
    expect(totalComparisons).toBeLessThan(15);
  });

  it('produces same hit positions as KMP across varied inputs', () => {
    const cases: Array<[string, string]> = [
      ['the slot machine is gacor', 'slot'],
      ['aaaaabaaaab', 'aaab'],
      ['mississippi', 'issi'],
      ['abcabcabc', 'abc'],
      ['no match here', 'xyz'],
    ];
    for (const [text, pattern] of cases) {
      const bm = boyerMooreSearchSingle(text, pattern).hits.map((h) => h.startIndex);
      const kmp = kmpSearchSingle(text, pattern).hits.map((h) => h.startIndex);
      expect(bm).toEqual(kmp);
    }
  });

  it('counts comparisons monotonically across hits', () => {
    const { hits } = boyerMooreSearchSingle('slot slot slot', 'slot');
    expect(hits).toHaveLength(3);
    expect(hits[0].comparisonsSoFar).toBeLessThan(hits[1].comparisonsSoFar);
    expect(hits[1].comparisonsSoFar).toBeLessThan(hits[2].comparisonsSoFar);
  });

  it('reports zero comparisons for no-op searches', () => {
    expect(boyerMooreSearchSingle('', 'pattern').totalComparisons).toBe(0);
    expect(boyerMooreSearchSingle('text', '').totalComparisons).toBe(0);
  });
});

describe('boyerMooreMatcher.search', () => {
  it('returns empty for empty patterns list', () => {
    expect(boyerMooreMatcher.search('any text', [])).toEqual([]);
  });

  it('skips empty patterns without throwing', () => {
    const results = boyerMooreMatcher.search('find slot here', ['', 'slot']);
    expect(results).toHaveLength(1);
    expect(results[0].keyword).toBe('slot');
  });

  it('preserves original-case keyword in result', () => {
    const results = boyerMooreMatcher.search('the gacor99 site', ['GACOR99']);
    expect(results[0].keyword).toBe('GACOR99');
  });

  it('returns matchedText with original casing from input text', () => {
    const results = boyerMooreMatcher.search('the Gacor99 site', ['gacor99']);
    expect(results[0].matchedText).toBe('Gacor99');
  });

  it('sets correct startIndex and endIndex', () => {
    const text = 'find slot here';
    const results = boyerMooreMatcher.search(text, ['slot']);
    expect(results[0].startIndex).toBe(5);
    expect(results[0].endIndex).toBe(9);
    expect(text.slice(results[0].startIndex, results[0].endIndex)).toBe('slot');
  });

  it('marks results as non-fuzzy and stamps algorithm name', () => {
    const results = boyerMooreMatcher.search('slot', ['slot']);
    expect(results[0].isFuzzy).toBe(false);
    expect(results[0].algorithm).toBe('BoyerMoore');
    expect(results[0].similarity).toBeUndefined();
  });

  it('handles multiple keywords in one call', () => {
    const text = 'slot machine gacor99';
    const results = boyerMooreMatcher.search(text, ['slot', 'gacor99']);
    expect(results.map((r) => r.keyword).sort()).toEqual(['gacor99', 'slot']);
  });

  it('reports positive comparisonCount on every match', () => {
    const results = boyerMooreMatcher.search('slot slot', ['slot']);
    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(r.comparisonCount).toBeGreaterThan(0);
    }
  });
});
