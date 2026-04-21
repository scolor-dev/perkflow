export interface RunePage {
  name: string;
  primaryStyleId: number;
  subStyleId: number;
  selectedPerkIds: number[];
}

export type Lane = "top" | "jungle" | "mid" | "bot" | "support";

export const LANES: { value: Lane; label: string; abbr: string }[] = [
  { value: "top", label: "Top", abbr: "TOP" },
  { value: "jungle", label: "Jungle", abbr: "JGL" },
  { value: "mid", label: "Mid", abbr: "MID" },
  { value: "bot", label: "Bot", abbr: "BOT" },
  { value: "support", label: "Support", abbr: "SUP" },
];

export interface ChampionRunes {
  championId: number;
  championName: string;
  lane?: Lane;
  pages: RunePage[];
}

export interface LcuRunePage {
  id: number;
  name: string;
  primaryStyleId: number;
  subStyleId: number;
  selectedPerkIds: number[];
  isEditable: boolean;
  isActive: boolean;
}

export interface PerkStyle {
  id: number;
  key: string;
  icon: string;
  name: string;
  slots: PerkSlot[];
}

export interface PerkSlot {
  type: string;
  // バージョンによって perks または runes
  perks?: Perk[];
  runes?: Perk[];
}

export interface Perk {
  id: number;
  key: string;
  icon: string;
  name: string;
  shortDesc: string;
}

export const STAT_SHARDS = {
  row1: [
    { id: 5008, name: "Adaptive Force" },
    { id: 5005, name: "Attack Speed" },
    { id: 5007, name: "Ability Haste" },
  ],
  row2: [
    { id: 5008, name: "Adaptive Force" },
    { id: 5010, name: "Move Speed" },
    { id: 5001, name: "Health Scaling" },
  ],
  row3: [
    { id: 5011, name: "Health" },
    { id: 5013, name: "Tenacity" },
    { id: 5001, name: "Health Scaling" },
  ],
} as const;

export type LcuStatus = { connected: boolean; port?: number; error?: string };