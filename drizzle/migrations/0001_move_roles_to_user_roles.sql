CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.coach_role NOT NULL,
  scope_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own role"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

INSERT INTO public.user_roles (user_id, role, scope_id)
SELECT id, role, scope_id FROM public.profiles WHERE role IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.profiles ALTER COLUMN role DROP NOT NULL;
UPDATE public.profiles SET role = NULL, scope_id = NULL;
COMMENT ON COLUMN public.profiles.role IS 'DEPRECATED: replaced by public.user_roles.role';
COMMENT ON COLUMN public.profiles.scope_id IS 'DEPRECATED: replaced by public.user_roles.scope_id';

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.coach_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.coach_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.coach_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.coach_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.coach_role) TO service_role;