import Tesseract, { createWorker } from 'tesseract.js';
import type { Worker } from 'tesseract.js';

export interface OcrRecord {
  image: HTMLImageElement;
  text: string;
  start: number;
  end: number;
}

export interface OcrResult {
  fullText: string;
  records: OcrRecord[];
  scanned: number;
  failed: number;
}

export interface OcrOptions {
  baseOffset?: number;
  root?: Node;
  lang?: string;
  concurrency?: number;
  minSize?: number;
  verbose?: boolean;
}

const DEFAULT_MIN_SIZE = 64;
const DEFAULT_LANG = 'eng+ind';
const LANG_CDN = 'https://tessdata.projectnaptha.com/4.0.0_best';
const LOG_PREFIX = '[judol-ocr]';

function log(verbose: boolean, ...args: unknown[]): void {
  if (verbose) console.log(LOG_PREFIX, ...args);
}

function warn(...args: unknown[]): void {
  console.warn(LOG_PREFIX, ...args);
}

function getExtensionUrl(path: string): string | null {
  if (typeof chrome === 'undefined' || !chrome.runtime?.getURL) return null;
  try {
    return chrome.runtime.getURL(path);
  } catch {
    return null;
  }
}

let workerPromise: Promise<Worker> | null = null;
let activeLang = '';
let forcedCoreFile: string | null = null;

const KNOWN_BAD_VARIANTS: Record<string, string> = {
  DotProductSSE: 'tesseract/core/tesseract-core-simd-lstm.wasm.js',
};

function pickFallbackVariant(err: string): string | null {
  for (const [marker, target] of Object.entries(KNOWN_BAD_VARIANTS)) {
    if (err.includes(marker)) return target;
  }
  if (err.includes('Aborted(missing function') || err.includes('RuntimeError')) {
    return 'tesseract/core/tesseract-core-simd-lstm.wasm.js';
  }
  return null;
}

async function destroyWorker(): Promise<void> {
  if (!workerPromise) return;
  const prev = workerPromise;
  workerPromise = null;
  activeLang = '';
  try {
    const w = await prev;
    await w.terminate();
  } catch {
    /* worker already dead */
  }
}

async function getWorker(lang: string, verbose: boolean): Promise<Worker> {
  if (workerPromise && activeLang === lang) return workerPromise;
  if (workerPromise) await destroyWorker();

  activeLang = lang;
  log(verbose, 'initializing worker with langs:', lang, forcedCoreFile ? `(forced: ${forcedCoreFile})` : '');

  const opts: Partial<Tesseract.WorkerOptions> = {
    cacheMethod: 'write',
    logger: () => {},
    langPath: LANG_CDN,
  };
  const workerUrl = getExtensionUrl('tesseract/worker.min.js');
  if (workerUrl) opts.workerPath = workerUrl;

  const coreFileOrDir = forcedCoreFile ?? 'tesseract/core/';
  const coreUrl = getExtensionUrl(coreFileOrDir);
  if (coreUrl) opts.corePath = coreUrl;

  workerPromise = createWorker(lang.split('+'), 1, opts);
  return workerPromise;
}

function isSvgSource(img: HTMLImageElement): boolean {
  const src = img.currentSrc || img.src || '';
  if (!src) return true;
  if (src.startsWith('data:image/svg')) return true;
  if (/\.svg(\?|#|$)/i.test(src)) return true;
  return false;
}

function isOpaqueSource(img: HTMLImageElement): boolean {
  const src = img.currentSrc || img.src || '';
  return src.startsWith('blob:') || src.startsWith('data:');
}

function shouldScan(img: HTMLImageElement, minSize: number): boolean {
  if (!img.src && !img.currentSrc) return false;
  if (img.dataset.legamblersSkip !== undefined) return false;
  if (img.classList.contains('legamblers-image-flag')) return false;
  if (isSvgSource(img)) return false;
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (w && w < minSize) return false;
  if (h && h < minSize) return false;
  return true;
}

function waitForImage(img: HTMLImageElement): Promise<boolean> {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve(true);
  if (img.complete) return Promise.resolve(false);
  return new Promise((resolve) => {
    img.addEventListener('load', () => resolve(img.naturalWidth > 0), { once: true });
    img.addEventListener('error', () => resolve(false), { once: true });
  });
}

function tryDirectCanvas(img: HTMLImageElement): HTMLCanvasElement | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    ctx.getImageData(0, 0, 1, 1);
    return canvas;
  } catch {
    return null;
  }
}

async function fetchImageBlob(url: string): Promise<Blob | null> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return null;
  try {
    const res = (await chrome.runtime.sendMessage({ type: 'fetchImage', url })) as
      | { ok: true; dataUrl: string }
      | { ok: false; error: string }
      | undefined;
    if (!res?.ok) return null;
    const fetchRes = await fetch(res.dataUrl);
    return await fetchRes.blob();
  } catch {
    return null;
  }
}

async function blobToCanvas(blob: Blob): Promise<HTMLCanvasElement | null> {
  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    return canvas;
  } catch {
    return null;
  }
}

interface OcrAttempt {
  text: string;
  error?: string;
  source?: 'canvas' | 'background-blob';
  chars?: number;
}

async function ocrImage(
  img: HTMLImageElement,
  lang: string,
  verbose: boolean,
): Promise<OcrAttempt> {
  const ready = await waitForImage(img);
  if (!ready) return { text: '', error: 'image-not-loaded' };

  let source: HTMLCanvasElement | null = tryDirectCanvas(img);
  let sourceTag: OcrAttempt['source'] = source ? 'canvas' : undefined;

  if (!source) {
    if (isOpaqueSource(img)) {
      return { text: '', error: 'opaque-source-no-fallback' };
    }
    log(verbose, 'canvas tainted, fetching via background:', img.src);
    const blob = await fetchImageBlob(img.src);
    if (!blob) return { text: '', error: 'background-fetch-failed' };
    source = await blobToCanvas(blob);
    if (!source) return { text: '', error: 'blob-decode-failed' };
    sourceTag = 'background-blob';
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const worker = await getWorker(lang, verbose);
      const { data } = await worker.recognize(source);
      const text = (data.text ?? '').trim();
      log(
        verbose,
        `recognized ${text.length} chars from ${img.src} [${sourceTag}]:`,
        JSON.stringify(text.slice(0, 80)),
      );
      return { text, source: sourceTag, chars: text.length };
    } catch (err) {
      const msg = String(err);
      const fallback = pickFallbackVariant(msg);
      if (attempt === 0 && fallback && fallback !== forcedCoreFile) {
        warn(`WASM abort detected, switching core variant → ${fallback}`);
        forcedCoreFile = fallback;
        await destroyWorker();
        continue;
      }
      return { text: '', error: `tesseract: ${msg.slice(0, 200)}` };
    }
  }
  return { text: '', error: 'tesseract: exhausted retries' };
}

function collectImages(root: Node, minSize: number): HTMLImageElement[] {
  const scope: ParentNode =
    root instanceof Document || root instanceof Element || root instanceof DocumentFragment
      ? root
      : (root.ownerDocument ?? document);
  const nodes = scope.querySelectorAll('img');
  const out: HTMLImageElement[] = [];
  for (const node of Array.from(nodes)) {
    if (!shouldScan(node, minSize)) continue;
    out.push(node);
  }
  return out;
}

export async function collectImageText(options: OcrOptions = {}): Promise<OcrResult> {
  const root = options.root ?? document.body;
  const minSize = options.minSize ?? DEFAULT_MIN_SIZE;
  const baseOffset = options.baseOffset ?? 0;
  const lang = options.lang ?? DEFAULT_LANG;
  const verbose = options.verbose ?? false;

  const candidates = collectImages(root, minSize);
  log(verbose, `${candidates.length} image candidate(s)`);
  if (candidates.length === 0) {
    return { fullText: '', records: [], scanned: 0, failed: 0 };
  }

  const records: OcrRecord[] = [];
  const parts: string[] = [];
  let offset = baseOffset;
  let failed = 0;
  const errorTally: Record<string, number> = {};
  const sourceTally: Record<string, number> = {};

  for (const img of candidates) {
    const attempt = await ocrImage(img, lang, verbose);
    if (attempt.error || !attempt.text) {
      failed++;
      const key = attempt.error ?? 'empty-text';
      errorTally[key] = (errorTally[key] ?? 0) + 1;
      continue;
    }
    sourceTally[attempt.source ?? 'unknown'] =
      (sourceTally[attempt.source ?? 'unknown'] ?? 0) + 1;
    records.push({
      image: img,
      text: attempt.text,
      start: offset,
      end: offset + attempt.text.length,
    });
    parts.push(attempt.text);
    offset += attempt.text.length + 1;
  }

  const succeeded = records.length;
  console.log(
    `${LOG_PREFIX} done: ${succeeded}/${candidates.length} recognized`,
    failed > 0 ? { failed, errors: errorTally } : '',
    succeeded > 0 ? { sources: sourceTally } : '',
  );
  if (failed > 0 && verbose) {
    warn('failure breakdown:', errorTally);
  }

  return {
    fullText: parts.join('\n'),
    records,
    scanned: candidates.length,
    failed,
  };
}
