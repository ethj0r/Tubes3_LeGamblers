import Tesseract, { createWorker, createScheduler, PSM } from 'tesseract.js';
import type { Worker, Scheduler } from 'tesseract.js';

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
  loadTimeoutMs?: number;
  maxDimension?: number;
  // blur immediately
  onImageText?: (image: HTMLImageElement, text: string) => void;
}

const DEFAULT_MIN_SIZE = 64;
const DEFAULT_LANG = 'eng+ind';
const DEFAULT_CONCURRENCY = Math.min(4, Math.max(2, navigator.hardwareConcurrency || 2));
const DEFAULT_LOAD_TIMEOUT_MS = 400;
const DEFAULT_MAX_DIMENSION = 1024;
const UPSCALE_TARGET = 800;
const MAX_UPSCALE = 3;
const LANG_CDN = 'https://tessdata.projectnaptha.com/4.0.0_fast';
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

let schedulerPromise: Promise<Scheduler> | null = null;
let activeKey = '';
const PRIMARY_CORE_FILE = 'tesseract/core/tesseract-core-simd-lstm.wasm.js';
const SAFE_CORE_FILE = 'tesseract/core/tesseract-core-lstm.wasm.js';
let forcedCoreFile: string = PRIMARY_CORE_FILE;

function pickFallbackVariant(err: string): string | null {
  // Any abort/runtime error from the SIMD core --> drop to the no-SIMD core.
  if (
    err.includes('DotProductSSE') ||
    err.includes('Aborted(missing function') ||
    err.includes('RuntimeError')
  ) {
    return SAFE_CORE_FILE;
  }
  return null;
}

async function createOcrWorker(lang: string): Promise<Worker> {
  const opts: Partial<Tesseract.WorkerOptions> = {
    cacheMethod: 'write',
    logger: () => {},
    langPath: LANG_CDN,
  };
  const workerUrl = getExtensionUrl('tesseract/worker.min.js');
  if (workerUrl) opts.workerPath = workerUrl;

  const coreUrl = getExtensionUrl(forcedCoreFile);
  if (coreUrl) opts.corePath = coreUrl;

  const worker = await createWorker(lang.split('+'), 1, opts);
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
  return worker;
}

async function destroyScheduler(): Promise<void> {
  if (!schedulerPromise) return;
  const prev = schedulerPromise;
  schedulerPromise = null;
  activeKey = '';
  try {
    const s = await prev;
    await s.terminate();
  } catch {
    /* scheduler already dead */
  }
}

function buildScheduler(lang: string, poolSize: number, verbose: boolean): Promise<Scheduler> {
  return (async () => {
    log(
      verbose,
      `initializing scheduler: ${poolSize} worker(s), langs=${lang}`,
      forcedCoreFile ? `(forced core: ${forcedCoreFile})` : '',
    );
    const scheduler = createScheduler();
    const workers = await Promise.all(
      Array.from({ length: poolSize }, () => createOcrWorker(lang)),
    );
    for (const w of workers) scheduler.addWorker(w);
    return scheduler;
  })();
}

const WARMUP_TIMEOUT_MS = 15000;

// Runs a tiny recognition to surface a broken WASM core before the real pool work starts.
async function warmupOk(scheduler: Scheduler): Promise<boolean> {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 8;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), WARMUP_TIMEOUT_MS);
  });

  const downgrade = (reason: string): boolean => {
    if (forcedCoreFile !== SAFE_CORE_FILE) {
      warn(`${reason}, switching core → ${SAFE_CORE_FILE}`);
      forcedCoreFile = SAFE_CORE_FILE;
      return false; // rebuild with the safe core
    }
    return true; // already on the safest core; nothing left to try
  };

  try {
    const job = scheduler.addJob('recognize', canvas).then(() => 'ok' as const);
    const outcome = await Promise.race([job, timeout]);
    if (outcome === 'timeout') return downgrade('warmup timed out (worker likely aborted)');
    return true;
  } catch (err) {
    if (pickFallbackVariant(String(err))) return downgrade('WASM abort during warmup');
    // Not a recoverable core issue.
    return true;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function getScheduler(lang: string, poolSize: number, verbose: boolean): Promise<Scheduler> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const key = `${lang}@${poolSize}@${forcedCoreFile ?? ''}`;
    if (schedulerPromise && activeKey === key) return schedulerPromise;
    if (schedulerPromise) await destroyScheduler();

    activeKey = key;
    schedulerPromise = buildScheduler(lang, poolSize, verbose);
    const scheduler = await schedulerPromise;

    if (attempt === 0 && (await warmupOk(scheduler))) return scheduler;
    if (attempt === 0) {
      await destroyScheduler();
      continue;
    }
    return scheduler;
  }
  // Unreachable, but satisfies the type checker.
  return schedulerPromise as Promise<Scheduler>;
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

function waitForImage(img: HTMLImageElement, timeoutMs: number): Promise<boolean> {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve(true);
  if (img.complete) return Promise.resolve(false);
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: boolean) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    img.addEventListener('load', () => finish(img.naturalWidth > 0), { once: true });
    img.addEventListener('error', () => finish(false), { once: true });
    // Nudge lazy/off-screen images so their load actually fires.
    if (img.loading === 'lazy') {
      try {
        img.loading = 'eager';
      } catch {
        /* read-only in some engines */
      }
    }
    img.decode?.().then(() => finish(img.naturalWidth > 0)).catch(() => {});
    // Never block the queue on a single image that refuses to load.
    setTimeout(() => finish(img.naturalWidth > 0), timeoutMs);
  });
}

function scaledSize(w: number, h: number, maxDimension: number): { width: number; height: number } {
  const longest = Math.max(w, h);
  if (longest === 0) return { width: w, height: h };

  let scale = 1;
  if (longest > maxDimension) {
    scale = maxDimension / longest;
  } else if (longest < UPSCALE_TARGET) {
    scale = Math.min(MAX_UPSCALE, UPSCALE_TARGET / longest);
  }
  if (scale === 1) return { width: w, height: h };
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

function tryDirectCanvas(img: HTMLImageElement, maxDimension: number): HTMLCanvasElement | null {
  try {
    const { width, height } = scaledSize(img.naturalWidth, img.naturalHeight, maxDimension);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, width, height);
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

async function blobToCanvas(blob: Blob, maxDimension: number): Promise<HTMLCanvasElement | null> {
  try {
    const bitmap = await createImageBitmap(blob);
    const { width, height } = scaledSize(bitmap.width, bitmap.height, maxDimension);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
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
  scheduler: Scheduler,
  verbose: boolean,
  timeoutMs: number,
  maxDimension: number,
): Promise<OcrAttempt> {
  const ready = await waitForImage(img, timeoutMs);

  let source: HTMLCanvasElement | null = ready ? tryDirectCanvas(img, maxDimension) : null;
  let sourceTag: OcrAttempt['source'] = source ? 'canvas' : undefined;

  if (!source) {
    // Either the element never decoded, or its canvas is tainted. Both are
    // recoverable by fetching the bytes ourselves, as long as we have a URL
    // the background can refetch (blob:/data: are scoped to the page only).
    if (isOpaqueSource(img)) {
      return { text: '', error: ready ? 'opaque-source-no-fallback' : 'image-not-loaded' };
    }
    const url = img.currentSrc || img.src;
    if (!url) return { text: '', error: 'image-not-loaded' };
    log(verbose, ready ? 'canvas tainted, fetching via background:' : 'not decoded, fetching via background:', url);
    const blob = await fetchImageBlob(url);
    if (!blob) return { text: '', error: 'background-fetch-failed' };
    source = await blobToCanvas(blob, maxDimension);
    if (!source) return { text: '', error: 'blob-decode-failed' };
    sourceTag = 'background-blob';
  }

  try {
    // The scheduler dispatches this to whichever worker is free, so multiple
    // recognitions run in parallel across the pool.
    const { data } = (await scheduler.addJob('recognize', source)) as Tesseract.RecognizeResult;
    const text = (data.text ?? '').trim();
    log(
      verbose,
      `recognized ${text.length} chars from ${img.src} [${sourceTag}]:`,
      JSON.stringify(text.slice(0, 80)),
    );
    return { text, source: sourceTag, chars: text.length };
  } catch (err) {
    return { text: '', error: `tesseract: ${String(err).slice(0, 200)}` };
  }
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
  const timeoutMs = options.loadTimeoutMs ?? DEFAULT_LOAD_TIMEOUT_MS;
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY);
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;

  const candidates = collectImages(root, minSize);
  log(verbose, `${candidates.length} image candidate(s), concurrency=${concurrency}`);
  if (candidates.length === 0) {
    return { fullText: '', records: [], scanned: 0, failed: 0 };
  }

  // Pool size is bounded by the candidate count
  const poolSize = Math.min(concurrency, candidates.length);
  const scheduler = await getScheduler(lang, poolSize, verbose);

  const attempts = new Array<OcrAttempt>(candidates.length);
  let next = 0;
  const runners = Array.from({ length: poolSize }, async () => {
    while (next < candidates.length) {
      const idx = next++;
      try {
        const attempt = await ocrImage(candidates[idx], scheduler, verbose, timeoutMs, maxDimension);
        attempts[idx] = attempt;
        // Blur the image immediately
        if (attempt.text && options.onImageText) {
          try {
            options.onImageText(candidates[idx], attempt.text);
          } catch (err) {
            warn('onImageText callback threw:', err);
          }
        }
      } catch (err) {
        attempts[idx] = { text: '', error: `unexpected: ${String(err).slice(0, 120)}` };
      }
    }
  });
  await Promise.all(runners);

  const records: OcrRecord[] = [];
  const parts: string[] = [];
  let offset = baseOffset;
  let failed = 0;
  const errorTally: Record<string, number> = {};
  const sourceTally: Record<string, number> = {};

  for (let i = 0; i < candidates.length; i++) {
    const attempt = attempts[i];
    if (attempt.error || !attempt.text) {
      failed++;
      const key = attempt.error ?? 'empty-text';
      errorTally[key] = (errorTally[key] ?? 0) + 1;
      continue;
    }
    sourceTally[attempt.source ?? 'unknown'] =
      (sourceTally[attempt.source ?? 'unknown'] ?? 0) + 1;
    records.push({
      image: candidates[i],
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
