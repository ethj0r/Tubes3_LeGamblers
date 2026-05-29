import { describe, expect, it } from 'vitest';
import {
  createLevenshteinMatcher,
  levenshteinDistance,
  levenshteinMatcher,
  levenshteinSearch,
} from '../levenshtein';

describe('levenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('slot', 'slot').distance).toBe(0);
  });

  it('returns length of b when a is empty', () => {
    expect(levenshteinDistance('', 'abc').distance).toBe(3);
  });

  it('returns length of a when b is empty', () => {
    expect(levenshteinDistance('abc', '').distance).toBe(3);
  });

  it('computes textbook kitten/sitting = 3', () => {
    expect(levenshteinDistance('kitten', 'sitting').distance).toBe(3);
  });

  it('computes single substitution', () => {
    expect(levenshteinDistance('cat', 'bat').distance).toBe(1);
  });

  it('computes single insertion/deletion', () => {
    expect(levenshteinDistance('cat', 'cats').distance).toBe(1);
    expect(levenshteinDistance('cats', 'cat').distance).toBe(1);
  });

  it('counts comparisons proportional to product of lengths', () => {
    const { comparisons } = levenshteinDistance('abcd', 'abcd');
    expect(comparisons).toBe(16);
  });
});

describe('levenshteinSearch', () => {
  it('returns empty when no patterns', () => {
    expect(levenshteinSearch('any text', [])).toEqual([]);
  });

  it('finds exact match with similarity 1', () => {
    const hits = levenshteinSearch('the slot machine', ['slot'], { threshold: 0.5 });
    expect(hits).toHaveLength(1);
    expect(hits[0].similarity).toBe(1);
    expect(hits[0].distance).toBe(0);
    expect(hits[0].startIndex).toBe(4);
    expect(hits[0].endIndex).toBe(8);
  });

  it('finds fuzzy match above threshold', () => {
    const hits = levenshteinSearch('the slott machine', ['slot'], { threshold: 0.7 });
    expect(hits).toHaveLength(1);
    expect(hits[0].matchedText).toBe('slott');
    expect(hits[0].distance).toBe(1);
  });

  it('excludes matches below threshold', () => {
    const hits = levenshteinSearch('xyzqr abcde', ['slot'], { threshold: 0.7 });
    expect(hits).toHaveLength(0);
  });

  it('is case-insensitive by default', () => {
    const hits = levenshteinSearch('GACOR99 here', ['gacor99'], { threshold: 0.9 });
    expect(hits).toHaveLength(1);
    expect(hits[0].matchedText).toBe('GACOR99');
  });

  it('respects case-sensitive mode when requested', () => {
    const hits = levenshteinSearch('GACOR99', ['gacor99'], {
      threshold: 0.99,
      caseInsensitive: false,
    });
    expect(hits).toHaveLength(0);
  });

  it('default threshold is 0.7', () => {
    const hits = levenshteinSearch('slot', ['slat']);
    expect(hits).toHaveLength(1);
  });

  it('skips empty patterns', () => {
    const hits = levenshteinSearch('slot here', ['', 'slot']);
    expect(hits).toHaveLength(1);
    expect(hits[0].pattern).toBe('slot');
  });
});

describe('levenshteinMatcher.search', () => {
  it('marks results as fuzzy and stamps algorithm name', () => {
    const results = levenshteinMatcher.search('slot', ['slot']);
    expect(results[0].isFuzzy).toBe(true);
    expect(results[0].algorithm).toBe('Levenshtein');
    expect(results[0].similarity).toBe(1);
  });

  it('preserves original-case keyword and matchedText', () => {
    const results = levenshteinMatcher.search('the Gacor99 site', ['GACOR99']);
    expect(results[0].keyword).toBe('GACOR99');
    expect(results[0].matchedText).toBe('Gacor99');
  });

  it('honors threshold from factory', () => {
    const strict = createLevenshteinMatcher({ threshold: 0.99 });
    expect(strict.search('the slott site', ['slot'])).toHaveLength(0);

    const loose = createLevenshteinMatcher({ threshold: 0.5 });
    expect(loose.search('the slott site', ['slot']).length).toBeGreaterThan(0);
  });
});
