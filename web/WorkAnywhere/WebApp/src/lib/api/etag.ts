// Non-cryptographic content hash for the mock data plane's ETags.
// Mirrors the documented wire format (a quoted hex string). Not the real
// production xattr path — purely a dev fixture.

const FNV64_OFFSET = 0xcbf29ce484222325n;
const FNV64_PRIME = 0x100000001b3n;
const MASK64 = 0xffffffffffffffffn;

export function hashContent(content: Uint8Array): string {
  let h = FNV64_OFFSET;

  for (let i = 0; i < content.length; i++) {
    h = (h ^ BigInt(content[i])) & MASK64;
    h = (h * FNV64_PRIME) & MASK64;
  }

  // Avalanche for better distribution.
  h = (h ^ (h >> 33n)) * 0xff51afd7ed558ccdn & MASK64;
  h = (h ^ (h >> 29n)) * 0xc4ceb9fe1a85ec53n & MASK64;
  h = (h ^ (h >> 33n)) & MASK64;
  return h.toString(16).padStart(16, "0");
}

export function etagFor(content: Uint8Array): string {
  return `"${hashContent(content)}"`;
}