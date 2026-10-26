import { AFFINITY_CODES, ELEMENTS } from "./constants.mjs";

/** Read the prepared model, never the stored base or affinity-named methods. */
export function affinityEntries(actor, { allowed = null, onInvalid } = {}) {
  if (!["character", "npc"].includes(actor?.type)) return [];
  const affinities = actor.system?.affinities;
  if (!affinities) return [];
  const entries = [];
  for (const [element] of ELEMENTS) {
    if (allowed && !allowed.has(element)) continue;
    const value = affinities[element]?.current;
    if (!Number.isInteger(value) || value < -1 || value > 3) {
      onInvalid?.(element);
      continue;
    }
    if (value === 0) continue;
    const code = AFFINITY_CODES[value];
    entries.push({ element, code });
  }
  return entries;
}

/** Plain text equivalent for integrations; the rendered plate uses the icons. */
export function formatAffinities(actor, { translate = (_key, fallback) => fallback, ...options } = {}) {
  return affinityEntries(actor, options).map(({ element, code }) => {
    const abbreviation = ELEMENTS.find(([key]) => key === element)[1];
    return `${translate(`elements.${element}`, abbreviation)}:${code}`;
  }).join(" | ");
}

/** Recognizes expanded, dotted, parent replacement, and deletion updates. */
export function affectsAffinities(changes) {
  function visit(value, prefix = "") {
    if (!value || typeof value !== "object") return false;
    for (const [rawKey, child] of Object.entries(value)) {
      const key = rawKey.split(".").map(part => part.replace(/^-=/, "")).join(".");
      const path = prefix ? `${prefix}.${key}` : key;
      if (path === "system.affinities" || path.startsWith("system.affinities.")) return true;
      if (path === "system" && (child === null || typeof child !== "object" || Object.keys(child).length === 0)) return true;
      if (path === "system" && rawKey.startsWith("-=")) return true;
      if (visit(child, path)) return true;
    }
    return false;
  }
  return visit(changes);
}
