import type { MatchResult, PatternMatcher } from '../types';

interface AhoNode {
    children: Map<string, number>;
    fail: number;
    output: string[];
}

interface AhoHit {
    keyword: string;
    startIndex: number;
    endIndex: number;
    comparisons: number;
}

function createNode(): AhoNode {
    return { children: new Map(), fail: 0, output: [] };
}

// buat trie dari semua pattern
function buildTrie(patterns: string[]): AhoNode[] {
    const nodes: AhoNode[] = [createNode()];

    for (const rawPattern of patterns) {
        const pattern = rawPattern.trim().toLowerCase();
        if (!pattern) continue;

        let state = 0;
        for (const ch of pattern) {
        const next = nodes[state].children.get(ch);
        if (next !== undefined) {
            state = next;
            continue;
        }

        nodes[state].children.set(ch, nodes.length);
        nodes.push(createNode());
        state = nodes.length - 1;
        }

        nodes[state].output.push(pattern);
    }

    return nodes;
}

// hitung failure link tiap node dengan BFS
function buildFailureLinks(nodes: AhoNode[]): void {
    const queue: number[] = [];

    for (const [, childIndex] of nodes[0].children) {
        nodes[childIndex].fail = 0;
        queue.push(childIndex);
    }

    while (queue.length > 0) {
        const state = queue.shift()!;

        for (const [ch, childIndex] of nodes[state].children) {
        let failState = nodes[state].fail;
        while (failState !== 0 && !nodes[failState].children.has(ch)) {
            failState = nodes[failState].fail;
        }

        const nextFail = nodes[failState].children.get(ch) ?? 0;
        nodes[childIndex].fail = nextFail === childIndex ? 0 : nextFail;

        // output diwarisi dari failure node 
        nodes[childIndex].output.push(...nodes[nodes[childIndex].fail].output);
        queue.push(childIndex);
        }
    }
}

// scan text sekali, lalu pindah state dengan failure link saat mismatch
function search(text: string, nodes: AhoNode[]): AhoHit[] {
    const results: AhoHit[] = [];
    const lowerText = text.toLowerCase();

    let state = 0;
    let comparisons = 0;

    for (let i = 0; i < lowerText.length; i++) {
        const ch = lowerText[i];
        comparisons++;

        while (state !== 0 && !nodes[state].children.has(ch)) {
        state = nodes[state].fail;
        comparisons++;
        }

        const next = nodes[state].children.get(ch);
        state = next ?? 0;

        if (nodes[state].output.length === 0) continue;

        for (const keyword of nodes[state].output) {
        const endIndex = i + 1;
        const startIndex = endIndex - keyword.length;
        results.push({ keyword, startIndex, endIndex, comparisons });
        }
    }

    return results;
}

export function ahoCorasickSearch(text: string, patterns: string[]): AhoHit[] {
    if (text.length === 0 || patterns.length === 0) return [];

    const trie = buildTrie(patterns);
    buildFailureLinks(trie);
    return search(text, trie);
}

export const ahoCorasickMatcher: PatternMatcher = {
    name: 'AhoCorasick',
    search(text: string, patterns: string[]): MatchResult[] {
        const hits = ahoCorasickSearch(text, patterns);
        return hits.map((hit) => ({
        keyword: hit.keyword,
        matchedText: text.slice(hit.startIndex, hit.endIndex),
        algorithm: 'AhoCorasick',
        startIndex: hit.startIndex,
        endIndex: hit.endIndex,
        comparisonCount: hit.comparisons,
        isFuzzy: false,
        }));
    },
};
