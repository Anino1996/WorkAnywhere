# CloudAgent Workspace — Web App (demo build)

A dark, mobile-first, **fully offline** web app for the CloudAgent Workspace
product. No remote calls. All control-plane and data-plane traffic is served
by in-browser mocks that persist to `localStorage` and exercise the **real**
polling / ETag / Apply-Undo loops you'd hit against the production backends.

## Run

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

Auto-login is on — you land on the home screen with a seeded demo account.
To see the login form, sign out via Settings → Sign out.

## Try it

1. **Home** — three seeded workspaces (ACTIVE / SAVED / PROVISIONING). Tap
   "Start New Workspace" → fill in a name → the provisioning card animates
   `PROVISIONING → ACTIVE` via the 500ms operations poller.
2. **Chat** — open a workspace. Try:
   - `auth` → 2-file SEARCH/REPLACE changeset (the example from the Diff doc)
   - `test` → `create` op for a new test file
   - `rewrite` / `large` → a `rewrite` over a >1 MB fixture (Apply proceeds,
     **Undo is disabled for this file** with a "too large" badge — the
     per-file 1 MB stash cap)
   - `ambiguous` → `search` matches 5+ locations; Apply rejects with a
     structured ambiguous-match error (the AI would normally re-emit with
     more context)
3. **Diff review** — `View Changes` opens the full-screen modal. Apply →
   `If-Match: <read-time ETag>` on every PUT, captures `postApplyETag`. Undo
   → inverse-table swap (S/R ↔ swap, replaceAll/rewrite/delete → restore from
   stashed `oldContent`), guarded by `If-Match: <postApplyETag>`.
4. **Files** — browse the seeded workspace tree (mirror of what the chat
   just applied/undid).
5. **Settings → Demo Controls** — inject failures:
   - **ETag 412 once** — next Apply hits a precondition mismatch.
   - **Partial fail at file #2** — Apply fails on the 2nd file; already-applied
     files are rolled back via their inverses (visible in the note banner).
   - **Slow ops** slider — stretches the polling timers so you can watch the
     status badges churn.

## Architecture seams

- `src/lib/api/types.ts` — `ControlPlaneClient` and `DataPlaneClient`
  interfaces match the JSON contracts documented in
  `AGENTS/Architecture.md` (workspaces, operations, files, dirs, ETags).
- `src/lib/api/mock/` — in-browser implementations. `MockControlPlane` runs
  async workspace transitions on timers (~1.5s) so the 500ms-operations
  polling code path is exercised exactly as in production. `MockDataPlane`
  computes real content-hash ETags and enforces `If-Match` CAS (412 on
  mismatch) — so the Apply/Undo round-trip genuinely works.
- `src/lib/api/index.ts` — factory. Defaults to mocks. Set
  `VITE_USE_MOCKS=0` to switch to the real HTTP clients (currently stubbed;
  drop-in wiring is the only change needed).
- `src/lib/changeset/` — 1:1 TS port of the Swift model in
  `AGENTS/Diff Application Strategy.md`:
  - `types.ts` — `EditBlock`, `FileEditOp`, `FileEdit`, `ChangeSet`
  - `blockMatch.ts` — exact-match counter + ambiguous-match locator + the
    `applyBlock` rules (default reject on 0/2+ matches; `replaceAll` opt-in)
  - `applier.ts` — Apply (with partial-failure walk-back via inverses) and
    Undo (using the inverse table). Per-file `oldContent` stash with the
    1 MB cap (`STASH_CAP_BYTES`).
  - `unifiedDiff.ts` — small Myers line diff for the Review screen.

## Verify

```bash
pnpm verify      # typecheck + tests
pnpm test        # vitest run — 24 tests covering blockMatch, unifiedDiff, applier
pnpm build       # tsc -b + vite build
```

## What's intentionally out of scope (per the agreed plan)

- Real BFF / auth — single mock-mode SPA only.
- Real AI — chat returns canned `ChangeSet`s from a keyword router.
- Build/Run/Test sheet content (handle + motion wired, body stubbed).
- Workspace Info Drawer content (handle + motion wired, body stubbed).
- Model Selection — pill stores preference locally only.
- VCS branch import on create — `POST /workspaces` sends `{name}` only.
- Data plane v0.2 exec / v0.3 watch.