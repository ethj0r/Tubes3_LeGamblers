import Tesseract from 'tesseract.js';

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
}

const DEFAULT_MIN_SIZE = 64;
const DEFAULT_CONCURRENCY = 2;
const DEFAULT_LANG = 'eng+ind';

function shouldScan(img: HTMLImageElement, minSize: number): boolean {
  if (!img.src) return false;
  if (img.dataset.legamblersSkip !== undefined) return false;
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

async function ocrImage(img: HTMLImageElement, lang: string): Promise<string> {
  const ready = await waitForImage(img);
  if (!ready) return '';
  try {
    const { data } = await Tesseract.recognize(img.src, lang, { logger: () => {} });
    return (data.text ?? '').trim();
  } catch {
    return '';
  }
}

async function processConcurrent<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
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
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const lang = options.lang ?? DEFAULT_LANG;

  const candidates = collectImages(root, minSize);
  if (candidates.length === 0) {
    return { fullText: '', records: [], scanned: 0, failed: 0 };
  }

  const texts = await processConcurrent(candidates, (img) => ocrImage(img, lang), concurrency);

  const records: OcrRecord[] = [];
  const parts: string[] = [];
  let offset = baseOffset;
  let failed = 0;
  for (let i = 0; i < candidates.length; i++) {
    const text = texts[i] ?? '';
    if (!text) {
      failed++;
      continue;
    }
    records.push({
      image: candidates[i],
      text,
      start: offset,
      end: offset + text.length,
    });
    parts.push(text);
    offset += text.length + 1;
  }

  return {
    fullText: parts.join('\n'),
    records,
    scanned: candidates.length,
    failed,
  };
}
