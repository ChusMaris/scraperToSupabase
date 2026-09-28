export enum ScrapeStatus {
  IDLE = 'IDLE',
  QUEUED = 'QUEUED',
  FETCHING_HTML = 'FETCHING_HTML',
  DOWNLOADING_JSON = 'DOWNLOADING_JSON',
  UPLOADING = 'UPLOADING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export interface MatchJob {
  id: string; // The mongo-like ID (e.g., 696b6acdd2a7ac0001714803)
  url: string; // The full stat page URL
  manualJornadaOverride?: number | null;
  status: ScrapeStatus;
  statsFileDownloaded: boolean;
  movesFileDownloaded: boolean;
  error?: string;
  matchTitle?: string;
}

export interface StatsResponse {
  // Loose typing as we just want to save the JSON
  [key: string]: any;
}

export const BASE_URL = "https://www.basquetcatala.cat";

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
const LEGACY_OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

// Helper to extract ID from URL
export const extractMatchId = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    const path = decodeURIComponent(parsed.pathname).replace(/\/+$/, '');
    const segments = path.split('/').filter(Boolean);
    const potentialId = segments[segments.length - 1] ?? '';

    if (!potentialId) {
      return null;
    }

    if (UUID_RE.test(potentialId) || LEGACY_OBJECT_ID_RE.test(potentialId)) {
      return potentialId;
    }

    const match = potentialId.match(/[0-9a-fA-F]{24}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/);
    return match ? match[0] : null;
  } catch {
    const potentialId = url.split('/').filter(Boolean).at(-1) ?? '';
    if (UUID_RE.test(potentialId) || LEGACY_OBJECT_ID_RE.test(potentialId)) {
      return potentialId;
    }
    return null;
  }
};
