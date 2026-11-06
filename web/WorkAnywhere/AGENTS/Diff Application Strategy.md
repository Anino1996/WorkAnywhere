# Diff Application Strategy

> _How AI-generated file changes are applied to a workspace. Client-side for MVP. See [[CloudAgent Workspace]] for product context and [[Architecture]] for backend services._

---

## Context

The iOS app's "Change Card" lists files modified by the AI (`auth.py +45 −10`). The backend has no diff-application mechanism — the data plane only exposes raw `GET/PUT/DELETE` on `/v1/fs/*` with ETag-based optimistic concurrency. A decision is needed on **how the AI describes its changes** and **where they get applied**.

This note records the chosen strategy, the alternatives considered, and the apply / undo algorithm.

---

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| **Edit format** | SEARCH/REPLACE blocks (with whole-content fallback for new/rewrite/delete) | Token-efficient, reliable, industry-standard (Aider, Claude Code, Cursor Composer) |
| **Apply location** | Client (iOS) | Reuses existing data plane endpoints; zero new backend code; preserves the "plan and explore without committing to the workspace" UX — chat and proposed edits stay client-only until the user hits Apply |
| **Apply mechanism** | Deterministic string replacement | AI emits intent; client owns matching/transformation. Eliminates AI "drift" at apply time. |
| **Undo storage** | Inverse changeset, in-memory on the client | S/R blocks are trivially symmetric (swap `search` ↔ `replace`). No file backups needed except for `rewrite` / `delete` / `replaceAll`. |
| **Undo durability** | Session-only (lost on app kill) | Acceptable for MVP. Future: git-in-workspace gives durable history via `git revert`. |
| **Concurrency safety** | ETag on both Apply (`If-Match` on read-time ETag) and Undo (`If-Match` on post-apply ETag) | Prevents lost-update on Apply; prevents Undo from clobbering newer content. |
| **Ambiguous matches** | Reject by default; AI re-emits with more context. Explicit `replaceAll: true` opt-in for rename-everywhere cases. | Safe (no accidental clobbering), self-healing (AI gets enough info to fix), and matches Claude Code / Aider conventions. |

---

## Edit Format: SEARCH/REPLACE Blocks

The AI emits structured edits, not free-form text or whole files:

```
<<<<<<< SEARCH
def authenticate(user):
    return user.token
=======
def authenticate(user):
    if not user.token: raise AuthError()
    return user.token
>>>>>>> REPLACE
```

### Approaches considered

| Approach | Used by | Why rejected |
|---|---|---|
| Whole-file replacement | Cursor (small files), simple wrappers | 5–10× more output tokens; AI silently drifts (drops imports, reformats); slow on large files |
| Unified diff (`@@ -10,3 +10,5 @@`) | GNU `patch`, git, early Aider modes | AI is bad at counting line numbers; off-by-one breaks the whole patch. Industry abandoned this. |
| **SEARCH/REPLACE blocks** | **Aider, Claude Code Edit tool, Cursor Composer, Cline, Roo Code** | **Convergent industry standard. No line numbers. Surgical. Easy to validate.** |
| AST / Tree-sitter edits | Sourcegraph Cody (partial), refactoring tools | Requires per-language parsers. Overkill for general AI editing. |

### When to use whole content instead

Hard rules:

| Case | Use |
|---|---|
| New file (no search target exists) | whole content |
| File <20 lines | whole content (S/R block delimiters cost more than the file) |
| File >2000 lines | S/R required (re-emitting 8K+ output tokens is too slow / expensive) |

Heuristic for the middle (AI picks):
- <30% of the file changing → S/R
- >50% of the file changing, or >5 distinct edit regions → whole content rewrite
- Total S/R block size approaching ~70% of file size → rewrite is more efficient

These rules go in the AI's system prompt. The client supports both via the same `FileEditOp` enum, so the cutover is purely a prompting decision.

---

## Apply Location: Client-Side

### Approaches considered

| Approach | Pros | Cons |
|---|---|---|
| **Client-side (chosen)** | No new backend code. Reuses `/v1/fs/*` + ETag. Fast to ship. Diff rendering on-device. Inverse changeset trivially in-memory. **Lets the user iterate on prompts and review proposed edits without anything touching the workspace until they hit Apply.** | Undo dies if app is killed mid-session. No cross-device undo. Client must handle partial-failure. |
| Server-side agent + changesets | Single source of truth. Cross-device undo. Audit log. API key not in the client binary. Multi-step tool loops are local syscalls, not HTTP round-trips. Git-in-workspace is immediate. | Significantly more backend work (agent runtime, streaming, tool execution, chat history). Shifts the UX toward "agent already ran, here's what it did" rather than "here's what it would do." |

The client-side cons are real but low-impact for a single-user, single-device flow. The server-side approach can be added later without changing the on-device data model — the inverse changeset just moves from `@Published` state to a backend store.

---

## Apply Algorithm

Per-file, executed by the iOS `ChangeSetApplier`:

1. `GET /v1/fs/{path}` via DataPlane → current content + read-time ETag (skip for `create`)
2. Compute new content:
   - `searchReplace` (default): locate `search` exactly once. **Bail if 0 or 2+ matches** with a structured error (see [Handling Ambiguous Matches](#handling-ambiguous-matches)).
   - `searchReplace` with `replaceAll: true`: replace every occurrence. Bail only if 0 matches.
   - `create` / `rewrite`: use `content`
   - `delete`: skip step 3, issue `DELETE` instead
3. `PUT /v1/fs/{path}` with `If-Match: <readTimeETag>` → capture returned new ETag into `postApplyETag` on the edit
4. Stash `oldContent` on the edit if the op needs it for Undo (`rewrite`, `delete`, or any `replaceAll` block) — subject to the [1 MB Stash Cap](#1-mb-stash-cap). If the file exceeds the cap, mark `undoable: false` with a reason; the Apply still proceeds.
5. If any file fails, walk back already-applied edits using their inverses (best-effort; surface partial-failure to the user)

### Deterministic apply, not AI apply

The client **always** owns the matching/replacement step. The AI only describes intent via `search` and `replace` strings. This means:

- **No drift.** The only way the file changes is if `search` is found exactly once and replaced byte-for-byte with `replace`. The AI cannot re-emit a "fixed" version of unrelated lines.
- **Loud failures.** If `search` doesn't match (typo, whitespace, ambiguity), the apply fails immediately with a recoverable error — not a silent regression discovered later.
- **Cheap implementation.** The apply function is ~30 lines of Swift.

---

## Handling Ambiguous Matches

Three layers, in order of preference.

### 1. Default: reject and let the AI disambiguate

If `search` matches 0 or 2+ times in the file, Apply fails immediately with a structured error that tells the AI *where* the matches are:

```
edit failed in `auth.py`: search string matches 3 locations
  line 12:  def authenticate(user):
  line 47:  def authenticate(user):
  line 91:  def authenticate(user):
add more surrounding lines to make the match unique, or set replaceAll: true
```

The AI then re-emits with more surrounding lines until the search is unique. This is what Aider, Claude Code, and Cursor Composer do — safe (no accidental clobbering), self-healing (AI has enough info to fix on the next turn).

### 2. Multi-block edits for distinct occurrences

If the AI wants to change three different occurrences differently, it emits three blocks in one `FileEdit`, each disambiguated by surrounding context. Already supported by `blocks: [EditBlock]`. Applied sequentially.

### 3. Escape hatch: explicit `replaceAll: true`

For legitimate rename-everywhere cases (e.g. renaming `userId` to `accountId` across a file), the AI must opt in explicitly:

```swift
struct EditBlock: Codable {
    let search: String
    let replace: String
    let replaceAll: Bool   // default false
}
```

Without the explicit flag, `replaceAll` semantics are **never** the default — too easy to clobber unrelated matches (e.g. `userId` appearing in a comment about "the legacy userId field" that shouldn't be renamed). Mirrors Claude Code's `Edit` tool `replace_all` parameter.

### Apply logic

```swift
func apply(_ block: EditBlock, to content: String) throws -> String {
    let count = content.components(separatedBy: block.search).count - 1

    if block.replaceAll {
        guard count >= 1 else { throw .searchNotFound(...) }
        return content.replacingOccurrences(of: block.search, with: block.replace)
    }

    switch count {
    case 0: throw .searchNotFound(...)
    case 1: return content.replacingOccurrences(of: block.search, with: block.replace)
    default: throw .searchAmbiguous(matches: locateMatches(...))
    }
}
```

---

## Undo Algorithm

For each edit in **reverse order**, build the inverse and apply with `If-Match: <postApplyETag>`. Edits marked `undoable: false` are skipped with a per-file note in the UI.

### Inverse table

| Op | Inverse |
|---|---|
| `searchReplace` (single block, no `replaceAll`) | swap each block's `search` ↔ `replace` |
| `searchReplace` with any `replaceAll: true` block | full-file restore from stashed `oldContent` (block-level inversion isn't safe — see below) |
| `create` | `delete` (no `oldContent` needed) |
| `rewrite` | `rewrite` with `newContent` ↔ `oldContent` |
| `delete` | `create` with stashed `oldContent` |

### Why `replaceAll` can't use symmetric block inversion

The naive inverse of "replace all `foo` with `bar`" would be "replace all `bar` with `foo`" — but if `bar` was already in the file before Apply (in a comment, a string literal, anywhere), the inverse over-replaces and corrupts unrelated content. So any `replaceAll` block triggers an `oldContent` stash on the parent `FileEdit` and Undo does a full-file restore for that file. Treat `replaceAll` as a "mini rewrite" for undo purposes.

### ETag guard on Undo

Each edit carries the `postApplyETag` captured at Apply time. Undo sends this as `If-Match`. If the file has been modified out-of-band (another client, a build script, a follow-up AI turn), the data plane returns `412 Precondition Failed`. The client surfaces:

> _file modified since edit — cannot undo cleanly_

and skips that file. **No merge attempt.** Better to present the user with a clear partial-undo than to silently clobber newer content.

---

## 1 MB Stash Cap

A frequent point of confusion, so spelled out explicitly here.

### What it caps

**Only the `oldContent` stashed in iOS app memory** for ops where the inverse can't be derived from the edit itself. It does **not** cap file size in general.

| Op | Needs `oldContent` stash? | Reason |
|---|---|---|
| `searchReplace` (single, non-`replaceAll`) | **No** | Inverse = swap `search` ↔ `replace`. The edit itself is the backup. |
| `searchReplace` with `replaceAll: true` | **Yes** | Naive inverse over-replaces if `replace` already existed in the file. |
| `create` | **No** | Inverse is `delete`. No content needed. |
| `rewrite` | **Yes** | Original is gone after Apply. |
| `delete` | **Yes** | File is gone after Apply. |

So a 5 MB source file can still receive a normal `searchReplace` edit fine — we stash nothing, and Undo just swaps the block. The cap only bites on `rewrite` / `delete` / `replaceAll`.

### Why a cap at all

iOS apps live under an OS-enforced memory budget (~1.5 GB on most devices, lower if backgrounded). A 50 MB `oldContent` sitting in `@Published` state until the user hits Undo can get the app jetsammed.

### Why 1 MB

Empirical heuristic, not a hard physical limit. Tunable.

- Most source files are <50 KB. A large one is ~200 KB. 1 MB covers all source code with headroom.
- Past 1 MB you're usually in **non-source territory** — minified bundles, lockfiles, fixtures, binary blobs, ML weights. Per-edit Undo on those is rarely meaningful.
- 5–10 stashed entries at 1 MB each ≈ 10 MB worst case. Comfortable.

### What happens when a file exceeds the cap

**The Apply still proceeds. Only Undo is disabled for that specific file.** The over-cap `FileEdit` carries `undoable: false` and a reason string.

```
Change Card:
  ✓ auth.py        (+45 −10)        [undoable]
  ✓ data.json      (rewritten)      ⚠ too large to undo locally
  ✓ app.py         (+18 −6)         [undoable]

  [ Review (3 files) ]  [ Undo (2 of 3 files) ]
```

This is preferable to:
- **Refusing the edit entirely** — blocks legitimate work on large files
- **Silently skipping Undo** — surprising and bad
- **Spilling to disk** — adds storage management, encryption, cleanup. Not worth it for MVP.

### Per-file, not cumulative

The cap is "no single stashed `oldContent` exceeds 1 MB," not "total stash across the changeset stays under 1 MB." Cumulative would create weird ordering effects (file 5 becomes non-undoable because files 1–4 used up the budget) and complicate UX.

### Removed by git-in-workspace

Once the workspace runs git, the cap goes away entirely — git stores diffs efficiently in `.git/objects` and Undo becomes `git revert <commit>`. The 1 MB cap is a property of the in-memory MVP, not the long-term design.

---

## Limits and Safety (summary)

| Concern | Mitigation |
|---|---|
| Large `oldContent` stash bloats client memory | 1 MB per-file cap on `oldContent`. Over-cap files marked `undoable: false`, not refused. See [1 MB Stash Cap](#1-mb-stash-cap). |
| Lost-update on Apply | `If-Match: <readTimeETag>` mandatory on every `PUT` |
| Out-of-band modification before Undo | `If-Match: <postApplyETag>` on Undo. 412 → surface, skip. |
| Concurrent changesets in flight | UI disables Apply until current changeset resolves. Keeps ordering simple. |
| Partial-failure during Apply | Walk back already-applied edits via inverses. Surface which files succeeded / failed. |
| Ambiguous `search` string | Default reject with structured error. See [Handling Ambiguous Matches](#handling-ambiguous-matches). |
| Accidental rename-everywhere | `replaceAll` requires explicit opt-in per block. |
| AI emits S/R blocks for >80% of a file | Log warning. Suggest the AI should have used `rewrite`. Don't reject the edit. |

---

## iOS Data Model

```swift
struct EditBlock: Codable {
    let search: String
    let replace: String
    let replaceAll: Bool       // default false; opt-in for rename-everywhere
}

enum FileEditOp: Codable {
    case searchReplace(blocks: [EditBlock])
    case create(content: String)
    case rewrite(oldContent: String, newContent: String)
    case delete(oldContent: String)
}

struct FileEdit: Codable {
    let path: String
    let op: FileEditOp
    var postApplyETag: String?
    var oldContent: String?    // populated at Apply if op needs it for Undo
    var undoable: Bool         // false if oldContent was needed but exceeded the 1 MB cap
    var undoableReason: String?  // user-visible note when undoable == false
}

struct ChangeSet: Identifiable {
    let id: UUID
    var edits: [FileEdit]
    var status: Status         // .pending, .applied, .undone, .failed, .partiallyUndone
}
```

---

## iOS File Layout

| File | Purpose |
|---|---|
| `Models/ChangeSet.swift` (new) | Types above |
| `Services/ChangeSetApplier.swift` (new) | Apply / Undo / inverse logic. Talks to `APIClient`. |
| `Services/UnifiedDiff.swift` (new) | On-device unified diff for the Review screen |
| `Services/APIClient.swift` (extend) | `getFile(path:)`, `putFile(path:content:ifMatch:)`, `deleteFile(path:ifMatch:)` |
| `Views/Chat/ChangeCard.swift` (modify) | Wire Review / Undo buttons to `ChatViewModel`. Render per-file undoable state. |
| `Views/Chat/ReviewSheet.swift` (new) | Per-file unified diff sheet |
| `ViewModels/ChatViewModel.swift` (new or extend) | Owns `currentChangeSet`. Exposes `apply()` / `undo()`. |

**Backend: no changes.** Reuses existing data plane `/v1/fs/*` endpoints documented in [[Architecture]].

---

## Diff Rendering

Computed on-device using a small unified-diff utility in `Services/UnifiedDiff.swift`. Rendered in `ReviewSheet` with monospaced styling and `+` / `−` colour coding. No server round-trip per Review tap.

A standard Myers-style line diff over the before / after content is sufficient. Word-level highlighting can come later.

---

## Future (post-MVP)

- **Git inside the workspace.** Each Apply becomes a commit on a working branch; Undo becomes `git revert` (or a branch reset). Provides:
    - Durable, cross-session, cross-device undo
    - Full edit history visible from the workspace itself
    - Natural `git push` story for syncing AI changes back to the user's upstream repo
    - Removes the 1 MB stash cap entirely
  This supersedes the in-memory inverse changeset model and removes the "lost on app kill" caveat.
- **Server-side changeset audit log.** Only if needed for analytics or cross-device flows. The on-device data model is unchanged — the inverse just moves to a backend store.
- **Server-side agent runtime.** Reconsider once the agent needs multi-step tool loops (read → edit → run tests → edit again). Each step is currently an HTTP round-trip from iOS; server-side they would be local syscalls. Trade-off shifts the UX from "plan and review then commit" toward "agent ran, here's what happened" — a real product question, not just an engineering one.

---

## Verification

1. **Unit tests** (`iOS/CloudAgentWorkspaceTests/`):
    - `ChangeSetApplierTests`:
        - single S/R applies cleanly
        - ambiguous search → structured error with match locations
        - `replaceAll: true` replaces every occurrence
        - `replaceAll` undo restores from `oldContent`, not from block inversion
        - full inverse round-trip restores original
        - ETag mismatch on Undo is surfaced rather than applied
        - over-cap `oldContent` → edit applies with `undoable: false`
    - `UnifiedDiffTests`: known input/output pairs
2. **Manual end-to-end**: send chat message → mock AI returns 3-file changeset → tap Apply → verify in workspace via DataPlane API or `kubectl exec` → tap Review → see diffs → tap Undo → files restored
3. **Failure cases**:
    - Kill app between Apply and Undo → restart → Undo button gone (expected)
    - Modify file out-of-band → Undo surfaces ETag-mismatch warning, skips that file
    - `rewrite` on a 2 MB file → Apply succeeds, Undo button shows "(N of M files)" with the over-cap file marked

---

## Open Items

- Swift unified-diff library choice — third-party (`swift-difference`, etc.) vs small in-house Myers implementation
- UX for partial-failure during Apply — toast vs sheet vs inline error in the Change Card
- UX for per-file `undoable: false` state in the Change Card and Review sheet — exact wording, icon, colour
- Whether the AI's edit format (S/R blocks plus rules above) should be enforced via tool-use schemas or via prompting alone
- Tunability of the 1 MB cap — config value vs hardcoded constant
