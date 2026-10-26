import { ELEMENTS, MODULE_ID } from "./constants.mjs";
import { configuredElements } from "./gm-reveals.mjs";

function flag(document, key) {
  return document?.getFlag?.(MODULE_ID, key) ?? document?.flags?.[MODULE_ID]?.[key];
}

/** An unset prototype opts in to the plate, while its element selection stays empty. */
export function prototypeEnabled(document) {
  return flag(document, "enabled") ?? true;
}

function selectionFlags(elements = new Set()) {
  return Object.fromEntries(ELEMENTS.map(([key]) => [key, elements.has(key)]));
}

/** Persist defaults on creation so future tokens inherit them without opening a sheet. */
export function initializePrototype(actor) {
  const prototype = actor.prototypeToken ?? actor._source?.prototypeToken;
  const changes = {};
  if (flag(prototype, "enabled") === undefined) changes[`prototypeToken.flags.${MODULE_ID}.enabled`] = true;
  if (flag(prototype, "revealedElements") === undefined) changes[`prototypeToken.flags.${MODULE_ID}.revealedElements`] = selectionFlags();
  if (Object.keys(changes).length) actor.updateSource(changes);
}

/** Older unconfigured prototypes use the same safe defaults when placed on a scene. */
export function initializeToken(document) {
  const prototype = document.actor?.prototypeToken;
  const changes = {};
  if (flag(document, "enabled") === undefined) changes[`flags.${MODULE_ID}.enabled`] = prototype ? prototypeEnabled(prototype) : false;
  if (flag(document, "revealedElements") === undefined) changes[`flags.${MODULE_ID}.revealedElements`] = selectionFlags(configuredElements(prototype));
  if (Object.keys(changes).length) document.updateSource(changes);
}
