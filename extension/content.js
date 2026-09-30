const PAGE_CAPTURE_CHANNEL = '__basquetcatala_federation_capture__';

const findPayloadsInTree = (roots) => {
  const result = { statsPayload: null, pbpPayload: null };
  const queue = roots.map(value => ({ value, depth: 0 }));
  const seen = new WeakSet();
  let inspected = 0;

  while (queue.length && inspected < 3000 && (!result.statsPayload || !result.pbpPayload)) {
    const { value, depth } = queue.shift();
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    inspected += 1;

    if (value.header && Array.isArray(value.boxscore)) {
      result.statsPayload = value;
    }
    if (Array.isArray(value.playByPlay)) {
      result.pbpPayload = value;
    }

    if (depth < 6) {
      let nestedValues = [];
      try {
        nestedValues = Object.values(value);
      } catch {
        continue;
      }
      for (const nestedValue of nestedValues) {
        if (nestedValue && typeof nestedValue === 'object') {
          queue.push({ value: nestedValue, depth: depth + 1 });
        }
      }
    }
  }

  return result;
};

const findPayloadsInPage = () => {
  const roots = [];
  const pageKeys = ['__MATCH_STATS__', '__MATCH_PBP__', '__FEDERATION_STATS__', '__FEDERATION_PBP__', '__MATCH_DATA__', '__APP_STATE__'];

  for (const key of Object.keys(window)) {
    try {
      roots.push(window[key]);
    } catch {
      // Ignore cross-origin window properties.
    }
  }
  for (const key of pageKeys) {
    try {
      roots.push(window[key]);
    } catch {
      // Ignore inaccessible page globals.
    }
  }

  for (const script of document.querySelectorAll('script[type="application/json"]')) {
    try {
      roots.push(JSON.parse(script.textContent || ''));
    } catch {
      // Ignore invalid JSON scripts.
    }
  }

  return findPayloadsInTree(roots);
};

const getCapturedNetworkPayloads = () => new Promise((resolve) => {
  let complete = false;
  const finish = (payloads) => {
    if (complete) return;
    complete = true;
    window.clearTimeout(timeoutId);
    window.removeEventListener('message', onPageMessage);
    resolve(payloads);
  };
  const onPageMessage = (event) => {
    if (event.source === window && event.origin === window.location.origin
      && event.data?.channel === PAGE_CAPTURE_CHANNEL && event.data.type === 'PAYLOADS') {
      finish(event.data.payloads ?? {});
    }
  };
  const timeoutId = window.setTimeout(() => finish({}), 500);

  window.addEventListener('message', onPageMessage);
  window.postMessage({ channel: PAGE_CAPTURE_CHANNEL, type: 'GET_PAYLOADS' }, window.location.origin);
});

const sanitizeForMessage = (value, seen = new WeakSet()) => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function') return '[Function]';

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof RegExp) {
    return value.toString();
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);

    if (Array.isArray(value)) {
      return value.map(item => sanitizeForMessage(item, seen));
    }

    const cleaned = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      if (key === 'window' || key === 'document' || key === 'parent' || key === 'top' || key === 'self') {
        continue;
      }
      cleaned[key] = sanitizeForMessage(nestedValue, seen);
    }
    return cleaned;
  }

  return String(value);
};

const sendPayloadToBackground = (statsPayload, pbpPayload, metadata) => new Promise((resolve) => {
  const safePayload = sanitizeForMessage({
    statsPayload,
    pbpPayload,
    metadata,
    sourceUrl: window.location.href,
    capturedAt: new Date().toISOString()
  });

  chrome.runtime.sendMessage({
    type: 'FEDERATION_PAYLOAD',
    payload: safePayload
  }, (response) => {
    if (chrome.runtime.lastError) {
      resolve({ ok: false, error: chrome.runtime.lastError.message });
      return;
    }

    resolve(response ?? { ok: false, error: 'The API did not return an import result.' });
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'CAPTURE_FEDERATION_PAYLOAD') {
    return;
  }

  (async () => {
    const [networkPayloads, pagePayloads] = await Promise.all([
      getCapturedNetworkPayloads(),
      Promise.resolve(findPayloadsInPage())
    ]);
    const statsPayload = networkPayloads.statsPayload ?? pagePayloads.statsPayload;
    const pbpPayload = networkPayloads.pbpPayload ?? pagePayloads.pbpPayload;

    if (!statsPayload || !pbpPayload) {
      const missing = [
        !statsPayload && 'stats (header + boxscore)',
        !pbpPayload && 'play-by-play'
      ].filter(Boolean).join(' y ');
      sendResponse({
        ok: false,
        error: `No se capturaron ambos JSON (${missing}). Recarga la página del partido con la extensión activa y vuelve a probar.`
      });
      return;
    }

    const metadata = message.metadata || {};
    sendPayloadToBackground(statsPayload, pbpPayload, metadata)
      .then(sendResponse)
      .catch(error => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
  })().catch(error => {
    sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
  });
  return true;
});
