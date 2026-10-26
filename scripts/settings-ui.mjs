import { MODULE_ID, localize } from "./constants.mjs";

export const SETTINGS_GROUPS = Object.freeze({
  font: ["fontFamily", "fontSize", "textColor", "textOpacity", "elementSpacing", "wrapElements"],
  shadow: ["shadowEnabled", "shadowColor", "shadowDistance", "shadowBlur", "shadowAngle", "shadowTransparency"],
  outline: ["outlineEnabled", "outlineColor", "outlineUseDisposition", "outlineThickness", "outlineTransparency"],
  positioning: ["placement", "spacing", "paddingX", "paddingY"]
});

const sessions = new WeakMap();

/** Move existing form rows intact so names, handlers, values and save behavior survive. */
export function groupSettings(element) {
  if (!element?.querySelector) return;
  if (!game.user?.isGM) {
    for (const input of element.querySelectorAll(`[name^="${MODULE_ID}."]`)) input.closest(".form-group")?.remove();
    element.querySelector(`[data-affinity-settings="${MODULE_ID}"]`)?.remove();
    return;
  }
  const rows = new Map();
  for (const keys of Object.values(SETTINGS_GROUPS)) {
    for (const key of keys) {
      const input = element.querySelector(`[name="${MODULE_ID}.${key}"]`);
      const row = input?.closest(".form-group");
      if (row) rows.set(key, row);
      if (input && ["paddingX", "paddingY"].includes(key)) input.setAttribute("step", "any");
    }
  }
  if (!rows.size) return;
  let wrapper = element.querySelector(`[data-affinity-settings="${MODULE_ID}"]`);
  if (!wrapper) {
    const first = rows.values().next().value;
    wrapper = element.ownerDocument.createElement("div");
    wrapper.dataset.affinitySettings = MODULE_ID;
    wrapper.style.display = "grid";
    wrapper.style.gap = "0.75rem";
    first.before(wrapper);
  }
  for (const [group, keys] of Object.entries(SETTINGS_GROUPS)) {
    const entries = keys.map(key => rows.get(key)).filter(Boolean);
    if (!entries.length) continue;
    let fieldset = wrapper.querySelector(`[data-affinity-settings-group="${group}"]`);
    if (!fieldset) {
      fieldset = element.ownerDocument.createElement("fieldset");
      fieldset.dataset.affinitySettingsGroup = group;
      fieldset.style.padding = "0.75rem";
      fieldset.style.border = "1px solid var(--color-border-light-primary, #777)";
      const legend = fieldset.appendChild(element.ownerDocument.createElement("legend"));
      legend.textContent = localize(`groups.${group}`, { font: "Font", shadow: "Drop Shadow", outline: "Outline", positioning: "Positioning" }[group]);
      legend.style.fontWeight = "600";
      wrapper.appendChild(fieldset);
    }
    for (const row of entries) if (row.parentElement !== fieldset) fieldset.appendChild(row);
  }
}

export function closeSettingsConfig(application) {
  sessions.get(application)?.disconnect();
  sessions.delete(application);
}

export function renderSettingsConfig(application, element) {
  closeSettingsConfig(application);
  groupSettings(element);
  // V13 loads settings categories lazily. Group the module category when it is
  // inserted, as well as on the initial application render.
  const observer = new MutationObserver(() => groupSettings(element));
  observer.observe(element, { childList: true, subtree: true });
  sessions.set(application, observer);
}
