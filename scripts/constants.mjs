export const MODULE_ID = "fabula-affinity-nameplates";
export const PREFIX = "FAN";

export const ELEMENTS = Object.freeze([
  ["physical", "PHY"], ["air", "AIR"], ["bolt", "BLT"],
  ["dark", "DRK"], ["earth", "EAR"], ["fire", "FIR"],
  ["ice", "ICE"], ["light", "LGT"], ["poison", "PSN"]
].map(Object.freeze));

export const AFFINITY_CODES = Object.freeze({ "-1": "VU", 1: "RS", 2: "IM", 3: "AB" });

export function localize(key, fallback) {
  const result = globalThis.game?.i18n?.localize(`${PREFIX}.${key}`);
  return result && result !== `${PREFIX}.${key}` ? result : fallback;
}
