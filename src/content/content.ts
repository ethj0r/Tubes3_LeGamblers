import type { MatchResult, ScanReport } from '../types';
import { loadKeywords } from '../algorithms/keywordLoader';
import { scanText } from '../algorithms/matcherOrchestrator';
import { collectPageText } from './domWalker';
import { highlightMatches, HIGHLIGHT_ATTR } from './highlighter';
import { censorMatches, CENSOR_ATTR } from './censorship';
import { installTooltip } from './tooltip';
import { collectImageText, type OcrRecord } from './ocr';
import { flagMatchedImages, IMAGE_FLAG_ATTR, clearImageFlags } from './imageOverlay';

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

const RESCAN_DEBOUNCE_MS = 600;
let rescanTimer: number | null = null;
let mutationObserver: MutationObserver | null = null;

function scheduleRescan(): void {
  if (rescanTimer != null) window.clearTimeout(rescanTimer);
  rescanTimer = window.setTimeout(() => {
    rescanTimer = null;
    void performScan();
  }, RESCAN_DEBOUNCE_MS);
}

function isOurInjection(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const el = node as Element;
  if (el.id === 'legamblers-tooltip') return true;
  return el.hasAttribute(HIGHLIGHT_ATTR) || el.hasAttribute(CENSOR_ATTR) || el.hasAttribute(IMAGE_FLAG_ATTR);
}

function hasMeaningfulAddition(mutations: MutationRecord[]): boolean {
  for (const m of mutations) {
    if (m.type !== 'childList') continue;
    for (const node of Array.from(m.addedNodes)) {
      if (isOurInjection(node)) continue;
      const parent = node.parentElement;
      if (parent && (parent.closest(`[${HIGHLIGHT_ATTR}],[${CENSOR_ATTR}],[${IMAGE_FLAG_ATTR}]`))) continue;
      const text = node.textContent?.trim();
      if (text && text.length >= 4) return true;
    }
  }
  return false;
}

function startAutoRescan(): void {
  if (mutationObserver) return;
  mutationObserver = new MutationObserver((mutations) => {
    if (isScanning) return;
    if (!hasMeaningfulAddition(mutations)) return;
    scheduleRescan();
  });
  mutationObserver.observe(document.body, { childList: true, subtree: true });
}

function pauseAutoRescan(): void {
  mutationObserver?.disconnect();
}

function resumeAutoRescan(): void {
  if (!mutationObserver) return;
  mutationObserver.observe(document.body, { childList: true, subtree: true });
}

function unwrapAll(selector: string): void {
  for (const el of Array.from(document.querySelectorAll(selector))) {
    const parent = el.parentNode;
    if (!parent) continue;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
    parent.normalize();
  }
}

function clearVisuals(): void {
  unwrapAll(`[${HIGHLIGHT_ATTR}]`);
  unwrapAll(`[${CENSOR_ATTR}]`);
  clearImageFlags();
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
  installTooltip(report);
}

// Scans a single image's OCR text the moment it's recognized and blurs that image right away
async function flagImageEagerly(
  image: HTMLImageElement,
  text: string,
  keywords: string[],
): Promise<void> {
  const { matches } = await scanText(text, keywords);
  if (matches.length === 0) return;
  const record: OcrRecord = { image, text, start: 0, end: text.length };
  flagMatchedImages(matches, [record]);
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
  
  // Install the tooltip for text matches immediately. 
  // Counts are refreshed at the end once OCR results are in.
  renderTooltip(initial.report);

  let finalReport = initial.report;

  if (enableOcr) {
    const baseOffset = fullText.length + 1;
    const ocr = await collectImageText({
      baseOffset,
      root: options.root,
      lang: options.ocrLang,
      concurrency: options.ocrConcurrency,
      minSize: options.ocrMinSize,
      verbose: true,
      onImageText: (image, text) => void flagImageEagerly(image, text, options.keywords),
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
  pauseAutoRescan();
  try {
    const report = await runContentSearch({ keywords: cachedKeywords });
    currentReport = report;
    await persistReport(report);
    return report;
  } finally {
    isScanning = false;
    window.setTimeout(resumeAutoRescan, 150);
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

  const bootScan = () => {
    void performScan().then(() => startAutoRescan());
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootScan, { once: true });
  } else {
    bootScan();
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
