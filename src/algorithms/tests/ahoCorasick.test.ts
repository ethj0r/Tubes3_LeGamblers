import { describe, expect, it } from 'vitest';
import { ahoCorasickSearch, ahoCorasickMatcher } from '../ahoCorasick';



describe('ahoCorasickSearch', () => {
  it('returns empty for empty text', () => {
    expect(ahoCorasickSearch('', ['slot', 'gacor'])).toEqual([]);
  });

  it('returns empty for empty patterns', () => {
    expect(ahoCorasickSearch('slot gacor maxwin', [])).toEqual([]);
  });

  it('finds a single keyword', () => {
    const results = ahoCorasickSearch('main slot sekarang', ['slot']);
    expect(results).toHaveLength(1);
    expect(results[0].keyword).toBe('slot');
    expect(results[0].startIndex).toBe(5);
    expect(results[0].endIndex).toBe(9);
  });

  it('finds multiple keywords in one pass', () => {
    // semua keyword ditemukan dalam 1x scan teks
    const results = ahoCorasickSearch('slot gacor maxwin', ['slot', 'gacor', 'maxwin']);
    const found = results.map((r) => r.keyword);
    expect(found).toContain('slot');
    expect(found).toContain('gacor');
    expect(found).toContain('maxwin');
    expect(results).toHaveLength(3);
  });

  it('finds overlapping/suffix patterns', () => {
    // contohnya "he" adalah suffix dari "she" jadi Aho-Corasick harus nemu keduanya di posisi yang benar
    const results = ahoCorasickSearch('she', ['he', 'she']);
    const found = results.map((r) => r.keyword);
    expect(found).toContain('she');
    expect(found).toContain('he');
  });

  it('is case-insensitive', () => {
    const results = ahoCorasickSearch('SLOT Gacor MAXWIN', ['slot', 'gacor', 'maxwin']);
    expect(results).toHaveLength(3);
  });

  it('finds keyword that appears multiple times', () => {
    const results = ahoCorasickSearch('slot slot slot', ['slot']);
    expect(results).toHaveLength(3);
  });

  it('does not find keyword that is not in text', () => {
    const results = ahoCorasickSearch('main game online', ['slot', 'gacor']);
    expect(results).toHaveLength(0);
  });

  it('startIndex and endIndex are correct', () => {
    const text = 'main gacor terus';
    const results = ahoCorasickSearch(text, ['gacor']);
    expect(results[0].startIndex).toBe(5);
    expect(results[0].endIndex).toBe(10);
    expect(text.slice(results[0].startIndex, results[0].endIndex)).toBe('gacor');
  });

  it('finds keyword embedded in longer text', () => {
    const results = ahoCorasickSearch('situsslotgacor777', ['slot', 'gacor']);
    const found = results.map((r) => r.keyword);
    expect(found).toContain('slot');
    expect(found).toContain('gacor');
  });

  it('comparisons count is positive', () => {
    const results = ahoCorasickSearch('coba slot ini', ['slot']);
    expect(results[0].comparisons).toBeGreaterThan(0);
  });

  it('handles keyword longer than text gracefully', () => {
    const results = ahoCorasickSearch('hi', ['keyword-yang-sangat-panjang']);
    expect(results).toHaveLength(0);
  });

  it('handles duplicate patterns without crashing', () => {
    const results = ahoCorasickSearch('slot gacor', ['slot', 'slot', 'gacor']);
    const found = results.map((r) => r.keyword);
    expect(found).toContain('slot');
    expect(found).toContain('gacor');
  });
});


describe('ahoCorasickMatcher', () => {
  it('has correct algorithm name', () => {
    expect(ahoCorasickMatcher.name).toBe('AhoCorasick');
  });

  it('returns MatchResult with correct shape', () => {
    const results = ahoCorasickMatcher.search('main slot gacor', ['slot', 'gacor']);
    expect(results).toHaveLength(2);

    const first = results[0];
    expect(first).toHaveProperty('keyword');
    expect(first).toHaveProperty('matchedText');
    expect(first).toHaveProperty('algorithm', 'AhoCorasick');
    expect(first).toHaveProperty('startIndex');
    expect(first).toHaveProperty('endIndex');
    expect(first).toHaveProperty('comparisonCount');
    expect(first).toHaveProperty('isFuzzy', false);
  });

  it('matchedText matches actual text (preserves original casing)', () => {
    const results = ahoCorasickMatcher.search('main SLOT sekarang', ['slot']);
    expect(results[0].keyword).toBe('slot');
    expect(results[0].matchedText).toBe('SLOT'); // dari teks asli
  });

  it('startIndex and endIndex slice correctly', () => {
    const text = 'temukan gacor disini';
    const results = ahoCorasickMatcher.search(text, ['gacor']);
    const r = results[0];
    expect(text.slice(r.startIndex, r.endIndex)).toBe('gacor');
  });

  it('returns empty array when no match', () => {
    const results = ahoCorasickMatcher.search('teks biasa tanpa judol', ['slot', 'gacor']);
    expect(results).toHaveLength(0);
  });

  it('comparisonCount is positive for every match', () => {
    const results = ahoCorasickMatcher.search('slot gacor maxwin', ['slot', 'gacor', 'maxwin']);
    for (const r of results) {
      expect(r.comparisonCount).toBeGreaterThan(0);
    }
  });
});