-- Grants for tables added in Phase 3

-- ai_model_config: service_role reads config (bypasses RLS for router)
-- authenticated admins can manage via RLS policy
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_model_config TO service_role;
GRANT SELECT                         ON public.ai_model_config TO authenticated;

-- api_usage_log: service_role writes usage logs (already used in route.ts via service client)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_usage_log   TO service_role;
