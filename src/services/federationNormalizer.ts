export interface FederationSeasonRecord {
  name: string;
  externalUuid?: string | null;
}

export interface FederationReferenceEntity {
  id?: string;
  name: string;
  shortName?: string | null;
  externalUuid?: string | null;
}

export interface FederationTeamRecord {
  id: string;
  name: string;
  shortName?: string | null;
  externalUuid?: string | null;
  clubName?: string | null;
  competitionName?: string | null;
  seasonName?: string | null;
}

export interface FederationPlayerRecord {
  id: string;
  name: string;
  shortName?: string | null;
  dorsal?: string | null;
  captain?: boolean;
  starting?: boolean;
  teamId?: string | null;
  teamName?: string | null;
  externalUuid?: string | null;
}

export interface FederationRosterRecord {
  teamId: string;
  playerId: string;
  seasonName: string;
  dorsal?: string | null;
  captain?: boolean;
  starting?: boolean;
}

export interface FederationMatchRecord {
  externalMatchUuid?: string | null;
  seasonName: string;
  categoryName: string;
  competitionName: string;
  groupName?: string | null;
  matchDayNum?: number | null;
  date?: string | null;
  localTeamId: string;
  visitorTeamId: string;
  localTeamName: string;
  visitorTeamName: string;
  finalScoreLocal: number | null;
  finalScoreVisitor: number | null;
  externalCompetitionUuid?: string | null;
  externalGroupUuid?: string | null;
  externalCategoryUuid?: string | null;
}

export interface FederationTeamStatRecord {
  period: number;
  teamId: string;
  teamName: string;
  shortName?: string | null;
  pts?: number;
  t2m?: number;
  t2a?: number;
  t3m?: number;
  t3a?: number;
  ftm?: number;
  fta?: number;
  fgm?: number;
  fga?: number;
  fc?: number;
  secondsPlayed?: number;
  minLabel?: string | null;
  onCourtPlusMinus?: number | null;
  offCourtPlusMinus?: number | null;
  tsPer?: number | null;
  efgPer?: number | null;
}

export interface FederationPlayerStatRecord {
  period: number;
  teamId: string;
  playerId: string;
  playerName: string;
  dorsal?: string | null;
  captain?: boolean;
  starting?: boolean;
  pts?: number;
  t2m?: number;
  t2a?: number;
  t3m?: number;
  t3a?: number;
  ftm?: number;
  fta?: number;
  fgm?: number;
  fga?: number;
  fc?: number;
  secondsPlayed?: number;
  minLabel?: string | null;
  onCourtPlusMinus?: number | null;
  offCourtPlusMinus?: number | null;
  tsPer?: number | null;
  efgPer?: number | null;
}

export interface FederationScoreEvolutionRecord {
  period: number;
  minute?: number | null;
  second?: number | null;
  localScore: number;
  visitorScore: number;
}

export interface FederationEventRecord {
  eventUuid: string;
  matchId: string;
  teamId?: string | null;
  playerId?: string | null;
  actorName?: string | null;
  dorsal?: string | null;
  period: number;
  minute?: number | null;
  second?: number | null;
  localScore?: number | null;
  visitorScore?: number | null;
  eventTypeCode?: string | null;
  externalEventTypeId?: number | null;
  externalEventSubTypeId?: number | null;
}

export interface FederationShotRecord {
  eventUuid: string;
  matchId: string;
  teamId?: string | null;
  playerId?: string | null;
  period: number;
  minute?: number | null;
  second?: number | null;
  x?: number | null;
  y?: number | null;
  made?: boolean | null;
  shotType?: string | null;
  shotZone?: number | null;
}

export interface FederationNormalizedMatch {
  season: FederationSeasonRecord;
  category: FederationReferenceEntity;
  competition: FederationReferenceEntity;
  group?: FederationReferenceEntity | null;
  clubs: FederationReferenceEntity[];
  teams: FederationTeamRecord[];
  players: FederationPlayerRecord[];
  rosters: FederationRosterRecord[];
  match: FederationMatchRecord;
  teamStats: FederationTeamStatRecord[];
  playerStats: FederationPlayerStatRecord[];
  scoreEvolution: FederationScoreEvolutionRecord[];
  events: FederationEventRecord[];
  shots: FederationShotRecord[];
}

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const slugFromText = (value: string): string => {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'entity';
};

const playerIdFrom = (uuid: unknown, name: unknown, dorsal: unknown): string => {
  if (typeof uuid === 'string' && uuid.trim()) {
    return slugFromText(`player-${uuid}`);
  }
  return slugFromText(`${typeof name === 'string' ? name : 'player'}-${String(dorsal ?? 'unknown')}`);
};

const textValue = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};

const toUuid = (value: unknown): string | null => {
  if (typeof value === 'string' && /^[0-9a-fA-F-]{36}$/.test(value)) {
    return value;
  }
  return null;
};

const pickBoxscoreSide = (boxscoreEntry: any, side: 'local' | 'visitor') => {
  const sideValue = boxscoreEntry?.[side];
  if (!sideValue) return null;
  return sideValue;
};

export const normalizeFederationMatch = (
  statsPayload: any,
  pbpPayload?: any
): FederationNormalizedMatch => {
  const header = statsPayload?.header ?? {};
  const boxscore = Array.isArray(statsPayload?.boxscore) ? statsPayload.boxscore : [];
  const shotChart = statsPayload?.shotChart ?? {};
  const scoreEvolution = Array.isArray(statsPayload?.scoreEvolution) ? statsPayload.scoreEvolution : [];
  const playByPlay = Array.isArray(pbpPayload?.playByPlay) ? pbpPayload.playByPlay : [];

  const seasonDate = header.date ? new Date(header.date) : new Date();
  const year = Number.isFinite(seasonDate.getTime()) ? seasonDate.getFullYear() : new Date().getFullYear();
  const seasonName = `${year}/${String((year + 1) % 100).padStart(2, '0')}`;

  const localTeam = header.localTeam ?? {};
  const visitorTeam = header.visitorTeam ?? {};
  const localTeamId = slugFromText(`${localTeam.name ?? 'local'}-${localTeam.uuid ?? 'local'}`);
  const visitorTeamId = slugFromText(`${visitorTeam.name ?? 'visitor'}-${visitorTeam.uuid ?? 'visitor'}`);

  const clubs = [
    {
      id: slugFromText(`${localTeam.name ?? 'local'}-${localTeam.uuid ?? 'local'}-club`),
      name: localTeam.name ?? 'Local team',
      shortName: localTeam.shortName ?? null,
      externalUuid: toUuid(localTeam.uuid)
    },
    {
      id: slugFromText(`${visitorTeam.name ?? 'visitor'}-${visitorTeam.uuid ?? 'visitor'}-club`),
      name: visitorTeam.name ?? 'Visitor team',
      shortName: visitorTeam.shortName ?? null,
      externalUuid: toUuid(visitorTeam.uuid)
    }
  ];

  const teams = [
    {
      id: localTeamId,
      name: localTeam.name ?? 'Local team',
      shortName: localTeam.shortName ?? null,
      externalUuid: toUuid(localTeam.uuid),
      clubName: localTeam.name ?? null,
      competitionName: header.competitionName ?? null,
      seasonName
    },
    {
      id: visitorTeamId,
      name: visitorTeam.name ?? 'Visitor team',
      shortName: visitorTeam.shortName ?? null,
      externalUuid: toUuid(visitorTeam.uuid),
      clubName: visitorTeam.name ?? null,
      competitionName: header.competitionName ?? null,
      seasonName
    }
  ];

  const players: FederationPlayerRecord[] = [];
  const rosters: FederationRosterRecord[] = [];
  const teamIdsByUuid = new Map<string, string>();
  const playerTeamIdsByUuid = new Map<string, string>();
  for (const team of teams) {
    if (team.externalUuid) teamIdsByUuid.set(team.externalUuid, team.id);
  }

  for (const boxscoreEntry of boxscore) {
    const localSide = pickBoxscoreSide(boxscoreEntry, 'local');
    const visitorSide = pickBoxscoreSide(boxscoreEntry, 'visitor');

    const addPlayersFromSide = (teamSide: any, teamId: string, teamName: string) => {
      if (!teamSide?.players || !Array.isArray(teamSide.players)) return;
      for (const player of teamSide.players) {
        const playerUuid = textValue(player.uuid);
        const playerName = textValue(player.name);
        const dorsal = textValue(player.dorsal);
        if (playerUuid) playerTeamIdsByUuid.set(playerUuid, teamId);
        if (!playerName) continue;

        const playerId = playerIdFrom(playerUuid, playerName, dorsal);
        players.push({
          id: playerId,
          name: playerName,
          shortName: player.shortName ?? null,
          dorsal,
          captain: Boolean(player.captain),
          starting: Boolean(player.starting),
          teamId,
          teamName,
          externalUuid: toUuid(player.uuid)
        });

        rosters.push({
          teamId,
          playerId,
          seasonName,
          dorsal: player.dorsal ?? null,
          captain: Boolean(player.captain),
          starting: Boolean(player.starting)
        });
      }
    };

    addPlayersFromSide(localSide, localTeamId, localTeam.name ?? 'Local team');
    addPlayersFromSide(visitorSide, visitorTeamId, visitorTeam.name ?? 'Visitor team');
  }

  for (const event of playByPlay) {
    const playerUuid = textValue(event.uuid);
    const playerName = textValue(event.actorName);
    if (!playerName) continue;

    const playerId = playerIdFrom(playerUuid, playerName, event.dorsal);
    const eventTeamId = textValue(event.teamUuid)
      ? teamIdsByUuid.get(String(event.teamUuid))
      : undefined;
    const teamId = eventTeamId ?? (playerUuid ? playerTeamIdsByUuid.get(playerUuid) : undefined) ?? null;
    const teamName = teams.find(team => team.id === teamId)?.name ?? null;
    const existingPlayer = players.find(player => player.id === playerId);
    if (existingPlayer) {
      if (!existingPlayer.teamId && teamId) {
        existingPlayer.teamId = teamId;
        existingPlayer.teamName = teamName;
      }
      continue;
    }

    players.push({
      id: playerId,
      name: playerName,
      dorsal: textValue(event.dorsal),
      starting: false,
      captain: false,
      teamId,
      teamName,
      externalUuid: toUuid(playerUuid)
    });
    if (teamId) {
      rosters.push({
        teamId,
        playerId,
        seasonName,
        dorsal: textValue(event.dorsal),
        captain: false,
        starting: false
      });
    }
  }

  const dedupedPlayers = players.filter((player, index, all) => all.findIndex(item => item.id === player.id) === index);
  const dedupedRosters = rosters.filter((roster, index, all) => all.findIndex(item => item.teamId === roster.teamId && item.playerId === roster.playerId) === index);

  const teamStats: FederationTeamStatRecord[] = [];
  const playerStats: FederationPlayerStatRecord[] = [];

  for (const boxscoreEntry of boxscore) {
    const localSide = pickBoxscoreSide(boxscoreEntry, 'local');
    const visitorSide = pickBoxscoreSide(boxscoreEntry, 'visitor');

    const mapTeamSide = (teamSide: any, teamId: string, teamName: string, shortName?: string | null) => {
      if (!teamSide) return;
      const accumulated = teamSide.accumulated ?? {};
      const computed = teamSide.computed ?? {};
      const advanced = teamSide.advanced ?? {};
      const teamStat: FederationTeamStatRecord = {
        period: Number(boxscoreEntry.period ?? 0),
        teamId,
        teamName,
        shortName,
        pts: toNumber(accumulated.pts) ?? undefined,
        t2m: toNumber(accumulated.t2m) ?? undefined,
        t2a: toNumber(accumulated.t2a) ?? undefined,
        t3m: toNumber(accumulated.t3m) ?? undefined,
        t3a: toNumber(accumulated.t3a) ?? undefined,
        ftm: toNumber(accumulated.ftm) ?? undefined,
        fta: toNumber(accumulated.fta) ?? undefined,
        fgm: toNumber(accumulated.fgm) ?? undefined,
        fga: toNumber(accumulated.fga) ?? undefined,
        fc: toNumber(accumulated.fc) ?? undefined,
        secondsPlayed: toNumber(computed.seconds) ?? undefined,
        minLabel: computed.min ?? null,
        onCourtPlusMinus: toNumber(computed.onCourtPlusMinus),
        offCourtPlusMinus: toNumber(computed.offCourtPlusMinus),
        tsPer: toNumber(advanced.tsPer) ?? toNumber(advanced.tsPer) ?? undefined,
        efgPer: toNumber(advanced.efgPer) ?? toNumber(advanced.efg) ?? undefined
      };
      teamStats.push(teamStat);

      if (Array.isArray(teamSide.players)) {
        for (const player of teamSide.players) {
          const playerName = textValue(player.name);
          if (!playerName) continue;
          const playerId = playerIdFrom(player.uuid, playerName, player.dorsal);
          const acc = player.accumulated ?? {};
          const comp = player.computed ?? {};
          const adv = player.advanced ?? {};
          playerStats.push({
            period: Number(boxscoreEntry.period ?? 0),
            teamId,
            playerId,
            playerName,
            dorsal: textValue(player.dorsal),
            captain: Boolean(player.captain),
            starting: Boolean(player.starting),
            pts: toNumber(acc.pts) ?? undefined,
            t2m: toNumber(acc.t2m) ?? undefined,
            t2a: toNumber(acc.t2a) ?? undefined,
            t3m: toNumber(acc.t3m) ?? undefined,
            t3a: toNumber(acc.t3a) ?? undefined,
            ftm: toNumber(acc.ftm) ?? undefined,
            fta: toNumber(acc.fta) ?? undefined,
            fgm: toNumber(acc.fgm) ?? undefined,
            fga: toNumber(acc.fga) ?? undefined,
            fc: toNumber(acc.fc) ?? undefined,
            secondsPlayed: toNumber(comp.seconds) ?? undefined,
            minLabel: comp.min ?? null,
            onCourtPlusMinus: toNumber(comp.onCourtPlusMinus),
            offCourtPlusMinus: toNumber(comp.offCourtPlusMinus),
            tsPer: toNumber(adv.tsPer) ?? undefined,
            efgPer: toNumber(adv.efgPer) ?? toNumber(adv.efg) ?? undefined
          });
        }
      }
    };

    mapTeamSide(localSide, localTeamId, localTeam.name ?? 'Local team', localTeam.shortName ?? null);
    mapTeamSide(visitorSide, visitorTeamId, visitorTeam.name ?? 'Visitor team', visitorTeam.shortName ?? null);
  }

  const derivedScoreEvolution: FederationScoreEvolutionRecord[] = [];
  for (const event of playByPlay) {
    const localScore = toNumber(event.localScore);
    const visitorScore = toNumber(event.visitorScore);
    if (localScore === null || visitorScore === null) continue;

    const previous = derivedScoreEvolution.at(-1);
    if (previous?.localScore === localScore && previous.visitorScore === visitorScore) continue;

    derivedScoreEvolution.push({
      period: Number(event.period ?? 0),
      minute: toNumber(event.minute),
      second: toNumber(event.second),
      localScore,
      visitorScore
    });
  }

  const normalizedScoreEvolution: FederationScoreEvolutionRecord[] = scoreEvolution.length
    ? scoreEvolution.map((entry: any) => ({
    period: Number(entry.period ?? 0),
    minute: toNumber(entry.minute) ?? null,
    second: toNumber(entry.second) ?? null,
    localScore: toNumber(entry.local) ?? toNumber(entry.localScore) ?? 0,
    visitorScore: toNumber(entry.visitor) ?? toNumber(entry.visitorScore) ?? 0
    }))
    : derivedScoreEvolution;

  const normalizedEvents: FederationEventRecord[] = (playByPlay ?? []).map((event: any) => {
    const eventUuid = toUuid(event.eventUuid) ?? toUuid(event.uuid) ?? `${slugFromText(event.actorName ?? 'event')}-${event.period ?? 0}-${event.minute ?? 0}-${event.second ?? 0}`;
    const teamId = event.teamUuid ? slugFromText(`${event.teamUuid}`) : null;
    const playerId = textValue(event.actorName)
      ? playerIdFrom(event.uuid, event.actorName, event.dorsal)
      : null;
    return {
      eventUuid,
      matchId: localTeamId + '-' + visitorTeamId,
      teamId,
      playerId,
      actorName: event.actorName ?? null,
      dorsal: event.dorsal ?? null,
      period: Number(event.period ?? 0),
      minute: toNumber(event.minute),
      second: toNumber(event.second),
      localScore: toNumber(event.localScore),
      visitorScore: toNumber(event.visitorScore),
      eventTypeCode: event.eventTypeCode ?? null,
      externalEventTypeId: toNumber(event.eventTypeId),
      externalEventSubTypeId: toNumber(event.eventSubTypeId)
    };
  });

  const normalizedShots: FederationShotRecord[] = [];
  const localShots = Array.isArray(shotChart.local) ? shotChart.local : [];
  const visitorShots = Array.isArray(shotChart.visitor) ? shotChart.visitor : [];
  for (const shot of [...localShots, ...visitorShots]) {
    const eventUuid = toUuid(shot.eventUuid) ?? toUuid(shot.uuid) ?? `${slugFromText(shot.actorName ?? 'shot')}-${shot.period ?? 0}-${shot.x ?? 0}-${shot.y ?? 0}`;
    const teamId = shot.teamUuid ? slugFromText(`${shot.teamUuid}`) : null;
    const playerId = shot.uuid && textValue(shot.actorName)
      ? playerIdFrom(shot.uuid, shot.actorName, null)
      : null;
    normalizedShots.push({
      eventUuid,
      matchId: localTeamId + '-' + visitorTeamId,
      teamId,
      playerId,
      period: Number(shot.period ?? 0),
      minute: toNumber(shot.minute),
      second: toNumber(shot.second),
      x: toNumber(shot.x),
      y: toNumber(shot.y),
      made: typeof shot.made === 'boolean' ? shot.made : null,
      shotType: shot.type ?? null,
      shotZone: toNumber(shot.zone)
    });
  }

  const match: FederationMatchRecord = {
    externalMatchUuid: toUuid(header.uuid) ?? toUuid(statsPayload?.match?.uuid) ?? null,
    seasonName,
    categoryName: header.categoryName ?? 'Unknown category',
    competitionName: header.competitionName ?? 'Unknown competition',
    groupName: header.groupName ?? null,
    matchDayNum: toNumber(header.matchDayNum) ?? null,
    date: header.date ?? null,
    localTeamId: localTeamId,
    visitorTeamId: visitorTeamId,
    localTeamName: localTeam.name ?? 'Local team',
    visitorTeamName: visitorTeam.name ?? 'Visitor team',
    finalScoreLocal: toNumber(header.score?.local),
    finalScoreVisitor: toNumber(header.score?.visitor),
    externalCompetitionUuid: toUuid(header.competitionGuid),
    externalGroupUuid: toUuid(header.groupUuid),
    externalCategoryUuid: toUuid(header.categoryUuid)
  };

  return {
    season: {
      name: seasonName,
      externalUuid: null
    },
    category: {
      name: header.categoryName ?? 'Unknown category',
      shortName: null,
      externalUuid: toUuid(header.categoryUuid)
    },
    competition: {
      name: header.competitionName ?? 'Unknown competition',
      shortName: null,
      externalUuid: toUuid(header.competitionGuid)
    },
    group: header.groupName
      ? {
          name: header.groupName,
          shortName: null,
          externalUuid: toUuid(header.groupUuid)
        }
      : null,
    clubs,
    teams,
    players: dedupedPlayers,
    rosters: dedupedRosters,
    match,
    teamStats,
    playerStats,
    scoreEvolution: normalizedScoreEvolution,
    events: normalizedEvents,
    shots: normalizedShots
  };
};
