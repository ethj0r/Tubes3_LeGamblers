import type { MatchResult, PatternMatcher } from '../types';
import { kmpMatcher } from '../algorithms/kmp';
import { loadKeywords } from '../algorithms/keywordLoader';
import { collectPageText } from './domWalker';
import { highlightMatches } from './highlighter';
import { installTooltip } from './tooltip';
import { collectImageText } from './ocr';
import { flagMatchedImages } from './imageOverlay';

export interface ContentSearchOptions {
  matcher?: PatternMatcher;
  keywords: string[];
  root?: Node;
  enableOcr?: boolean;
  ocrLang?: string;
  ocrConcurrency?: number;
  ocrMinSize?: number;
}

export async function runContentSearch(options: ContentSearchOptions): Promise<void> {
  const matcher = options.matcher ?? kmpMatcher;
  const enableOcr = options.enableOcr ?? true;
  const { fullText, records } = collectPageText(options.root);

  const textStart = performance.now();
  const textMatches = matcher.search(fullText, options.keywords);
  const textElapsed = performance.now() - textStart;

  if (textMatches.length > 0) {
    highlightMatches(textMatches, records);
  }

  renderTooltip(matcher.name, textMatches, textElapsed);

  if (!enableOcr) return;

  const baseOffset = fullText.length + 1;
  const ocr = await collectImageText({
    baseOffset,
    root: options.root,
    lang: options.ocrLang,
    concurrency: options.ocrConcurrency,
    minSize: options.ocrMinSize,
  });

  if (ocr.records.length === 0) return;

  const combined = `${fullText}\n${ocr.fullText}`;
  const combinedStart = performance.now();
  const allMatches = matcher.search(combined, options.keywords);
  const combinedElapsed = performance.now() - combinedStart;

  const { ocrMatches } = partitionMatches(allMatches, fullText.length);

  if (ocrMatches.length > 0) {
    flagMatchedImages(ocrMatches, ocr.records);
  }

  renderTooltip(matcher.name, allMatches, combinedElapsed);
}

function partitionMatches(
  matches: MatchResult[],
  domLen: number,
): { textMatches: MatchResult[]; ocrMatches: MatchResult[] } {
  const textMatches: MatchResult[] = [];
  const ocrMatches: MatchResult[] = [];
  for (const m of matches) {
    if (m.endIndex <= domLen) textMatches.push(m);
    else if (m.startIndex >= domLen + 1) ocrMatches.push(m);
  }
  return { textMatches, ocrMatches };
}

function renderTooltip(algorithm: string, matches: MatchResult[], elapsedMs: number): void {
  if (matches.length === 0) return;
  const keywords = Array.from(new Set(matches.map((m) => m.keyword)));
  const comparisons = matches.reduce((s, m) => s + m.comparisonCount, 0);
  installTooltip({
    algorithm,
    keywords,
    appearances: matches.length,
    comparisons,
    executionTimeMs: elapsedMs,
  });
}

export function initContentSearch(options: ContentSearchOptions): void {
  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        void runContentSearch(options);
      },
      { once: true },
    );
  } else {
    void runContentSearch(options);
  }
}

void loadKeywords().then((keywords) => {
  if (keywords.length === 0) return;
  initContentSearch({ keywords });
});
