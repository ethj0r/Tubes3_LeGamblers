import type { MatchResult } from '../types';
import type { OcrRecord } from './ocr';

export const IMAGE_FLAG_ATTR = 'data-legamblers-image-flag';
const IMG_CLASS = 'legamblers-image-flag';
const BADGE_CLASS = 'legamblers-image-badge';
const BADGE_ATTR = 'data-legamblers-image-badge';
const STYLE_ID = 'legamblers-image-flag-styles';

const CSS = `
img.${IMG_CLASS} {
  outline: 3px solid #dc2626 !important;
  outline-offset: 2px !important;
  filter: blur(8px) !important;
  transition: filter 180ms ease !important;
  cursor: pointer !important;
}
img.${IMG_CLASS}:hover {
  filter: blur(0) !important;
}
.${BADGE_CLASS} {
  position: fixed;
  background: #dc2626;
  color: #fff;
  font: 600 11px/1 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  padding: 3px 6px;
  border-radius: 3px;
  pointer-events: none;
  z-index: 2147483646;
  letter-spacing: 0.02em;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}
`;

const registry = new Map<HTMLImageElement, HTMLElement>();
let scrollHandlerAttached = false;
let resizeObserver: ResizeObserver | null = null;
let rafPending = false;

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function positionBadge(img: HTMLImageElement, badge: HTMLElement): void {
  const rect = img.getBoundingClientRect();
  if (
    rect.width === 0 ||
    rect.height === 0 ||
    rect.bottom < 0 ||
    rect.top > window.innerHeight ||
    rect.right < 0 ||
    rect.left > window.innerWidth
  ) {
    badge.style.display = 'none';
    return;
  }
  badge.style.display = '';
  badge.style.top = `${rect.top + 4}px`;
  badge.style.left = `${rect.left + 4}px`;
}

function repositionAll(): void {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    for (const [img, badge] of registry) {
      if (!img.isConnected) {
        badge.remove();
        registry.delete(img);
        resizeObserver?.unobserve(img);
        continue;
      }
      positionBadge(img, badge);
    }
  });
}

function ensureGlobalListeners(): void {
  if (scrollHandlerAttached) return;
  scrollHandlerAttached = true;
  window.addEventListener('scroll', repositionAll, { capture: true, passive: true });
  window.addEventListener('resize', repositionAll, { passive: true });
  resizeObserver = new ResizeObserver(repositionAll);
}

export function flagMatchedImages(matches: MatchResult[], records: OcrRecord[]): HTMLImageElement[] {
  if (matches.length === 0 || records.length === 0) return [];
  injectStyles();
  ensureGlobalListeners();

  const byImage = new Map<HTMLImageElement, MatchResult[]>();
  for (const m of matches) {
    for (const r of records) {
      if (r.end <= m.startIndex || r.start >= m.endIndex) continue;
      const list = byImage.get(r.image) ?? [];
      list.push(m);
      byImage.set(r.image, list);
    }
  }

  const flagged: HTMLImageElement[] = [];
  for (const [img, ms] of byImage) {
    if (flagImage(img, ms)) flagged.push(img);
  }
  return flagged;
}

function flagImage(img: HTMLImageElement, matches: MatchResult[]): boolean {
  if (img.classList.contains(IMG_CLASS)) return false;

  const keywords = Array.from(new Set(matches.map((m) => m.keyword)));

  img.classList.add(IMG_CLASS);
  img.setAttribute(IMAGE_FLAG_ATTR, keywords.join(','));
  img.setAttribute('data-algorithm', matches[0].algorithm);
  img.title = `Konten judi terdeteksi pada gambar: ${keywords.join(', ')}`;

  const badge = document.createElement('div');
  badge.className = BADGE_CLASS;
  badge.setAttribute(BADGE_ATTR, '');
  badge.textContent = `judol · ${matches.length}`;
  document.body.appendChild(badge);

  positionBadge(img, badge);
  registry.set(img, badge);
  resizeObserver?.observe(img);

  return true;
}

export function clearImageFlags(): void {
  for (const [img, badge] of registry) {
    img.classList.remove(IMG_CLASS);
    img.removeAttribute(IMAGE_FLAG_ATTR);
    img.removeAttribute('data-algorithm');
    img.removeAttribute('title');
    badge.remove();
    resizeObserver?.unobserve(img);
  }
  registry.clear();

  for (const stray of Array.from(document.querySelectorAll(`img.${IMG_CLASS}`))) {
    stray.classList.remove(IMG_CLASS);
    stray.removeAttribute(IMAGE_FLAG_ATTR);
    stray.removeAttribute('data-algorithm');
    stray.removeAttribute('title');
  }
  for (const badge of Array.from(document.querySelectorAll(`[${BADGE_ATTR}]`))) {
    badge.remove();
  }
}
