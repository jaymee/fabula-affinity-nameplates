import test from "node:test";
import assert from "node:assert/strict";
import { IconCache, iconURL } from "../scripts/icons.mjs";
import { normalizeSettings } from "../scripts/settings.mjs";
import { Texture } from "./support/pixi-stub.mjs";
import { tokenEnabled } from "../scripts/token-config.mjs";

test("icon URLs resolve relative to the module, independent of Foundry route prefixes", () => {
  assert.ok(iconURL("physical").endsWith("/systems/projectfu/styles/static/affinities/icons/physical.png"));
});
test("source images and matching styled textures are shared; only final release destroys them", async () => {
  let loads = 0, renders = 0;
  const source = new Texture();
  const cache = new IconCache({ load: async () => { loads++; return source; }, render: () => {
    renders++; return { texture: new Texture(), width: 24, height: 24 };
  } });
  const settings = normalizeSettings({});
  const first = cache.acquire("fire", settings, "#000000"), second = cache.acquire("fire", settings, "#000000");
  const [a, b] = await Promise.all([first.promise, second.promise]);
  assert.equal(loads, 1); assert.equal(renders, 1); assert.equal(a.texture, b.texture);
  first.release(); assert.equal(a.texture.destroyed, false);
  second.release(); assert.equal(a.texture.destroyed, true); assert.equal(source.destroyed, false);
  second.release();
});
test("changing outline settings recomposes icons without loading the PNG again", async () => {
  let loads = 0;
  const cache = new IconCache({ load: async () => { loads++; return {}; }, render: () => ({ texture: new Texture(), width: 24, height: 24 }) });
  const first = cache.acquire("ice", normalizeSettings({}), "#000000"); await first.promise;
  const second = cache.acquire("ice", normalizeSettings({ outlineThickness: 9 }), "#000000"); await second.promise;
  assert.equal(loads, 1);
  first.release(); second.release();
});
test("deletion before icon loading finishes releases the late texture", async () => {
  let finish;
  const cache = new IconCache({ load: () => new Promise(resolve => { finish = resolve; }), render: () => ({ texture: new Texture(), width: 24, height: 24 }) });
  const lease = cache.acquire("bolt", normalizeSettings({}), "#000000"); lease.release();
  await Promise.resolve(); finish({});
  const result = await lease.promise; assert.equal(result.texture.destroyed, true);
});
test("a failed source load can be retried without a permanent broken cache", async () => {
  let loads = 0;
  const cache = new IconCache({ load: async () => { if (++loads === 1) throw new Error("missing"); return {}; }, render: () => ({ texture: new Texture(), width: 24, height: 24 }) });
  const first = cache.acquire("dark", normalizeSettings({}), "#000000");
  await assert.rejects(first.promise, /dark icon/); first.release();
  const second = cache.acquire("dark", normalizeSettings({}), "#000000"); await second.promise;
  assert.equal(loads, 2); second.release();
});
test("token flags default to hidden and honor explicit persisted false values", () => {
  globalThis.game = { user: { isGM: true } };
  assert.equal(tokenEnabled({}), false);
  assert.equal(tokenEnabled({ getFlag: () => false }), false);
  assert.equal(tokenEnabled({ flags: { "fabula-affinity-nameplates": { enabled: false } } }), false);
  assert.equal(tokenEnabled({ flags: { "fabula-affinity-nameplates": { enabled: true } } }), true);
  delete globalThis.game;
});
test("changing shadow blur generates a new texture while reusing the source PNG", async () => {
  let loads = 0, renders = 0;
  const cache = new IconCache({ load: async () => { loads++; return {}; }, render: () => { renders++; return { texture: new Texture(), width: 24, height: 24 }; } });
  const first = cache.acquire("fire", normalizeSettings({ shadowEnabled: true, shadowBlur: 0 }), "#000000");
  const second = cache.acquire("fire", normalizeSettings({ shadowEnabled: true, shadowBlur: 8 }), "#000000");
  const [a, b] = await Promise.all([first.promise, second.promise]);
  assert.equal(loads, 1); assert.equal(renders, 2); assert.notEqual(a.texture, b.texture);
  first.release(); second.release();
});
