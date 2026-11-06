// Exact string-match counter + ambiguous-match locator. Mirrors the
// "Handling Ambiguous Matches" rules: default rejects 0 or 2+ matches;
// `replaceAll: true` requires >=1 match.

import type { EditBlock } from "./types";

export interface MatchLocation {
  line: number; // 1-based
  column: number; // 1-based
}

export interface MatchResult {
  count: number;
  locations: MatchLocation[];
}

export function countOccurrences(haystack: string, needle: string): MatchResult {
  if (needle.length === 0) return { count: 0, locations: [] };
  const locations: MatchLocation[] = [];
  let i = 0;
  let line = 1;
  let col = 1;

  while (i <= haystack.length - needle.length) {
    if (haystack.startsWith(needle, i)) {
      locations.push({ line, column: col });
      // advance past the match
      const matched = needle;

      for (const ch of matched) {
        if (ch === "\n") {
          line += 1;
          col = 1;
        } else {
          col += 1;
        }
      }

      i += needle.length;
    } else {
      if (haystack[i] === "\n") {
        line += 1;
        col = 1;
      } else {
        col += 1;
      }

      i += 1;
    }
  }

  return { count: locations.length, locations };
}

export class BlockApplyError extends Error {
  constructor(
    public readonly code:
      | "search_not_found"
      | "search_ambiguous"
      | "search_empty"
      | "file_not_found",
    message: string,
    public readonly locations?: MatchLocation[],
  ) {
    super(message);
    this.name = "BlockApplyError";
  }
}

// Apply one block to a content string. Throws on 0/2+ matches unless
// replaceAll (which throws only on 0).
export function applyBlock(content: string, block: EditBlock): string {
  if (block.search.length === 0) {
    throw new BlockApplyError("search_empty", "Empty search string is not allowed");
  }

  const { count, locations } = countOccurrences(content, block.search);

  if (block.replaceAll) {
    if (count < 1) {
      throw new BlockApplyError("search_not_found", `search not found in file`, locations);
    }

    // Global replace.
    return content.split(block.search).join(block.replace);
  }

  switch (count) {
    case 0:
      throw new BlockApplyError("search_not_found", `search not found`, locations);
    case 1:
      return content.replace(block.search, block.replace);
    default: {
      const preview = locations
        .slice(0, 3)
        .map((l) => `  line ${l.line}: ${peekLine(content, l.line)}`)
        .join("\n");
      throw new BlockApplyError(
        "search_ambiguous",
        `search string matches ${count} locations:\n${preview}\nadd more surrounding lines to make the match unique, or set replaceAll: true`,
        locations,
      );
    }
  }
}

function peekLine(content: string, lineNo: number): string {
  const lines = content.split("\n");
  return lines[lineNo - 1] ?? "";
}