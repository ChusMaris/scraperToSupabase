import { BASE_URL } from '../types';
import JSZip from 'jszip';

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Downloads a ZIP file containing multiple JSONs.
 * This prevents browser "Multiple File Download" blocking.
 */
export const downloadAsZip = async (
  files: { filename: string; data: any }[], 
  zipFilename: string
): Promise<boolean> => {
  try {
    const zip = new JSZip();

    files.forEach(file => {
      zip.file(file.filename, JSON.stringify(file.data, null, 2));
    });

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = zipFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return true;
  } catch (e) {
    console.error("ZIP Generation failed", e);
    return false;
  }
};

/**
 * Downloads a JSON object as a file in the browser (Legacy/Fallback).
 */
export const downloadJson = (data: any, filename: string) => {
  try {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (e) {
    console.error("Download failed", e);
    return false;
  }
};

/**
 * Creates the same-origin proxy URL used by the local Express server.
 * This is the most reliable option for browser-based federation requests because it
 * avoids the public proxy blocks that return 403/timeout for these APIs.
 */
export const buildLocalProxyUrl = (target: string): string => {
  return `/api/proxy?url=${encodeURIComponent(target)}`;
};

/**
 * PROXY STRATEGY:
 * Prefer the local app proxy first, then fall back to external public providers.
 */
export const PROXY_PROVIDERS = [
  {
    name: 'local-proxy',
    getUrl: (target: string) => buildLocalProxyUrl(target),
    isWrapped: false,
    timeout: 30000
  },
  {
    name: 'corsproxy.io',
    getUrl: (target: string) => `https://corsproxy.io/?${encodeURIComponent(target)}`,
    isWrapped: false
  },
  {
    name: 'allorigins-raw',
    getUrl: (target: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
    isWrapped: false,
    timeout: 30000
  },
  {
    name: 'allorigins-wrapped',
    getUrl: (target: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(target)}`,
    isWrapped: true,
    timeout: 30000
  },
  {
    name: 'codetabs',
    getUrl: (target: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`,
    isWrapped: false
  },
  {
    name: 'cors-anywhere-mirror',
    getUrl: (target: string) => `https://cors-anywhere.herokuapp.com/${target}`,
    isWrapped: false
  },
  {
    name: 'cors-proxy-htmldriven',
    getUrl: (target: string) => `https://cors-proxy.htmldriven.com/?url=${encodeURIComponent(target)}`,
    isWrapped: false
  },
  {
    name: 'thingproxy',
    getUrl: (target: string) => `https://thingproxy.freeboard.io/fetch/${target}`,
    isWrapped: false
  }
];

/**
 * Fetches text content (HTML or JSON string) using the proxy fallback strategy.
 */
async function fetchTextWithFallback(
  targetUrl: string, 
  onLog?: (msg: string, type: any) => void
): Promise<{ text: string, proxy: string }> {
  const urlWithCacheBuster = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}__t=${Date.now()}`;

  if (typeof window !== 'undefined') {
    try {
      const localUrl = buildLocalProxyUrl(urlWithCacheBuster);
      const response = await fetch(localUrl, { headers: { Accept: 'application/json, text/plain, */*' } });

      if (response.ok) {
        const text = await response.text();
        if (text && text.trim().length > 0) {
          if (onLog) onLog('✅ Éxito usando proxy local', 'success');
          return { text, proxy: 'local-proxy' };
        }
      }
    } catch (error) {
      const failMsg = `Fallo con proxy local: ${error instanceof Error ? error.message : String(error)}`;
      console.warn(failMsg);
      if (onLog) onLog(failMsg, 'error');
    }
  }

  let lastError: any = null;

  for (const provider of PROXY_PROVIDERS) {
    try {
      const finalUrl = urlWithCacheBuster;
      const proxyUrl = provider.getUrl(finalUrl);
      
      const attemptMsg = `Intentando vía ${provider.name} para ${targetUrl}`;
      console.log(attemptMsg);
      if (onLog) onLog(attemptMsg, 'info');
      
      // Use a timeout to prevent hanging if IT filter is "silent"
      const controller = new AbortController();
      const currentTimeout = (provider as any).timeout || 15000;
      const timeoutId = setTimeout(() => controller.abort(), currentTimeout);

      try {
        const response = await fetch(proxyUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          let errorDetail = "";
          try {
            const errorJson = await response.json();
            errorDetail = errorJson.details || errorJson.error || "";
          } catch (e) {
            // Not JSON
          }
          throw new Error(`Proxy ${provider.name} respondió con status ${response.status}${errorDetail ? ': ' + errorDetail : ''}`);
        }
        
        let text = '';
  
        if (provider.isWrapped) {
          // Handle AllOrigins wrapped response
          const wrapperJson = await response.json();
          if (wrapperJson && wrapperJson.status && wrapperJson.status.http_code === 200) {
             text = wrapperJson.contents;
          } else {
             throw new Error(`Proxy envuelto retornó error: ${wrapperJson?.status?.http_code}`);
          }
        } else {
          // Standard raw proxy
          text = await response.text();
        }
        
        if (!text || text.trim().length === 0) {
          throw new Error("Respuesta vacía del proxy");
        }
  
        // Detect "Security Verification" or Cloudflare challenges
        if (text.includes("Verificació de seguretat") || text.includes("Cloudflare") || text.includes("Security Check")) {
          const challengeMsg = `⚠️ Desafío de seguridad detectado en ${provider.name}. El sitio web ha bloqueado la petición automática.`;
          if (onLog) onLog(challengeMsg, 'error');
          throw new Error(challengeMsg);
        }
  
        if (onLog) onLog(`✅ Éxito usando ${provider.name}`, 'success');
        return { text, proxy: provider.name };
      } catch (e: any) {
        clearTimeout(timeoutId);
        if (e.name === 'AbortError') {
          throw new Error(`Timeout (15s) vía ${provider.name}`);
        }
        const detail = e instanceof TypeError ? `error de red (${e.message})` : (e.message || String(e));
        throw new Error(`Proxy ${provider.name} falló: ${detail}`);
      }
    } catch (error: any) {
      const failMsg = `Fallo con ${provider.name}: ${error.message || error}`;
      console.warn(failMsg);
      if (onLog) onLog(failMsg, 'error');
      lastError = error;
      // Wait before trying the next one with a bit of randomness
      const jitter = Math.floor(Math.random() * 1000);
      await delay(1500 + jitter);
    }
  }

  throw lastError || new Error("Todos los proxies fallaron al recuperar los datos.");
}

/**
 * Parses the HTML of the results list page to find match links.
 */
export const parseResultsHtml = (html: string): string[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Find all links containing '/estadistiques/'
  const anchors = Array.from(doc.querySelectorAll('a'));
  const statsLinks = anchors
    .map(a => a.getAttribute('href'))
    .filter((href): href is string => href !== null && href.includes('/estadistiques/'))
    // Normalize URLs (some might be relative)
    .map(href => href.startsWith('http') ? href : `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`);

  // Deduplicate
  return Array.from(new Set(statsLinks));
};

/**
 * Fetches the HTML of the main results list page to find match links.
 */
export const fetchResultsPage = async (pageUrl: string, onLog?: (msg: string, type: any) => void): Promise<string[]> => {
  try {
    const { text: html } = await fetchTextWithFallback(pageUrl, onLog);
    return parseResultsHtml(html);
  } catch (error) {
    console.error("Error scraping results page:", error);
    throw error;
  }
};

/**
 * Builds the modern federation API URLs used by the new provider payloads.
 */
export const buildFederationMatchUrls = (matchId: string): { stats: string; pbp: string } => {
  const normalizedMatchId = (matchId ?? '').trim();
  if (!normalizedMatchId) {
    throw new Error('Match ID is required to build federation URLs.');
  }

  const matchesBase = 'https://msstats.optimalwayconsulting.com/v1/fcbq/matches';
  return {
    stats: `${matchesBase}/${normalizedMatchId}/stats?currentSeason=true`,
    pbp: `${matchesBase}/${normalizedMatchId}/pbp?currentSeason=true`
  };
};

/**
 * Fetches the specific JSON data for a match using the API.
 */
export const fetchMatchData = async (
  matchId: string,
  type: 'stats' | 'moves' | 'pbp',
  onLog?: (msg: string, type: any) => void
): Promise<any> => {
  const API_BASE = 'https://msstats.optimalwayconsulting.com/v1/fcbq';
  const isModernFederationId = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(matchId);

  const modernUrl = buildFederationMatchUrls(matchId);
  const targetUrl = isModernFederationId
    ? (type === 'stats' ? modernUrl.stats : modernUrl.pbp)
    : `${API_BASE}/${type === 'stats' ? 'getJsonWithMatchStats' : 'getJsonWithMatchMoves'}/${matchId}`;

  try {
    const { text: jsonString } = await fetchTextWithFallback(targetUrl, onLog);

    try {
      return JSON.parse(jsonString);
    } catch (e) {
      console.error(`Failed to parse JSON for ${type}.`, e);
      throw new Error('Invalid JSON response from server');
    }
  } catch (error) {
    console.error(`Error fetching ${type} for ${matchId}:`, error);
    throw error;
  }
};

/**
 * Fetches competition results directly from the API, bypassing Cloudflare HTML.
 */
export const fetchCompetitionResultsApi = async (
  competitionId: string,
  jornada: string | number,
  onLog?: (msg: string, type: any) => void
): Promise<string[]> => {
  const targetUrl = `https://msstats.optimalwayconsulting.com/v1/fcbq/getJsonWithJornadaResults/${competitionId}/${jornada}`;
  
  try {
    if (onLog) onLog(`Accediendo al API de resultados para Competición ${competitionId}, Jornada ${jornada}...`, 'info');
    const { text: jsonString } = await fetchTextWithFallback(targetUrl, onLog);
    const data = JSON.parse(jsonString);
    
    // The API returns an object with a matches array
    const matches = data.matches || [];
    if (!Array.isArray(matches)) {
      throw new Error("Formato de API de resultados inesperado");
    }

    // Extract the match IDs and build the stats URLs
    const links = matches.map((m: any) => {
      const id = m.id || m.matchId;
      // We use the same format as the scraper expects
      return id ? `https://www.basquetcatala.cat/estadistiques/2025/${id}` : null;
    }).filter(Boolean) as string[];

    if (onLog) onLog(`✅ API respondió con ${links.length} partidos encontrados.`, 'success');
    return links;
  } catch (error) {
    console.error("Error fetching competition results via API:", error);
    throw error;
  }
};