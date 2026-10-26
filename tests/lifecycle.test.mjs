import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Container, Text, PIXI, fakeIconCache } from "./support/pixi-stub.mjs";
import { ELEMENTS, MODULE_ID } from "../scripts/constants.mjs";
import { OverlayManager } from "../scripts/overlay.mjs";
import { registerSettings, settingDefinitions } from "../scripts/settings.mjs";

let manager, frames, settings, registrations, tickerCallbacks;
function flushFrames() {
  const callbacks = [...frames.values()]; frames.clear();
  callbacks.forEach(callback => callback());
}
function actor(type = "npc", values = { fire: 1 }) {
  return { type, uuid: "Actor.enemy", documentName: "Actor", system: { affinities: Object.fromEntries(ELEMENTS.map(([key]) => [key, { current: values[key] ?? 0 }])) },
    tokens: [], calls: 0, getActiveTokens() { this.calls++; return this.tokens; }, testUserPermission: () => true };
}
function makeToken(a = actor(), id = "t") {
  const token = canvas.tokens.addChild(new Container());
  Object.assign(token, { actor: a, scene: canvas.scene, w: 100, h: 100, isVisible: true,
    document: { flags: { [MODULE_ID]: { enabled: true } }, parent: canvas.scene, actorId: "enemy", id } });
  token.nameplate = token.addChild(new Text("Enemy"));
  token.nameplate.anchor.set(0.5, 0); token.nameplate.position.set(50, 102);
  token.draw = () => assert.fail("Token draw must not be used for overlay updates");
  token.document.object = token;
  a.tokens.push(token); canvas.tokens.placeables.push(token);
  return token;
}
function overlay(token) { return token.children.find(child => child.name?.startsWith(`${MODULE_ID}.code.`) && !child.destroyed); }

beforeEach(() => {
  frames = new Map(); let frameId = 0;
  tickerCallbacks = new Set();
  globalThis.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  globalThis.PIXI = PIXI;
  registrations = new Map();
  settings = { fontSize: 16, fontFamily: "Signika", textColor: "#FFFFFF", spacing: 4, placement: "belowNameplates" };
  globalThis.game = {
    user: { isGM: true }, version: "13.mock", release: { generation: 13 }, system: { id: "projectfu", version: "4.16.3" }, actors: [],
    modules: new Map([[MODULE_ID, { version: "0.1.0" }], ["token-nameplates", { active: false }]]),
    settings: { get: (_id, key) => settings[key], register: (_id, key, value) => registrations.set(key, value) },
    i18n: { localize: key => key }
  };
  const stage = new Container(), tokens = stage.addChild(new Container()); tokens.placeables = [];
  globalThis.canvas = { scene: { id: "scene" }, stage, tokens,
    draw: () => assert.fail("Canvas draw must not be used for overlay updates"),
    app: { ticker: { add(callback) { tickerCallbacks.add(callback); }, remove(callback) { tickerCallbacks.delete(callback); } } }
  };
  manager = new OverlayManager({ icons: fakeIconCache() });
});
afterEach(() => {
  manager.tearDown();
  for (const key of ["game", "canvas", "PIXI", "requestAnimationFrame", "cancelAnimationFrame", "document"]) delete globalThis[key];
});

test("repeated draws attach exactly one direct child and reuse the text texture", () => {
  const token = makeToken(); manager.refreshToken(token); const text = overlay(token), writes = text.assignments;
  manager.refreshToken(token); flushFrames();
  assert.equal(token.children.filter(child => child.name?.startsWith(`${MODULE_ID}.code.`)).length, 1);
  assert.equal(text.parent, token); assert.equal(text.text, "RS"); assert.equal(text.assignments, writes);
  assert.equal(text.eventMode, "none"); assert.equal(text.visible, true);
});
test("actor updates use active tokens and update text immediately without drawing", () => {
  const a = actor(), t1 = makeToken(a), t2 = makeToken(a, "t2");
  manager.canvasReady(); a.system.affinities.fire.current = -1; manager.updateActor(a);
  assert.equal(a.calls, 1);
  assert.equal(overlay(t1).text, "VU"); assert.equal(overlay(t2).text, "VU");
  assert.equal(frames.size, 1); flushFrames();
});
test("linked base updates read each unlinked token's own prepared actor", () => {
  const base = actor(), override = actor("npc", { ice: 3 });
  const linked = makeToken(base), unlinked = makeToken(override);
  base.tokens.push(unlinked);
  manager.canvasReady(); base.system.affinities.fire.current = 2; manager.updateActor(base);
  assert.equal(overlay(linked).text, "IM"); assert.equal(overlay(unlinked).text, "AB");
});
test("a synthetic actor update leaves sibling instances unchanged", () => {
  const left = actor(), right = actor(); right.uuid = "Scene.scene.Token.other.Actor.enemy";
  const t1 = makeToken(left), t2 = makeToken(right);
  manager.canvasReady(); left.system.affinities.fire.current = 3; manager.updateActor(left);
  assert.equal(overlay(t1).text, "AB"); assert.equal(overlay(t2).text, "RS");
});
test("character updates also query active tokens and catch derived values", () => {
  const a = actor("character"), token = makeToken(a);
  manager.canvasReady(); a.system.affinities.fire.current = 2; manager.updateActor(a);
  assert.equal(a.calls, 1); assert.equal(overlay(token).text, "IM");
});
test("deferred pass reads changes prepared after the initial update hook", () => {
  const a = actor(), token = makeToken(a); manager.canvasReady(); manager.updateActor(a);
  a.system.affinities.fire.current = 3; flushFrames();
  assert.equal(overlay(token).text, "AB");
});
test("no neutral line remains visible after affinities are removed", () => {
  const a = actor(), token = makeToken(a); manager.refreshToken(token);
  a.system.affinities.fire.current = 0; manager.updateActor(a);
  assert.equal(overlay(token), undefined);
});
test("disclosure revocation clears an already visible label immediately", () => {
  const a = actor(), token = makeToken(a); manager.refreshToken(token);
  game.user = { isGM: false }; manager.refreshAllOverlays();
  assert.equal(overlay(token), undefined);
});
test("all shared GM styling settings update without a reload", () => {
  registerSettings(() => manager.refreshAllOverlays({ settingsChanged: true }));
  assert.equal([...registrations.values()].filter(value => value.config).length, Object.keys(settingDefinitions()).length);
  for (const key of Object.keys(settingDefinitions())) {
    const value = registrations.get(key);
    assert.equal(value.scope, "world"); assert.equal(value.config, true); assert.equal(value.requiresReload, false);
  }
  const token = makeToken(); manager.canvasReady();
  for (const [key, value] of Object.entries({ fontSize: 24, fontFamily: "Arial", textColor: "#FFCC00", spacing: 10, placement: "aboveNameplates" })) {
    settings[key] = value; registrations.get(key).onChange(value);
  }
  assert.equal(overlay(token).style.fontSize, 24); assert.equal(overlay(token).style.fontFamily, "Arial");
  assert.equal(overlay(token).style.fill, "#FFCC00"); assert.ok(overlay(token).y < token.nameplate.y);
});
test("affinity visibility is independent of core-nameplate display settings", () => {
  const token = makeToken(); token.nameplate.visible = false; manager.refreshToken(token);
  assert.equal(overlay(token).visible, true);
  settings.placement = "belowToken"; manager.refreshAllOverlays({ settingsChanged: true });
  assert.equal(overlay(token).visible, true);
  token.document.hidden = true; game.user.isGM = false; manager.refreshAllOverlays();
  assert.equal(overlay(token), undefined);
});
test("watcher follows direct Token Nameplates changes and does no idle bounds measurement", () => {
  game.modules.get("token-nameplates").active = true;
  const token = makeToken(); token.nameplate.renderable = false;
  const external = canvas.tokens.addChild(new Container());
  const plate = external.addChild(new Text("Custom")); plate.position.set(50, 120); plate.nameplatePosition = "bottom";
  token.nameplates = [plate]; manager.canvasReady(); flushFrames();
  const text = overlay(token), initialY = text.y, calls = plate.measurements;
  for (let i = 0; i < 100; i++) tickerCallbacks.forEach(callback => callback());
  assert.equal(plate.measurements, calls);
  plate.y += 70; tickerCallbacks.forEach(callback => callback());
  assert.ok(text.y > initialY + 69);
  external.visible = false; tickerCallbacks.forEach(callback => callback()); assert.equal(text.visible, true);
  assert.ok(text.y < initialY, "Empty bottom stack should fall back to the bottom token edge");
});
test("destroyed text is recreated on redraw and own resources are removed on teardown", () => {
  const token = makeToken(); manager.refreshToken(token);
  const old = overlay(token), oldIcon = token.children.find(child => child.name?.startsWith(`${MODULE_ID}.icon.`));
  token.removeChild(old); old.destroy(); manager.refreshToken(token);
  const replacement = overlay(token); assert.notEqual(old, replacement);
  assert.equal(oldIcon.destroyed, true); assert.equal(oldIcon.texture.destroyed, true);
  assert.equal(token.children.filter(child => child.name?.startsWith(`${MODULE_ID}.icon.`)).length, 1);
  manager.tearDown();
  assert.equal(replacement.destroyed, true); assert.equal(token.nameplate.destroyed, false);
  assert.equal(frames.size, 0); assert.equal(tickerCallbacks.size, 0);
});
test("old-scene queued work is discarded and a new scene accepts labels", () => {
  const token = makeToken(); manager.refreshToken(token); const old = overlay(token);
  canvas.scene = { id: "other" }; flushFrames(); assert.equal(old.destroyed, true);
  manager.tearDown(); manager.beginScene();
  const newToken = makeToken(); manager.refreshToken(newToken); assert.equal(overlay(newToken).visible, true);
});
test("destroying a token before the deferred pass does not recreate its text", () => {
  const token = makeToken(); manager.refreshToken(token); manager.destroyOverlay(token); flushFrames();
  assert.equal(overlay(token), undefined);
});
test("asynchronous font loading invalidates text metrics and queues a fresh layout", async () => {
  let finish;
  globalThis.document = { fonts: { load: () => new Promise(resolve => { finish = resolve; }) } };
  const token = makeToken(); manager.refreshToken(token); flushFrames();
  await Promise.resolve(); finish([]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(overlay(token).dirty, true); assert.equal(frames.size, 1);
  flushFrames(); assert.equal(overlay(token).visible, true);
});
test("inactive canvas settings are harmless", () => {
  canvas.scene = null; manager.refreshAllOverlays({ settingsChanged: true });
  assert.equal(frames.size, 0);
});
test("affinities can render even if another module removes the core nameplate object", () => {
  const token = makeToken(); token.removeChild(token.nameplate); token.nameplate = null;
  manager.refreshToken(token); assert.equal(overlay(token).visible, true);
});

test("per-token flags hide only the selected token and can be re-enabled", () => {
  const a = actor(), first = makeToken(a), second = makeToken(a, "second");
  manager.canvasReady();
  first.document.flags = { [MODULE_ID]: { enabled: false } }; manager.refreshToken(first);
  assert.equal(overlay(first), undefined); assert.equal(overlay(second).visible, true);
  first.document.flags[MODULE_ID].enabled = true; manager.refreshToken(first);
  assert.equal(overlay(first).text, "RS"); assert.equal(overlay(first).visible, true);
});
test("players render GM-published affinities without access to the underlying actor", () => {
  const token = makeToken(); token.actor = undefined;
  settings.gmReveals = { "Scene.scene.Token.t": { enabled: true, entries: [{ element: "fire", code: "AB" }] } };
  game.user = { isGM: false }; manager.refreshToken(token);
  assert.equal(overlay(token).text, "AB"); assert.equal(overlay(token).visible, true);
  settings.gmReveals["Scene.scene.Token.t"] = { enabled: false, entries: [] }; manager.refreshAllOverlays();
  assert.equal(overlay(token), undefined);
});
test("font color, independent effect alpha, and overall opacity are applied", () => {
  const token = makeToken(); token.getDispositionColor = () => 0xFF6600;
  Object.assign(settings, { textOpacity: 45, outlineUseDisposition: true, outlineTransparency: 25,
    outlineThickness: 6, shadowEnabled: true, shadowColor: "#123456", shadowTransparency: 60, shadowAngle: 90, shadowDistance: 9, shadowBlur: 7 });
  manager.refreshToken(token);
  const text = overlay(token), icon = token.children.find(child => child.name?.startsWith(`${MODULE_ID}.icon.`));
  assert.equal(text.alpha, 0.45); assert.equal(icon.alpha, 0.45);
  assert.equal(text.style.stroke, "rgba(255, 102, 0, 0.75)"); assert.equal(text.style.strokeThickness, 6);
  assert.equal(text.style.dropShadow, true); assert.equal(text.style.dropShadowColor, "#123456");
  assert.equal(text.style.dropShadowAlpha, 0.4); assert.equal(text.style.dropShadowAngle, Math.PI / 2); assert.equal(text.style.dropShadowDistance, 9);
  assert.equal(text.style.dropShadowBlur, 7);
  settings.outlineEnabled = false; settings.shadowEnabled = false; manager.refreshAllOverlays({ settingsChanged: true });
  assert.equal(overlay(token).style.strokeThickness, 0); assert.equal(overlay(token).style.dropShadow, false);
});
test("disposition changes refresh the outline without a content change", () => {
  const token = makeToken(); let color = 0xFF0000;
  token.getDispositionColor = () => color; settings.outlineUseDisposition = true;
  manager.refreshToken(token); assert.equal(overlay(token).style.stroke, "rgba(255, 0, 0, 1)");
  color = 0x00FF00; token.document.disposition = 1; manager.refreshToken(token);
  assert.equal(overlay(token).style.stroke, "rgba(0, 255, 0, 1)");
});
test("Bar Brawl alone starts geometry watching and handles asynchronous bar changes", () => {
  game.modules.set("barbrawl", { active: true, version: "1.9.0" });
  const token = makeToken(); token.nameplate.visible = false; token.bars = token.addChild(new Container());
  token.document.flags = { [MODULE_ID]: { enabled: true }, barbrawl: { resourceBars: { hp: { position: "bottom-outer" } } } };
  manager.canvasReady(); flushFrames(); assert.equal(tickerCallbacks.size, 1);
  const baseline = overlay(token).y;
  const bar = token.bars.addChild(new Text("HP")); bar.name = "hp"; bar.position.set(0, 155);
  tickerCallbacks.forEach(callback => callback()); assert.ok(overlay(token).y > baseline + 40);
  bar.visible = false; tickerCallbacks.forEach(callback => callback()); assert.equal(overlay(token).y, baseline);
  manager.tearDown(); assert.equal(tickerCallbacks.size, 0);
});
test("icons replace element text while codes remain exact and all objects are direct children", () => {
  const token = makeToken(actor("npc", { physical: -1, fire: 3, ice: 2, poison: 1 }));
  manager.refreshToken(token);
  const labels = token.children.filter(child => child.name?.startsWith(`${MODULE_ID}.code.`));
  const icons = token.children.filter(child => child.name?.startsWith(`${MODULE_ID}.icon.`));
  assert.deepEqual(labels.map(label => label.text), ["VU", "AB", "IM", "RS"]);
  assert.deepEqual(icons.map(icon => icon.affinityElement), ["physical", "fire", "ice", "poison"]);
  assert.ok([...labels, ...icons].every(object => object.parent === token));
});
