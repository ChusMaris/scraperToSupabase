importScripts('config.js');

const DEFAULT_API_BASE_URL = self.STATS_EXTENSION_CONFIG.apiBaseUrl;

chrome.action.onClicked.addListener(async (tab) => {
  const dashboardUrl = new URL(chrome.runtime.getURL('dashboard.html'));
  if (tab?.id !== undefined) dashboardUrl.searchParams.set('targetTabId', String(tab.id));
  await chrome.tabs.create({ url: dashboardUrl.toString() });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'COMPLEMENTARY_STATS_API_REQUEST') return;

  chrome.storage.local.get(['complementaryStatsApiBaseUrl', 'complementaryStatsApiToken'])
    .then(async (stored) => {
      const baseUrl = String(stored.complementaryStatsApiBaseUrl || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
      const headers = { Accept: 'application/json' };
      if (stored.complementaryStatsApiToken) {
        headers.Authorization = `Bearer ${stored.complementaryStatsApiToken}`;
      }
      if (message.body !== undefined) headers['Content-Type'] = 'application/json';

      const response = await fetch(`${baseUrl}${message.path}`, {
        method: message.method || 'GET',
        headers,
        ...(message.body === undefined ? {} : { body: JSON.stringify(message.body) })
      });
      const data = await response.json().catch(() => ({ error: 'La API devolvió una respuesta no válida.' }));
      if (!response.ok) {
        return { ok: false, error: data.error || `Error de API ${response.status}`, details: data };
      }
      return { ok: true, data };
    })
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));

  return true;
});