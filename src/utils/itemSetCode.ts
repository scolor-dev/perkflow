import type { ItemSet } from "../types";

const VERSION = 2;

// Binary layout (little-endian):
// [0]     version (uint8) = 2
// [1]     block count (uint8)
// for each block:
//   [N]     type string byte length (uint8)
//   [N+1..] type string (utf8)
//   [M]     item count (uint8)
//   for each item:
//     [M+1, M+2] item id (uint16)
//     [M+3]      count   (uint8)

function encodeString(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function decodeString(buf: Uint8Array, offset: number, len: number): string {
  return new TextDecoder().decode(buf.slice(offset, offset + len));
}

export function encodeItemSet(set: ItemSet): string {
  const blocks = set.blocks.filter((b) => b.items.length > 0);

  const parts: Uint8Array[] = [];
  let totalLen = 2; // version + block count

  for (const block of blocks) {
    const typeBytes = encodeString(block.type);
    const typeLen = Math.min(typeBytes.length, 255);
    totalLen += 1 + typeLen + 1 + block.items.length * 3;
  }

  const buf = new Uint8Array(totalLen);
  const view = new DataView(buf.buffer);
  let off = 0;

  view.setUint8(off++, VERSION);
  view.setUint8(off++, Math.min(blocks.length, 255));

  for (const block of blocks) {
    const typeBytes = encodeString(block.type);
    const typeLen = Math.min(typeBytes.length, 255);
    view.setUint8(off++, typeLen);
    buf.set(typeBytes.slice(0, typeLen), off);
    off += typeLen;

    const items = block.items.slice(0, 255);
    view.setUint8(off++, items.length);
    for (const item of items) {
      view.setUint16(off, item.id, true); off += 2;
      view.setUint8(off++, Math.min(item.count, 255));
    }
  }

  void parts;
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function decodeItemSet(code: string): ItemSet {
  const b64 = code.trim().replace(/-/g, "+").replace(/_/g, "/");
  let bin: string;
  try {
    bin = atob(b64);
  } catch {
    throw new Error("Invalid code format");
  }

  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);

  if (buf.length < 2) throw new Error("Code too short");

  const view = new DataView(buf.buffer);
  let off = 0;

  const version = view.getUint8(off++);
  if (version !== VERSION) throw new Error(`Unsupported version: ${version}`);

  const blockCount = view.getUint8(off++);
  const blocks = [];

  for (let b = 0; b < blockCount; b++) {
    if (off >= buf.length) throw new Error("Code truncated");
    const typeLen = view.getUint8(off++);
    if (off + typeLen > buf.length) throw new Error("Code truncated");
    const type = decodeString(buf, off, typeLen);
    off += typeLen;

    const itemCount = view.getUint8(off++);
    const items = [];
    for (let i = 0; i < itemCount; i++) {
      if (off + 3 > buf.length) throw new Error("Code truncated");
      const id = view.getUint16(off, true); off += 2;
      const count = view.getUint8(off++);
      items.push({ id, count });
    }
    blocks.push({ type, items });
  }

  return { blocks };
}

export type CombinedCodeParts = {
  runeCode: string | null;
  itemCode: string | null;
};

export function encodeCombined(runeCode: string, itemCode: string): string {
  return `${runeCode}|${itemCode}`;
}

export function decodeCombined(code: string): CombinedCodeParts {
  const idx = code.indexOf("|");
  if (idx === -1) return { runeCode: null, itemCode: null };
  return {
    runeCode: code.slice(0, idx) || null,
    itemCode: code.slice(idx + 1) || null,
  };
}

export function detectCodeType(code: string): "rune" | "itemset" | "combined" | "unknown" {
  if (code.includes("|")) return "combined";
  try {
    const b64 = code.trim().replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    const version = bin.charCodeAt(0);
    if (version === 1) return "rune";
    if (version === 2) return "itemset";
  } catch {
    // ignore
  }
  return "unknown";
}
