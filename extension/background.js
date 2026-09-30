const DEFAULT_API_URL = 'https://scrapertosupabase.onrender.com/api/federation/import';

const getApiUrl = async () => {
  const result = await chrome.storage.local.get(['federationApiUrl']);
  return result.federationApiUrl || DEFAULT_API_URL;
};

const publishImportLog = (importId, message, level = 'info') => {
  chrome.runtime.sendMessage({
    type: 'FEDERATION_IMPORT_LOG',
    importId,
    message,
    level
  }, () => {
    void chrome.runtime.lastError;
  });
};

const sendImport = async (payload, importId) => {
  const apiUrl = await getApiUrl();
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: 'Unknown API error' }));
    throw new Error(data.error || `API error ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('La API no devolvió un flujo de progreso compatible.');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let importResult = null;
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = frame.split('\n')
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trim())
        .join('\n');

      if (data) {
        const event = JSON.parse(data);
        if (event.type === 'log') publishImportLog(importId, event.message, event.level);
        if (event.type === 'error') throw new Error(event.error || 'Error de importación desconocido.');
        if (event.type === 'complete') importResult = event.result;
      }
      boundary = buffer.indexOf('\n\n');
    }

    if (done) break;
  }

  if (!importResult) {
    throw new Error('La API cerró el flujo antes de confirmar el resultado.');
  }
  return importResult;
};

const getImportOptions = async () => {
  const apiUrl = await getApiUrl();
  const optionsUrl = apiUrl.replace(/\/import\/?$/, '/options');
  const response = await fetch(optionsUrl);
  const data = await response.json().catch(() => ({ error: 'Unknown API error' }));

  if (!response.ok) {
    throw new Error(data.error || `API error ${response.status}`);
  }

  return data.options;
};

const publishImportResult = async (importId, result) => {
  const resultKey = `federationImportResult:${importId}`;
  await chrome.storage.local.set({ [resultKey]: result });
  chrome.runtime.sendMessage({
    type: 'FEDERATION_IMPORT_RESULT',
    importId,
    result
  }, () => {
    void chrome.runtime.lastError;
  });
};

chrome.action.onClicked.addListener(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    console.error('[extension] No active tab found');
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_FEDERATION_PAYLOAD' });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'GET_FEDERATION_OPTIONS') {
    getImportOptions()
      .then(options => sendResponse({ ok: true, options }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type !== 'FEDERATION_PAYLOAD') {
    return;
  }

  const importId = crypto.randomUUID();
  sendResponse({ ok: true, pending: true, importId });

  publishImportLog(importId, 'Payload recibido desde la página; conectando con la API.', 'info');
  sendImport(message.payload, importId)
    .then((result) => publishImportResult(importId, { ok: true, result }))
    .catch((error) => publishImportResult(importId, {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }))
    .catch((error) => console.error('[extension] Could not publish import result:', error));

  return false;
});
