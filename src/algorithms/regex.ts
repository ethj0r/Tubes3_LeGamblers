import type { MatchResult, PatternMatcher } from '../types';

const WORD_DIGIT_PATTERN = /\b([A-Za-z]{2,})(\d{2,})\b/gi;

export interface RegexHit {
  startIndex: number;
  endIndex: number;
  matchedText: string;
  wordPart: string;
  digitPart: string;
  comparisonsSoFar: number;
}

export interface RegexSearchResult {
  hits: RegexHit[];
  totalComparisons: number;
}

export function regexSearchWordDigit(text: string): RegexSearchResult {
  const re = new RegExp(WORD_DIGIT_PATTERN.source, WORD_DIGIT_PATTERN.flags);
  const hits: RegexHit[] = [];
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const startIndex = match.index;
    const endIndex = startIndex + match[0].length;
    hits.push({
      startIndex,
      endIndex,
      matchedText: match[0],
      wordPart: match[1],
      digitPart: match[2],
      comparisonsSoFar: endIndex,
    });

    if (match[0].length === 0) re.lastIndex++;
  }

  return { hits, totalComparisons: text.length };
}

export const regexMatcher: PatternMatcher = {
  name: 'RegEx',
  search(text: string, _patterns: string[]): MatchResult[] {
    const { hits } = regexSearchWordDigit(text);
    return hits.map<MatchResult>((hit) => ({
      keyword: hit.matchedText,
      matchedText: hit.matchedText,
      algorithm: 'RegEx',
      startIndex: hit.startIndex,
      endIndex: hit.endIndex,
      comparisonCount: hit.comparisonsSoFar,
      isFuzzy: false,
    }));
  },
};
