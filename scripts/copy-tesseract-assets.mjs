import { cp, mkdir, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const TARGET = join(root, 'public', 'tesseract');
const CORE_TARGET = join(TARGET, 'core');

const WORKER_SRC = join(root, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js');
const CORE_SRC = join(
  root,
  'node_modules',
  '.pnpm',
  'tesseract.js-core@7.0.0',
  'node_modules',
  'tesseract.js-core',
);

const CORE_FILES = [
  'tesseract-core.wasm.js',
  'tesseract-core.wasm',
  'tesseract-core-lstm.wasm.js',
  'tesseract-core-lstm.wasm',
  'tesseract-core-simd.wasm.js',
  'tesseract-core-simd.wasm',
  'tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm',
  'tesseract-core-relaxedsimd.wasm.js',
  'tesseract-core-relaxedsimd.wasm',
  'tesseract-core-relaxedsimd-lstm.wasm.js',
  'tesseract-core-relaxedsimd-lstm.wasm',
];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function copyIfMissing(src, dest) {
  if (await exists(dest)) return false;
  await cp(src, dest);
  return true;
}

async function main() {
  await mkdir(CORE_TARGET, { recursive: true });
  await mkdir(join(TARGET, 'lang'), { recursive: true });

  const workerCopied = await copyIfMissing(WORKER_SRC, join(TARGET, 'worker.min.js'));
  if (workerCopied) console.log('[tesseract] copied worker.min.js');

  for (const f of CORE_FILES) {
    const copied = await copyIfMissing(join(CORE_SRC, f), join(CORE_TARGET, f));
    if (copied) console.log(`[tesseract] copied core/${f}`);
  }
}

main().catch((err) => {
  console.error('[tesseract] copy failed:', err);
  process.exit(1);
});
