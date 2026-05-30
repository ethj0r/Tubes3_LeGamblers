import type { MatchResult } from '../types';
import type { TextNodeRecord } from './domWalker';

export const HIGHLIGHT_ATTR = 'data-legamblers-highlight';
const CLASS = 'legamblers-highlight';
const STYLE_ID = 'legamblers-highlight-styles';

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `.${CLASS}{background:#fff176;border-radius:2px;padding:0 1px}`;
  document.head.appendChild(style);
}

export function highlightMatches(matches: MatchResult[], records: TextNodeRecord[]): HTMLElement[] {
  if (matches.length === 0) return [];
  injectStyles();

  const byRecord = new Map<TextNodeRecord, Array<{ start: number; end: number; match: MatchResult }>>();
  for (const m of matches) {
    for (const r of records) {
      if (r.end <= m.startIndex || r.start >= m.endIndex) continue;
      const s = Math.max(0, m.startIndex - r.start);
      const e = Math.min(r.end - r.start, m.endIndex - r.start);
      if (s >= e) continue;
      const list = byRecord.get(r) ?? [];
      list.push({ start: s, end: e, match: m });
      byRecord.set(r, list);
    }
  }

  const created: HTMLElement[] = [];
  for (const [record, ranges] of byRecord) {
    ranges.sort((a, b) => b.start - a.start);
    for (const range of ranges) {
      const el = wrap(record.node, range.start, range.end, range.match);
      if (el) created.push(el);
    }
  }
  return created;
}

function wrap(textNode: Text, start: number, end: number, match: MatchResult): HTMLElement | null {
  const parent = textNode.parentNode;
  if (!parent) return null;
  const value = textNode.nodeValue ?? '';

  const mark = document.createElement('mark');
  mark.className = CLASS;
  mark.setAttribute(HIGHLIGHT_ATTR, match.keyword);
  mark.setAttribute('data-algorithm', match.algorithm);
  mark.setAttribute('data-legamblers-source', 'dom');
  if (match.isFuzzy && typeof match.similarity === 'number') {
    mark.setAttribute('data-similarity', match.similarity.toFixed(3));
  }
  mark.textContent = value.slice(start, end);

  textNode.nodeValue = value.slice(0, start);
  const after = document.createTextNode(value.slice(end));
  parent.insertBefore(mark, textNode.nextSibling);
  parent.insertBefore(after, mark.nextSibling);
  return mark;
}
