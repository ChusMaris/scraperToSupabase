const NEW_VALUE = '__new_value__';

const getFieldValue = (fieldId) => {
  const select = document.getElementById(fieldId);
  if (select.value === NEW_VALUE) {
    return document.getElementById(`${fieldId}-new`).value.trim();
  }
  return select.value.trim();
};

const formValues = () => {
  const jornadaValue = getFieldValue('jornada');
  return {
    temporada: getFieldValue('temporada'),
    categoria: getFieldValue('categoria'),
    competicion: getFieldValue('competicion'),
    jornada: jornadaValue ? Number(jornadaValue) : null
  };
};

const setStatus = (message, isError = false) => {
  const status = document.getElementById('status');
  status.textContent = message;
  status.style.color = isError ? '#fca5a5' : '#93c5fd';
};

let activeImportId = null;
const seenLogSequences = new Set();

const appendLog = (message, level = 'info', timestamp = new Date().toISOString(), sequence = null) => {
  if (sequence !== null) {
    if (seenLogSequences.has(sequence)) return;
    seenLogSequences.add(sequence);
  }

  const logList = document.getElementById('import-log');
  const entry = document.createElement('li');
  entry.dataset.level = level;
  entry.textContent = `${new Date(timestamp).toLocaleTimeString()} ${message}`;
  logList.append(entry);
  while (logList.children.length > 60) logList.firstElementChild.remove();
  logList.scrollTop = logList.scrollHeight;
};

const restoreLastImportState = () => {
  chrome.storage.local.get(['federationLastImportState'], (stored) => {
    const state = stored.federationLastImportState;
    if (!state) return;

    activeImportId = state.importId;
    seenLogSequences.clear();
    for (const log of state.logs ?? []) {
      appendLog(log.message, log.level, log.timestamp, log.sequence);
    }

    if (state.status === 'running') {
      setStatus('Importación en curso. Actualizando trazas...');
    } else if (state.status === 'completed') {
      showImportResult(state.result);
    } else if (state.status === 'failed') {
      showImportResult(state.result);
    }
  });
};

const sendCaptureMessage = (tabId, message) => new Promise((resolve) => {
  chrome.tabs.sendMessage(tabId, message, (response) => {
    resolve({ response, error: chrome.runtime.lastError?.message });
  });
});

const showImportResult = (result) => {
  if (result?.ok) {
    const details = result.result;
    setStatus(`Guardado: ${details?.score ?? 'sin marcador'}; ${details?.fechaHora ?? 'sin fecha'}; jornada ${details?.jornada ?? '-'}.`);
  } else {
    setStatus(`Error al guardar: ${result?.error || 'Error desconocido'}`, true);
  }
};

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'FEDERATION_IMPORT_LOG' && message.importId !== activeImportId) {
    activeImportId = message.importId;
    seenLogSequences.clear();
    document.getElementById('import-log').replaceChildren();
  }
  if (message?.importId !== activeImportId) {
    return;
  }
  if (message.type === 'FEDERATION_IMPORT_LOG') {
    appendLog(message.log.message, message.log.level, message.log.timestamp, message.log.sequence);
  } else if (message.type === 'FEDERATION_IMPORT_RESULT') {
    showImportResult(message.result);
    appendLog(message.result?.ok ? 'Importación finalizada.' : `Importación fallida: ${message.result?.error ?? 'error desconocido'}`, message.result?.ok ? 'success' : 'error');
  }
});

const fillOptions = (selectId, values, prompt) => {
  const select = document.getElementById(selectId);
  const options = [new Option(prompt, '')];
  options.push(...values.map((value) => new Option(String(value), String(value))));
  options.push(new Option('Escribir un valor nuevo...', NEW_VALUE));
  select.replaceChildren(...options);
};

const setupCustomField = (fieldId) => {
  const select = document.getElementById(fieldId);
  const customInput = document.getElementById(`${fieldId}-new`);
  select.addEventListener('change', () => {
    customInput.hidden = select.value !== NEW_VALUE;
    if (!customInput.hidden) customInput.focus();
  });
};

['temporada', 'categoria', 'competicion', 'jornada'].forEach(setupCustomField);

const loadImportOptions = () => {
  setStatus('Conectando con Supabase...');
  chrome.runtime.sendMessage({ type: 'GET_FEDERATION_OPTIONS' }, (response) => {
    if (chrome.runtime.lastError) {
      setStatus(`No se pudieron cargar los catálogos: ${chrome.runtime.lastError.message}`, true);
      return;
    }

    if (!response?.ok) {
      setStatus(`No se pudieron cargar los catálogos: ${response?.error || 'Error desconocido'}`, true);
      return;
    }

    const options = response.options;
    fillOptions('temporada', options.temporadas ?? [], 'Selecciona temporada');
    fillOptions('categoria', options.categorias ?? [], 'Selecciona categoría');
    fillOptions('competicion', options.competiciones ?? [], 'Selecciona competición');
    fillOptions('jornada', options.jornadas ?? [], 'Selecciona jornada');

    const count = (options.temporadas?.length ?? 0) + (options.categorias?.length ?? 0)
      + (options.competiciones?.length ?? 0) + (options.jornadas?.length ?? 0);
    setStatus(`Conexión con Supabase correcta. ${count} opciones cargadas.`);
  });
};

loadImportOptions();
restoreLastImportState();

document.getElementById('importBtn').addEventListener('click', async () => {
  document.getElementById('import-log').replaceChildren();
  seenLogSequences.clear();
  activeImportId = null;
  appendLog('Iniciando captura del partido.');
  setStatus('Buscando datos del partido...');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus('No hay una pestaña activa.', true);
    return;
  }

  const message = {
    type: 'CAPTURE_FEDERATION_PAYLOAD',
    metadata: formValues()
  };
  let { response, error } = await sendCaptureMessage(tab.id, message);

  if (error && /Receiving end does not exist|Could not establish connection/i.test(error)) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      ({ response, error } = await sendCaptureMessage(tab.id, message));
    } catch (injectionError) {
      setStatus(`No se pudo activar el importador en esta página: ${injectionError.message || injectionError}`, true);
      return;
    }
  }

  if (error) {
    setStatus(error, true);
    return;
  }

  if (!response?.ok) {
    setStatus(response?.error || 'No se encontraron datos del partido.', true);
    appendLog(response?.error || 'No se encontraron los JSON del partido.', 'error');
    return;
  }

  if (response.pending && response.importId) {
    activeImportId = response.importId;
    appendLog('Payload capturado; esperando progreso de la API.');
    setStatus('Importación recibida. Guardando en Supabase...');
    const resultKey = `federationImportResult:${activeImportId}`;
    chrome.storage.local.get([resultKey], (stored) => {
      if (stored[resultKey]) {
        showImportResult(stored[resultKey]);
        chrome.storage.local.remove(resultKey);
      }
    });
    return;
  }

  setStatus('Importación enviada a la API.');
});
