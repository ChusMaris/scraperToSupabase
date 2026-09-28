const formValues = () => ({
  temporada: document.getElementById('temporada').value.trim(),
  categoria: document.getElementById('categoria').value.trim(),
  competicion: document.getElementById('competicion').value.trim(),
  jornada: document.getElementById('jornada').value ? Number(document.getElementById('jornada').value) : null
});

const setStatus = (message, isError = false) => {
  const status = document.getElementById('status');
  status.textContent = message;
  status.style.color = isError ? '#fca5a5' : '#93c5fd';
};

const sendCaptureMessage = (tabId, message) => new Promise((resolve) => {
  chrome.tabs.sendMessage(tabId, message, (response) => {
    resolve({ response, error: chrome.runtime.lastError?.message });
  });
});

const fillOptions = (listId, values) => {
  const list = document.getElementById(listId);
  list.replaceChildren(...values.map((value) => {
    const option = document.createElement('option');
    option.value = String(value);
    return option;
  }));
};

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
    fillOptions('temporada-options', options.temporadas ?? []);
    fillOptions('categoria-options', options.categorias ?? []);
    fillOptions('competicion-options', options.competiciones ?? []);
    fillOptions('jornada-options', options.jornadas ?? []);

    const count = (options.temporadas?.length ?? 0) + (options.categorias?.length ?? 0)
      + (options.competiciones?.length ?? 0) + (options.jornadas?.length ?? 0);
    setStatus(`Conexión con Supabase correcta. ${count} opciones cargadas.`);
  });
};

loadImportOptions();

document.getElementById('importBtn').addEventListener('click', async () => {
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
    return;
  }

  setStatus('Importación enviada a la API.');
});
