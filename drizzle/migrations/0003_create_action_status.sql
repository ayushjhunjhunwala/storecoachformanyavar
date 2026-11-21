CREATE TABLE public.action_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_key text NOT NULL CHECK (char_length(item_key) BETWEEN 1 AND 200),
  status text NOT NULL CHECK (char_length(status) BETWEEN 1 AND 40),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_key)
);

CREATE INDEX action_status_item_key_idx ON public.action_status (item_key);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_status TO authenticated;
GRANT ALL ON public.action_status TO service_role;

ALTER TABLE public.action_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own ticks"
  ON public.action_status FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users add their own ticks"
  ON public.action_status FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users change their own ticks"
  ON public.action_status FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users remove their own ticks"
  ON public.action_status FOR DELETE TO authenticated
  USING (user_id = auth.uid());