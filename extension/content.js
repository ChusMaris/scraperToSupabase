const pickFromWindow = () => {
  const candidates = [];
  const scope = window;

  for (const key of Object.keys(scope)) {
    const value = scope[key];
    if (!value || typeof value !== 'object') continue;

    if (value.header || value.boxscore || value.scoreEvolution || value.playByPlay || value.shotChart) {
      candidates.push(value);
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
    if (window[key] && typeof window[key] === 'object') {
      candidates.push(window[key]);
    }
  }

  return candidates;
};

const findPayload = () => {
  const windowObjects = pickFromWindow();

  for (const candidate of windowObjects) {
    const hasStats = !!candidate?.header || !!candidate?.boxscore || !!candidate?.shotChart || !!candidate?.scoreEvolution;
    const hasPbp = !!candidate?.playByPlay || Array.isArray(candidate?.movements) || Array.isArray(candidate?.plays);

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

const sendPayloadToBackground = async (payload) => {
  chrome.runtime.sendMessage({
    type: 'FEDERATION_PAYLOAD',
    payload: {
      statsPayload: payload,
      pbpPayload: payload,
      sourceUrl: window.location.href,
      capturedAt: new Date().toISOString()
    }
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[extension] Runtime error:', chrome.runtime.lastError.message);
      return;
    }

    if (!response?.ok) {
      console.error('[extension] Import failed:', response?.error || 'Unknown error');
      return;
    }

    console.log('[extension] Import successful:', response.result);
  });
};

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

  sendPayloadToBackground(payload);
  sendResponse({ ok: true, message: 'Payload detected and forwarded.' });
});
