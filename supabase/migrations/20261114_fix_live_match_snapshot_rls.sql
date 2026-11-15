ALTER FUNCTION public.replace_live_match_snapshot(jsonb, jsonb, jsonb, jsonb, jsonb)
  SECURITY INVOKER;

ALTER FUNCTION public.replace_live_match_snapshot(jsonb, jsonb, jsonb, jsonb, jsonb)
  SET search_path = pg_catalog, public, pg_temp;

REVOKE ALL ON FUNCTION public.replace_live_match_snapshot(jsonb, jsonb, jsonb, jsonb, jsonb)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.replace_live_match_snapshot(jsonb, jsonb, jsonb, jsonb, jsonb)
  TO service_role;
