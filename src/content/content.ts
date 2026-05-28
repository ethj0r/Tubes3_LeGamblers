import type { PatternMatcher } from '../types';
import { kmpMatcher } from '../algorithms/kmp';
import { collectPageText } from './domWalker';
import { highlightMatches } from './highlighter';
import { installTooltip } from './tooltip';

export interface ContentSearchOptions {
  matcher?: PatternMatcher;
  keywords: string[];
  root?: Node;
}

export function runContentSearch(options: ContentSearchOptions): void {
  const matcher = options.matcher ?? kmpMatcher;
  const { fullText, records } = collectPageText(options.root);

  const start = performance.now();
  const matches = matcher.search(fullText, options.keywords);
  const executionTimeMs = performance.now() - start;

  if (matches.length === 0) return;

  highlightMatches(matches, records);

  const keywords = Array.from(new Set(matches.map((m) => m.keyword)));
  const comparisons = matches.reduce((s, m) => s + m.comparisonCount, 0);
  installTooltip({
    algorithm: matcher.name,
    keywords,
    appearances: matches.length,
    comparisons,
    executionTimeMs,
  });
}

export function initContentSearch(options: ContentSearchOptions): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => runContentSearch(options), { once: true });
  } else {
    runContentSearch(options);
  }
}
