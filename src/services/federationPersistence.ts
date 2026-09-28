import { supabase } from '../lib/supabase';
import { normalizeFederationMatch, type FederationNormalizedMatch } from './federationNormalizer';

export type FederationLogType = 'info' | 'success' | 'error' | 'data';

const normalizeString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return value === null || value === undefined ? null : String(value);
};

const findOne = async (table: string, filters: Array<{ field: string; value: unknown }>) => {
  let query = supabase.from(table).select('*');

  for (const filter of filters) {
    const value = filter.value;
    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === 'string' && value.length === 0) {
      continue;
    }

    query = query.eq(filter.field, value);
  }

  const { data, error } = await query.limit(1);
  if (error) {
    throw new Error(`${table} query failed: ${error.message}`);
  }
  return data?.[0] ?? null;
};

const upsertEntity = async (
  table: string,
  row: Record<string, any>,
  filters: Array<{ field: string; value: unknown }>,
  label: string,
  log?: (msg: string, type?: FederationLogType) => void
) => {
  const existing = await findOne(table, filters);
  if (existing) {
    const { data, error } = await supabase
      .from(table)
      .update(row)
      .eq('id', existing.id)
      .select();

    if (error) {
      throw new Error(`${label}: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error(`${label}: no row returned after update`);
    }

    log?.(`✅ ${label} actualizado`, 'success');
    return data[0];
  }

  const { data, error } = await supabase
    .from(table)
    .insert(row)
    .select();

  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error(`${label}: no row returned after insert`);
  }

  log?.(`✅ ${label} creado`, 'success');
  return data[0];
};

const deleteByMatchId = async (table: string, matchId: string, log?: (msg: string, type?: FederationLogType) => void) => {
  const { error } = await supabase.from(table).delete().eq('match_id', matchId);
  if (error) {
    log?.(`⚠️ No se pudo limpiar ${table}: ${error.message}`, 'error');
  }
};

export const isFederationPayload = (payload: any): boolean => {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  return Boolean(
    payload.header ||
    payload.boxscore ||
    payload.shotChart ||
    payload.scoreEvolution ||
    payload.visibility ||
    payload.playByPlay
  );
};

export const upsertFederationMatchToSupabase = async (
  mainJson: any,
  pbpJson: any,
  onLog?: (msg: string, type?: FederationLogType) => void
) => {
  const log = (msg: string, type: FederationLogType = 'info') => {
    console.log(`[FederationPersistence] ${msg}`);
    if (onLog) {
      onLog(msg, type);
    }
  };

  const normalized: FederationNormalizedMatch = normalizeFederationMatch(mainJson, pbpJson);

  log('Normalizando payload federativo para persistencia canonical', 'info');

  const seasonRow = await upsertEntity(
    'seasons',
    {
      name: normalized.season.name,
      external_uuid: normalized.season.externalUuid ?? null
    },
    [{ field: 'name', value: normalized.season.name }],
    'season',
    log
  );

  const categoryRow = await upsertEntity(
    'categories',
    {
      name: normalized.category.name,
      external_uuid: normalized.category.externalUuid ?? null
    },
    [{ field: 'name', value: normalized.category.name }],
    'category',
    log
  );

  const competitionRow = await upsertEntity(
    'competitions',
    {
      season_id: seasonRow.id,
      category_id: categoryRow.id,
      name: normalized.competition.name,
      external_uuid: normalized.competition.externalUuid ?? null
    },
    [
      { field: 'season_id', value: seasonRow.id },
      { field: 'category_id', value: categoryRow.id },
      { field: 'name', value: normalized.competition.name }
    ],
    'competition',
    log
  );

  let groupRow: any = null;
  if (normalized.group) {
    groupRow = await upsertEntity(
      'competition_groups',
      {
        competition_id: competitionRow.id,
        name: normalized.group.name,
        external_uuid: normalized.group.externalUuid ?? null
      },
      [
        { field: 'competition_id', value: competitionRow.id },
        { field: 'name', value: normalized.group.name }
      ],
      'group',
      log
    );
  }

  const clubRows = new Map<string, any>();
  for (const club of normalized.clubs) {
    const clubRow = await upsertEntity(
      'clubs',
      {
        name: club.name,
        short_name: club.shortName ?? null,
        external_uuid: club.externalUuid ?? null
      },
      [{ field: 'name', value: club.name }],
      `club ${club.name}`,
      log
    );

    clubRows.set(club.name, clubRow);
  }

  const teamRows = new Map<string, any>();
  for (const team of normalized.teams) {
    const clubRow = clubRows.get(team.clubName ?? team.name) ?? clubRows.values().next().value ?? null;
    const teamRow = await upsertEntity(
      'teams',
      {
        club_id: clubRow?.id ?? null,
        competition_id: competitionRow.id,
        name: team.name,
        short_name: team.shortName ?? null,
        external_uuid: team.externalUuid ?? null
      },
      [
        { field: 'competition_id', value: competitionRow.id },
        { field: 'name', value: team.name }
      ],
      `team ${team.name}`,
      log
    );

    teamRows.set(team.name, teamRow);
  }

  const playerRows = new Map<string, any>();
  for (const player of normalized.players) {
    const playerRow = await upsertEntity(
      'players',
      {
        name: player.name,
        short_name: player.shortName ?? null,
        external_uuid: player.externalUuid ?? null
      },
      [{ field: 'name', value: player.name }],
      `player ${player.name}`,
      log
    );

    playerRows.set(player.id, playerRow);
  }

  for (const roster of normalized.rosters) {
    const teamRow = teamRows.get(normalized.teams.find(team => team.id === roster.teamId)?.name ?? '');
    const playerRow = playerRows.get(roster.playerId);
    if (!teamRow || !playerRow) {
      continue;
    }

    await upsertEntity(
      'team_rosters',
      {
        team_id: teamRow.id,
        player_id: playerRow.id,
        season_id: seasonRow.id,
        dorsal: roster.dorsal ?? null,
        captain: Boolean(roster.captain),
        starting: Boolean(roster.starting)
      },
      [
        { field: 'team_id', value: teamRow.id },
        { field: 'player_id', value: playerRow.id },
        { field: 'season_id', value: seasonRow.id }
      ],
      `roster ${teamRow.name}/${playerRow.name}`,
      log
    );
  }

  const localTeam = teamRows.get(normalized.match.localTeamName) ?? teamRows.values().next().value;
  const visitorTeam = teamRows.get(normalized.match.visitorTeamName) ?? Array.from(teamRows.values())[1] ?? localTeam;

  const matchRow = await upsertEntity(
    'matches',
    {
      competition_id: competitionRow.id,
      season_id: seasonRow.id,
      competition_group_id: groupRow?.id ?? null,
      local_team_id: localTeam?.id ?? null,
      visitor_team_id: visitorTeam?.id ?? null,
      match_day_num: normalized.match.matchDayNum ?? null,
      match_date: normalizeString(normalized.match.date) ? new Date(normalized.match.date as string).toISOString() : null,
      local_team_name: normalized.match.localTeamName,
      visitor_team_name: normalized.match.visitorTeamName,
      final_score_local: normalized.match.finalScoreLocal,
      final_score_visitor: normalized.match.finalScoreVisitor,
      external_match_uuid: normalized.match.externalMatchUuid ?? null,
      external_group_uuid: normalized.match.externalGroupUuid ?? null,
      external_competition_uuid: normalized.match.externalCompetitionUuid ?? null,
      external_category_uuid: normalized.match.externalCategoryUuid ?? null
    },
    [
      { field: 'competition_id', value: competitionRow.id },
      { field: 'season_id', value: seasonRow.id },
      { field: 'local_team_id', value: localTeam?.id ?? null },
      { field: 'visitor_team_id', value: visitorTeam?.id ?? null },
      { field: 'match_date', value: normalizeString(normalized.match.date) ? new Date(normalized.match.date as string).toISOString() : null }
    ],
    'match',
    log
  );

  await deleteByMatchId('match_score_evolution', matchRow.id, log);
  for (const scoreEntry of normalized.scoreEvolution) {
    await supabase.from('match_score_evolution').insert({
      match_id: matchRow.id,
      period: scoreEntry.period,
      minute: scoreEntry.minute ?? null,
      second: scoreEntry.second ?? null,
      local_score: scoreEntry.localScore,
      visitor_score: scoreEntry.visitorScore
    });
  }

  const event_type_codes = new Set(normalized.events.map(event => event.eventTypeCode).filter(Boolean));
  for (const code of event_type_codes) {
    const normalizedCode = String(code);
    const existingEventType = await findOne('event_types', [{ field: 'code', value: normalizedCode }]);
    if (!existingEventType) {
      await supabase.from('event_types').insert({ code: normalizedCode, name: normalizedCode });
    }
  }

  await deleteByMatchId('match_events', matchRow.id, log);
  for (const event of normalized.events) {
    const eventTypeRow = await findOne('event_types', [{ field: 'code', value: event.eventTypeCode ?? '' }]);
    const teamId = event.teamId ? teamRows.get(normalized.teams.find(team => team.id === event.teamId)?.name ?? '')?.id ?? null : null;
    const playerId = event.playerId ? playerRows.get(event.playerId)?.id ?? null : null;

    await supabase.from('match_events').insert({
      match_id: matchRow.id,
      team_id: teamId,
      player_id: playerId,
      event_type_id: eventTypeRow?.id ?? null,
      external_event_type_id: event.externalEventTypeId ?? null,
      external_event_sub_type_id: event.externalEventSubTypeId ?? null,
      event_type_code: event.eventTypeCode ?? null,
      period: event.period,
      minute: event.minute ?? null,
      second: event.second ?? null,
      local_score: event.localScore ?? null,
      visitor_score: event.visitorScore ?? null,
      dorsal: event.dorsal ?? null,
      actor_name: event.actorName ?? null,
      event_uuid: event.eventUuid ? event.eventUuid : null
    });
  }

  await deleteByMatchId('match_shots', matchRow.id, log);
  for (const shot of normalized.shots) {
    const teamId = shot.teamId ? teamRows.get(normalized.teams.find(team => team.id === shot.teamId)?.name ?? '')?.id ?? null : null;
    const playerId = shot.playerId ? playerRows.get(shot.playerId)?.id ?? null : null;

    await supabase.from('match_shots').insert({
      match_id: matchRow.id,
      team_id: teamId,
      player_id: playerId,
      event_uuid: shot.eventUuid ? shot.eventUuid : null,
      period: shot.period ?? null,
      minute: shot.minute ?? null,
      second: shot.second ?? null,
      x: shot.x ?? null,
      y: shot.y ?? null,
      made: shot.made ?? null,
      shot_type: shot.shotType ?? null,
      shot_value: null
    });
  }

  log(`✅ Importación federativa completada para ${normalized.match.localTeamName} vs ${normalized.match.visitorTeamName}`, 'success');
  return matchRow;
};
