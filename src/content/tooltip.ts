import { HIGHLIGHT_ATTR } from './highlighter';
import { IMAGE_FLAG_ATTR } from './imageOverlay';

const TOOLTIP_ID = 'legamblers-tooltip';
const STYLE_ID = 'legamblers-tooltip-styles';

export interface TooltipData {
  algorithm: string;
  keywords: string[];
  appearances: number;
  comparisons: number;
  executionTimeMs: number;
}

const CSS = `
#${TOOLTIP_ID}{position:fixed;z-index:2147483647;min-width:320px;background:#0f172a;color:#e2e8f0;border:1px solid #1e293b;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.45);font:14px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;pointer-events:none;opacity:0;transition:opacity 120ms}
#${TOOLTIP_ID}.show{opacity:1}
#${TOOLTIP_ID} header{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid #1e293b;font-weight:600;color:#f8fafc}
#${TOOLTIP_ID} .badge{background:#2563eb;color:#fff;font-weight:700;font-size:12px;padding:4px 12px;border-radius:999px}
#${TOOLTIP_ID} .row{display:flex;justify-content:space-between;gap:16px;padding:8px 16px;border-top:1px solid rgba(30,41,59,.6)}
#${TOOLTIP_ID} .label{color:#94a3b8}
#${TOOLTIP_ID} .value{color:#f8fafc;font-weight:600}
#${TOOLTIP_ID} .keywords{color:#fbbf24;font-style:italic}
`;

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function formatDuration(ms: number): string {
  if (ms < 1) return `${Math.round(ms * 1000)} µs`;
  if (ms < 1000) return `${ms.toFixed(1)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function render(tip: HTMLElement, d: TooltipData) {
  const kw = d.keywords.join(', ') || '-';
  tip.innerHTML = `
    <header><span>Konten Judi Terdeteksi</span><span class="badge">${d.algorithm}</span></header>
    <div class="row"><span class="label">Keyword</span><span class="value keywords">"${kw}"</span></div>
    <div class="row"><span class="label">Kemunculan</span><span class="value">${d.appearances.toLocaleString()}×</span></div>
    <div class="row"><span class="label">Perbandingan</span><span class="value">${d.comparisons.toLocaleString()}</span></div>
    <div class="row"><span class="label">Waktu Eksekusi</span><span class="value">${formatDuration(d.executionTimeMs)}</span></div>
  `;
}

function position(tip: HTMLElement, target: Element) {
  const r = target.getBoundingClientRect();
  const t = tip.getBoundingClientRect();
  let top = r.bottom + 8;
  let left = r.left;
  if (top + t.height > window.innerHeight - 8) top = r.top - t.height - 8;
  if (left + t.width > window.innerWidth - 8) left = window.innerWidth - t.width - 8;
  tip.style.top = `${Math.max(8, top)}px`;
  tip.style.left = `${Math.max(8, left)}px`;
}

export function installTooltip(data: TooltipData): () => void {
  injectStyles();
  document.getElementById(TOOLTIP_ID)?.remove();
  const tip = document.createElement('div');
  tip.id = TOOLTIP_ID;
  render(tip, data);
  document.body.appendChild(tip);

  let current: Element | null = null;
  const selector = `[${HIGHLIGHT_ATTR}],[${IMAGE_FLAG_ATTR}]`;

  const onOver = (e: Event) => {
    const hit = (e.target as Element)?.closest?.(selector);
    if (!hit || hit === current) return;
    current = hit;
    tip.classList.add('show');
    position(tip, hit);
  };
  const onOut = () => {
    current = null;
    tip.classList.remove('show');
  };
  const onScroll = () => current && position(tip, current);

  document.addEventListener('mouseover', onOver);
  document.addEventListener('mouseout', onOut);
  window.addEventListener('scroll', onScroll, true);

  return () => {
    document.removeEventListener('mouseover', onOver);
    document.removeEventListener('mouseout', onOut);
    window.removeEventListener('scroll', onScroll, true);
    tip.remove();
  };
}
