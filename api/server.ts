import express from 'express';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { normalizeFederationMatch } from '../src/services/federationNormalizer.js';
import { persistFederationMatchToLegacy } from '../src/services/federationLegacyWriter.js';

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

  return null;
};

app.get('/health', (_req, res) => {
  res.json({ ok: true, status: 'healthy' });
});

app.get('/api/federation/options', async (_req, res) => {
  if (!supabase) {
    res.status(503).json({ ok: false, error: 'Supabase client is not configured' });
    return;
  }

  try {
    const [seasonsResult, categoriesResult, competitionsResult, matchdaysResult] = await Promise.all([
      supabase.from('temporadas').select('nombre').order('nombre', { ascending: true }),
      supabase.from('categorias').select('nombre').order('nombre', { ascending: true }),
      supabase.from('competiciones').select('nombre').order('nombre', { ascending: true }),
      supabase.from('partidos').select('jornada').not('jornada', 'is', null).order('jornada', { ascending: true })
    ]);

    const queryError = seasonsResult.error || categoriesResult.error || competitionsResult.error || matchdaysResult.error;
    if (queryError) {
      throw new Error(queryError.message);
    }

    const uniqueNames = (rows: Array<{ nombre: string | null }> | null) =>
      [...new Set((rows ?? []).map(row => row.nombre?.trim()).filter((name): name is string => Boolean(name)))];
    const jornadas = [...new Set((matchdaysResult.data ?? [])
      .map((row: { jornada: unknown }) => Number(row.jornada))
      .filter((jornada: number) => Number.isInteger(jornada) && jornada > 0))]
      .sort((first, second) => first - second);

    res.json({
      ok: true,
      options: {
        temporadas: uniqueNames(seasonsResult.data),
        categorias: uniqueNames(categoriesResult.data),
        competiciones: uniqueNames(competitionsResult.data),
        jornadas
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown catalog query error';
    console.error('[api] Catalog query failed:', message);
    res.status(500).json({ ok: false, error: message });
  }
});

app.post('/api/federation/import', async (req, res) => {
  const validationError = validateBundle(req.body);
  if (validationError) {
    res.status(400).json({ ok: false, error: validationError });
    return;
  }

  if (!supabase) {
    res.status(503).json({ ok: false, error: 'Supabase client is not configured' });
    return;
  }

  try {
    const statsPayload = req.body.statsPayload ?? req.body.mainJson;
    const pbpPayload = req.body.pbpPayload ?? req.body.movesJson;
    const metadata = req.body.metadata ?? statsPayload.metadata ?? {};
    const normalized = normalizeFederationMatch(statsPayload, pbpPayload);
    const legacyMetadata = {
      temporada: typeof metadata.temporada === 'string' && metadata.temporada.trim()
        ? metadata.temporada.trim()
        : normalized.season.name,
      categoria: typeof metadata.categoria === 'string' && metadata.categoria.trim()
        ? metadata.categoria.trim()
        : normalized.category.name,
      competicion: typeof metadata.competicion === 'string' && metadata.competicion.trim()
        ? metadata.competicion.trim()
        : normalized.competition.name
    };
    const requestedMatchDay = Number(metadata.jornada);
    const matchDay = Number.isInteger(requestedMatchDay) && requestedMatchDay > 0
      ? requestedMatchDay
      : normalized.match.matchDayNum ?? null;
    const result = await persistFederationMatchToLegacy(
      normalized,
      legacyMetadata,
      matchDay,
      req.body.sourceUrl,
      supabase
    );

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
