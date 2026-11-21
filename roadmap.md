# Store Coach roadmap

## In progress
- [ ] Store lead sees each salesperson's Done / Not today (needs a server read of the team's card ticks, scoped to the lead's store)
- [ ] Re-run sign-in safety checks (role promotion blocked, salesperson redirects) after the redesign

## Transformation brief ("Store Coach by Manyavar") — phases
- [ ] FEATURE-COVERAGE.md: all 114 IDs + F1–F11 / S1–S13 with honest status
- [ ] Phase 3: action workflow with append-only history (assign, acknowledge, begin, block with reason, done, dismiss with reason, reopen), action board + filters + CSV export, in-app notifications
- [ ] Phase 5: Evidence Courtroom (Detective / Skeptic checks / Verdict / Challenge / Silence ledger / Decision audit) grounded on scoped facts
- [ ] Phase 6: Revenue Studio scenarios from real store baselines (conversion, items per bill, attachment), saved and compared
- [ ] Phase 7: Voice Sales Dojo (Sarvam speech-to-text + text-to-speech, AI customer personas, feedback, retries, text fallback)
- [ ] Phase 8: employee Practice / Progress (skill radar, timeline, micro-lessons, streaks), executive briefing, people-risk view
- [ ] Phase 4: daily scheduled run that publishes briefs + notifications without a browser (replay data)
- [ ] Guided judge tour + welcome page
- Blocked: raw data pack (bills, stock, roster, customers) is not in the project — needed for ghost receipts, stock/size checks, frequently-bought-together, propensity, source reconciliation

## Done
- [x] Redesign to the uploaded design PDF: light design system, Live replay pill, sign-in, AM digest with inline assistant, issue detail, store huddle, salesperson Today + My callbacks, zone page, HQ Guardrails / Runs / Digests
- [x] Roster planner (wedding-date week, Present/Off, suggestion, undo, save waits for the server, people who stopped billing left off)
- [x] Ticks saved to the account (Mark done / Dismiss, Done / Not today, callback outcomes, mentor choices)
- [x] Product name "Store Coach by Manyavar" in header, sign-in and page titles; synthetic-data note in footer
- [x] Account check reports created / repaired / already valid
- [x] Coach data engine helpers + role-scoped slices
- [x] Server functions: scoped view, HQ-only seeding, manager assistant (Sarvam + fallback, 10/hour)
- [x] Login page with demo accounts; role routes /hq /zone /am /store /me with guards
- [x] Ask Store Coach drawer on /hq /zone /am /store
- [x] Seeded 152 demo accounts; PRD checks passed (sp1019 redirects, am01 LKO only, LKO-02 answer matches card)
- [x] Tests for scoping rules and account list
- [x] Roles moved to a separate read-own table; app can't write roles, profiles or chats
- [x] Lovable Cloud on; private bucket coach-data with data.json; profiles + chat_messages with own-row access; HQ account; public sign-up off
- [x] SARVAM_API_KEY saved

## Ideas / later

## Next (priority order, after 20-min cutoff on 21 Nov)
- [ ] Revenue scenarios from real baselines (no forecasts)
- [x] Salesperson text sales practice with AI customer + coach feedback
- [ ] Voice input for practice + Progress page
- [ ] Daily automatic run
- [ ] Welcome page with guided demo + feature checklist
- Blocked: bill-line, stock and roster features need data not in the upload
