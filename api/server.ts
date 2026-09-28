import express from 'express';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { normalizeFederationMatch } from '../src/services/federationNormalizer.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(express.json({ limit: '25mb' }));

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[api] Missing Supabase env values. Import endpoint will fail until they are configured.');
}

const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const validateBundle = (body: any) => {
  if (!body || typeof body !== 'object') {
    return 'Request body is not an object';
  }

  const hasStats = !!body.statsPayload || !!body.mainJson;
  const hasPbp = !!body.pbpPayload || !!body.movesJson;

  if (!hasStats || !hasPbp) {
    return 'The request must include both statsPayload and pbpPayload';
  }

  if (!body.statsPayload && !body.mainJson) {
    return 'Missing stats payload';
  }

  if (!body.pbpPayload && !body.movesJson) {
    return 'Missing PBP payload';
  }

  return null;
};

const upsertEntity = async (table: string, row: Record<string, any>, filters: Array<{ field: string; value: any }>) => {
  if (!supabase) {
    throw new Error('Supabase client is not configured');
  }

  const query = supabase.from(table).select('*');
  let withFilter = query;

  for (const filter of filters) {
    if (filter.value !== null && filter.value !== undefined && filter.value !== '') {
      withFilter = withFilter.eq(filter.field, filter.value);
    }
  }

  const { data: existingRows, error: selectError } = await withFilter.limit(1);
  if (selectError) {
    throw new Error(`${table} select failed: ${selectError.message}`);
  }

  if (existingRows && existingRows.length > 0) {
    const { error } = await supabase.from(table).update(row).eq('id', existingRows[0].id);
    if (error) throw new Error(`${table} update failed: ${error.message}`);
    return existingRows[0];
  }

  const { data, error } = await supabase.from(table).insert(row).select();
  if (error) throw new Error(`${table} insert failed: ${error.message}`);
  return data?.[0];
};

const persistMatch = async (statsPayload: any, pbpPayload: any) => {
  if (!supabase) {
    throw new Error('Supabase client is not configured');
  }

  const normalized = normalizeFederationMatch(statsPayload, pbpPayload);

  const season = await upsertEntity('seasons', {
    name: normalized.season.name,
    external_uuid: normalized.season.externalUuid ?? null
  }, [{ field: 'name', value: normalized.season.name }]);

  const category = await upsertEntity('categories', {
    name: normalized.category.name,
    external_uuid: normalized.category.externalUuid ?? null
  }, [{ field: 'name', value: normalized.category.name }]);

  const competition = await upsertEntity('competitions', {
    season_id: season.id,
    category_id: category.id,
    name: normalized.competition.name,
    external_uuid: normalized.competition.externalUuid ?? null
  }, [
    { field: 'season_id', value: season.id },
    { field: 'category_id', value: category.id },
    { field: 'name', value: normalized.competition.name }
  ]);

  let group: any = null;
  if (normalized.group) {
    group = await upsertEntity('competition_groups', {
      competition_id: competition.id,
      name: normalized.group.name,
      external_uuid: normalized.group.externalUuid ?? null
    }, [
      { field: 'competition_id', value: competition.id },
      { field: 'name', value: normalized.group.name }
    ]);
  }

  const clubs = new Map<string, any>();
  for (const club of normalized.clubs) {
    const row = await upsertEntity('clubs', {
      name: club.name,
      short_name: club.shortName ?? null,
      external_uuid: club.externalUuid ?? null
    }, [{ field: 'name', value: club.name }]);
    clubs.set(club.name, row);
  }

  const teams = new Map<string, any>();
  for (const team of normalized.teams) {
    const club = clubs.get(team.clubName ?? team.name) ?? Array.from(clubs.values())[0] ?? null;
    const row = await upsertEntity('teams', {
      club_id: club?.id ?? null,
      competition_id: competition.id,
      name: team.name,
      short_name: team.shortName ?? null,
      external_uuid: team.externalUuid ?? null
    }, [
      { field: 'competition_id', value: competition.id },
      { field: 'name', value: team.name }
    ]);
    teams.set(team.name, row);
  }

  const players = new Map<string, any>();
  for (const player of normalized.players) {
    const row = await upsertEntity('players', {
      name: player.name,
      short_name: player.shortName ?? null,
      external_uuid: player.externalUuid ?? null
    }, [{ field: 'name', value: player.name }]);
    players.set(player.id, row);
  }

  for (const roster of normalized.rosters) {
    const team = teams.get(normalized.teams.find(team => team.id === roster.teamId)?.name ?? '');
    const player = players.get(roster.playerId);
    if (!team || !player) continue;

    await upsertEntity('team_rosters', {
      team_id: team.id,
      player_id: player.id,
      season_id: season.id,
      dorsal: roster.dorsal ?? null,
      captain: Boolean(roster.captain),
      starting: Boolean(roster.starting)
    }, [
      { field: 'team_id', value: team.id },
      { field: 'player_id', value: player.id },
      { field: 'season_id', value: season.id }
    ]);
  }

  const localTeam = teams.get(normalized.match.localTeamName) ?? Array.from(teams.values())[0];
  const visitorTeam = teams.get(normalized.match.visitorTeamName) ?? Array.from(teams.values())[1] ?? Array.from(teams.values())[0];

  const matchRow = await upsertEntity('matches', {
    competition_id: competition.id,
    season_id: season.id,
    competition_group_id: group?.id ?? null,
    local_team_id: localTeam?.id ?? null,
    visitor_team_id: visitorTeam?.id ?? null,
    match_day_num: normalized.match.matchDayNum ?? null,
    match_date: normalized.match.date ? new Date(normalized.match.date).toISOString() : null,
    local_team_name: normalized.match.localTeamName,
    visitor_team_name: normalized.match.visitorTeamName,
    final_score_local: normalized.match.finalScoreLocal,
    final_score_visitor: normalized.match.finalScoreVisitor,
    external_match_uuid: normalized.match.externalMatchUuid ?? null,
    external_group_uuid: normalized.match.externalGroupUuid ?? null,
    external_competition_uuid: normalized.match.externalCompetitionUuid ?? null,
    external_category_uuid: normalized.match.externalCategoryUuid ?? null
  }, [
    { field: 'season_id', value: season.id },
    { field: 'competition_id', value: competition.id },
    { field: 'external_match_uuid', value: normalized.match.externalMatchUuid ?? null }
  ]);

  for (const score of normalized.scoreEvolution) {
    await upsertEntity('match_score_evolution', {
      match_id: matchRow.id,
      period: score.period,
      minute: score.minute ?? null,
      second: score.second ?? null,
      local_score: score.localScore,
      visitor_score: score.visitorScore
    }, [
      { field: 'match_id', value: matchRow.id },
      { field: 'period', value: score.period },
      { field: 'minute', value: score.minute ?? null },
      { field: 'second', value: score.second ?? null }
    ]);
  }

  for (const event of normalized.events) {
    const eventType = event.eventTypeCode ? await upsertEntity('event_types', {
      code: event.eventTypeCode,
      name: event.eventTypeCode,
      external_event_type_id: event.externalEventTypeId ?? null,
      external_event_sub_type_id: event.externalEventSubTypeId ?? null
    }, [{ field: 'code', value: event.eventTypeCode }]) : null;

    await upsertEntity('match_events', {
      match_id: matchRow.id,
      team_id: event.teamId ? teams.get(normalized.teams.find(team => team.id === event.teamId)?.name ?? '')?.id ?? null : null,
      player_id: event.playerId ? players.get(event.playerId)?.id ?? null : null,
      event_type_id: eventType?.id ?? null,
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
    }, [
      { field: 'match_id', value: matchRow.id },
      { field: 'event_uuid', value: event.eventUuid ?? null }
    ]);
  }

  for (const shot of normalized.shots) {
    await upsertEntity('match_shots', {
      match_id: matchRow.id,
      team_id: shot.teamId ? teams.get(normalized.teams.find(team => team.id === shot.teamId)?.name ?? '')?.id ?? null : null,
      player_id: shot.playerId ? players.get(shot.playerId)?.id ?? null : null,
      period: shot.period,
      minute: shot.minute ?? null,
      second: shot.second ?? null,
      x: shot.x ?? null,
      y: shot.y ?? null,
      made: shot.made ?? null,
      shot_type: shot.shotType ?? null,
      shot_zone: shot.shotZone ?? null,
      event_uuid: shot.eventUuid ?? null
    }, [
      { field: 'match_id', value: matchRow.id },
      { field: 'event_uuid', value: shot.eventUuid ?? null }
    ]);
  }

  return {
    matchId: matchRow.id,
    seasonName: normalized.season.name,
    competitionName: normalized.competition.name,
    localTeam: normalized.match.localTeamName,
    visitorTeam: normalized.match.visitorTeamName,
    score: `${normalized.match.finalScoreLocal}-${normalized.match.finalScoreVisitor}`
  };
};

app.get('/health', (_req, res) => {
  res.json({ ok: true, status: 'healthy' });
});

app.post('/api/federation/import', async (req, res) => {
  try {
    const error = validateBundle(req.body);
    if (error) {
      res.status(400).json({ ok: false, error });
      return;
    }

    const statsPayload = req.body.statsPayload ?? req.body.mainJson;
    const pbpPayload = req.body.pbpPayload ?? req.body.movesJson;

    const result = await persistMatch(statsPayload, pbpPayload);
    res.status(200).json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown import error';
    console.error('[api] Import failed:', message);
    res.status(500).json({ ok: false, error: message });
  }
});

app.listen(port, () => {
  console.log(`Federation API running on http://localhost:${port}`);
});
