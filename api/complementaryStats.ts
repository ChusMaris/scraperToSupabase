type SupabaseLike = {
  from: (table: string) => any;
};

type Option = { id: string | number; name: string };
type ImportContext = {
  seasonId: string;
  categoryId: string;
  competitionId: string;
  matchday: number;
  matchId: string;
  teamId: string;
  includedMatchCount: number;
  confirmedSingleMatch: boolean;
};
type ImportRow = {
  jerseyNumber: string;
  playerName?: string;
  t2Made: number;
  t2Attempted: number;
  t3Made: number;
  t3Attempted: number;
  tlMade: number;
  tlAttempted: number;
  rebounds: number;
  assists: number;
  steals: number;
  turnovers: number;
};

const isId = (value: unknown): value is string =>
  (typeof value === 'string' || typeof value === 'number') && String(value).trim().length > 0;

const requiredId = (value: unknown, label: string): string => {
  if (!isId(value)) throw Object.assign(new Error(`${label} es obligatorio.`), { statusCode: 400 });
  return String(value).trim();
};

const readRows = async (query: any, label: string): Promise<any[]> => {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data ?? [];
};

const readSingle = async (query: any, label: string): Promise<any | null> => {
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`${label}: ${error.message}`);
  return data ?? null;
};

const normalizeJersey = (value: unknown): string | null => {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) return null;
  const number = Number(text);
  return Number.isSafeInteger(number) ? String(number) : null;
};

export const getComplementaryStatsOptions = async (
  database: SupabaseLike,
  parameters: URLSearchParams
): Promise<Option[]> => {
  const type = parameters.get('type');

  if (type === 'seasons') {
    const rows = await readRows(database.from('temporadas').select('id,nombre').order('nombre'), 'Temporadas');
    return rows.map((row) => ({ id: row.id, name: row.nombre }));
  }

  if (type === 'categories') {
    const seasonId = requiredId(parameters.get('seasonId'), 'Temporada');
    const rows = await readRows(database.from('competiciones')
      .select('categoria_id,categorias(id,nombre)')
      .eq('temporada_id', seasonId)
      .is('deleted_at', null)
      .order('nombre'), 'Categorías');
    const options = new Map<string, Option>();
    for (const row of rows) {
      const categories = Array.isArray(row.categorias) ? row.categorias : [row.categorias];
      for (const category of categories) {
        if (category?.id !== undefined && category.nombre) {
          options.set(String(category.id), { id: category.id, name: category.nombre });
        }
      }
    }
    return [...options.values()].sort((first, second) => first.name.localeCompare(second.name));
  }

  if (type === 'competitions') {
    const seasonId = requiredId(parameters.get('seasonId'), 'Temporada');
    const categoryId = requiredId(parameters.get('categoryId'), 'Categoría');
    const rows = await readRows(database.from('competiciones')
      .select('id,nombre')
      .eq('temporada_id', seasonId)
      .eq('categoria_id', categoryId)
      .is('deleted_at', null)
      .order('nombre'), 'Competiciones');
    return rows.map((row) => ({ id: row.id, name: row.nombre }));
  }

  if (type === 'matchdays') {
    const competitionId = requiredId(parameters.get('competitionId'), 'Competición');
    const rows = await readRows(database.from('partidos')
      .select('jornada')
      .eq('competicion_id', competitionId)
      .is('deleted_at', null)
      .not('jornada', 'is', null)
      .order('jornada'), 'Jornadas');
    return [...new Set(rows.map((row) => Number(row.jornada)).filter((day) => Number.isInteger(day) && day > 0))]
      .sort((first, second) => first - second)
      .map((day) => ({ id: day, name: `Jornada ${day}` }));
  }

  if (type === 'matches') {
    const competitionId = requiredId(parameters.get('competitionId'), 'Competición');
    const matchday = Number(parameters.get('matchday'));
    if (!Number.isInteger(matchday) || matchday <= 0) throw Object.assign(new Error('Jornada no válida.'), { statusCode: 400 });
    const matches = await readRows(database.from('partidos')
      .select('id,fecha_hora,jornada,equipo_local_id,equipo_visitante_id,puntos_local,puntos_visitante')
      .eq('competicion_id', competitionId)
      .eq('jornada', matchday)
      .is('deleted_at', null)
      .order('fecha_hora'), 'Partidos');
    const teamIds = [...new Set(matches.flatMap((match) => [match.equipo_local_id, match.equipo_visitante_id]).filter(isId))];
    if (!teamIds.length) return [];
    const teams = await readRows(database.from('equipos').select('id,nombre_especifico')
      .in('id', teamIds)
      .is('deleted_at', null), 'Equipos');
    const teamNames = new Map(teams.map((team) => [String(team.id), team.nombre_especifico]));
    return matches.map((match) => {
      const date = match.fecha_hora ? new Date(match.fecha_hora).toLocaleDateString('es-ES') : 'Sin fecha';
      const home = teamNames.get(String(match.equipo_local_id)) || 'Equipo local';
      const away = teamNames.get(String(match.equipo_visitante_id)) || 'Equipo visitante';
      return {
        id: match.id,
        name: `${home} ${match.puntos_local ?? '-'} - ${match.puntos_visitante ?? '-'} ${away} · ${date}`
      };
    });
  }

  if (type === 'teams') {
    const matchId = requiredId(parameters.get('matchId'), 'Partido');
    const match = await readSingle(database.from('partidos')
      .select('equipo_local_id,equipo_visitante_id')
      .eq('id', matchId), 'Partido');
    if (!match) return [];
    const teamIds = [...new Set([match.equipo_local_id, match.equipo_visitante_id].filter(isId))];
    const rows = await readRows(database.from('equipos').select('id,nombre_especifico')
      .in('id', teamIds)
      .is('deleted_at', null), 'Equipos');
    return rows.map((row) => ({ id: row.id, name: row.nombre_especifico }));
  }

  throw Object.assign(new Error('Tipo de catálogo no reconocido.'), { statusCode: 400 });
};

const validateContext = (value: unknown): ImportContext => {
  if (!value || typeof value !== 'object') throw Object.assign(new Error('Falta el contexto del partido.'), { statusCode: 400 });
  const context = value as Record<string, unknown>;
  const matchday = Number(context.matchday);
  if (!Number.isInteger(matchday) || matchday <= 0) throw Object.assign(new Error('Jornada no válida.'), { statusCode: 400 });
  if (Number(context.includedMatchCount) !== 1 || context.confirmedSingleMatch !== true) {
    throw Object.assign(new Error('Confirma que la página muestra únicamente el partido seleccionado.'), { statusCode: 400 });
  }
  return {
    seasonId: requiredId(context.seasonId, 'Temporada'),
    categoryId: requiredId(context.categoryId, 'Categoría'),
    competitionId: requiredId(context.competitionId, 'Competición'),
    matchday,
    matchId: requiredId(context.matchId, 'Partido'),
    teamId: requiredId(context.teamId, 'Equipo'),
    includedMatchCount: 1,
    confirmedSingleMatch: true
  };
};

const numericFields = [
  't2Made', 't2Attempted', 't3Made', 't3Attempted', 'tlMade', 'tlAttempted',
  'rebounds', 'assists', 'steals', 'turnovers'
] as const;

const validateRows = (value: unknown): ImportRow[] => {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw Object.assign(new Error('El lote debe contener entre 1 y 100 jugadores.'), { statusCode: 400 });
  }
  const jerseys = new Set<string>();
  return value.map((candidate, index) => {
    if (!candidate || typeof candidate !== 'object') {
      throw Object.assign(new Error(`Fila ${index + 1}: formato no válido.`), { statusCode: 400 });
    }
    const row = candidate as Record<string, unknown>;
    const jerseyNumber = normalizeJersey(row.jerseyNumber);
    if (!jerseyNumber) throw Object.assign(new Error(`Fila ${index + 1}: dorsal no válido.`), { statusCode: 400 });
    if (jerseys.has(jerseyNumber)) throw Object.assign(new Error(`Dorsal duplicado: ${jerseyNumber}.`), { statusCode: 400 });
    jerseys.add(jerseyNumber);

    const stats = {} as Record<(typeof numericFields)[number], number>;
    for (const field of numericFields) {
      const number = row[field];
      if (typeof number !== 'number' || !Number.isSafeInteger(number) || number < 0) {
        throw Object.assign(new Error(`Dorsal ${jerseyNumber}: ${field} debe ser un entero no negativo.`), { statusCode: 400 });
      }
      stats[field] = number;
    }
    if (stats.t2Made > stats.t2Attempted || stats.t3Made > stats.t3Attempted || stats.tlMade > stats.tlAttempted) {
      throw Object.assign(new Error(`Dorsal ${jerseyNumber}: los anotados no pueden superar los intentados.`), { statusCode: 400 });
    }
    return { jerseyNumber, playerName: String(row.playerName ?? ''), ...stats } as ImportRow;
  });
};

export const importComplementaryStats = async (
  database: SupabaseLike,
  rawContext: unknown,
  rawRows: unknown
): Promise<{ updatedRows: number; updatedDorsals: string[]; teamName: string }> => {
  const context = validateContext(rawContext);
  const rows = validateRows(rawRows);

  const competition = await readSingle(database.from('competiciones')
    .select('id,temporada_id,categoria_id')
    .eq('id', context.competitionId)
    .eq('temporada_id', context.seasonId)
    .eq('categoria_id', context.categoryId)
    .is('deleted_at', null), 'Competición');
  if (!competition) throw Object.assign(new Error('La competición no pertenece a la temporada y categoría seleccionadas.'), { statusCode: 400 });

  const match = await readSingle(database.from('partidos')
    .select('id,competicion_id,jornada,equipo_local_id,equipo_visitante_id')
    .eq('id', context.matchId)
    .is('deleted_at', null), 'Partido');
  if (!match || String(match.competicion_id) !== context.competitionId || Number(match.jornada) !== context.matchday) {
    throw Object.assign(new Error('El partido no pertenece a la competición y jornada seleccionadas.'), { statusCode: 400 });
  }
  if (![match.equipo_local_id, match.equipo_visitante_id].some((teamId) => String(teamId) === context.teamId)) {
    throw Object.assign(new Error('El equipo seleccionado no participa en el partido.'), { statusCode: 400 });
  }

  const team = await readSingle(database.from('equipos').select('id,nombre_especifico')
    .eq('id', context.teamId)
    .is('deleted_at', null), 'Equipo');
  if (!team) throw Object.assign(new Error('El equipo seleccionado no existe.'), { statusCode: 400 });

  const [roster, matchStats] = await Promise.all([
    readRows(database.from('plantillas').select('jugador_id,dorsal')
      .eq('equipo_id', context.teamId)
      .is('deleted_at', null), 'Plantilla'),
    readRows(database.from('estadisticas_jugador_partido')
      .select('id,jugador_id,dorsal')
      .eq('partido_id', context.matchId)
      .is('deleted_at', null), 'Estadísticas del partido')
  ]);
  const targets = rows.map((row) => {
    const matchingRoster = roster.filter((player) => normalizeJersey(player.dorsal) === row.jerseyNumber);
    if (matchingRoster.length !== 1) {
      throw Object.assign(new Error(`Dorsal ${row.jerseyNumber}: ${matchingRoster.length ? 'está repetido en el equipo' : 'no pertenece a la plantilla del equipo'}.`), {
        statusCode: 400,
        failedJersey: row.jerseyNumber
      });
    }
    const playerId = String(matchingRoster[0].jugador_id);
    const matchingStats = matchStats.filter((stat) => String(stat.jugador_id) === playerId);
    if (matchingStats.length !== 1) {
      throw Object.assign(new Error(`Dorsal ${row.jerseyNumber}: no tiene una fila única de estadísticas para este partido.`), {
        statusCode: 400,
        failedJersey: row.jerseyNumber
      });
    }
    const statJersey = normalizeJersey(matchingStats[0].dorsal);
    if (statJersey && statJersey !== row.jerseyNumber) {
      throw Object.assign(new Error(`Dorsal ${row.jerseyNumber}: no coincide con el dorsal registrado para este partido.`), {
        statusCode: 400,
        failedJersey: row.jerseyNumber
      });
    }
    return { row, stat: matchingStats[0] };
  });
  if (new Set(targets.map(({ stat }) => String(stat.id))).size !== targets.length) {
    throw Object.assign(new Error('Dos dorsales resuelven a la misma fila de estadísticas.'), { statusCode: 400 });
  }

  let updatedRows = 0;
  const updatedDorsals: string[] = [];
  for (const { row, stat } of targets) {
    const { data, error } = await database.from('estadisticas_jugador_partido').update({
      t2_anotados: row.t2Made,
      t2_intentados: row.t2Attempted,
      t3_anotados: row.t3Made,
      t3_intentados: row.t3Attempted,
      t1_anotados: row.tlMade,
      t1_intentados: row.tlAttempted,
      rebotes_totales: row.rebounds,
      asistencias: row.assists,
      robos: row.steals,
      perdidas: row.turnovers
    }).eq('id', stat.id).select('id');
    if (error || !data?.length) {
      throw Object.assign(new Error(`Error al actualizar dorsal ${row.jerseyNumber}: ${error?.message || 'no se actualizó ninguna fila'}.`), {
        statusCode: 500,
        updatedRows,
        updatedDorsals,
        failedJersey: row.jerseyNumber
      });
    }
    updatedRows += 1;
    updatedDorsals.push(row.jerseyNumber);
  }
  return { updatedRows, updatedDorsals, teamName: team.nombre_especifico };
};