import { MODULE_ID, ELEMENTS, AFFINITY_CODES } from "./constants.mjs";
import { affinityEntries } from "./affinities.mjs";

export const REVEALS_SETTING = "gmReveals";
const ELEMENT_KEYS = new Set(ELEMENTS.map(([key]) => key));
const CODES = new Set(Object.values(AFFINITY_CODES));

export function tokenKey(document) {
  if (document?.uuid?.startsWith("Scene.")) return document.uuid;
  return document?.parent?.id && document.id ? `Scene.${document.parent.id}.Token.${document.id}` : null;
}

export function configuredEnabled(document) {
  return (document?.getFlag?.(MODULE_ID, "enabled") ?? document?.flags?.[MODULE_ID]?.enabled) === true;
}

/** Legacy explicitly enabled tokens retain all elements until the GM selects a subset. */
export function configuredElements(document) {
  const selection = document?.getFlag?.(MODULE_ID, "revealedElements") ?? document?.flags?.[MODULE_ID]?.revealedElements;
  return new Set(ELEMENTS.map(([key]) => key).filter(key => selection ? selection[key] === true : configuredEnabled(document)));
}

/** Read only the GM-published world setting, never player-editable token flags. */
export function publishedToken(document, game = globalThis.game) {
  const key = tokenKey(document);
  if (!key) return null;
  return game?.settings?.get(MODULE_ID, REVEALS_SETTING)?.[key] ?? null;
}

export function publishedEntries(document, game = globalThis.game) {
  const record = publishedToken(document, game);
  if (record?.enabled !== true || !Array.isArray(record.entries)) return [];
  const entries = new Map(record.entries.filter(entry => ELEMENT_KEYS.has(entry?.element) && CODES.has(entry?.code))
    .map(({ element, code }) => [element, { element, code }]));
  return ELEMENTS.map(([key]) => entries.get(key)).filter(Boolean);
}

export function revealRecord(document, requested = configuredEnabled(document), elements = [...configuredElements(document)]) {
  // Hidden tokens never publish their affinity values to player clients.
  const enabled = requested && configuredEnabled(document) && !document.hidden;
  return { enabled, entries: enabled ? affinityEntries(document.actor, { allowed: new Set(elements) }) : [], ...(enabled ? { elements } : {}) };
}

export function isPublisher(game = globalThis.game) {
  return !!game?.user?.isGM && (!game.users?.activeGM || game.users.activeGM.id === game.user.id);
}

/** Coalesce minimal public snapshots. Only a GM writes this world setting. */
export class GMRevealPublisher {
  #pending = new Map();
  #scheduled = false;
  #running = false;

  queue(document, { visibility = false, authority = document } = {}) {
    if (!isPublisher()) return;
    const key = tokenKey(document);
    if (!key) return;
    const prior = this.#pending.get(key);
    this.#pending.set(key, { document, authority: prior?.visibility ? prior.authority : authority, visibility: visibility || prior?.visibility === true });
    this.#schedule();
  }

  remove(document) {
    if (!isPublisher()) return;
    const key = tokenKey(document);
    if (!key) return;
    this.#pending.set(key, { document: null });
    this.#schedule();
  }

  queueScene(scene = globalThis.canvas?.scene) {
    if (!isPublisher() || !scene || scene.active === false) return;
    const records = game.settings.get(MODULE_ID, REVEALS_SETTING) ?? {};
    for (const document of scene.tokens?.contents ?? scene.tokens ?? []) {
      this.queue(document, { visibility: !Object.hasOwn(records, tokenKey(document)) });
    }
  }

  queueActor(actor) {
    if (!isPublisher()) return;
    for (const token of actor.getActiveTokens?.() ?? []) this.queue(token.document);
    // Also update already-published tokens if the GM is viewing another scene.
    const records = game.settings.get(MODULE_ID, REVEALS_SETTING) ?? {};
    for (const scene of game.scenes?.contents ?? game.scenes ?? []) {
      for (const document of scene.tokens?.contents ?? scene.tokens ?? []) {
        const matches = actor.isToken ? tokenKey(document) === tokenKey(actor.token)
          : document.actorId === actor.id || document.actor === actor;
        if (matches && (scene.active || Object.hasOwn(records, tokenKey(document)))) this.queue(document);
      }
    }
  }

  #schedule() {
    if (this.#scheduled || this.#running) return;
    this.#scheduled = true;
    const defer = globalThis.requestAnimationFrame ?? queueMicrotask;
    defer(() => {
      this.#scheduled = false;
      this.flush().catch(error => console.error(`${MODULE_ID} | Could not publish GM affinity reveals.`, error));
    });
  }

  async flush() {
    if (this.#running || !isPublisher()) return;
    this.#running = true;
    try {
      while (this.#pending.size && isPublisher()) {
        const pending = [...this.#pending]; this.#pending.clear();
        const current = game.settings.get(MODULE_ID, REVEALS_SETTING) ?? {};
        const next = { ...current };
        let changed = false;
        for (const [key, { document, visibility, authority }] of pending) {
          const record = document ? revealRecord(document, visibility ? configuredEnabled(authority) : current[key]?.enabled === true, visibility ? [...configuredElements(authority)] : current[key]?.elements ?? current[key]?.entries?.map(entry => entry.element) ?? []) : null;
          if (record === null) {
            if (Object.hasOwn(next, key)) { delete next[key]; changed = true; }
          } else if (JSON.stringify(current[key]) !== JSON.stringify(record)) {
            next[key] = record; changed = true;
          }
        }
        if (changed) await game.settings.set(MODULE_ID, REVEALS_SETTING, next);
      }
    } finally { this.#running = false; }
  }
}

function paths(changes, prefix = "", result = new Map()) {
  for (const [key, value] of Object.entries(changes ?? {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    result.set(path, value);
    if (value && typeof value === "object" && !Array.isArray(value)) paths(value, path, result);
  }
  return result;
}

/** Local pre-update guard, backed by the GM-only world reveal authority. */
export function guardRevealUpdate(document, changes, prototype = false) {
  if (game.user?.isGM) return;
  const root = prototype ? "prototypeToken." : "";
  const target = prototype ? document.prototypeToken : document;
  for (const [path, value] of paths(changes)) {
    if ([`${root}-=flags`, `${root}flags.-=${MODULE_ID}`, `${root}flags.${MODULE_ID}.-=enabled`].includes(path)) return false;
    if (path === `${root}flags.${MODULE_ID}.-=revealedElements` || path.startsWith(`${root}flags.${MODULE_ID}.revealedElements`)) return false;
    if (path === `${root}flags.${MODULE_ID}.enabled` && value !== configuredEnabled(target)) return false;
  }
}
