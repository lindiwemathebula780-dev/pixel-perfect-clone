DO $$ DECLARE t text; BEGIN
FOREACH t IN ARRAY ARRAY['threads','messages','tasks','emails'] LOOP
  EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id DROP NOT NULL, ALTER COLUMN user_id DROP DEFAULT', t);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon', t);
  EXECUTE format('CREATE POLICY "open workspace" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', t);
END LOOP; END $$;