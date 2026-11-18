const MAX_LEGACY_BIGINT = 9_223_372_036_854_775_807n;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const getLiveMatchId = (body: Record<string, unknown>): string | undefined => {
  const value = body.liveMatchId;
  if (value === undefined) return undefined;

  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return String(value);
  }

  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || BigInt(value) > MAX_LEGACY_BIGINT) {
    throw new Error('liveMatchId must be a positive numeric ID within the legacy database range');
  }

  return value;
};

const validateLiveSnapshot = (statsPayload: unknown, pbpPayload: unknown): string | null => {
  if (!isRecord(statsPayload) || !isRecord(pbpPayload)) {
    return 'Live imports require object statsPayload and pbpPayload values';
  }

  const header = statsPayload.header;
  if (!isRecord(header) || typeof header.date !== 'string' || !Number.isFinite(Date.parse(header.date))) {
    return 'Live statsPayload.header.date must be a valid date';
  }

  const localTeam = header.localTeam;
  const visitorTeam = header.visitorTeam;
  if (!isRecord(localTeam) || typeof localTeam.name !== 'string' || !localTeam.name.trim()
    || !isRecord(visitorTeam) || typeof visitorTeam.name !== 'string' || !visitorTeam.name.trim()) {
    return 'Live statsPayload.header must include localTeam.name and visitorTeam.name';
  }

  const score = header.score;
  if (!isRecord(score) || typeof score.local !== 'number' || !Number.isFinite(score.local)
    || typeof score.visitor !== 'number' || !Number.isFinite(score.visitor)) {
    return 'Live statsPayload.header.score must include numeric local and visitor scores';
  }

  if (!Array.isArray(statsPayload.boxscore) || !Array.isArray(pbpPayload.playByPlay)) {
    return 'Live imports require statsPayload.boxscore and pbpPayload.playByPlay arrays';
  }

  return null;
};

export const validateFederationImportBody = (
  body: unknown,
  mode?: 'legacy' | 'live'
): string | null => {
  if (!isRecord(body)) {
    return 'Request body is not an object';
  }

  if (mode === 'legacy' && body.liveMatchId !== undefined) {
    return 'Live snapshots must use /api/federation/live-import';
  }
  if (mode === 'live' && body.liveMatchId === undefined) {
    return 'Live imports require liveMatchId';
  }

  const statsPayload = body.statsPayload ?? body.mainJson;
  const pbpPayload = body.pbpPayload ?? body.movesJson;
  if (!statsPayload || !pbpPayload) {
    return 'The request must include both statsPayload and pbpPayload';
  }

  if (body.liveMatchId !== undefined) {
    try {
      getLiveMatchId(body);
    } catch (error) {
      return error instanceof Error ? error.message : 'liveMatchId is invalid';
    }

    return validateLiveSnapshot(statsPayload, pbpPayload);
  }

  return null;
};
