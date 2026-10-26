import { MODULE_ID, ELEMENTS, localize } from "./constants.mjs";
import { configuredEnabled, configuredElements, publishedToken } from "./gm-reveals.mjs";

export function tokenEnabled(document) {
  return globalThis.game?.user?.isGM ? configuredEnabled(document) : publishedToken(document)?.enabled === true;
}

/** Named form inputs are saved by Foundry with normal TokenConfig submission. */
export function renderTokenConfig(application, element) {
  if (!game.user?.isGM) {
    element?.querySelector?.(`[data-${MODULE_ID}]`)?.remove();
    return;
  }
  const document = application.token ?? application.document;
  if (!document || !element?.querySelector || element.querySelector(`[data-${MODULE_ID}]`)) return;
  const form = element.matches?.("form") ? element : element.querySelector("form");
  const target = element.querySelector('.tab[data-tab="identity"]') ?? form;
  if (!target) return;
  const fieldset = element.ownerDocument.createElement("fieldset");
  fieldset.setAttribute(`data-${MODULE_ID}`, "");
  const legend = fieldset.appendChild(element.ownerDocument.createElement("legend"));
  legend.textContent = localize("token.legend", "Affinity Nameplate");
  const group = fieldset.appendChild(element.ownerDocument.createElement("div"));
  group.className = "form-group";
  const label = group.appendChild(element.ownerDocument.createElement("label"));
  label.textContent = localize("token.enabled", "Show Affinities");
  const fields = group.appendChild(element.ownerDocument.createElement("div"));
  fields.className = "form-fields";
  const input = fields.appendChild(element.ownerDocument.createElement("input"));
  input.type = "checkbox";
  input.name = `flags.${MODULE_ID}.enabled`;
  input.id = `${application.id ?? MODULE_ID}-affinities-enabled`;
  input.checked = tokenEnabled(document);
  const permissionDocument = application.isPrototype ? application.actor ?? document.parent : document;
  input.disabled = !(permissionDocument?.canUserModify?.(game.user, "update") ?? permissionDocument?.testUserPermission?.(game.user, "OWNER"));
  label.htmlFor = input.id;
  const hint = group.appendChild(element.ownerDocument.createElement("p"));
  hint.className = "hint";
  hint.textContent = localize("token.hint", "GM only. Reveal this token’s affinities to players who can see it. Save to apply. Prototype Token sets the default for future tokens.");
  const selected = configuredElements(document);
  const instructions = fieldset.appendChild(element.ownerDocument.createElement("p"));
  instructions.className = "hint";
  instructions.textContent = "Select the elements to reveal, then save. Unselected elements stay hidden. New tokens are disabled until explicitly enabled.";
  const choices = fieldset.appendChild(element.ownerDocument.createElement("div"));
  choices.style.cssText = "display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px";
  for (const [key, fallback] of ELEMENTS) {
    const choice = choices.appendChild(element.ownerDocument.createElement("label"));
    const checkbox = choice.appendChild(element.ownerDocument.createElement("input"));
    checkbox.type = "checkbox";
    checkbox.name = `flags.${MODULE_ID}.revealedElements.${key}`;
    checkbox.checked = selected.has(key);
    checkbox.disabled = input.disabled;
    choice.appendChild(element.ownerDocument.createTextNode(" " + localize(`elements.${key}`, fallback)));
  }
  for (const [text, checked] of [["Select All", true], ["Clear All", false]]) {
    const button = fieldset.appendChild(element.ownerDocument.createElement("button"));
    button.type = "button"; button.textContent = text; button.disabled = input.disabled;
    button.addEventListener("click", () => choices.querySelectorAll("input").forEach(checkbox => { checkbox.checked = checked; }));
  }
  const footer = target.querySelector(":scope > footer");
  target.insertBefore(fieldset, footer);
}
