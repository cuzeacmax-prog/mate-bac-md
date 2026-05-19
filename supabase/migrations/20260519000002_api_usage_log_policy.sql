-- Allow service role to insert api usage logs (already covered by service role bypass)
-- Allow authenticated users to read their own usage logs
CREATE POLICY "Users can read own api usage logs"
  ON api_usage_log FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Service role INSERT is handled by RLS bypass (no explicit policy needed)
-- But we need a policy for the service client acting on behalf of users
CREATE POLICY "Service role can insert api usage logs"
  ON api_usage_log FOR INSERT
  TO service_role
  WITH CHECK (true);
