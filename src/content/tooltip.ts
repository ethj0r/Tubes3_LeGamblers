import type { ScanReport } from '../types';
import { HIGHLIGHT_ATTR } from './highlighter';
import { CENSOR_ATTR } from './censorship';
import { IMAGE_FLAG_ATTR } from './imageOverlay';

const TOOLTIP_ID = 'legamblers-tooltip';
const STYLE_ID = 'legamblers-tooltip-styles';
const SOURCE_ATTR = 'data-legamblers-source';
const OCR_EXCERPT_ATTR = 'data-legamblers-ocr-excerpt';
const SIM_ATTR = 'data-similarity';

const CSS = `
#${TOOLTIP_ID}{position:fixed;z-index:2147483647;min-width:340px;max-width:420px;background:#0f172a;color:#e2e8f0;border:1px solid #1e293b;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.45);font:13px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;pointer-events:none;opacity:0;transition:opacity 120ms}
#${TOOLTIP_ID}.show{opacity:1}
#${TOOLTIP_ID} header{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:11px 16px;border-bottom:1px solid #1e293b;font-weight:600;color:#f8fafc;font-size:13px}
#${TOOLTIP_ID} .src-pill{font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:3px 9px;border-radius:999px}
#${TOOLTIP_ID} .src-pill.dom{background:#1d4ed8;color:#dbeafe}
#${TOOLTIP_ID} .src-pill.ocr{background:#b91c1c;color:#fee2e2}
#${TOOLTIP_ID} section{padding:10px 16px;border-bottom:1px solid rgba(30,41,59,.6)}
#${TOOLTIP_ID} section:last-child{border-bottom:none}
#${TOOLTIP_ID} .row{display:flex;justify-content:space-between;gap:14px;padding:3px 0;font-size:12px}
#${TOOLTIP_ID} .label{color:#94a3b8;flex-shrink:0}
#${TOOLTIP_ID} .value{color:#f8fafc;font-weight:600;text-align:right;word-break:break-word}
#${TOOLTIP_ID} .value.algo{color:#fbbf24}
#${TOOLTIP_ID} .value.keywords{color:#fbbf24;font-style:italic}
#${TOOLTIP_ID} .ocr-block{margin-top:6px;padding:8px 10px;background:rgba(220,38,38,.08);border:1px solid rgba(220,38,38,.2);border-radius:6px;color:#fecaca;font-size:11px;line-height:1.5;font-style:italic}
#${TOOLTIP_ID} .ocr-block::before{content:"OCR · ";font-style:normal;font-weight:700;color:#f87171;letter-spacing:.04em}
#${TOOLTIP_ID} .section-title{font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#64748b;margin-bottom:6px}
#${TOOLTIP_ID} .sim-badge{display:inline-block;margin-left:6px;padding:1px 6px;font-size:10px;font-weight:700;background:rgba(251,191,36,.18);color:#fbbf24;border-radius:4px}
`;

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}

function formatDuration(ms: number): string {
  if (ms < 1) return `${Math.round(ms * 1000)} µs`;
  if (ms < 1000) return `${ms.toFixed(2)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function extractKeywords(target: Element): string[] {
  if (target.hasAttribute(IMAGE_FLAG_ATTR)) {
    return (target.getAttribute(IMAGE_FLAG_ATTR) ?? '').split(',').filter(Boolean);
  }
  if (target.hasAttribute(HIGHLIGHT_ATTR)) {
    const k = target.getAttribute(HIGHLIGHT_ATTR);
    return k ? [k] : [];
  }
  if (target.hasAttribute(CENSOR_ATTR)) {
    const k = target.getAttribute(CENSOR_ATTR);
    return k ? [k] : [];
  }
  return [];
}

function renderElementSection(target: Element): string {
  const source = target.getAttribute(SOURCE_ATTR) ?? 'dom';
  const algo = target.getAttribute('data-algorithm') ?? '—';
  const keywords = extractKeywords(target);
  const sim = target.getAttribute(SIM_ATTR);
  const ocrExcerpt = target.getAttribute(OCR_EXCERPT_ATTR);

  const srcLabel = source === 'ocr' ? 'OCR · Gambar' : 'Teks Halaman';
  const srcClass = source === 'ocr' ? 'ocr' : 'dom';
  const simBadge =
    sim && !Number.isNaN(parseFloat(sim))
      ? ` <span class="sim-badge">≈ ${(parseFloat(sim) * 100).toFixed(0)}%</span>`
      : '';

  const algoFormatted = esc(algo).split(',').join(', ');
  const kwFormatted = keywords.map((k) => `"${esc(k)}"`).join(', ') || '—';

  return `
    <header>
      <span>Konten Judi Terdeteksi</span>
      <span class="src-pill ${srcClass}">${esc(srcLabel)}</span>
    </header>
    <section>
      <div class="section-title">Detail Deteksi</div>
      <div class="row"><span class="label">Keyword</span><span class="value keywords">${kwFormatted}</span></div>
      <div class="row"><span class="label">Algoritma</span><span class="value algo">${algoFormatted}${simBadge}</span></div>
      ${ocrExcerpt ? `<div class="ocr-block">${esc(ocrExcerpt)}…</div>` : ''}
    </section>
  `;
}

function renderSummarySection(report: ScanReport): string {
  const totalCmp = report.stats.reduce((s, st) => s + st.comparisonCount, 0);
  const totalTime = report.stats.reduce((s, st) => s + st.executionTimeMs, 0);
  const uniqueKw = Object.keys(report.matchesByKeyword).length;
  return `
    <section>
      <div class="section-title">Statistik Halaman</div>
      <div class="row"><span class="label">Total kemunculan</span><span class="value">${report.totalMatches.toLocaleString('id-ID')}×</span></div>
      <div class="row"><span class="label">Keyword unik</span><span class="value">${uniqueKw}</span></div>
      <div class="row"><span class="label">Total perbandingan</span><span class="value">${totalCmp.toLocaleString('id-ID')}</span></div>
      <div class="row"><span class="label">Total waktu</span><span class="value">${formatDuration(totalTime)}</span></div>
    </section>
  `;
}

function position(tip: HTMLElement, target: Element): void {
  const r = target.getBoundingClientRect();
  const t = tip.getBoundingClientRect();
  let top = r.bottom + 8;
  let left = r.left;
  if (top + t.height > window.innerHeight - 8) top = r.top - t.height - 8;
  if (left + t.width > window.innerWidth - 8) left = window.innerWidth - t.width - 8;
  tip.style.top = `${Math.max(8, top)}px`;
  tip.style.left = `${Math.max(8, left)}px`;
}

let installed = false;
let currentReport: ScanReport | null = null;
let currentTarget: Element | null = null;
let detach: (() => void) | null = null;

const SELECTOR = `[${HIGHLIGHT_ATTR}],[${CENSOR_ATTR}],[${IMAGE_FLAG_ATTR}]`;

function ensureInstalled(): HTMLElement {
  let tip = document.getElementById(TOOLTIP_ID);
  if (tip) return tip;
  injectStyles();
  tip = document.createElement('div');
  tip.id = TOOLTIP_ID;
  document.body.appendChild(tip);
  return tip;
}

function updateForTarget(target: Element): void {
  if (!currentReport) return;
  const tip = ensureInstalled();
  tip.innerHTML = renderElementSection(target) + renderSummarySection(currentReport);
  tip.classList.add('show');
  position(tip, target);
}

function attachListeners(): void {
  if (installed) return;
  installed = true;

  const onOver = (e: Event): void => {
    const hit = (e.target as Element)?.closest?.(SELECTOR);
    if (!hit || hit === currentTarget) return;
    currentTarget = hit;
    updateForTarget(hit);
  };
  const onOut = (e: Event): void => {
    const related = (e as MouseEvent).relatedTarget as Element | null;
    if (related?.closest?.(SELECTOR) === currentTarget) return;
    currentTarget = null;
    document.getElementById(TOOLTIP_ID)?.classList.remove('show');
  };
  const onScroll = (): void => {
    if (currentTarget) {
      const tip = document.getElementById(TOOLTIP_ID);
      if (tip) position(tip, currentTarget);
    }
  };

  document.addEventListener('mouseover', onOver);
  document.addEventListener('mouseout', onOut);
  window.addEventListener('scroll', onScroll, true);

  detach = () => {
    document.removeEventListener('mouseover', onOver);
    document.removeEventListener('mouseout', onOut);
    window.removeEventListener('scroll', onScroll, true);
    document.getElementById(TOOLTIP_ID)?.remove();
    installed = false;
    detach = null;
  };
}

export function installTooltip(report: ScanReport): () => void {
  currentReport = report;
  ensureInstalled();
  attachListeners();
  return () => {
    currentReport = null;
    detach?.();
  };
}
