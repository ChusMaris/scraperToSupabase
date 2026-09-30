(() => {
  const channel = '__basquetcatala_federation_capture__';
  if (window[channel]) return;

  const captured = { statsPayload: null, pbpPayload: null };
  window[channel] = captured;

  const collectPayloads = (root) => {
    const found = { statsPayload: null, pbpPayload: null };
    const queue = [{ value: root, depth: 0 }];
    const seen = new WeakSet();

    while (queue.length && (found.statsPayload === null || found.pbpPayload === null)) {
      const { value, depth } = queue.shift();
      if (!value || typeof value !== 'object' || seen.has(value)) continue;
      seen.add(value);

      if (value.header && Array.isArray(value.boxscore)) {
        found.statsPayload = value;
      }
      if (Array.isArray(value.playByPlay)) {
        found.pbpPayload = value;
      }

      if (depth < 6) {
        for (const nestedValue of Object.values(value)) {
          if (nestedValue && typeof nestedValue === 'object') {
            queue.push({ value: nestedValue, depth: depth + 1 });
          }
        }
      }
    }

    return found;
  };

  const rememberPayload = (value) => {
    const found = collectPayloads(value);
    if (found.statsPayload) captured.statsPayload = found.statsPayload;
    if (found.pbpPayload) captured.pbpPayload = found.pbpPayload;
  };

  const postCapturedPayloads = () => {
    window.postMessage({ channel, type: 'PAYLOADS', payloads: captured }, window.location.origin);
  };

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    if (event.data?.channel === channel && event.data.type === 'GET_PAYLOADS') {
      postCapturedPayloads();
    }
  });

  const isMatchJsonUrl = (url) => {
    const value = String(url ?? '');
    return value.includes('/matches/') && /\/(stats|pbp)(?:\?|$)/.test(value);
  };

  const originalFetch = window.fetch;
  if (typeof originalFetch === 'function') {
    window.fetch = function (...args) {
      const requestUrl = typeof args[0] === 'string' ? args[0] : args[0]?.url;
      return originalFetch.apply(this, args).then((response) => {
        if (response.ok && isMatchJsonUrl(requestUrl)) {
          response.clone().json().then(rememberPayload).catch(() => {});
        }
        return response;
      });
    };
  }

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...args) {
    this[channel] = String(url ?? '');
    return originalOpen.call(this, method, url, ...args);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    if (isMatchJsonUrl(this[channel])) {
      this.addEventListener('load', () => {
        try {
          const value = this.responseType === 'json' ? this.response : JSON.parse(this.responseText);
          rememberPayload(value);
        } catch {
          // Ignore non-JSON responses.
        }
      }, { once: true });
    }
    return originalSend.apply(this, args);
  };
})();
