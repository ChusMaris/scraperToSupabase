CREATE OR REPLACE FUNCTION public.replace_live_match_snapshot(
  p_match jsonb,
  p_player_stats jsonb,
  p_shots jsonb,
  p_score_evolution jsonb,
  p_movements jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_match_id public.partidos.id%TYPE;
BEGIN
  INSERT INTO public.partidos (
    id_match_extern,
    competicion_id,
    equipo_local_id,
    equipo_visitante_id,
    fecha_hora,
    puntos_local,
    puntos_visitante,
    jornada
  )
  SELECT
    match_row.id_match_extern,
    match_row.competicion_id,
    match_row.equipo_local_id,
    match_row.equipo_visitante_id,
    match_row.fecha_hora,
    match_row.puntos_local,
    match_row.puntos_visitante,
    match_row.jornada
  FROM jsonb_populate_record(NULL::public.partidos, p_match) AS match_row
  ON CONFLICT (id_match_extern) DO UPDATE SET
    competicion_id = EXCLUDED.competicion_id,
    equipo_local_id = EXCLUDED.equipo_local_id,
    equipo_visitante_id = EXCLUDED.equipo_visitante_id,
    fecha_hora = EXCLUDED.fecha_hora,
    puntos_local = EXCLUDED.puntos_local,
    puntos_visitante = EXCLUDED.puntos_visitante,
    jornada = EXCLUDED.jornada
  RETURNING id INTO v_match_id;

  DELETE FROM public.detalle_tiros_jugador AS shot
  USING public.estadisticas_jugador_partido AS stat
  WHERE shot.estadistica_id = stat.id
    AND stat.partido_id = v_match_id;

  DELETE FROM public.estadisticas_jugador_partido
  WHERE partido_id = v_match_id;

  DELETE FROM public.partido_marcador_evolucion
  WHERE partido_id = v_match_id;

  DELETE FROM public.partido_movimientos
  WHERE partido_id = v_match_id;

  INSERT INTO public.estadisticas_jugador_partido (
    partido_id,
    jugador_id,
    dorsal,
    puntos,
    valoracion,
    tiempo_jugado,
    asistencias,
    tapones,
    faltas_cometidas,
    t1_anotados,
    t2_anotados,
    t3_anotados,
    t1_intentados,
    t2_intentados,
    t3_intentados
  )
  SELECT
    v_match_id,
    stat.jugador_id,
    stat.dorsal,
    stat.puntos,
    stat.valoracion,
    stat.tiempo_jugado,
    stat.asistencias,
    stat.tapones,
    stat.faltas_cometidas,
    stat.t1_anotados,
    stat.t2_anotados,
    stat.t3_anotados,
    stat.t1_intentados,
    stat.t2_intentados,
    stat.t3_intentados
  FROM jsonb_populate_recordset(
    NULL::public.estadisticas_jugador_partido,
    COALESCE(p_player_stats, '[]'::jsonb)
  ) AS stat;

  INSERT INTO public.detalle_tiros_jugador (
    estadistica_id,
    tipo_tiro,
    periodo,
    minuto,
    segundo,
    x,
    y,
    x_norm,
    y_norm,
    event_uuid
  )
  SELECT
    stat.id,
    shot.tipo_tiro,
    shot.periodo,
    shot.minuto,
    shot.segundo,
    shot.x,
    shot.y,
    shot.x_norm,
    shot.y_norm,
    shot.event_uuid
  FROM jsonb_to_recordset(COALESCE(p_shots, '[]'::jsonb)) AS shot(
    jugador_id text,
    tipo_tiro text,
    periodo integer,
    minuto integer,
    segundo integer,
    x numeric,
    y numeric,
    x_norm numeric,
    y_norm numeric,
    event_uuid text
  )
  JOIN public.estadisticas_jugador_partido AS stat
    ON stat.partido_id = v_match_id
   AND stat.jugador_id::text = shot.jugador_id;

  INSERT INTO public.partido_marcador_evolucion (
    partido_id,
    periodo,
    minuto_cuarto,
    minuto_absoluto,
    puntos_local,
    puntos_visitante,
    diferencia
  )
  SELECT
    v_match_id,
    evolution.periodo,
    evolution.minuto_cuarto,
    evolution.minuto_absoluto,
    evolution.puntos_local,
    evolution.puntos_visitante,
    evolution.diferencia
  FROM jsonb_populate_recordset(
    NULL::public.partido_marcador_evolucion,
    COALESCE(p_score_evolution, '[]'::jsonb)
  ) AS evolution;

  INSERT INTO public.partido_movimientos (
    partido_id,
    periodo,
    minuto,
    segundo,
    tipo_movimiento,
    descripcion,
    jugador_id,
    equipo_id,
    marcador,
    event_uuid
  )
  SELECT
    v_match_id,
    movement.periodo,
    movement.minuto,
    movement.segundo,
    movement.tipo_movimiento,
    movement.descripcion,
    movement.jugador_id,
    movement.equipo_id,
    movement.marcador,
    movement.event_uuid
  FROM jsonb_populate_recordset(
    NULL::public.partido_movimientos,
    COALESCE(p_movements, '[]'::jsonb)
  ) AS movement;

  RETURN v_match_id::text;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_live_match_snapshot(jsonb, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_live_match_snapshot(jsonb, jsonb, jsonb, jsonb, jsonb)
  TO service_role;
