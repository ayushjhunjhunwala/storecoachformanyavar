CREATE TABLE public.investigations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id text NOT NULL,
  store_id text NOT NULL,
  area_manager_id text NOT NULL,
  zone text NOT NULL,
  created_by uuid NOT NULL,
  created_by_name text NOT NULL,
  as_of date NOT NULL,
  data_version text NOT NULL,
  evidence_hash text NOT NULL,
  facts jsonb NOT NULL,
  checks jsonb NOT NULL,
  detective jsonb,
  skeptic jsonb,
  verdict text CHECK (verdict IS NULL OR verdict IN ('supported', 'uncertain', 'rejected')),
  verdict_reason text,
  status text NOT NULL DEFAULT 'detective' CHECK (status IN ('detective', 'complete')),
  provider text,
  model text,
  prompt_version text NOT NULL,
  validations jsonb NOT NULL DEFAULT '[]'::jsonb,
  fallback boolean NOT NULL DEFAULT false,
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX investigations_issue_idx ON public.investigations (issue_id, created_at DESC);

CREATE TABLE public.investigation_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id text NOT NULL,
  store_id text NOT NULL,
  area_manager_id text NOT NULL,
  zone text NOT NULL,
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  question text NOT NULL CHECK (char_length(question) BETWEEN 2 AND 400),
  preset text,
  answer text NOT NULL,
  can_answer boolean NOT NULL,
  fact_ids text[] NOT NULL DEFAULT '{}',
  provider text,
  fallback boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX investigation_challenges_issue_idx ON public.investigation_challenges (issue_id, created_at DESC);
CREATE INDEX investigation_challenges_user_idx ON public.investigation_challenges (user_id, created_at DESC);

GRANT SELECT ON public.investigations TO authenticated;
GRANT ALL ON public.investigations TO service_role;
GRANT SELECT ON public.investigation_challenges TO authenticated;
GRANT ALL ON public.investigation_challenges TO service_role;

ALTER TABLE public.investigations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigation_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers read investigations in their scope"
  ON public.investigations FOR SELECT TO authenticated
  USING (public.can_see_store_action(store_id, area_manager_id, zone));

CREATE POLICY "Managers read challenges in their scope"
  ON public.investigation_challenges FOR SELECT TO authenticated
  USING (public.can_see_store_action(store_id, area_manager_id, zone));