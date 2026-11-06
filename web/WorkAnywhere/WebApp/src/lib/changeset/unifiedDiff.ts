// Tiny Myers-style line diff. Output mirrors GNU unified diff line prefixes:
// " " context, "+" added, "-" removed. Single-pass over before/after strings.

export interface DiffLine {
  type: "context" | "added" | "removed";
  text: string;
  oldNo?: number;
  newNo?: number;
}

export interface DiffHunk {
  oldStart: number;
  newStart: number;
  lines: DiffLine[];
}

// Classic LCS DP — fine for our small files (≤ a few KB).
function lcsMatrix(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  return dp;
}

// Returns a flat list of diff lines (no hunk headers) — easy to render.
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.length === 0 ? [] : before.split("\n");
  const b = after.length === 0 ? [] : after.split("\n");
  const dp = lcsMatrix(a, b);
  const out: DiffLine[] = [];
  let i = a.length;
  let j = b.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      out.unshift({ type: "context", text: a[i - 1], oldNo: i, newNo: j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      out.unshift({ type: "added", text: b[j - 1], newNo: j });
      j--;
    } else {
      out.unshift({ type: "removed", text: a[i - 1], oldNo: i });
      i--;
    }
  }

  return out;
}

// Computes a short stat line: "+3 -5".
export function diffStat(lines: DiffLine[]): { adds: number; dels: number } {
  let adds = 0;
  let dels = 0;

  for (const l of lines) {
    if (l.type === "added") adds++;
    else if (l.type === "removed") dels++;
  }

  return { adds, dels };
}