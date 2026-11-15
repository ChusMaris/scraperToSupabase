REVOKE ALL ON FUNCTION public.replace_live_match_snapshot(jsonb, jsonb, jsonb, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.replace_live_match_snapshot(jsonb, jsonb, jsonb, jsonb, jsonb)
  TO service_role;
