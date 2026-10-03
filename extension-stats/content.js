(() => {
  const parser = globalThis.ComplementaryStatsParser;

  const getCells = (row) => Array.from(row.children).map((cell) => (cell.innerText || cell.textContent || '').trim());

  const getRows = (container) => {
    const semanticRows = Array.from(container.querySelectorAll('tr, [role="row"]'));
    if (semanticRows.length) return semanticRows;
    return Array.from(container.children).filter((row) => row.children.length >= 8);
  };

  const parsePlayerRow = (cells, indexes, rowNumber) => {
    let jerseyNumber;
    let playerName;
    if (indexes.combinedPlayerIndex >= 0) {
      const player = parser.parsePlayerCell(cells[indexes.combinedPlayerIndex]);
      if (!player) throw new Error(`No se pudo leer el dorsal y jugador de la fila ${rowNumber}.`);
      ({ jerseyNumber, playerName } = player);
    } else {
      jerseyNumber = parser.parseJersey(cells[indexes.jerseyIndex]);
      playerName = String(cells[indexes.playerNameIndex] ?? '').trim();
      if (!jerseyNumber || !playerName) throw new Error(`No se pudo leer el dorsal y jugador de la fila ${rowNumber}.`);
    }

    const t2 = parser.parseShooting(cells[indexes.t2]);
    const t3 = parser.parseShooting(cells[indexes.t3]);
    const tl = parser.parseShooting(cells[indexes.tl]);
    const rebounds = parser.parseInteger(cells[indexes.rebounds]);
    const assists = parser.parseInteger(cells[indexes.assists]);
    const steals = parser.parseInteger(cells[indexes.steals]);
    const turnovers = parser.parseInteger(cells[indexes.turnovers]);
    if (!t2 || !t3 || !tl || [rebounds, assists, steals, turnovers].some((value) => value === null)) {
      throw new Error(`Estadística no reconocida en la fila ${rowNumber} (${playerName}); revisa la tabla antes de importar.`);
    }

    return {
      jerseyNumber,
      playerName,
      t2Made: t2.made,
      t2Attempted: t2.attempted,
      t3Made: t3.made,
      t3Attempted: t3.attempted,
      tlMade: tl.made,
      tlAttempted: tl.attempted,
      rebounds,
      assists,
      steals,
      turnovers
    };
  };

  const extractStats = () => {
    const includedMatchCount = parser.parseIncludedMatchCount(document.body.innerText || document.body.textContent);
    if (includedMatchCount === null) {
      throw new Error('No se pudo verificar cuántos partidos están incluidos en las estadísticas.');
    }
    if (includedMatchCount !== 1) {
      throw new Error(`La tabla acumula ${includedMatchCount} partidos incluidos. Deja exactamente uno antes de continuar.`);
    }

    const containers = Array.from(document.querySelectorAll('table, [role="table"], [class*="table"], [class*="grid"]'));
    for (const container of containers) {
      const rows = getRows(container);
      const headerIndex = rows.findIndex((row) => parser.mapHeaders(getCells(row)) !== null);
      if (headerIndex < 0) continue;

      const headers = getCells(rows[headerIndex]);
      const indexes = parser.mapHeaders(headers);
      const playerRows = [];
      for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
        const cells = getCells(rows[rowIndex]);
        if (cells.every((cell) => !cell)) continue;
        playerRows.push(parsePlayerRow(cells, indexes, rowIndex + 1));
      }
      if (!playerRows.length) throw new Error('La tabla reconocida no contiene filas de jugadores.');
      return { includedMatchCount, rows: playerRows };
    }
    throw new Error('No se encontró la tabla Plantilla con las columnas estadísticas esperadas.');
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'CAPTURE_COMPLEMENTARY_STATS') return;
    try {
      sendResponse({ ok: true, data: extractStats() });
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });
})();