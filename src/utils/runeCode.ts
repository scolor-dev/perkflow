import type { RunePage } from "../types";

const VERSION = 1;

// Binary layout (little-endian):
// [0]     version  (uint8)
// [1-2]   primaryStyleId (uint16)
// [3-4]   subStyleId     (uint16)
// [5]     perk count     (uint8)
// [6+]    perk IDs       (uint16 each)
export function encodeRunePage(page: Partial<RunePage>): string {
  const primaryStyleId = page.primaryStyleId ?? 0;
  const subStyleId = page.subStyleId ?? 0;
  const perkIds = (page.selectedPerkIds ?? []).slice(0, 255);

  const buf = new Uint8Array(1 + 2 + 2 + 1 + perkIds.length * 2);
  const view = new DataView(buf.buffer);
  let offset = 0;

  view.setUint8(offset++, VERSION);
  view.setUint16(offset, primaryStyleId, true); offset += 2;
  view.setUint16(offset, subStyleId, true);     offset += 2;
  view.setUint8(offset++, perkIds.length);
  for (const id of perkIds) {
    view.setUint16(offset, id, true); offset += 2;
  }

  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function decodeRunePage(code: string): Partial<RunePage> {
  const b64 = code.trim().replace(/-/g, "+").replace(/_/g, "/");
  let bin: string;
  try {
    bin = atob(b64);
  } catch {
    throw new Error("Invalid code format");
  }

  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);

  if (buf.length < 6) throw new Error("Code is too short");

  const view = new DataView(buf.buffer);
  let offset = 0;

  const version = view.getUint8(offset++);
  if (version !== VERSION) throw new Error(`Unsupported version: ${version}`);

  const primaryStyleId = view.getUint16(offset, true); offset += 2;
  const subStyleId     = view.getUint16(offset, true); offset += 2;
  const count          = view.getUint8(offset++);

  if (buf.length < offset + count * 2) throw new Error("Code is truncated");

  const selectedPerkIds: number[] = [];
  for (let i = 0; i < count; i++) {
    selectedPerkIds.push(view.getUint16(offset, true)); offset += 2;
  }

  return { name: "", primaryStyleId, subStyleId, selectedPerkIds };
}
