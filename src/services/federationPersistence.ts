import { supabase } from '../lib/supabase.js';
import { normalizeFederationMatch } from './federationNormalizer.js';
import { persistFederationMatchToLegacy } from './federationLegacyWriter.js';

export type FederationLogType = 'info' | 'success' | 'error' | 'data';

export interface FederationImportOptions {
  metadata?: { temporada?: string; categoria?: string; competicion?: string; jornada?: number | null };
  jornada?: number | null;
  sourceUrl?: string;
}

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
  statsPayload: any,
  pbpPayload: any,
  onLog?: (message: string, type?: FederationLogType) => void,
  options: FederationImportOptions = {},
  database: any = supabase
) => {
  const normalized = normalizeFederationMatch(statsPayload, pbpPayload);
  const metadata = {
    temporada: options.metadata?.temporada?.trim() || normalized.season.name,
    categoria: options.metadata?.categoria?.trim() || normalized.category.name,
    competicion: options.metadata?.competicion?.trim() || normalized.competition.name
  };
  const jornada = options.jornada ?? options.metadata?.jornada ?? normalized.match.matchDayNum ?? null;

  if (jornada !== null && Number.isInteger(Number(jornada)) && Number(jornada) > 0) {
    normalized.match.matchDayNum = Number(jornada);
  }

  const log = (message: string, type: FederationLogType = 'info') => {
    console.log(`[FederationPersistence] ${message}`);
    onLog?.(message, type);
  };

  log(`Persistiendo ${normalized.match.localTeamName} vs ${normalized.match.visitorTeamName} en las tablas legacy`, 'info');
  const result = await persistFederationMatchToLegacy(
    normalized,
    metadata,
    normalized.match.matchDayNum ?? null,
    options.sourceUrl,
    database,
    onLog
  );

  log('Importación federativa completada en el esquema legacy', 'success');
  return result;
};
