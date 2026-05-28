import type { MatchResult, ScanReport } from '../types';
import { loadKeywords } from '../algorithms/keywordLoader';
import { scanText } from '../algorithms/matcherOrchestrator';
import { collectPageText } from './domWalker';
import { highlightMatches, HIGHLIGHT_ATTR } from './highlighter';
import { censorMatches, CENSOR_ATTR } from './censorship';
import { installTooltip } from './tooltip';
import { collectImageText } from './ocr';
import { flagMatchedImages, IMAGE_FLAG_ATTR } from './imageOverlay';

export interface ContentSearchOptions {
  keywords: string[];
  root?: Node;
  enableOcr?: boolean;
  censorMode?: boolean;
  ocrLang?: string;
  ocrConcurrency?: number;
  ocrMinSize?: number;
}

const PREFS_KEY = 'judolDetectorPrefs';
const REPORT_KEY = 'judolDetectorReport';

interface Prefs {
  censorMode: boolean;
  enableOcr: boolean;
}

const DEFAULT_PREFS: Prefs = { censorMode: false, enableOcr: true };

let currentReport: ScanReport | null = null;
let isScanning = false;
let cachedKeywords: string[] = [];

function unwrapAll(selector: string): void {
  for (const el of Array.from(document.querySelectorAll(selector))) {
    const parent = el.parentNode;
    if (!parent) continue;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
    parent.normalize();
  }
}

function removeImageFlags(): void {
  for (const wrap of Array.from(document.querySelectorAll(`[${IMAGE_FLAG_ATTR}]`))) {
    const img = wrap.querySelector('img');
    const parent = wrap.parentNode;
    if (!parent) continue;
    if (img) {
      img.classList.remove('legamblers-image-blur');
      parent.replaceChild(img, wrap);
    } else {
      parent.removeChild(wrap);
    }
  }
}

function clearVisuals(): void {
  unwrapAll(`[${HIGHLIGHT_ATTR}]`);
  unwrapAll(`[${CENSOR_ATTR}]`);
  removeImageFlags();
  document.getElementById('legamblers-tooltip')?.remove();
}

function partitionMatches(
  matches: MatchResult[],
  domLen: number,
): { textMatches: MatchResult[]; ocrMatches: MatchResult[] } {
  const textMatches: MatchResult[] = [];
  const ocrMatches: MatchResult[] = [];
  for (const m of matches) {
    if (m.endIndex <= domLen) textMatches.push(m);
    else if (m.startIndex >= domLen + 1) ocrMatches.push(m);
  }
  return { textMatches, ocrMatches };
}

function renderTooltip(report: ScanReport): void {
  if (report.totalMatches === 0) return;
  const keywords = Object.keys(report.matchesByKeyword);
  const totalComparisons = report.stats.reduce((s, st) => s + st.comparisonCount, 0);
  const totalTime = report.stats.reduce((s, st) => s + st.executionTimeMs, 0);
  const topAlgo = [...report.stats].sort((a, b) => b.matchCount - a.matchCount)[0];
  installTooltip({
    algorithm: topAlgo?.algorithm ?? 'KMP',
    keywords,
    appearances: report.totalMatches,
    comparisons: totalComparisons,
    executionTimeMs: totalTime,
  });
}

async function persistReport(report: ScanReport): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  await chrome.storage.local.set({ [REPORT_KEY]: report });
}

async function loadPrefs(): Promise<Prefs> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return DEFAULT_PREFS;
  const stored = await chrome.storage.local.get(PREFS_KEY);
  return { ...DEFAULT_PREFS, ...(stored[PREFS_KEY] ?? {}) };
}

export async function runContentSearch(options: ContentSearchOptions): Promise<ScanReport> {
  clearVisuals();

  const prefs = await loadPrefs();
  const censorMode = options.censorMode ?? prefs.censorMode;
  const enableOcr = options.enableOcr ?? prefs.enableOcr;

  const { fullText, records } = collectPageText(options.root);

  const initial = await scanText(fullText, options.keywords);
  const apply = censorMode ? censorMatches : highlightMatches;
  if (initial.matches.length > 0) {
    apply(initial.matches, records);
  }

  let finalReport = initial.report;

  if (enableOcr) {
    const baseOffset = fullText.length + 1;
    const ocr = await collectImageText({
      baseOffset,
      root: options.root,
      lang: options.ocrLang,
      concurrency: options.ocrConcurrency,
      minSize: options.ocrMinSize,
    });

    if (ocr.records.length > 0) {
      const combined = `${fullText}\n${ocr.fullText}`;
      const combinedScan = await scanText(combined, options.keywords);
      const { ocrMatches } = partitionMatches(combinedScan.matches, fullText.length);

      if (ocrMatches.length > 0) {
        flagMatchedImages(ocrMatches, ocr.records);
      }

      finalReport = combinedScan.report;
    }
  }

  renderTooltip(finalReport);
  return finalReport;
}

async function performScan(): Promise<ScanReport | null> {
  if (isScanning) return currentReport;
  if (cachedKeywords.length === 0) {
    cachedKeywords = await loadKeywords();
  }
  if (cachedKeywords.length === 0) return null;

  isScanning = true;
  try {
    const report = await runContentSearch({ keywords: cachedKeywords });
    currentReport = report;
    await persistReport(report);
    return report;
  } finally {
    isScanning = false;
  }
}

function bootstrap(): void {
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.type === 'getReport') {
        sendResponse({ report: currentReport, isScanning });
        return false;
      }
      if (msg?.type === 'rescan') {
        void performScan().then((report) => sendResponse({ ok: true, report }));
        return true;
      }
      return false;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => void performScan(), { once: true });
  } else {
    void performScan();
  }
}

export function initContentSearch(options: ContentSearchOptions): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => void runContentSearch(options), { once: true });
  } else {
    void runContentSearch(options);
  }
}

bootstrap();
