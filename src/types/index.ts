export type AlgorithmName =
  | 'KMP'
  | 'BoyerMoore'
  | 'RegEx'
  | 'Levenshtein'
  | 'AhoCorasick'
  | 'RabinKarp';

export interface MatchResult {
  keyword: string;
  matchedText: string;
  algorithm: AlgorithmName;
  startIndex: number;
  endIndex: number;
  comparisonCount: number;
  isFuzzy: boolean;
  similarity?: number;
}

export interface AlgorithmStats {
  algorithm: AlgorithmName;
  executionTimeMs: number;
  matchCount: number;
  comparisonCount: number;
}

export interface ScanReport {
  totalMatches: number;
  matchesByKeyword: Record<string, number>;
  stats: AlgorithmStats[];
  timestamp: number;
}

export interface PatternMatcher {
  name: AlgorithmName;
  search(text: string, patterns: string[]): MatchResult[];
}
