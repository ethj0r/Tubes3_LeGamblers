import type { MatchResult } from '../types';
import type { OcrRecord } from './ocr';

export const IMAGE_FLAG_ATTR = 'data-legamblers-image-flag';
const WRAP_CLASS = 'legamblers-image-wrap';
const IMG_CLASS = 'legamblers-image-blur';
const BADGE_CLASS = 'legamblers-image-badge';
const STYLE_ID = 'legamblers-image-flag-styles';

const CSS = `
.${WRAP_CLASS}{position:relative;display:inline-block;outline:3px solid #dc2626;outline-offset:2px;border-radius:2px}
.${IMG_CLASS}{filter:blur(8px);transition:filter 180ms;cursor:pointer}
.${WRAP_CLASS}:hover .${IMG_CLASS}{filter:blur(0)}
.${BADGE_CLASS}{position:absolute;top:4px;left:4px;background:#dc2626;color:#fff;font:600 11px/1 system-ui,-apple-system,sans-serif;padding:3px 6px;border-radius:3px;pointer-events:none;z-index:2;letter-spacing:.02em}
`;

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

export function flagMatchedImages(matches: MatchResult[], records: OcrRecord[]): HTMLElement[] {
  if (matches.length === 0 || records.length === 0) return [];
  injectStyles();

  const byImage = new Map<HTMLImageElement, MatchResult[]>();
  for (const m of matches) {
    for (const r of records) {
      if (r.end <= m.startIndex || r.start >= m.endIndex) continue;
      const list = byImage.get(r.image) ?? [];
      list.push(m);
      byImage.set(r.image, list);
    }
  }

  const created: HTMLElement[] = [];
  for (const [img, ms] of byImage) {
    const el = wrapImage(img, ms);
    if (el) created.push(el);
  }
  return created;
}

function wrapImage(img: HTMLImageElement, matches: MatchResult[]): HTMLElement | null {
  if (img.closest(`.${WRAP_CLASS}`)) return null;
  const parent = img.parentNode;
  if (!parent) return null;

  const keywords = Array.from(new Set(matches.map((m) => m.keyword)));

  const wrap = document.createElement('span');
  wrap.className = WRAP_CLASS;
  wrap.setAttribute(IMAGE_FLAG_ATTR, keywords.join(','));
  wrap.setAttribute('data-algorithm', matches[0].algorithm);
  wrap.title = `Konten judi terdeteksi pada gambar: ${keywords.join(', ')}`;

  parent.insertBefore(wrap, img);
  img.classList.add(IMG_CLASS);
  wrap.appendChild(img);

  const badge = document.createElement('span');
  badge.className = BADGE_CLASS;
  badge.textContent = `judol · ${matches.length}`;
  wrap.appendChild(badge);

  return wrap;
}
