import test from "node:test";
import assert from "node:assert/strict";
import { Container, Text, TextStyle, Sprite, Texture } from "./support/pixi-stub.mjs";
import { boundsInToken, measureNameplates, nameplateSignature, placeOverlay, signaturesEqual } from "../scripts/nameplate-adapter.mjs";

function scene() {
  const stage = new Container(), layer = stage.addChild(new Container()), token = layer.addChild(new Container());
  token.position.set(300, 200); token.w = token.h = 100;
  token.nameplate = token.addChild(new Text("Hero", new TextStyle({ fontSize: 20 })));
  token.nameplate.anchor.set(0.5, 0); token.nameplate.position.set(50, 102);
  return { stage, layer, token };
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

test("nameplate bounds honor anchors and are invariant under canvas zoom", () => {
  const { stage, token } = scene();
  const before = boundsInToken(token.nameplate, token);
  stage.scale.set(0.37); stage.position.set(91, -32);
  const after = boundsInToken(token.nameplate, token);
  for (const key of ["x", "y", "width", "height"]) near(before[key], after[key]);
  near(before.y, 102);
  near(before.x + before.width / 2, 50);
});
test("Bar Brawl bars reserve their rendered outer extent even beyond the initial plate", () => {
  globalThis.game = { modules: new Map([["barbrawl", { active: true }]]) };
  const { token } = scene(); token.nameplate.visible = false;
  token.document = { flags: { barbrawl: { resourceBars: { hp: { position: "bottom-outer" } } } } };
  token.bars = token.addChild(new Container());
  const bar = token.bars.addChild(new Sprite(new Texture(100, 18))); bar.name = "hp"; bar.position.set(0, 145);
  const measured = measureNameplates(token);
  assert.equal(measured.bars.length, 1);
  assert.deepEqual(placeOverlay(measured, { width: 80, height: 20 }, token, { placement: "belowToken", spacing: 4 }), { x: 50, y: 167 });
  bar.visible = false;
  assert.equal(measureNameplates(token).bars.length, 0);
  delete globalThis.game;
});
test("rotated side bars use transformed geometry and do not change the chosen side", () => {
  globalThis.game = { modules: new Map([["barbrawl", { active: true }]]) };
  const { token } = scene(); token.nameplate.visible = false;
  token.document = { flags: { barbrawl: { resourceBars: { hp: { position: "left-outer" } } } } };
  token.bars = token.addChild(new Container());
  const bar = token.bars.addChild(new Sprite(new Texture(100, 12))); bar.name = "hp"; bar.rotation = -Math.PI / 2; bar.position.set(-30, 100);
  const measured = measureNameplates(token);
  const left = placeOverlay(measured, { width: 80, height: 20 }, token, { placement: "leftToken", spacing: 4 });
  assert.ok(left.x + 40 <= -34);
  assert.equal(placeOverlay(measured, { width: 80, height: 20 }, token, { placement: "belowToken", spacing: 4 }).y, 104);
  delete globalThis.game;
});
test("bar signature changes on visibility, redraw, and geometry without measuring idle bars", () => {
  globalThis.game = { modules: new Map([["barbrawl", { active: true }]]) };
  const { token } = scene(); token.bars = token.addChild(new Container());
  const bar = token.bars.addChild(new Text("HP"));
  const before = nameplateSignature(token), calls = bar.measurements;
  assert.equal(signaturesEqual(before, nameplateSignature(token)), true); assert.equal(bar.measurements, calls);
  bar.y = 140; assert.equal(signaturesEqual(before, nameplateSignature(token)), false);
  const moved = nameplateSignature(token); bar.visible = false; assert.equal(signaturesEqual(moved, nameplateSignature(token)), false);
  delete globalThis.game;
});
test("externally parented and rotated plates are converted into token coordinates", () => {
  const { layer, token } = scene();
  const outside = layer.addChild(new Container());
  outside.position.set(token.x, token.y); outside.rotation = Math.PI / 2;
  const plate = outside.addChild(new Text("A", new TextStyle({ fontSize: 20 })));
  plate.position.set(40, 20);
  const bounds = boundsInToken(plate, token);
  near(bounds.width, 24); near(bounds.height, 11); near(bounds.x, -44); near(bounds.y, 40);
});
test("Token Nameplates replaces hidden core geometry and selects the bottom stack", () => {
  globalThis.game = { modules: new Map([["token-nameplates", { active: true }]]) };
  const { token } = scene(); token.nameplate.renderable = false;
  const first = token.addChild(new Text("First")), second = token.addChild(new Text("Second"));
  first.nameplatePosition = second.nameplatePosition = "bottom";
  first.position.set(50, 110); second.position.set(50, 145);
  token.nameplates = [first, second];
  const { anchor, all } = measureNameplates(token);
  near(anchor.y, 110); near(anchor.y + anchor.height, 164.2); assert.equal(all.length, 2);
  first.parent.visible = false;
  assert.equal(measureNameplates(token).anchor, null);
  delete globalThis.game;
});
test("below/above placement clears multiline bounds by configured spacing", () => {
  const stack = { x: 10, y: 100, width: 80, height: 60 };
  const plates = { sections: { bottom: stack, top: stack }, all: [] };
  assert.deepEqual(placeOverlay(plates, { width: 100, height: 40 }, { w: 100, h: 100 }, { spacing: 6, placement: "belowNameplates" }), { x: 50, y: 166 });
  assert.deepEqual(placeOverlay(plates, { width: 100, height: 40 }, { w: 100, h: 100 }, { spacing: 6, placement: "aboveNameplates" }), { x: 50, y: 54 });
});
test("below-token mode avoids intersecting existing labels without requiring a nameplate", () => {
  const other = { x: 0, y: 110, width: 100, height: 30 };
  assert.deepEqual(placeOverlay({ anchor: null, all: [other] }, { width: 100, height: 20 }, { w: 100, h: 100 }, { spacing: 4, placement: "belowToken" }), { x: 50, y: 144 });
  assert.deepEqual(placeOverlay({ anchor: null, all: [] }, { width: 20, height: 20 }, { w: 100, h: 100 }, { spacing: 4, placement: "belowNameplates" }), { x: 50, y: 104 });
});
test("a top-only label stack cannot redirect bottom placement to the top", () => {
  const top = { x: 20, y: -60, width: 60, height: 40 };
  const plates = { anchor: top, sections: { top }, all: [top] };
  assert.deepEqual(placeOverlay(plates, { width: 80, height: 20 }, { w: 100, h: 100 }, { spacing: 4, placement: "belowNameplates" }), { x: 50, y: 104 });
  assert.deepEqual(placeOverlay(plates, { width: 80, height: 20 }, { w: 100, h: 100 }, { spacing: 4, placement: "aboveNameplates" }), { x: 50, y: -84 });
});
test("a bottom-only label stack cannot redirect top placement below the token", () => {
  const bottom = { x: 20, y: 110, width: 60, height: 40 };
  assert.deepEqual(placeOverlay({ sections: { bottom }, all: [bottom] }, { width: 80, height: 20 }, { w: 100, h: 100 }, { spacing: 4, placement: "aboveNameplates" }), { x: 50, y: -24 });
});
test("watch signatures detect new parents and visibility without measuring text", () => {
  const { layer, token } = scene();
  const before = nameplateSignature(token), measurements = token.nameplate.measurements;
  assert.equal(signaturesEqual(before, nameplateSignature(token)), true);
  assert.equal(token.nameplate.measurements, measurements);
  const group = layer.addChild(new Container()); group.addChild(token.nameplate);
  assert.equal(signaturesEqual(before, nameplateSignature(token)), false);
  const reparented = nameplateSignature(token); group.visible = false;
  assert.equal(signaturesEqual(reparented, nameplateSignature(token)), false);
});
test("left and right sections anchor outside token edges and accept relative padding", () => {
  const plates = { anchor: { x: 20, y: 102, width: 60, height: 20 }, all: [] };
  assert.deepEqual(placeOverlay(plates, { width: 80, height: 30 }, { w: 100, h: 100 }, { spacing: 4, placement: "leftNameplates", paddingX: -8, paddingY: 10 }), { x: -52, y: 45 });
  assert.deepEqual(placeOverlay(plates, { width: 80, height: 30 }, { w: 100, h: 100 }, { spacing: 4, placement: "rightToken", paddingX: 8, paddingY: -10 }), { x: 152, y: 25 });
});
test("directional custom stacks are followed and collisions move outward on that axis", () => {
  const left = { x: -80, y: 10, width: 60, height: 40 };
  const obstruction = { x: -170, y: 10, width: 50, height: 40 };
  const position = placeOverlay({ anchor: left, sections: { left }, all: [left, obstruction] }, { width: 80, height: 20 }, { w: 100, h: 100 }, { spacing: 4, placement: "leftNameplates" });
  assert.deepEqual(position, { x: -214, y: 20 });
});
test("small negative vertical padding overrides automatic bar clearance exactly", () => {
  const bar = { x: 0, y: 155, width: 100, height: 14 };
  const obstacles = { all: [bar], bars: [{ direction: "bottom", bounds: bar }] };
  const settings = { placement: "belowToken", spacing: 4 };
  const baseline = placeOverlay(obstacles, { width: 80, height: 20 }, { w: 100, h: 100 }, settings);
  for (const paddingY of [-0.5, -1, -2, -3, -10]) {
    const actual = placeOverlay(obstacles, { width: 80, height: 20 }, { w: 100, h: 100 }, { ...settings, paddingY });
    assert.equal(actual.y, baseline.y + paddingY);
  }
});
test("manual offsets are applied after collision resolution and may intentionally overlap", () => {
  const name = { x: 0, y: 110, width: 100, height: 20 }, bar = { x: 0, y: 145, width: 100, height: 20 };
  const obstacles = { sections: { bottom: name }, all: [name, bar] };
  const settings = { placement: "belowNameplates", spacing: 4 };
  const baseline = placeOverlay(obstacles, { width: 80, height: 30 }, { w: 100, h: 100 }, settings);
  const moved = placeOverlay(obstacles, { width: 80, height: 30 }, { w: 100, h: 100 }, { ...settings, paddingY: -2, paddingX: -1 });
  assert.equal(moved.y, baseline.y - 2); assert.equal(moved.x, baseline.x - 1);
});
test("zero clearance places affinity content directly against a bar", () => {
  const bar = { x: 0, y: 130, width: 100, height: 10 };
  const position = placeOverlay({ all: [bar], bars: [{ direction: "bottom", bounds: bar }] },
    { width: 80, height: 20 }, { w: 100, h: 100 }, { placement: "belowToken", spacing: 0 });
  assert.equal(position.y, 140);
});
