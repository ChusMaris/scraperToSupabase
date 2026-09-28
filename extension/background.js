const DEFAULT_API_URL = 'https://scrapertosupabase.onrender.com/api/federation/import';

const getApiUrl = async () => {
  const result = await chrome.storage.local.get(['federationApiUrl']);
  return result.federationApiUrl || DEFAULT_API_URL;
};

const sendImport = async (payload) => {
  const apiUrl = await getApiUrl();
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: 'Unknown API error' }));
    throw new Error(data.error || `API error ${response.status}`);
  }

  return response.json();
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

  sendImport(message.payload)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});
