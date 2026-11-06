import { describe, it, expect } from "vitest";
import { diffLines, diffStat } from "@/lib/changeset/unifiedDiff";

describe("diffLines", () => {
  it("marks additions and removals", () => {
    const lines = diffLines("a\nb\nc", "a\nB\nc");
    const types = lines.map((l) => l.type);
    expect(types).toContain("removed");
    expect(types).toContain("added");
    const removedText = lines.find((l) => l.type === "removed")?.text;
    const addedText = lines.find((l) => l.type === "added")?.text;
    expect(removedText).toBe("b");
    expect(addedText).toBe("B");
  });

  it("handles pure insertions", () => {
    const lines = diffLines("", "new\nfile");
    expect(lines.length).toBe(2);
    expect(lines.every((l) => l.type === "added")).toBe(true);
  });

  it("handles pure deletions", () => {
    const lines = diffLines("gone\nnow", "");
    expect(lines.every((l) => l.type === "removed")).toBe(true);
  });

  it("handles no-op identical inputs", () => {
    const lines = diffLines("same\ncontent", "same\ncontent");
    expect(lines.every((l) => l.type === "context")).toBe(true);
  });
});

describe("diffStat", () => {
  it("counts adds/dels", () => {
    const s = diffStat(diffLines("a\nb\nc", "a\nB\nc"));
    expect(s).toEqual({ adds: 1, dels: 1 });
  });
});