const pickFromWindow = () => {
  const candidates = [];
  const scope = window;

  for (const key of Object.keys(scope)) {
    let value;
    try {
      value = scope[key];
    } catch {
      continue;
    }
    if (!value || typeof value !== 'object') continue;

    try {
      if (value.header || value.boxscore || value.scoreEvolution || value.playByPlay || value.shotChart) {
        candidates.push(value);
      }
    } catch {
      continue;
    }
  }

  const globalKeys = [
    '__MATCH_STATS__',
    '__MATCH_PBP__',
    '__FEDERATION_STATS__',
    '__FEDERATION_PBP__',
    '__MATCH_DATA__',
    '__APP_STATE__'
  ];

  for (const key of globalKeys) {
    try {
      const value = window[key];
      if (value && typeof value === 'object') {
        candidates.push(value);
      }
    } catch {
      continue;
    }
  }

  return candidates;
};

const findPayload = () => {
  const windowObjects = pickFromWindow();

  for (const candidate of windowObjects) {
    let hasStats;
    let hasPbp;
    try {
      hasStats = !!candidate?.header || !!candidate?.boxscore || !!candidate?.shotChart || !!candidate?.scoreEvolution;
      hasPbp = !!candidate?.playByPlay || Array.isArray(candidate?.movements) || Array.isArray(candidate?.plays);
    } catch {
      continue;
    }

    if (hasStats || hasPbp) {
      return candidate;
    }
  }

  const scripts = document.querySelectorAll('script[type="application/json"]');
  for (const script of scripts) {
    try {
      const raw = JSON.parse(script.textContent || '');
      if (raw?.header || raw?.boxscore || raw?.playByPlay || raw?.scoreEvolution) {
        return raw;
      }
    } catch {
      // Ignore invalid JSON scripts.
    }
  }

  return null;
};

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

const sendPayloadToBackground = (payload) => new Promise((resolve) => {
  const safePayload = sanitizeForMessage({
    statsPayload: payload,
    pbpPayload: payload,
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

  const payload = findPayload();

  if (!payload) {
    console.warn('[extension] No federation payload found in this page.');
    sendResponse({ ok: false, error: 'No federation payload found in page.' });
    return;
  }

  const metadata = message.metadata || {};

  sendPayloadToBackground({
    ...payload,
    metadata
  }).then(sendResponse).catch((error) => {
    sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
  });
  return true;
});
