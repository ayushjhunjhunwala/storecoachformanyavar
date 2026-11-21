CREATE TYPE public.issue_action_state AS ENUM ('open', 'assigned', 'acknowledged', 'in_progress', 'blocked', 'done', 'reviewed', 'dismissed');

CREATE TABLE public.issue_actions (
  issue_id text PRIMARY KEY CHECK (char_length(issue_id) BETWEEN 1 AND 120),
  store_id text NOT NULL,
  area_manager_id text NOT NULL,
  zone text NOT NULL,
  week_date date NOT NULL,
  lever text,
  title text,
  rupees numeric,
  state public.issue_action_state NOT NULL DEFAULT 'open',
  assignee_user_id uuid,
  assignee_name text,
  due_date date,
  block_reason text,
  dismiss_reason text,
  version integer NOT NULL DEFAULT 1,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX issue_actions_store_idx ON public.issue_actions (store_id);
CREATE INDEX issue_actions_am_idx ON public.issue_actions (area_manager_id);
CREATE INDEX issue_actions_zone_idx ON public.issue_actions (zone);
CREATE INDEX issue_actions_assignee_idx ON public.issue_actions (assignee_user_id);

CREATE TABLE public.issue_action_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  issue_id text NOT NULL REFERENCES public.issue_actions(issue_id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL,
  actor_name text NOT NULL,
  actor_role text NOT NULL,
  event text NOT NULL CHECK (char_length(event) BETWEEN 1 AND 40),
  from_state public.issue_action_state,
  to_state public.issue_action_state NOT NULL,
  assignee_name text,
  reason text CHECK (reason IS NULL OR char_length(reason) <= 120),
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX issue_action_events_issue_idx ON public.issue_action_events (issue_id, created_at);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (char_length(kind) BETWEEN 1 AND 40),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  body text CHECK (body IS NULL OR char_length(body) <= 600),
  link text CHECK (link IS NULL OR (char_length(link) <= 300 AND link LIKE '/%')),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_idx ON public.notifications (user_id, created_at DESC);

GRANT SELECT ON public.issue_actions TO authenticated;
GRANT ALL ON public.issue_actions TO service_role;
GRANT SELECT ON public.issue_action_events TO authenticated;
GRANT ALL ON public.issue_action_events TO service_role;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.issue_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_action_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_see_store_action(_store text, _am text, _zone text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = auth.uid()
      AND (
        r.role = 'hq'
        OR (r.role = 'zonal' AND r.scope_id = _zone)
        OR (r.role = 'am' AND r.scope_id = _am)
        OR (r.role = 'store_lead' AND r.scope_id = _store)
      )
  )
$$;

REVOKE ALL ON FUNCTION public.can_see_store_action(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_see_store_action(text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_see_store_action(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_see_store_action(text, text, text) TO service_role;

CREATE POLICY "Managers read issue actions in their scope"
  ON public.issue_actions FOR SELECT TO authenticated
  USING (public.can_see_store_action(store_id, area_manager_id, zone));

CREATE POLICY "Managers read action history in their scope"
  ON public.issue_action_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.issue_actions a
    WHERE a.issue_id = issue_action_events.issue_id
      AND public.can_see_store_action(a.store_id, a.area_manager_id, a.zone)
  ));

CREATE POLICY "Users read their own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users mark their own notifications read"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- One transaction per change: create the row if needed, check the version, update, log, notify.
CREATE OR REPLACE FUNCTION public.apply_issue_transition(
  _issue_id text,
  _store_id text,
  _am_id text,
  _zone text,
  _week_date date,
  _lever text,
  _title text,
  _rupees numeric,
  _actor uuid,
  _actor_name text,
  _actor_role text,
  _event text,
  _expected_version integer,
  _to_state public.issue_action_state,
  _assignee uuid,
  _assignee_name text,
  _set_assignee boolean,
  _due date,
  _reason text,
  _note text,
  _notify uuid[],
  _notify_kind text,
  _notify_title text,
  _notify_body text,
  _notify_link text
)
RETURNS TABLE (new_version integer, new_state public.issue_action_state)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_row public.issue_actions%ROWTYPE;
  target uuid;
BEGIN
  INSERT INTO public.issue_actions (issue_id, store_id, area_manager_id, zone, week_date, lever, title, rupees, version)
  VALUES (_issue_id, _store_id, _am_id, _zone, _week_date, _lever, _title, _rupees, 0)
  ON CONFLICT (issue_id) DO NOTHING;

  SELECT * INTO current_row FROM public.issue_actions WHERE issue_id = _issue_id FOR UPDATE;

  IF current_row.version <> _expected_version THEN
    RAISE EXCEPTION 'version_conflict' USING ERRCODE = 'P0409';
  END IF;

  UPDATE public.issue_actions SET
    state = _to_state,
    assignee_user_id = CASE WHEN _set_assignee THEN _assignee ELSE assignee_user_id END,
    assignee_name = CASE WHEN _set_assignee THEN _assignee_name ELSE assignee_name END,
    due_date = COALESCE(_due, due_date),
    block_reason = CASE WHEN _to_state = 'blocked' THEN _reason WHEN _to_state IN ('in_progress', 'done', 'reviewed', 'open', 'assigned') THEN NULL ELSE block_reason END,
    dismiss_reason = CASE WHEN _to_state = 'dismissed' THEN _reason WHEN _to_state = 'dismissed' THEN dismiss_reason ELSE NULL END,
    version = current_row.version + 1,
    updated_by = _actor,
    updated_at = now()
  WHERE issue_id = _issue_id;

  INSERT INTO public.issue_action_events (issue_id, actor_user_id, actor_name, actor_role, event, from_state, to_state, assignee_name, reason, note)
  VALUES (
    _issue_id, _actor, _actor_name, _actor_role, _event,
    CASE WHEN current_row.version = 0 THEN NULL ELSE current_row.state END,
    _to_state,
    CASE WHEN _set_assignee THEN _assignee_name ELSE NULL END,
    _reason, _note
  );

  IF _notify IS NOT NULL THEN
    FOREACH target IN ARRAY _notify LOOP
      IF target IS NOT NULL AND target <> _actor THEN
        INSERT INTO public.notifications (user_id, kind, title, body, link)
        VALUES (target, _notify_kind, _notify_title, _notify_body, _notify_link);
      END IF;
    END LOOP;
  END IF;

  RETURN QUERY SELECT current_row.version + 1, _to_state;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_issue_transition(text, text, text, text, date, text, text, numeric, uuid, text, text, text, integer, public.issue_action_state, uuid, text, boolean, date, text, text, uuid[], text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_issue_transition(text, text, text, text, date, text, text, numeric, uuid, text, text, text, integer, public.issue_action_state, uuid, text, boolean, date, text, text, uuid[], text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.apply_issue_transition(text, text, text, text, date, text, text, numeric, uuid, text, text, text, integer, public.issue_action_state, uuid, text, boolean, date, text, text, uuid[], text, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_issue_transition(text, text, text, text, date, text, text, numeric, uuid, text, text, text, integer, public.issue_action_state, uuid, text, boolean, date, text, text, uuid[], text, text, text, text) TO service_role;