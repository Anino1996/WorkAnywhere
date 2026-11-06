import { describe, it, expect } from "vitest";
import { countOccurrences, applyBlock, BlockApplyError } from "@/lib/changeset/blockMatch";

describe("countOccurrences", () => {
  it("counts single occurrence with line/column tracking", () => {
    const r = countOccurrences("foo bar foo", "foo");
    expect(r.count).toBe(2);
    expect(r.locations[0]).toEqual({ line: 1, column: 1 });
    expect(r.locations[1]).toEqual({ line: 1, column: 9 });
  });

  it("tracks newlines", () => {
    const r = countOccurrences("a\nfoo\nfoo\nb", "foo");
    expect(r.count).toBe(2);
    expect(r.locations[0]).toEqual({ line: 2, column: 1 });
    expect(r.locations[1]).toEqual({ line: 3, column: 1 });
  });

  it("returns 0 for empty needle", () => {
    expect(countOccurrences("hello", "").count).toBe(0);
  });
});

describe("applyBlock", () => {
  it("replaces a single unique match", () => {
    expect(applyBlock("hello world", { search: "world", replace: "there" })).toBe("hello there");
  });

  it("rejects ambiguous matches with structured error", () => {
    expect(() => applyBlock("foo foo foo", { search: "foo", replace: "bar" })).toThrow(BlockApplyError);

    try {
      applyBlock("foo foo foo", { search: "foo", replace: "bar" });
    } catch (e) {
      const err = e as BlockApplyError;
      expect(err.code).toBe("search_ambiguous");
      expect(err.locations?.length).toBe(3);
    }
  });

  it("rejects zero matches", () => {
    try {
      applyBlock("nothing here", { search: "missing", replace: "x" });
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as BlockApplyError).code).toBe("search_not_found");
    }
  });

  it("replaceAll requires >=1 match and swaps every occurrence", () => {
    expect(applyBlock("a b a b", { search: "a", replace: "z", replaceAll: true })).toBe("z b z b");
    expect(() =>
      applyBlock("xyz", { search: "a", replace: "z", replaceAll: true }),
    ).toThrow(BlockApplyError);
  });

  it("rejects empty search string", () => {
    expect(() => applyBlock("hi", { search: "", replace: "x" })).toThrow(BlockApplyError);
  });
});