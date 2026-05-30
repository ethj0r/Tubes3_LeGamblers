import { describe, expect, it } from 'vitest';
import { regexMatcher, regexSearchWordDigit } from '../regex';

describe('regexSearchWordDigit', () => {
  it('returns no hits for empty text', () => {
    expect(regexSearchWordDigit('').hits).toEqual([]);
  });

  it('finds the basic <word><digits> shape', () => {
    const { hits } = regexSearchWordDigit('visit GACOR99 now');
    expect(hits).toHaveLength(1);
    expect(hits[0].matchedText).toBe('GACOR99');
    expect(hits[0].wordPart).toBe('GACOR');
    expect(hits[0].digitPart).toBe('99');
  });

  it('finds multiple matches in one text', () => {
    const { hits } = regexSearchWordDigit('FOO99 and BAR88 and BAZ123');
    expect(hits.map((h) => h.matchedText)).toEqual(['FOO99', 'BAR88', 'BAZ123']);
  });

  it('handles 2 and 3+ digit suffixes', () => {
    expect(regexSearchWordDigit('SLOT99').hits[0].matchedText).toBe('SLOT99');
    expect(regexSearchWordDigit('MADU308').hits[0].matchedText).toBe('MADU308');
    expect(regexSearchWordDigit('ZONAWIN777').hits[0].matchedText).toBe('ZONAWIN777');
  });

  it('rejects single-digit suffix below threshold', () => {
    expect(regexSearchWordDigit('GACOR9').hits).toEqual([]);
  });

  it('rejects letters-only and digits-only', () => {
    expect(regexSearchWordDigit('GACOR').hits).toEqual([]);
    expect(regexSearchWordDigit('9999').hits).toEqual([]);
  });

  it('rejects single-letter word part below threshold', () => {
    expect(regexSearchWordDigit('A99').hits).toEqual([]);
  });

  it('rejects sequences without trailing word boundary', () => {
    expect(regexSearchWordDigit('FOO99BAR').hits).toEqual([]);
  });

  it('matches at start and end of string', () => {
    expect(regexSearchWordDigit('FOO99 trails').hits[0].startIndex).toBe(0);
    const tail = regexSearchWordDigit('leads to BAR88');
    expect(tail.hits[0].matchedText).toBe('BAR88');
  });

  it('matches when surrounded by punctuation', () => {
    const { hits } = regexSearchWordDigit('(SLOT99) and [GACOR88]!');
    expect(hits.map((h) => h.matchedText)).toEqual(['SLOT99', 'GACOR88']);
  });

  it('rejects names with space between word and digits', () => {
    expect(regexSearchWordDigit('GACOR 99').hits).toEqual([]);
  });

  it('is case-insensitive for letters', () => {
    const { hits } = regexSearchWordDigit('gacor99 Gacor99 GACOR99');
    expect(hits).toHaveLength(3);
    expect(hits.map((h) => h.matchedText)).toEqual(['gacor99', 'Gacor99', 'GACOR99']);
  });

  it('only captures Latin-letter portion when non-Latin chars split the word', () => {
    const { hits } = regexSearchWordDigit('Gαcor99');
    expect(hits).toHaveLength(1);
    expect(hits[0].matchedText).toBe('cor99');
  });

  it('reports total comparisons as text length', () => {
    const text = 'visit GACOR99 now';
    expect(regexSearchWordDigit(text).totalComparisons).toBe(text.length);
  });

  it('comparisonsSoFar grows with position of match', () => {
    const { hits } = regexSearchWordDigit('FOO99 BAR99 BAZ99');
    expect(hits[0].comparisonsSoFar).toBeLessThan(hits[1].comparisonsSoFar);
    expect(hits[1].comparisonsSoFar).toBeLessThan(hits[2].comparisonsSoFar);
  });
});

describe('regexMatcher.search', () => {
  it('ignores patterns argument (RegEx discovers, not filters)', () => {
    const text = 'find SLOT99 and GACOR88';
    const withPatterns = regexMatcher.search(text, ['UNRELATED']);
    const withoutPatterns = regexMatcher.search(text, []);
    expect(withPatterns).toEqual(withoutPatterns);
    expect(withPatterns).toHaveLength(2);
  });

  it('uses matchedText as keyword for discovered names', () => {
    const results = regexMatcher.search('grab MAXWIN88 here', []);
    expect(results[0].keyword).toBe('MAXWIN88');
    expect(results[0].matchedText).toBe('MAXWIN88');
  });

  it('sets correct startIndex and endIndex', () => {
    const text = 'find SLOT99 now';
    const results = regexMatcher.search(text, []);
    expect(text.slice(results[0].startIndex, results[0].endIndex)).toBe('SLOT99');
  });

  it('marks results as non-fuzzy and stamps algorithm name', () => {
    const results = regexMatcher.search('SLOT99', []);
    expect(results[0].isFuzzy).toBe(false);
    expect(results[0].algorithm).toBe('RegEx');
    expect(results[0].similarity).toBeUndefined();
  });

  it('reports positive comparisonCount on every match', () => {
    const results = regexMatcher.search('FOO99 BAR88', []);
    for (const r of results) {
      expect(r.comparisonCount).toBeGreaterThan(0);
    }
  });
});
