const LOG_PREFIX = '[judol-bg]';

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { credentials: 'omit', cache: 'force-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  if (!blob.type.startsWith('image/')) {
    throw new Error(`unexpected mime: ${blob.type}`);
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${blob.type};base64,${btoa(binary)}`;
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
