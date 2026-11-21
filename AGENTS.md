<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules (Store Coach by Manyavar)

- The coach data (`data.json`) lives in the private `coach-data` storage bucket and is read only by server code (`src/lib/coach/*.server.ts`); the browser receives role-scoped slices built server-side, because scope filtering in the browser would leak other stores' data.
- Every server function in `src/lib/coach/coach.functions.ts` authenticates with `requireSupabaseAuth` and resolves role/scope from `public.user_roles` (never from profile fields or client input), because roles in editable rows allow privilege escalation.
- Clients may only read their own `profiles`, `user_roles` and chat rows; all writes to those go through server functions with the admin client after a role check, because client writes were the escalation path.
- Per-user ticks and workflow states (issue done/dismissed, card done/not today, callback outcomes, mentor choices, roster plans) are rows in `public.action_status` keyed by `statusKey.*` helpers in `use-action-status.ts`, so every screen reads the same key and state survives devices.
- Engine numbers are precomputed in the data; UI and assistant copy them, never recalculate, so the UI, the assistant and the issue cards always agree.
- Pure business rules (scoping, roster planning) live in plain TS modules under `src/lib/coach/` with Vitest tests in `src/test/`, so rules are testable without a browser.
- Visual design follows the uploaded "Store Coach web app design" PDF via semantic tokens in `src/styles.css` and shared primitives in `src/components/coach/primitives.tsx`; components never hardcode colours.
- The assistant calls Sarvam first and falls back to the Lovable AI gateway with the same scoped context (`src/lib/coach/ai.server.ts`), so answers never see data outside the caller's scope.
