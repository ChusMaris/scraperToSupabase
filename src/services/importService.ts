import { MatchJob, ScrapeStatus, extractMatchId } from '../types';
import { delay, fetchMatchData } from './scraperService';
import { uploadMatchToSupabase, UploadMetadata } from './supabaseService';

export interface ImportBatchRequest {
  urls: string[];
  metadata: UploadMetadata;
  isPrd?: boolean;
  manualJornada?: number | null;
  onLog?: (msg: string, type: 'info' | 'success' | 'error' | 'data') => void;
  onJobUpdate?: (job: MatchJob) => void;
  onStatusChange?: (msg: string) => void;
}

export interface ImportBatchResult extends MatchJob {
  error?: string;
}

export const normalizeImportUrls = (input: string): string[] => {
  return input
    .split(/[\n,]+/)
    .map(url => url.trim())
    .filter(url => url.length > 0);
};

export const getMatchScorePreview = (mainJson: any): string => {
  const scoreTimeline = Array.isArray(mainJson?.score) ? mainJson.score : [];
  if (scoreTimeline.length > 0) {
    const lastScore = scoreTimeline[scoreTimeline.length - 1];
    if (lastScore) {
      return `${lastScore.local ?? 0}-${lastScore.visit ?? 0}`;
    }
  }

  const localTeam = mainJson?.teams?.[0];
  const localPlayer = localTeam?.players?.[0];
  const teamScore = localPlayer?.teamScore ?? localTeam?.data?.score?.local ?? localTeam?.data?.score?.teamScore ?? 0;
  const oppScore = localPlayer?.oppScore ?? localTeam?.data?.score?.oppScore ?? localTeam?.data?.score?.visit ?? 0;

  return `${teamScore}-${oppScore}`;
};

const buildInitialJobs = (urls: string[]): MatchJob[] => {
  return urls.map((url, index) => {
    const id = extractMatchId(url);
    return {
      id: id || `unknown-${index}`,
      url,
      status: ScrapeStatus.IDLE,
      statsFileDownloaded: false,
      movesFileDownloaded: false,
      matchTitle: id ? `Partido ${id}` : 'URL Inválida'
    };
  });
};

const processSingleJob = async (
  job: MatchJob,
  metadata: UploadMetadata,
  prdMode: boolean,
  manualJornada: number | null,
  onLog?: (msg: string, type: 'info' | 'success' | 'error' | 'data') => void,
  onJobUpdate?: (job: MatchJob) => void
): Promise<MatchJob> => {
  let currentJob = job;

  const updateJob = (next: MatchJob) => {
    currentJob = next;
    if (onJobUpdate) onJobUpdate(next);
  };

  const log = (msg: string, type: 'info' | 'success' | 'error' | 'data' = 'info') => {
    if (onLog) onLog(msg, type);
  };

  updateJob({ ...currentJob, status: ScrapeStatus.DOWNLOADING_JSON });
  log(`Iniciando extracción para partido ID: ${job.id} (${prdMode ? 'MODO PRD' : 'MODO SIMULACIÓN'})`, 'info');
  log(`URL del partido: ${job.url}`, 'info');

  try {
    log('Descargando estadísticas (JSON)...', 'info');
    const statsData = await fetchMatchData(job.id, 'stats', log);
    log(`Estadísticas descargadas: ${statsData.teams?.[0]?.name} vs ${statsData.teams?.[1]?.name}`, 'success');

    updateJob({ ...currentJob, statsFileDownloaded: true });
    await delay(500);

    log('Descargando movimientos (Play-by-Play)...', 'info');
    const movesData = await fetchMatchData(job.id, 'moves', log);
    const movesCount = Array.isArray(movesData) ? movesData.length : (movesData?.moves?.length || 0);
    log(`Movimientos descargados: ${movesCount} eventos encontrados.`, 'success');

    updateJob({
      ...currentJob,
      movesFileDownloaded: true,
      status: ScrapeStatus.UPLOADING
    });

    log(`${prdMode ? '🚀 SUBIENDO A SUPABASE (MODO PRD):' : '🔍 SIMULACIÓN DE DATOS (MODO PRD DESACTIVADO):'}`, 'data');
    log(`- Temporada: ${metadata.temporada}`, 'data');
    log(`- Categoría: ${metadata.categoria}`, 'data');
    log(`- Competicion: ${metadata.competicion}`, 'data');

    const localTeam = statsData.teams?.[0];
    const visitorTeam = statsData.teams?.[1];
    const score = getMatchScorePreview(statsData);
    log(`- Partido: ${localTeam?.name} vs ${visitorTeam?.name}`, 'data');
    log(`- Resultado final: ${score}`, 'data');

    const extractedJornada = statsData.jornada || (statsData.match && statsData.match.jornada) || null;
    const jornadaNumToUse = manualJornada !== null ? manualJornada : extractedJornada;
    log(`- Jornada: ${jornadaNumToUse} ${manualJornada !== null ? '(Manual)' : '(Extraída)'}`, 'data');
    log(`- Jugadores encontrados: ${(localTeam?.players?.length || 0) + (visitorTeam?.players?.length || 0)}`, 'data');

    if (!prdMode) {
      const samplePlayers = localTeam?.players?.slice(0, 3).map((p: any) => `${p.name} (#${p.dorsal})`).join(', ');
      log(`- Preview Jugadores Local: ${samplePlayers}...`, 'data');
      log(`- Eventos de juego: ${movesCount} detectados.`, 'data');
      log('✅ EXTRACCIÓN COMPLETADA. Los datos anteriores son un resumen de lo que se subiría a Supabase.', 'success');
      log('⚠️ LLAMADA A BASE DE DATOS OMITIDA (Estás en modo simulación).', 'info');
    } else {
      log('⏳ Iniciando transacciones en Supabase...', 'info');
    }

    await uploadMatchToSupabase(statsData, movesData, metadata, jornadaNumToUse, prdMode, log);

    const completedJob = { ...currentJob, status: ScrapeStatus.COMPLETED };
    updateJob(completedJob);
    log(`Partido ${job.id} procesado correctamente (${prdMode ? 'PRD' : 'Simulación'}).`, 'success');
    return completedJob;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    log(`Error en partido ${job.id}: ${errorMsg}`, 'error');
    console.error(error);
    const failureJob = {
      ...currentJob,
      status: ScrapeStatus.ERROR,
      error: errorMsg
    };
    updateJob(failureJob);
    return failureJob;
  }
};

export const runImportBatch = async ({
  urls,
  metadata,
  isPrd = false,
  manualJornada = null,
  onLog,
  onJobUpdate,
  onStatusChange
}: ImportBatchRequest): Promise<ImportBatchResult[]> => {
  const normalizedUrls = urls.filter(url => url?.trim().length);

  if (normalizedUrls.length === 0) {
    throw new Error('No se han proporcionado URLs válidas.');
  }

  if (onStatusChange) onStatusChange(`Preparando ${normalizedUrls.length} partidos...`);

  const initialJobs = buildInitialJobs(normalizedUrls);
  initialJobs.forEach(job => onJobUpdate?.(job));

  const results: ImportBatchResult[] = [];

  for (let index = 0; index < initialJobs.length; index += 1) {
    const job = initialJobs[index];

    if (job.id.startsWith('unknown')) {
      const invalidJob = {
        ...job,
        status: ScrapeStatus.ERROR,
        error: 'URL Inválida'
      };
      onJobUpdate?.(invalidJob);
      results.push(invalidJob);
      onLog?.(`Saltando URL inválida: ${job.url}`, 'error');
      continue;
    }

    if (onStatusChange) onStatusChange(`Procesando ${index + 1} de ${initialJobs.length}...`);
    const processedJob = await processSingleJob(job, metadata, isPrd, manualJornada, onLog, onJobUpdate);
    results.push(processedJob);

    if (index < initialJobs.length - 1) {
      await delay(1000);
    }
  }

  if (onStatusChange) onStatusChange(`Finalizado. ${initialJobs.length} URLs procesadas.`);
  return results;
};
