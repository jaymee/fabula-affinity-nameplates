import test from "node:test";
import assert from "node:assert/strict";
import { ELEMENTS } from "../scripts/constants.mjs";
import { formatAffinities, affectsAffinities } from "../scripts/affinities.mjs";
import { normalizeSettings, settingDefinitions } from "../scripts/settings.mjs";
import { SETTINGS_GROUPS } from "../scripts/settings-ui.mjs";

const actor = values => ({ type: "character", system: { affinities: Object.fromEntries(
  ELEMENTS.map(([key]) => [key, { base: 0, current: values[key] ?? 0 }])
) } });

test("formats all nine types in a stable order with the effective affinity", () => {
  assert.equal(formatAffinities(actor({ physical: -1, air: 1, bolt: 2, dark: 3, earth: -1, fire: 1, ice: 2, light: 3, poison: -1 })),
    "PHY:VU | AIR:RS | BLT:IM | DRK:AB | EAR:VU | FIR:RS | ICE:IM | LGT:AB | PSN:VU");
});
test("padding is a numeric field with signed fractional values and no slider limits", () => {
  const definitions = settingDefinitions();
  assert.equal(definitions.paddingX.type, Number); assert.equal(definitions.paddingY.type, Number);
  assert.equal(definitions.paddingX.range, undefined); assert.equal(definitions.paddingY.range, undefined);
  const settings = normalizeSettings({ paddingX: -450.75, paddingY: 1250.5 });
  assert.equal(settings.paddingX, -450.75); assert.equal(settings.paddingY, 1250.5);
});
test("every setting is assigned to exactly one of the four requested groups", () => {
  const keys = Object.values(SETTINGS_GROUPS).flat();
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual([...keys].sort(), Object.keys(settingDefinitions()).sort());
  assert.deepEqual(Object.keys(SETTINGS_GROUPS), ["font", "shadow", "outline", "positioning"]);
});
test("uses getters and never treats method names or base values as live affinities", () => {
  const value = actor({});
  value.system.affinities.fire = { base: -1, resistant() {}, get current() { return 1; } };
  assert.equal(formatAffinities(value), "FIR:RS");
});
test("neutral and unsupported actors produce no label", () => {
  assert.equal(formatAffinities(actor({})), "");
  assert.equal(formatAffinities({ ...actor({ fire: -1 }), type: "party" }), "");
  assert.equal(formatAffinities(null), "");
});
test("malformed values do not invent an affinity or coerce strings", () => {
  const value = actor({ fire: 1 });
  value.system.affinities.ice = { base: 3 };
  value.system.affinities.air = { current: "1" };
  value.system.affinities.dark = { current: 0.5 };
  value.system.affinities.physical = { current: 4 };
  const invalid = [];
  assert.equal(formatAffinities(value, { onInvalid: key => invalid.push(key) }), "FIR:RS");
  assert.deepEqual(invalid, ["physical", "air", "dark", "ice"]);
});
test("disclosure filtering and localization occur before building the string", () => {
  const value = actor({ physical: -1, fire: 1, ice: 3 });
  assert.equal(formatAffinities(value, { allowed: new Set(["fire"]), translate: (key, fallback) => key === "elements.fire" ? "FOC" : fallback }), "FOC:RS");
  assert.equal(formatAffinities(value, { allowed: new Set() }), "");
});
for (const [name, changes] of Object.entries({
  nested: { system: { affinities: { fire: { base: 1 } } } },
  dotted: { "system.affinities.fire.base": 1 },
  replacement: { "system.affinities": {} },
  deletion: { "system.-=affinities": null },
  parentDeletion: { "-=system": null },
  parentReplacement: { system: {} }
})) test(`detects ${name} affinity updates`, () => assert.equal(affectsAffinities(changes), true));
test("unrelated actor updates do not look like literal affinity edits", () => {
  assert.equal(affectsAffinities({ name: "New", system: { resources: { hp: { value: 5 } } } }), false);
});
test("invalid settings have bounded predictable fallbacks", () => {
  const value = normalizeSettings({ fontSize: 1000, fontFamily: "", textColor: "red", spacing: -3, placement: "other" });
  assert.equal(value.fontSize, 48); assert.equal(value.fontFamily, "Signika");
  assert.equal(value.textColor, "#FFFFFF"); assert.equal(value.spacing, 0); assert.equal(value.placement, "belowNameplates");
});
