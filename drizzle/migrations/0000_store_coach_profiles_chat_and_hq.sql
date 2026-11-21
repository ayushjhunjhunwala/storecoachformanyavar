CREATE TYPE public.coach_role AS ENUM ('hq', 'zonal', 'am', 'store_lead', 'salesperson');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  role public.coach_role NOT NULL,
  scope_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.coach_role NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  replay_date date,
  provider text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chat_messages_user_created_idx ON public.chat_messages (user_id, created_at DESC);

GRANT SELECT ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own chat messages"
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.auth_user_id_by_email(_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.auth_user_id_by_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_user_id_by_email(text) FROM anon;
REVOKE ALL ON FUNCTION public.auth_user_id_by_email(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_id_by_email(text) TO service_role;

DO $$
DECLARE
  uid uuid;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE lower(email) = 'hq@storecoach.demo';
  IF uid IS NULL THEN
    uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      'hq@storecoach.demo', extensions.crypt('Demo@2026', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"HQ Admin"}'::jsonb, now(), now(),
      '', '', '', '', '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), uid, uid::text,
      jsonb_build_object('sub', uid::text, 'email', 'hq@storecoach.demo', 'email_verified', true, 'phone_verified', false),
      'email', now(), now(), now()
    );
  END IF;

  INSERT INTO public.profiles (id, email, display_name, role, scope_id)
  VALUES (uid, 'hq@storecoach.demo', 'HQ Admin', 'hq', 'ALL')
  ON CONFLICT (id) DO NOTHING;
END $$;