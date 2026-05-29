import type { MatchResult, PatternMatcher } from '../types';

export interface LevenshteinResult {
  distance: number;
  comparisons: number;
}

export function levenshteinDistance(a: string, b: string): LevenshteinResult {
  const n = a.length;
  const m = b.length;
  let comparisons = 0;

  if (n === 0) return { distance: m, comparisons };
  if (m === 0) return { distance: n, comparisons };

  let prev = new Array<number>(m + 1);
  let curr = new Array<number>(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;

  for (let i = 1; i <= n; i++) {
    curr[0] = i;
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= m; j++) {
      comparisons++;
      const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
      const del = prev[j] + 1;
      const ins = curr[j - 1] + 1;
      const sub = prev[j - 1] + cost;
      let v = del < ins ? del : ins;
      if (sub < v) v = sub;
      curr[j] = v;
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }

  return { distance: prev[m], comparisons };
}

const LEET_CLASS: Record<string, string> = {
  '0': 'o',
  '1': 'il',
  '2': 'z',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '6': 'g',
  '7': 't',
  '8': 'b',
  '9': 'g',
  '@': 'a',
  $: 's',
  '!': 'i',
  '|': 'il',
  '+': 't',
};

function canonical(ch: string): string {
  return LEET_CLASS[ch] ?? ch;
}

// 0 when the two characters are equal or share a confusable class, else 1.
function substitutionCost(x: string, y: string): number {
  if (x === y) return 0;
  const cx = canonical(x);
  const cy = canonical(y);
  for (const c of cx) {
    if (cy.includes(c)) return 0;
  }
  return 1;
}

// Levenshtein distance where leet/homoglyph substitutions are free.
export function weightedLevenshtein(a: string, b: string): { distance: number; comparisons: number } {
  const n = a.length;
  const m = b.length;
  let comparisons = 0;

  if (n === 0) return { distance: m, comparisons };
  if (m === 0) return { distance: n, comparisons };

  let prev = new Array<number>(m + 1);
  let curr = new Array<number>(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;

  for (let i = 1; i <= n; i++) {
    curr[0] = i;
    const ai = a[i - 1];
    for (let j = 1; j <= m; j++) {
      comparisons++;
      const cost = substitutionCost(ai, b[j - 1]);
      const del = prev[j] + 1;
      const ins = curr[j - 1] + 1;
      const sub = prev[j - 1] + cost;
      let v = del < ins ? del : ins;
      if (sub < v) v = sub;
      curr[j] = v;
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }

  return { distance: prev[m], comparisons };
}

export function similarityFromDistance(a: string, b: string, distance: number): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - distance / maxLen;
}

export interface LevenshteinSearchOptions {
  threshold?: number;
  caseInsensitive?: boolean;
}

export interface LevenshteinHit {
  pattern: string;
  startIndex: number;
  endIndex: number;
  matchedText: string;
  distance: number;
  similarity: number;
  comparisons: number;
}

function tokenize(text: string): Array<{ word: string; start: number }> {
  const tokens: Array<{ word: string; start: number }> = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    // Trim leading/trailing punctuation (e.g. `gac0r.` → `gac0r`) so a phantom
    // edit doesn't sink a real hit. Internal leet symbols (g@cor) are kept.
    const lead = raw.match(/^[^\p{L}\p{N}]*/u)?.[0].length ?? 0;
    const trail = raw.match(/[^\p{L}\p{N}]*$/u)?.[0].length ?? 0;
    const core = raw.slice(lead, raw.length - trail);
    if (core.length === 0) continue;
    tokens.push({ word: core, start: m.index + lead });
  }
  return tokens;
}

export function levenshteinSearch(
  text: string,
  patterns: string[],
  options?: LevenshteinSearchOptions,
): LevenshteinHit[] {
  const threshold = options?.threshold ?? 0.7;
  const caseInsensitive = options?.caseInsensitive ?? true;
  const hits: LevenshteinHit[] = [];

  if (patterns.length === 0 || text.length === 0) return hits;

  const tokens = tokenize(text);

  for (const pattern of patterns) {
    if (pattern.length === 0) continue;
    const p = caseInsensitive ? pattern.toLowerCase() : pattern;

    for (const tok of tokens) {
      const w = caseInsensitive ? tok.word.toLowerCase() : tok.word;
      const { distance, comparisons } = weightedLevenshtein(p, w);
      const similarity = similarityFromDistance(p, w, distance);
      if (similarity >= threshold) {
        hits.push({
          pattern,
          startIndex: tok.start,
          endIndex: tok.start + tok.word.length,
          matchedText: tok.word,
          distance,
          similarity,
          comparisons,
        });
      }
    }
  }

  return hits;
}

export interface LevenshteinMatcherOptions {
  threshold?: number;
  caseInsensitive?: boolean;
}

export function createLevenshteinMatcher(options?: LevenshteinMatcherOptions): PatternMatcher {
  return {
    name: 'Levenshtein',
    search(text: string, patterns: string[]): MatchResult[] {
      const hits = levenshteinSearch(text, patterns, options);
      return hits.map((h) => ({
        keyword: h.pattern,
        matchedText: h.matchedText,
        algorithm: 'Levenshtein',
        startIndex: h.startIndex,
        endIndex: h.endIndex,
        comparisonCount: h.comparisons,
        isFuzzy: true,
        similarity: h.similarity,
      }));
    },
  };
}

export const levenshteinMatcher: PatternMatcher = createLevenshteinMatcher();
