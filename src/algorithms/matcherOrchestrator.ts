import type { AlgorithmStats, MatchResult } from '../types';

export async function scanText(_text: string): Promise<{
  matches: MatchResult[];
  stats: AlgorithmStats[];
}> {
  throw new Error('scanText not implemented yet');
}
