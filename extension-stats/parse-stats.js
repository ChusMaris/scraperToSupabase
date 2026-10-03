(() => {
  const normalizeText = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const parseShooting = (value) => {
    const match = String(value ?? '').match(/^\s*(\d+)\s*\/\s*(\d+)(?:\s*\([^)]*\))?\s*$/);
    if (!match) return null;
    const made = Number(match[1]);
    const attempted = Number(match[2]);
    if (!Number.isSafeInteger(made) || !Number.isSafeInteger(attempted) || made > attempted) return null;
    return { made, attempted };
  };

  const parseInteger = (value) => {
    const normalized = String(value ?? '').trim();
    if (!/^\d+$/.test(normalized)) return null;
    const number = Number(normalized);
    return Number.isSafeInteger(number) ? number : null;
  };

  const parseJersey = (value) => {
    const match = String(value ?? '').match(/^\s*#?\s*(\d+)\s*$/);
    return match ? match[1] : null;
  };

  const parsePlayerCell = (value) => {
    const match = String(value ?? '').trim().match(/^#\s*(\d+)\s+(.+?)\s*$/);
    return match ? { jerseyNumber: match[1], playerName: match[2] } : null;
  };

  const mapHeaders = (headers) => {
    const normalized = headers.map(normalizeText);
    const find = (predicate) => normalized.findIndex(predicate);
    const combinedPlayerIndex = find((header) => header.includes('jugador') && header.includes('#'));
    const jerseyIndex = find((header) => header === '#' || header.includes('dorsal'));
    const playerNameIndex = find((header) => header === 'jugador' || header === 'nombre');
    const indexes = {
      combinedPlayerIndex,
      jerseyIndex,
      playerNameIndex,
      t2: find((header) => /^t2\b/.test(header)),
      t3: find((header) => /^t3\b/.test(header)),
      tl: find((header) => /^(tl|t1)\b/.test(header)),
      rebounds: find((header) => /^reb\b/.test(header)),
      assists: find((header) => /^ast\b/.test(header)),
      steals: find((header) => /^rob\b/.test(header)),
      turnovers: find((header) => /^per\b/.test(header))
    };
    if ((combinedPlayerIndex < 0 && (jerseyIndex < 0 || playerNameIndex < 0))
      || Object.entries(indexes).some(([key, index]) => !['combinedPlayerIndex', 'jerseyIndex', 'playerNameIndex'].includes(key) && index < 0)) {
      return null;
    }
    return indexes;
  };

  const parseIncludedMatchCount = (value) => {
    const text = String(value ?? '');
    const counts = new Set();
    for (const match of text.matchAll(/(?:en\s+los?\s+)?(\d+)\s+partidos?\s+incluidos?/gi)) {
      counts.add(Number(match[1]));
    }
    for (const match of text.matchAll(/(\d+)\s+de\s+\d+\s+incluidos?/gi)) {
      counts.add(Number(match[1]));
    }
    return counts.size === 1 ? [...counts][0] : null;
  };

  globalThis.ComplementaryStatsParser = {
    normalizeText,
    parseShooting,
    parseInteger,
    parseJersey,
    parsePlayerCell,
    mapHeaders,
    parseIncludedMatchCount
  };
})();