import type { MatchResult } from '../types';
import type { TextNodeRecord } from './domWalker';

export const CENSOR_ATTR = 'data-legamblers-censor';
const CLASS = 'legamblers-censor';
const STYLE_ID = 'legamblers-censor-styles';

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .${CLASS}{filter:blur(5px);background:#fde68a;border-radius:2px;padding:0 1px;transition:filter 150ms;cursor:pointer}
    .${CLASS}:hover{filter:blur(0)}
  `;
  document.head.appendChild(style);
}

export function censorMatches(matches: MatchResult[], records: TextNodeRecord[]): HTMLElement[] {
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

  const span = document.createElement('span');
  span.className = CLASS;
  span.setAttribute(CENSOR_ATTR, match.keyword);
  span.setAttribute('data-algorithm', match.algorithm);
  span.setAttribute('data-legamblers-source', 'dom');
  if (match.isFuzzy && typeof match.similarity === 'number') {
    span.setAttribute('data-similarity', match.similarity.toFixed(3));
  }
  span.textContent = value.slice(start, end);

  textNode.nodeValue = value.slice(0, start);
  const after = document.createTextNode(value.slice(end));
  parent.insertBefore(span, textNode.nextSibling);
  parent.insertBefore(after, span.nextSibling);
  return span;
}
