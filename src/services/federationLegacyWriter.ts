import type { FederationNormalizedMatch } from './federationNormalizer.js';

export interface FederationLegacyMetadata {
  temporada: string;
  categoria: string;
  competicion: string;
}

const slugFromText = (value: string): string => {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'entity';
};

export const toLegacyBigintId = (sourceId: string): string => {
  const maximumBigint = 9_223_372_036_854_775_807n;
  if (/^\d+$/.test(sourceId)) {
    const numericId = BigInt(sourceId);
    if (numericId <= maximumBigint) return numericId.toString();
  }

  let hash = 14_695_981_039_346_656_037n;
  for (let index = 0; index < sourceId.length; index += 1) {
    hash ^= BigInt(sourceId.charCodeAt(index));
    hash = (hash * 1_099_511_628_211n) & 0xffff_ffff_ffff_ffffn;
  }

  const syntheticId = (hash & ((1n << 61n) - 1n)) | (1n << 62n);
  return syntheticId.toString();
};

const throwOnError = (label: string, error: { message: string } | null) => {
  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }
};

const upsertOne = async (
  database: any,
  table: string,
  row: Record<string, any>,
  onConflict: string,
  label: string
) => {
  const { data, error } = await database
    .from(table)
    .upsert(row, { onConflict })
    .select()
    .single();

  throwOnError(label, error);
  if (!data) {
    throw new Error(`${label}: no row returned after upsert`);
  }
  return data;
};

export const persistFederationMatchToLegacy = async (
  normalized: FederationNormalizedMatch,
  metadata: FederationLegacyMetadata,
  matchDay: number | null,
  sourceUrl: string | undefined,
  database: any,
  onLog?: (message: string, type?: 'info' | 'success' | 'error' | 'data') => void
) => {
  const log = (message: string, type: 'info' | 'success' | 'error' | 'data' = 'info') => onLog?.(message, type);
  const seasonResult = await upsertOne(database, 'temporadas', { nombre: metadata.temporada }, 'nombre', 'Temporada');
  const categoryResult = await upsertOne(database, 'categorias', { nombre: metadata.categoria }, 'nombre', 'Categoría');
  const competitionResult = await upsertOne(database, 'competiciones', {
    nombre: metadata.competicion,
    temporada_id: seasonResult.id,
    categoria_id: categoryResult.id
  }, 'nombre,temporada_id,categoria_id', 'Competición');

  const teamIds = new Map<string, string>();

  for (const team of normalized.teams) {
    const club = await upsertOne(database, 'clubs', {
      nombre: team.clubName ?? team.name,
      nombre_corto: team.shortName ?? null
    }, 'nombre', `Club ${team.name}`);
    const providerTeamId = team.externalUuid ?? team.id;
    const numericProviderTeamId = /^\d+$/.test(providerTeamId) ? providerTeamId : null;
    const legacyTeam = await upsertOne(database, 'equipos', {
      club_id: club.id,
      competicion_id: competitionResult.id,
      nombre_especifico: team.name,
      ...(numericProviderTeamId ? { team_id_intern_fce: numericProviderTeamId } : {})
    }, 'club_id,competicion_id', `Equipo ${team.name}`);

    teamIds.set(team.id, legacyTeam.id);
    teamIds.set(slugFromText(providerTeamId), legacyTeam.id);
  }

  const localTeam = normalized.teams.find(team => team.name === normalized.match.localTeamName) ?? normalized.teams[0];
  const visitorTeam = normalized.teams.find(team => team.name === normalized.match.visitorTeamName) ?? normalized.teams[1];
  if (!localTeam || !visitorTeam) {
    throw new Error('El partido no contiene los dos equipos necesarios para persistirlo.');
  }

  const sourceMatchId = normalized.match.externalMatchUuid
    ?? sourceUrl?.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0]
    ?? `match-${slugFromText(`${normalized.match.localTeamName}-${normalized.match.visitorTeamName}-${normalized.match.date ?? 'unknown-date'}`)}`;
  const legacyMatchId = toLegacyBigintId(sourceMatchId);
  const matchDate = normalized.match.date && Number.isFinite(new Date(normalized.match.date).getTime())
    ? new Date(normalized.match.date).toISOString()
    : null;
  const match = await upsertOne(database, 'partidos', {
    id_match_extern: legacyMatchId,
    competicion_id: competitionResult.id,
    equipo_local_id: teamIds.get(localTeam.id),
    equipo_visitante_id: teamIds.get(visitorTeam.id),
    fecha_hora: matchDate,
    puntos_local: normalized.match.finalScoreLocal,
    puntos_visitante: normalized.match.finalScoreVisitor,
    jornada: matchDay
  }, 'id_match_extern', 'Partido');

  const { error: evolutionDeleteError } = await database.from('partido_marcador_evolucion').delete().eq('partido_id', match.id);
  throwOnError('Limpieza de evolución del marcador', evolutionDeleteError);
  const { error: movementsDeleteError } = await database.from('partido_movimientos').delete().eq('partido_id', match.id);
  throwOnError('Limpieza de movimientos', movementsDeleteError);

  const { data: oldStats, error: oldStatsError } = await database
    .from('estadisticas_jugador_partido')
    .select('id')
    .eq('partido_id', match.id);
  throwOnError('Consulta de estadísticas anteriores', oldStatsError);

  if (oldStats?.length) {
    const { error: oldShotsError } = await database
      .from('detalle_tiros_jugador')
      .delete()
      .in('estadistica_id', oldStats.map((row: { id: string }) => row.id));
    throwOnError('Limpieza de tiros anteriores', oldShotsError);
  }

  const { error: statsDeleteError } = await database.from('estadisticas_jugador_partido').delete().eq('partido_id', match.id);
  throwOnError('Limpieza de estadísticas anteriores', statsDeleteError);

  const playerIds = new Map<string, string>();
  const playerStats = new Map<string, FederationNormalizedMatch['playerStats'][number]>();
  for (const stat of normalized.playerStats) {
    if (stat.period === 0 || !playerStats.has(stat.playerId)) {
      playerStats.set(stat.playerId, stat);
    }
  }

  for (const player of normalized.players) {
    const teamId = player.teamId ? teamIds.get(player.teamId) : undefined;
    if (!teamId) continue;

    const legacyPlayer = await upsertOne(database, 'jugadores', {
      nombre_completo: player.name,
      actor_id: player.externalUuid ?? player.id
    }, 'nombre_completo', `Jugador ${player.name}`);
    playerIds.set(player.id, legacyPlayer.id);

    const { error: rosterError } = await database.from('plantillas').upsert({
      jugador_id: legacyPlayer.id,
      equipo_id: teamId,
      dorsal: player.dorsal ? String(player.dorsal) : null
    }, { onConflict: 'jugador_id,equipo_id' });
    throwOnError(`Plantilla ${player.name}`, rosterError);

    const stat = playerStats.get(player.id);
    const { data: matchStats, error: matchStatsError } = await database
      .from('estadisticas_jugador_partido')
      .upsert({
        partido_id: match.id,
        jugador_id: legacyPlayer.id,
        dorsal: player.dorsal ? String(player.dorsal) : null,
        puntos: stat?.pts ?? 0,
        valoracion: 0,
        tiempo_jugado: stat?.secondsPlayed ?? 0,
        asistencias: 0,
        tapones: 0,
        faltas_cometidas: stat?.fc ?? 0,
        t1_anotados: stat?.ftm ?? 0,
        t2_anotados: stat?.t2m ?? 0,
        t3_anotados: stat?.t3m ?? 0,
        t1_intentados: stat?.fta ?? 0,
        t2_intentados: stat?.t2a ?? 0,
        t3_intentados: stat?.t3a ?? 0
      }, { onConflict: 'partido_id,jugador_id' })
      .select()
      .single();
    throwOnError(`Estadísticas ${player.name}`, matchStatsError);
    if (!matchStats) throw new Error(`Estadísticas ${player.name}: no se devolvió la fila guardada`);

    const shots = normalized.shots
      .filter(shot => shot.playerId === player.id && shot.shotType && shot.made !== null && shot.made !== undefined)
      .map(shot => {
        const shotNumber = shot.shotType?.match(/[123]/)?.[0];
        if (!shotNumber) return null;
        return {
          estadistica_id: matchStats.id,
          tipo_tiro: `${shotNumber}pt`,
          periodo: shot.period,
          minuto: shot.minute ?? 0,
          segundo: shot.second ?? 0,
          x: shot.x ?? 0,
          y: shot.y ?? 0,
          x_norm: 0,
          y_norm: 0,
          event_uuid: shot.eventUuid
        };
      })
      .filter((shot): shot is NonNullable<typeof shot> => shot !== null);

    if (shots.length) {
      const { error: shotsError } = await database
        .from('detalle_tiros_jugador')
        .upsert(shots, { onConflict: 'event_uuid' });
      throwOnError(`Tiros ${player.name}`, shotsError);
    }
  }

  if (normalized.scoreEvolution.length) {
    const scoreRows = normalized.scoreEvolution.map(entry => ({
      partido_id: match.id,
      periodo: entry.period,
      minuto_cuarto: entry.minute ?? 0,
      minuto_absoluto: Math.max(0, (entry.period - 1) * 10 + (entry.minute ?? 0)),
      puntos_local: entry.localScore,
      puntos_visitante: entry.visitorScore,
      diferencia: entry.localScore - entry.visitorScore
    }));
    const { error } = await database.from('partido_marcador_evolucion').insert(scoreRows);
    throwOnError('Evolución del marcador', error);
  }

  const movementRows = normalized.events.map(event => {
    const teamDbId = event.teamId ? teamIds.get(event.teamId) : undefined;
    const playerDbId = event.playerId ? playerIds.get(event.playerId) : undefined;
    const score = event.localScore === null || event.localScore === undefined
      || event.visitorScore === null || event.visitorScore === undefined
      ? ''
      : `${event.localScore}-${event.visitorScore}`;

    return {
      partido_id: match.id,
      periodo: event.period,
      minuto: event.minute ?? 0,
      segundo: event.second ?? 0,
      tipo_movimiento: String(event.externalEventTypeId ?? event.eventTypeCode ?? 'EVENTO'),
      descripcion: event.eventTypeCode ?? '',
      jugador_id: playerDbId ?? null,
      equipo_id: teamDbId ?? null,
      marcador: score,
      event_uuid: event.eventUuid
    };
  });

  const startingRows = normalized.players
    .filter(player => player.starting)
    .map(player => {
      const teamDbId = player.teamId ? teamIds.get(player.teamId) : undefined;
      const playerDbId = playerIds.get(player.id);
      if (!teamDbId || !playerDbId) return null;
      return {
        partido_id: match.id,
        periodo: 1,
        minuto: 6,
        segundo: 0,
        tipo_movimiento: '112',
        descripcion: 'Entra al camp',
        jugador_id: playerDbId,
        equipo_id: teamDbId,
        marcador: '0-0',
        event_uuid: `start_${match.id}_${playerDbId}`
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
  const allMovementRows = [...startingRows, ...movementRows];

  if (allMovementRows.length) {
    const { error } = await database
      .from('partido_movimientos')
      .upsert(allMovementRows, { onConflict: 'event_uuid' });
    throwOnError('Movimientos del partido', error);
  }

  log(`Partido ${sourceMatchId} guardado con clave legacy ${legacyMatchId}`, 'success');
  return {
    matchId: match.id,
    sourceMatchId,
    externalMatchId: legacyMatchId,
    seasonName: metadata.temporada,
    categoryName: metadata.categoria,
    competitionName: metadata.competicion,
    localTeam: normalized.match.localTeamName,
    visitorTeam: normalized.match.visitorTeamName,
    score: `${normalized.match.finalScoreLocal}-${normalized.match.finalScoreVisitor}`
  };
};
