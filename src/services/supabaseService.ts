import { supabase } from '../lib/supabase';

export interface UploadMetadata {
  temporada: string;
  categoria: string;
  competicion: string;
}

export const fetchCategorias = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from('categorias')
    .select('nombre')
    .order('nombre', { ascending: true });
  
  if (error) {
    console.error('Error fetching categorias:', error);
    return [];
  }
  
  return data ? data.map(c => c.nombre) : [];
};

export const fetchTemporadas = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from('temporadas')
    .select('nombre')
    .order('nombre', { ascending: true });
  
  if (error) {
    console.error('Error fetching temporadas:', error);
    return [];
  }
  
  return data ? data.map(t => t.nombre) : [];
};

export const fetchCompeticiones = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from('competiciones')
    .select('nombre')
    .order('nombre', { ascending: true });
  
  if (error) {
    console.error('Error fetching competiciones:', error);
    return [];
  }
  
  // Use a Set to get unique names
  const names = data ? data.map(c => c.nombre) : [];
  return Array.from(new Set(names));
};

export const uploadMatchToSupabase = async (
  mainJson: any,
  movesJson: any,
  metadata: UploadMetadata,
  jornadaNum: number | null,
  isPrd: boolean = false,
  onLog?: (msg: string, type?: 'info' | 'success' | 'error' | 'data') => void
) => {
  const log = (msg: string, type: 'info' | 'success' | 'error' | 'data' = 'info') => {
    console.log(`[SupabaseService] ${msg}`);
    if (onLog) onLog(msg, type);
  };

  log(`--- ${isPrd ? 'PRODUCTION' : 'MOCK'} UPLOAD START ---`, 'info');
  log(`Metadata: ${JSON.stringify(metadata)}`, 'data');
  log(`Jornada: ${jornadaNum}`, 'data');

  if (!isPrd) {
    log("Simulating data preparation...", 'info');
    const { temporada, categoria, competicion } = metadata;
    const mockData = {
      temporada: { nombre: temporada },
      categoria: { nombre: categoria },
      competicion: { nombre: competicion },
      partido: {
        local: mainJson.teams?.[0]?.name,
        visitante: mainJson.teams?.[1]?.name,
        marcador: `${mainJson.teams?.[0]?.players?.[0]?.teamScore || 0}-${mainJson.teams?.[0]?.players?.[0]?.oppScore || 0}`
      }
    };
    log(`Mock Data Generated: ${mockData.partido.local} vs ${mockData.partido.visitante}`, 'success');
    log("--- MOCK UPLOAD END ---", 'info');
    return true;
  }

  // --- REAL PRODUCTION UPLOAD ---
  try {
    if (!mainJson.teams) throw new Error("JSON sin equipos");

    const { temporada, categoria, competicion } = metadata;

    // --- MAESTROS ---
    // Temporada
    log(`Upserting temporada: ${temporada}...`, 'info');
    const { data: tData, error: tErr } = await supabase.from('temporadas')
      .upsert({ nombre: temporada }, { onConflict: 'nombre' }).select();
    if (tErr || !tData?.length) throw new Error(`Temporada: ${tErr?.message}`);
    const temporadaId = tData[0].id;
    log(`Temporada ID: ${temporadaId}`, 'success');

    // Categoría
    log(`Upserting categoría: ${categoria}...`, 'info');
    const { data: cData, error: cErr } = await supabase.from('categorias')
      .upsert({ nombre: categoria }, { onConflict: 'nombre' }).select();
    if (cErr || !cData?.length) throw new Error(`Categoría: ${cErr?.message}`);
    const categoriaId = cData[0].id;
    log(`Categoría ID: ${categoriaId}`, 'success');

    // Competición
    log(`Upserting competicion: ${competicion}...`, 'info');
    const { data: compData, error: compErr } = await supabase.from('competiciones').upsert({ 
      nombre: competicion, 
      temporada_id: temporadaId, 
      categoria_id: categoriaId
    }, { onConflict: 'nombre,temporada_id,categoria_id' }).select();
    
    if (compErr || !compData?.length) throw new Error(`Competición: ${compErr?.message}`);
    const competicionId = compData[0].id;
    log(`Competición ID: ${competicionId}`, 'success');

    // --- EQUIPOS ---
    let idsEquipos: string[] = [];
    const mapaEquiposPorNombre: Record<string, string> = {}; 
    const mapaTeamIdANombre: Record<string, string> = {};

    for (const t of mainJson.teams) {
      log(`Processing Club & Equipo: ${t.name}...`, 'info');
      const { data: clu, error: cluErr } = await supabase.from('clubs')
        .upsert({ nombre: t.name, nombre_corto: t.shortName }, { onConflict: 'nombre' }).select();
      
      if (cluErr || !clu?.length) throw new Error(`Club ${t.name}: ${cluErr?.message}`);
      const clubId = clu[0].id;

      const { data: eq, error: eqErr } = await supabase.from('equipos').upsert({
        club_id: clubId, 
        competicion_id: competicionId, 
        nombre_especifico: t.name, 
        team_id_intern_fce: String(t.teamIdIntern ?? t.idTeam ?? t.teamId ?? '')
      }, { onConflict: 'club_id,competicion_id' }).select();

      if (eqErr || !eq?.length) throw new Error(`Equipo ${t.name}: ${eqErr?.message}`);
      
      const eqId = eq[0].id;
      const teamIdKey = String(t.teamIdIntern ?? t.idTeam ?? t.teamId ?? '');
      
      idsEquipos.push(eqId);
      mapaEquiposPorNombre[t.name] = eqId;
      if (teamIdKey) mapaTeamIdANombre[teamIdKey] = t.name;
      log(`Equipo ${t.name} ID: ${eqId}`, 'success');
    }

    // --- PARTIDO ---
    log(`Upserting partido: ${mainJson.idMatchExtern}...`, 'info');
    const fechaValida = new Date(mainJson.time);
    const fechaISO = isNaN(fechaValida.getTime()) ? new Date().toISOString() : fechaValida.toISOString();

    const { data: partData, error: partErr } = await supabase.from('partidos').upsert({
      id_match_extern: mainJson.idMatchExtern,
      id_match_intern: mainJson.idMatchIntern,
      competicion_id: competicionId,
      equipo_local_id: idsEquipos[0],
      equipo_visitante_id: idsEquipos[1],
      fecha_hora: fechaISO,
      puntos_local: mainJson.teams[0]?.players[0]?.teamScore || 0,
      puntos_visitante: mainJson.teams[0]?.players[0]?.oppScore || 0,
      jornada: jornadaNum
    }, { onConflict: 'id_match_extern' }).select();

    if (partErr || !partData?.length) throw new Error(`Partido: ${partErr?.message}`);
    const partidoId = partData[0].id;
    log(`Partido ID: ${partidoId}`, 'success');

    // --- LIMPIEZA DE DATOS PREVIOS ---
    log(`Cleaning previous data for partido ${partidoId}...`, 'info');
    await supabase.from('partido_marcador_evolucion').delete().eq('partido_id', partidoId);
    await supabase.from('partido_movimientos').delete().eq('partido_id', partidoId);
    
    const { data: oldStats } = await supabase.from('estadisticas_jugador_partido').select('id').eq('partido_id', partidoId);
    if (oldStats?.length) {
      const oldStatsIds = oldStats.map(s => s.id);
      await supabase.from('detalle_tiros_jugador').delete().in('estadistica_id', oldStatsIds);
    }
    await supabase.from('estadisticas_jugador_partido').delete().eq('partido_id', partidoId);
    log(`Cleanup finished.`, 'success');

    // --- JUGADORES Y ESTADÍSTICAS ---
    const mapaJugadoresPorNombre: Record<string, string> = {}; 
    const mapaActorANombre: Record<string, string> = {};
    const movimientosIniciales: any[] = [];
    const nombresEnPista = new Set<string>(); 

    for (const t of mainJson.teams) {
      const eqId = mapaEquiposPorNombre[t.name];
      log(`Uploading stats for team: ${t.name}...`, 'info');
      
      for (const p of t.players) {
        const actorIdKey = String(p.actorId ?? p.idActor ?? p.actor_id ?? '');
        
        const { data: jug, error: jugErr } = await supabase.from('jugadores').upsert({
          nombre_completo: p.name, 
          actor_id: actorIdKey
        }, { onConflict: 'nombre_completo' }).select();
        
        if (jugErr || !jug?.length) throw new Error(`Jugador ${p.name}: ${jugErr?.message}`);
        const jugadorId = jug[0].id;
        
        mapaJugadoresPorNombre[p.name] = jugadorId;
        if (actorIdKey) mapaActorANombre[actorIdKey] = p.name;

        await supabase.from('plantillas').upsert({
          jugador_id: jugadorId, equipo_id: eqId, dorsal: p.dorsal ? String(p.dorsal) : null
        }, { onConflict: 'jugador_id,equipo_id' });

        if (p.starting === true) {
          nombresEnPista.add(p.name);
          movimientosIniciales.push({
            partido_id: partidoId,
            periodo: 1,
            minuto: 6,
            segundo: 0,
            tipo_movimiento: '112',
            descripcion: 'Entra al camp',
            jugador_id: jugadorId,
            equipo_id: eqId,
            marcador: '0-0',
            event_uuid: `start_${partidoId}_${jugadorId}`
          });
        }

        const d = p.data || {};
        const { data: statsData, error: statsErr } = await supabase.from('estadisticas_jugador_partido').upsert({
          partido_id: partidoId, 
          jugador_id: jugadorId, 
          dorsal: p.dorsal ? String(p.dorsal) : null,
          puntos: d.score || 0, 
          valoracion: d.valoration || 0,
          tiempo_jugado: p.timePlayed || 0,
          asistencias: d.assists || 0,
          tapones: d.block || 0,
          faltas_cometidas: d.faults || 0,
          t1_anotados: d.shotsOfOneSuccessful || 0, 
          t2_anotados: d.shotsOfTwoSuccessful || 0, 
          t3_anotados: d.shotsOfThreeSuccessful || 0,
          t1_intentados: d.shotsOfOneAttempted || 0, 
          t2_intentados: d.shotsOfTwoAttempted || 0, 
          t3_intentados: d.shotsOfThreeAttempted || 0
        }, { onConflict: 'partido_id,jugador_id' }).select();

        if (statsData?.length && d) { 
          await guardarDetalleTiros(d, statsData[0].id, log); 
        }
      }
      log(`Stats for ${t.name} uploaded.`, 'success');
    }

    // --- MARCADOR Y MOVIMIENTOS ---
    if (mainJson.score?.length) {
      log(`Inserting marcador evolución (${mainJson.score.length} entries)...`, 'info');
      const evolData = mainJson.score.map((s: any) => ({
        partido_id: partidoId, periodo: s.period || 0, minuto_cuarto: s.minuteQuarter || 0,
        minuto_absoluto: s.minuteAbsolute || 0, puntos_local: s.local || 0,
        puntos_visitante: s.visit || 0, diferencia: (s.local || 0) - (s.visit || 0)
      }));
      await supabase.from('partido_marcador_evolucion').insert(evolData);
      log(`Marcador evolución inserted.`, 'success');
    }

    const rawMoves = Array.isArray(movesJson) ? movesJson : (movesJson?.moves || []);
    let dataMoves: any[] = [];
    
    if (rawMoves.length > 0) {
      log(`Processing ${rawMoves.length} moves...`, 'info');
      dataMoves = rawMoves.map((m: any) => {
        const actorIdKey = m.actorId ? String(m.actorId) : null;
        const teamIdKey = m.idTeam ? String(m.idTeam) : null;
        
        const nombreJugador = actorIdKey ? mapaActorANombre[actorIdKey] : null;
        const nombreEquipo = teamIdKey ? mapaTeamIdANombre[teamIdKey] : null;
        
        const jugadorId = nombreJugador ? mapaJugadoresPorNombre[nombreJugador] : null;
        const equipoId = nombreEquipo ? mapaEquiposPorNombre[nombreEquipo] : null;

        const tipoMov = String(m.idMove ?? m.id_move ?? 'EVENTO');
        
        if (nombreJugador) {
          if (tipoMov === '112') {
            nombresEnPista.add(nombreJugador);
          } else if (tipoMov === '115') {
            nombresEnPista.delete(nombreJugador);
          }
        }

        return {
          partido_id: partidoId,
          periodo: m.period ?? m.periodo ?? 0,
          minuto: m.min ?? m.minuto ?? 0,
          segundo: m.second ?? m.sec ?? m.segundo ?? 0,
          tipo_movimiento: tipoMov,
          descripcion: m.move ?? m.descripcion ?? '',
          jugador_id: jugadorId,
          equipo_id: equipoId,
          marcador: m.score ?? m.marcador ?? '',
          event_uuid: m.event_uuid ?? m.eventUuid ?? `move_${partidoId}_${Math.random().toString(36).substr(2, 9)}`
        };
      });
    }

    let marcadorFinal = `${mainJson.teams[0]?.players[0]?.teamScore || 0}-${mainJson.teams[0]?.players[0]?.oppScore || 0}`;
    const endOfMatchMove = [...dataMoves]
      .filter(m => m.tipo_movimiento === '116')
      .sort((a, b) => {
        if (b.periodo !== a.periodo) return b.periodo - a.periodo;
        if (b.minuto !== a.minuto) return b.minuto - a.minuto;
        return b.segundo - a.segundo;
      })[0];

    if (endOfMatchMove && endOfMatchMove.marcador) {
      marcadorFinal = endOfMatchMove.marcador;
    } else if (mainJson.score && mainJson.score.length > 0) {
      const lastScore = mainJson.score[mainJson.score.length - 1];
      marcadorFinal = `${lastScore.local}-${lastScore.visit}`;
    }

    const movimientosFinales: any[] = [];
    for (const nombre of nombresEnPista) {
      const jugadorId = mapaJugadoresPorNombre[nombre];
      let eqId = null;
      
      for (const t of mainJson.teams) {
        if (t.players.some((p: any) => p.name === nombre)) {
          eqId = mapaEquiposPorNombre[t.name];
          break;
        }
      }

      if (jugadorId && eqId) {
        movimientosFinales.push({
          partido_id: partidoId,
          periodo: 8,
          minuto: 0,
          segundo: 0,
          tipo_movimiento: '115',
          descripcion: 'Surt del camp',
          jugador_id: jugadorId,
          equipo_id: eqId,
          marcador: marcadorFinal, 
          event_uuid: `end_${partidoId}_${jugadorId}`
        });
      }
    }

    dataMoves = [...movimientosIniciales, ...dataMoves, ...movimientosFinales];

    if (dataMoves.length > 0) {
      log(`Upserting ${dataMoves.length} total movements...`, 'info');
      await supabase.from('partido_movimientos').upsert(dataMoves, { onConflict: 'event_uuid' });
      log(`Movements upserted.`, 'success');
    }
    log("--- PRODUCTION UPLOAD COMPLETED ---", 'success');
    return true;
  } catch (err) {
    log(`PRODUCTION UPLOAD ERROR: ${err instanceof Error ? err.message : String(err)}`, 'error');
    console.error("PRODUCTION UPLOAD ERROR:", err);
    throw err;
  }
};

async function guardarDetalleTiros(dataObj: any, estadisticaId: string, log: (msg: string, type?: any) => void) {
  const tiros: any[] = [];
  const config = [
    { key: 'metadataShotsOfOneSuccessful', tipo: '1pt' }, { key: 'metadataShotsOfOneFailed', tipo: '1pt' },
    { key: 'shootingOfTwoSuccessfulPoint', tipo: '2pt' }, { key: 'shootingOfTwoFailedPoint', tipo: '2pt' },
    { key: 'shootingOfThreeSuccessfulPoint', tipo: '3pt' }, { key: 'shootingOfThreeFailedPoint', tipo: '3pt' }
  ];

  config.forEach(cfg => {
    const lista = dataObj[cfg.key];
    if (Array.isArray(lista)) {
      lista.forEach((t: any) => {
        tiros.push({
          estadistica_id: estadisticaId,
          tipo_tiro: cfg.tipo,
          periodo: t.period || 0,
          minuto: t.minute !== undefined ? t.minute : (t.min || 0),
          segundo: t.second || 0,
          x: t.x || 0,
          y: t.y || 0,
          x_norm: t.xnormalize || 0,
          y_norm: t.ynormalize || 0,
          event_uuid: t.event_uuid || t.eventUuid || null
        });
      });
    }
  });

  if (tiros.length > 0) {
    log(`Upserting ${tiros.length} shot details...`, 'info');
    await supabase.from('detalle_tiros_jugador').upsert(tiros, { onConflict: 'event_uuid' });
  }
}
