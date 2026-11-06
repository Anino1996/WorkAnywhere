// Stubbed AI responses. The chat screen routes user messages by keyword to
// one of these canned ChangeSets. None of this is a real LLM; it exists only
// to exercise the full Review → Apply → Undo loop end-to-end without an API key.

import type { ChangeSet, FileEdit } from "@/lib/changeset/types";

const newId = () => `cs_${Math.random().toString(36).slice(2, 10)}`;

// "auth" — the SEARCH/REPLACE block straight from the Diff doc.
const authChangeSet: () => ChangeSet = () => ({
  id: newId(),
  status: "pending",
  edits: [
    {
      path: "auth.py",
      op: {
        kind: "searchReplace",
        blocks: [
          {
            search:
              "def authenticate(user):\n    return user.token",
            replace:
              "def authenticate(user):\n    if not user.token:\n        raise AuthError('no token')\n    return user.token",
          },
        ],
      },
      undoable: false,
    },
    {
      path: "app.py",
      op: {
        kind: "searchReplace",
        blocks: [
          {
            search: "token = authenticate(user)\n    return {'token': token}\n",
            replace: "token = authenticate(user)\n    try:\n        return {'token': token}\n    except AuthError:\n        return {'error': 'unauthorized'}\n",
          },
        ],
      },
      undoable: false,
    },
  ],
});

// "test" — create a new test file.
const testChangeSet: () => ChangeSet = () => ({
  id: newId(),
  status: "pending",
  edits: [
    {
      path: "tests/test_auth.py",
      op: {
        kind: "create",
        content:
          "import pytest\nfrom auth import authenticate\n\n\nclass FakeUser:\n    def __init__(self, token=None):\n        self.token = token\n\n\ndef test_authenticate_returns_token():\n    user = FakeUser('secret')\n    assert authenticate(user) == 'secret'\n\n\ndef test_authenticate_rejects_empty():\n    user = FakeUser(None)\n    with pytest.raises(Exception):\n        authenticate(user)\n",
      },
      undoable: false,
    },
  ],
});

// "large" or "rewrite"  — a rewrite of a >1MB fixture, exercising the
// `undoable=false` path. The file is generated lazily.
const largeChangeSet: () => ChangeSet = () => {
  // ~1.4 MB of padding via repeated comments.
  const big = "# padding\n".repeat(80_000); // ~720 KB per 80k lines
  const oldContent = `${big}# end\n`;
  void big;
  return {
    id: newId(),
    status: "pending",
    edits: [
      {
        path: "data/weights.json",
        op: {
          kind: "rewrite",
          oldContent,
          newContent: JSON.stringify({ weights: Array.from({ length: 200 }, (_, i) => i) }, null, 2),
        },
        undoable: false,
      },
    ],
  };
};

// "ambiguous" — a SEARCH string that appears twice in `auth.py` (the `def authenticate(user):` line
// plus an inline appearance in a comment we inject) to demonstrate the
// default ambiguous-reject behaviour. We can't easily inject a duplicate since
// `auth.py` only has one `def authenticate(user):` line. Instead emit a search
// for `"return user.token"` style — appears once. To genuinely trigger ambiguity,
// we use a 1-char search `e` which obviously has 2+ matches; the applier
// rejects with a structured error and the AI "re-emits" — but here we just
// surface the error to the UI for demonstration.
const ambiguousChangeSet: () => ChangeSet = () => ({
  id: newId(),
  status: "pending",
  edits: [
    {
      path: "auth.py",
      op: {
        kind: "searchReplace",
        blocks: [{ search: "user.", replace: "actor." }],
      },
      undoable: false,
      undoableReason: "Ambiguous search (5+ matches). The AI would re-emit with more context.",
    },
  ],
});

export interface StubReply {
  text: string;
  changeSet?: ChangeSet;
}

const GENERIC_REPLIES = [
  "I'd help with that — but real LLM integration is stubbed in this demo. Try asking about `auth`, `test`, `rewrite`, or `ambiguous`.",
  "Sounds good. Type `auth` to see a SEARCH/REPLACE changeset, or `rewrite` to try the too-large-to-undo badge.",
  "I can show a demo changeset if you mention `auth`, `test`, `rewrite`, or `ambiguous`.",
];

export function stubReply(message: string): StubReply {
  const m = message.toLowerCase();
  if (m.includes("auth")) {
    return {
      text: "I'll add input validation to `authenticate` and handle the new `AuthError` in `app.py`. Two files changed.",
      changeSet: authChangeSet(),
    };
  }
  if (m.includes("test")) {
    return {
      text: "Adding two tests for `authenticate` — happy path and rejected empty token.",
      changeSet: testChangeSet(),
    };
  }
  if (m.includes("rewrite") || m.includes("large")) {
    return {
      text: "Rewriting `data/weights.json` with a small replacement. The original is too large for in-memory Undo, so Apply proceeds but Undo is disabled for this file.",
      changeSet: largeChangeSet(),
    };
  }
  if (m.includes("ambiguous")) {
    return {
      text: "Trying to rename `user.` → `actor.` everywhere. Your client's applier will reject this as ambiguous (5+ matches) — exactly the safe behaviour.",
      changeSet: ambiguousChangeSet(),
    };
  }
  return { text: GENERIC_REPLIES[Math.floor(Math.random() * GENERIC_REPLIES.length)] };
}

export function blankChangeSet(): ChangeSet {
  return { id: newId(), status: "pending", edits: [] };
}

export type { ChangeSet, FileEdit };