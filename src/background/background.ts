const LOG_PREFIX = '[judol-bg]';

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { credentials: 'omit', cache: 'force-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  if (!blob.type.startsWith('image/')) {
    throw new Error(`unexpected mime: ${blob.type}`);
  }
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'fetchImage' || typeof msg.url !== 'string') return false;

  fetchImageAsDataUrl(msg.url)
    .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
    .catch((err) => {
      console.warn(LOG_PREFIX, 'fetchImage failed for', msg.url, err);
      sendResponse({ ok: false, error: String(err) });
    });

  return true;
});
