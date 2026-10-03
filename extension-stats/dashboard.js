const targetTabValue = new URLSearchParams(location.search).get('targetTabId');
const targetTabId = targetTabValue === null ? Number.NaN : Number(targetTabValue);
const selectIds = ['season', 'category', 'competition', 'matchday', 'match', 'team'];
const statFields = [
  ['t2Made', 'T2M'], ['t2Attempted', 'T2A'], ['t3Made', 'T3M'], ['t3Attempted', 'T3A'],
  ['tlMade', 'TLN'], ['tlAttempted', 'TLA'], ['rebounds', 'REB'], ['assists', 'AST'],
  ['steals', 'ROB'], ['turnovers', 'PER']
];
let extractedRows = [];
let includedMatchCount = null;
let captureInProgress = false;
let catalogError = null;

const elements = Object.fromEntries([
  'status', 'context-state', 'grid-meta', 'grid-body', 'extract-button', 'submit-button',
  'single-match-confirmation', 'reload-options'
].map((id) => [id, document.getElementById(id)]));

const setStatus = (message, kind = 'info') => {
  elements.status.textContent = message;
  elements.status.dataset.kind = kind;
};

const apiRequest = async (path, method = 'GET', body) => {
  const response = await chrome.runtime.sendMessage({
    type: 'COMPLEMENTARY_STATS_API_REQUEST', path, method, body
  });
  if (!response?.ok) {
    const error = new Error(response?.error || 'No se pudo conectar con la API.');
    error.details = response?.details;
    throw error;
  }
  return response.data;
};

const resetSelect = (id, prompt) => {
  const select = document.getElementById(id);
  select.replaceChildren(new Option(prompt, ''));
  select.disabled = true;
};

const setOptions = async (id, type, parameters, prompt) => {
  const select = document.getElementById(id);
  select.replaceChildren(new Option('Cargando...', ''));
  select.disabled = true;
  const query = new URLSearchParams({ type, ...parameters });
  try {
    const response = await apiRequest(`/api/complementary-stats/options?${query}`);
    if (!Array.isArray(response.options)) throw new Error('La API respondió sin una lista de opciones válida.');
    const items = response.options;
    if (!items.length) {
      select.replaceChildren(new Option('Sin opciones disponibles', ''));
      throw new Error(`La API no devolvió opciones para ${type}.`);
    }
    select.replaceChildren(new Option(prompt, ''), ...items.map((item) => new Option(item.name, String(item.id))));
    select.disabled = false;
    catalogError = null;
  } catch (error) {
    select.replaceChildren(new Option(`Error: ${error.message}`, ''));
    select.disabled = true;
    throw error;
  }
};

const setContextState = () => {
  const next = selectIds.find((id) => !document.getElementById(id).value);
  elements['context-state'].textContent = next
    ? `Falta ${document.querySelector(`label:has(#${next})`).firstChild.textContent.trim()}`
    : 'Contexto completo';
  updateSubmitState();
};

const updateSubmitState = () => {
  const contextComplete = selectIds.every((id) => Boolean(document.getElementById(id).value));
  elements['submit-button'].disabled = !contextComplete || extractedRows.length === 0
    || !elements['single-match-confirmation'].checked;
};

const renderGrid = () => {
  if (!extractedRows.length) {
    elements['grid-body'].innerHTML = '<tr class="empty-row"><td colspan="12">Usa “Extraer plantilla” en la página del partido.</td></tr>';
    elements['grid-meta'].textContent = 'Aún no hay datos capturados';
    updateSubmitState();
    return;
  }

  elements['grid-body'].replaceChildren(...extractedRows.map((row, rowIndex) => {
    const tableRow = document.createElement('tr');
    const jerseyCell = document.createElement('td');
    jerseyCell.className = 'jersey-cell';
    const jerseyInput = document.createElement('input');
    jerseyInput.type = 'number';
    jerseyInput.min = '0';
    jerseyInput.step = '1';
    jerseyInput.required = true;
    jerseyInput.value = row.jerseyNumber;
    jerseyInput.dataset.row = String(rowIndex);
    jerseyInput.dataset.field = 'jerseyNumber';
    jerseyInput.setAttribute('aria-label', `Dorsal de ${row.playerName}`);
    jerseyCell.append(jerseyInput);
    tableRow.append(jerseyCell);

    const nameCell = document.createElement('td');
    nameCell.className = 'player-cell';
    nameCell.textContent = row.playerName;
    tableRow.append(nameCell);

    for (const [field, label] of statFields) {
      const cell = document.createElement('td');
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.step = '1';
      input.required = true;
      input.value = String(row[field]);
      input.dataset.row = String(rowIndex);
      input.dataset.field = field;
      input.setAttribute('aria-label', `${label} de ${row.playerName}`);
      cell.append(input);
      tableRow.append(cell);
    }
    return tableRow;
  }));
  elements['grid-meta'].textContent = `${extractedRows.length} jugadores · ${includedMatchCount} partido incluido`;
  updateSubmitState();
};

const sendCaptureMessage = (tabId) => new Promise((resolve, reject) => {
  chrome.tabs.sendMessage(tabId, { type: 'CAPTURE_COMPLEMENTARY_STATS' }, (response) => {
    const error = chrome.runtime.lastError?.message;
    if (error) reject(new Error(error));
    else resolve(response);
  });
});

const extractFromPage = async () => {
  if (!Number.isInteger(targetTabId) || targetTabId < 0) {
    throw new Error('Abre el importador desde el icono de la extensión en la página del partido.');
  }
  const tab = await chrome.tabs.get(targetTabId);
  if (!tab.url?.startsWith('https://pinetys.github.io/Estad-stiques-/')) {
    throw new Error('La pestaña de origen ya no está en Estad-stiques-.');
  }

  try {
    return await sendCaptureMessage(targetTabId);
  } catch (error) {
    if (!/Receiving end does not exist|Could not establish connection/i.test(error.message)) throw error;
    await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      files: ['parse-stats.js', 'content.js']
    });
    return sendCaptureMessage(targetTabId);
  }
};

const loadInitialOptions = async () => {
  try {
    await setOptions('season', 'seasons', {}, 'Selecciona temporada');
    catalogError = null;
    if (!captureInProgress && !extractedRows.length) setStatus('Catálogos listos. Selecciona el contexto del partido.');
  } catch (error) {
    catalogError = error.message;
    setStatus(`No se pudieron cargar los catálogos: ${catalogError}`, 'error');
  }
  setContextState();
};

const handleContextChange = async (changedId) => {
  const changedIndex = selectIds.indexOf(changedId);
  for (const id of selectIds.slice(changedIndex + 1)) {
    const index = selectIds.indexOf(id);
    const prompts = ['Selecciona temporada', 'Selecciona categoría', 'Selecciona competición', 'Selecciona jornada', 'Selecciona partido', 'Selecciona equipo'];
    resetSelect(id, prompts[index]);
  }
  elements['single-match-confirmation'].checked = false;

  try {
    if (changedId === 'season' && document.getElementById('season').value) {
      await setOptions('category', 'categories', { seasonId: document.getElementById('season').value }, 'Selecciona categoría');
    } else if (changedId === 'category' && document.getElementById('category').value) {
      await setOptions('competition', 'competitions', {
        seasonId: document.getElementById('season').value,
        categoryId: document.getElementById('category').value
      }, 'Selecciona competición');
    } else if (changedId === 'competition' && document.getElementById('competition').value) {
      await setOptions('matchday', 'matchdays', { competitionId: document.getElementById('competition').value }, 'Selecciona jornada');
    } else if (changedId === 'matchday' && document.getElementById('matchday').value) {
      await setOptions('match', 'matches', {
        competitionId: document.getElementById('competition').value,
        matchday: document.getElementById('matchday').value
      }, 'Selecciona partido');
    } else if (changedId === 'match' && document.getElementById('match').value) {
      await setOptions('team', 'teams', { matchId: document.getElementById('match').value }, 'Selecciona equipo');
    }
  } catch (error) {
    catalogError = error.message;
    setStatus(`No se pudieron cargar las opciones: ${error.message}`, 'error');
  }
  setContextState();
};

selectIds.forEach((id) => document.getElementById(id).addEventListener('change', () => {
  void handleContextChange(id);
}));

elements['reload-options'].addEventListener('click', () => {
  void loadInitialOptions();
});

elements['single-match-confirmation'].addEventListener('change', updateSubmitState);
elements['grid-body'].addEventListener('input', updateSubmitState);

const captureCurrentPage = async () => {
  elements['extract-button'].disabled = true;
  captureInProgress = true;
  setStatus('Leyendo la plantilla y verificando los partidos incluidos...');
  try {
    const response = await extractFromPage();
    if (!response?.ok) throw new Error(response?.error || 'No se pudo extraer la tabla.');
    includedMatchCount = response.data.includedMatchCount;
    if (includedMatchCount !== 1) throw new Error('La página debe tener exactamente un partido incluido.');
    extractedRows = response.data.rows;
    elements['single-match-confirmation'].disabled = false;
    elements['single-match-confirmation'].checked = false;
    renderGrid();
    setStatus(catalogError
      ? `Plantilla extraída; los combos no están disponibles: ${catalogError}`
      : 'Revisa la plantilla, selecciona el equipo y confirma que el partido coincide.', catalogError ? 'error' : 'success');
  } catch (error) {
    extractedRows = [];
    includedMatchCount = null;
    elements['single-match-confirmation'].disabled = true;
    elements['single-match-confirmation'].checked = false;
    renderGrid();
    setStatus(error.message, 'error');
  } finally {
    captureInProgress = false;
    elements['extract-button'].disabled = false;
  }
};

elements['extract-button'].addEventListener('click', () => {
  void captureCurrentPage();
});

const collectEditedRows = () => {
  const rows = extractedRows.map((row) => ({ ...row }));
  for (const input of elements['grid-body'].querySelectorAll('input[data-field]')) {
    if (!input.reportValidity()) throw new Error(`Valor no válido en ${input.getAttribute('aria-label')}.`);
    const row = rows[Number(input.dataset.row)];
    if (input.dataset.field === 'jerseyNumber') row.jerseyNumber = String(Number(input.value));
    else row[input.dataset.field] = Number(input.value);
  }
  const jerseys = rows.map((row) => row.jerseyNumber);
  if (new Set(jerseys).size !== jerseys.length) throw new Error('Hay dorsales repetidos en la grid.');
  return rows;
};

elements['submit-button'].addEventListener('click', async () => {
  elements['submit-button'].disabled = true;
  try {
    const rows = collectEditedRows();
    const context = {
      seasonId: document.getElementById('season').value,
      categoryId: document.getElementById('category').value,
      competitionId: document.getElementById('competition').value,
      matchday: Number(document.getElementById('matchday').value),
      matchId: document.getElementById('match').value,
      teamId: document.getElementById('team').value,
      includedMatchCount,
      confirmedSingleMatch: elements['single-match-confirmation'].checked
    };
    setStatus('Validando contexto y actualizando estadísticas...');
    const response = await apiRequest('/api/complementary-stats/import', 'POST', { context, rows });
    const dorsalSummary = response.updatedDorsals.map((dorsal) => `#${dorsal}`).join(', ');
    setStatus(`${response.updatedRows} filas actualizadas para ${response.teamName}: ${dorsalSummary}.`, 'success');
  } catch (error) {
    const updatedRows = Number(error.details?.updatedRows || 0);
    const updatedDorsals = Array.isArray(error.details?.updatedDorsals) ? error.details.updatedDorsals : [];
    const partialMessage = updatedRows > 0
      ? ` Se actualizaron ${updatedRows} filas (#${updatedDorsals.join(', #')}) antes del error.`
      : '';
    setStatus(`${error.message}${partialMessage}`, 'error');
  } finally {
    updateSubmitState();
  }
});

if (!Number.isInteger(targetTabId) || targetTabId < 0) {
  elements['extract-button'].disabled = true;
  setStatus('Abre esta herramienta desde el icono de la extensión en la página del partido.', 'error');
} else {
  void chrome.tabs.get(targetTabId).then((tab) => {
    if (!tab.url?.startsWith('https://pinetys.github.io/Estad-stiques-/')) {
      elements['extract-button'].disabled = true;
      setStatus('La pestaña de origen no es una página de Estad-stiques-.', 'error');
      return;
    }
    void captureCurrentPage();
  }).catch(() => {
    elements['extract-button'].disabled = true;
    setStatus('No se pudo recuperar la página de origen.', 'error');
  });
}

void loadInitialOptions();