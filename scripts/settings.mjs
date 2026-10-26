import { MODULE_ID, PREFIX } from "./constants.mjs";
import { REVEALS_SETTING } from "./gm-reveals.mjs";

export function defaultFont() {
  const font = globalThis.CONFIG?.canvasTextStyle?.fontFamily ?? globalThis.CONFIG?.defaultFontFamily ?? "Signika";
  return Array.isArray(font) ? font.join(", ") : String(font);
}

export const PLACEMENTS = Object.freeze([
  "belowNameplates", "aboveNameplates", "leftNameplates", "rightNameplates",
  "belowToken", "aboveToken", "leftToken", "rightToken"
]);

export function settingDefinitions() {
  const number = (value, min, max, step = 1) => ({ type: Number, default: value, range: { min, max, step } });
  return {
    fontFamily: { type: String, default: defaultFont() },
    fontSize: number(16, 8, 48),
    textColor: { type: String, default: "#FFFFFF" },
    textOpacity: number(100, 0, 100),
    elementSpacing: { type: Number, default: 3 },
    wrapElements: { type: Boolean, default: false },
    placement: { type: String, default: "belowNameplates", choices: Object.fromEntries(PLACEMENTS.map(key => [key, `${PREFIX}.placements.${key}`])) },
    spacing: number(2, 0, 80),
    paddingX: { type: Number, default: 0 },
    paddingY: { type: Number, default: 0 },
    shadowEnabled: { type: Boolean, default: false },
    shadowColor: { type: String, default: "#000000" },
    shadowDistance: number(3, 0, 40),
    shadowBlur: number(0, 0, 40),
    shadowAngle: number(45, 0, 360),
    shadowTransparency: number(40, 0, 100),
    outlineEnabled: { type: Boolean, default: true },
    outlineColor: { type: String, default: "#000000" },
    outlineUseDisposition: { type: Boolean, default: false },
    outlineThickness: number(3, 0, 12),
    outlineTransparency: number(0, 0, 100)
  };
}

export function normalizeSettings(raw) {
  const settings = {};
  for (const [key, definition] of Object.entries(settingDefinitions())) {
    const value = raw[key];
    if (definition.type === Number) settings[key] = Number.isFinite(value)
      ? definition.range ? Math.min(definition.range.max, Math.max(definition.range.min, value)) : value
      : definition.default;
    else if (definition.type === Boolean) settings[key] = typeof value === "boolean" ? value : definition.default;
    else if (key.endsWith("Color")) settings[key] = typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : definition.default;
    else settings[key] = value ?? definition.default;
  }
  const font = typeof raw.fontFamily === "string" ? raw.fontFamily.trim().slice(0, 200) : "";
  settings.fontFamily = font && !/[\r\n<>]/.test(font) ? font : defaultFont();
  if (!PLACEMENTS.includes(settings.placement)) settings.placement = "belowNameplates";
  settings.elementSpacing = Math.max(0, settings.elementSpacing);
  return settings;
}

export function readSettings() {
  return normalizeSettings(Object.fromEntries(Object.keys(settingDefinitions()).map(key => [key, game.settings.get(MODULE_ID, key)])));
}

export function registerSettings(onChange) {
  for (const [key, definition] of Object.entries(settingDefinitions())) {
    game.settings.register(MODULE_ID, key, {
      name: `${PREFIX}.settings.${key}.name`, hint: `${PREFIX}.settings.${key}.hint`,
      scope: "world", config: !!game.user?.isGM, requiresReload: false, ...definition, onChange
    });
  }
  game.settings.register(MODULE_ID, REVEALS_SETTING, { scope: "world", config: false, type: Object, default: {}, onChange });
  game.settings.register(MODULE_ID, "worldStyleVersion", { scope: "world", config: false, type: Number, default: 0 });
}

export function syncSettingsVisibility() {
  for (const key of Object.keys(settingDefinitions())) {
    const definition = game.settings.settings?.get(`${MODULE_ID}.${key}`);
    if (definition) definition.config = !!game.user?.isGM;
  }
}

/** First active GM carries their old local preferences into shared settings. */
export async function migrateWorldStyles() {
  if (!game.user?.isGM || game.settings.get(MODULE_ID, "worldStyleVersion") >= 1) return;
  const client = game.settings.storage?.get("client"), world = game.settings.storage?.get("world");
  const raw = {};
  for (const key of Object.keys(settingDefinitions())) {
    const stored = client?.getItem?.(`${MODULE_ID}.${key}`);
    if (stored != null) {
      try { raw[key] = JSON.parse(stored); } catch { raw[key] = stored; }
    }
  }
  const migrated = normalizeSettings(raw);
  for (const key of Object.keys(settingDefinitions())) {
    const fullKey = `${MODULE_ID}.${key}`;
    const exists = world?.has?.(fullKey) ?? (world?.getItem?.(fullKey) != null);
    if (!exists) await game.settings.set(MODULE_ID, key, migrated[key]);
  }
  await game.settings.set(MODULE_ID, "worldStyleVersion", 1);
}

export function outlineColor(token, settings) {
  const disposition = settings.outlineUseDisposition ? token.getDispositionColor?.() : null;
  return Number.isFinite(disposition) ? `#${disposition.toString(16).padStart(6, "0")}` : settings.outlineColor;
}

export function colorWithAlpha(color, alpha) {
  const value = parseInt(color.slice(1), 16);
  return `rgba(${value >> 16 & 255}, ${value >> 8 & 255}, ${value & 255}, ${alpha})`;
}

export function textStyle(settings, color) {
  return {
    fontSize: settings.fontSize, fontFamily: settings.fontFamily, fill: settings.textColor,
    align: "center", lineJoin: "round", padding: 4,
    stroke: colorWithAlpha(color, 1 - settings.outlineTransparency / 100),
    strokeThickness: settings.outlineEnabled ? settings.outlineThickness : 0,
    dropShadow: settings.shadowEnabled, dropShadowColor: settings.shadowColor,
    dropShadowDistance: settings.shadowDistance, dropShadowAngle: settings.shadowAngle * Math.PI / 180,
    dropShadowAlpha: 1 - settings.shadowTransparency / 100, dropShadowBlur: settings.shadowBlur
  };
}
