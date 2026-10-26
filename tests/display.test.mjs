import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { AffinityDisplay } from "../scripts/affinity-display.mjs";
import { normalizeSettings } from "../scripts/settings.mjs";
import { ELEMENTS } from "../scripts/constants.mjs";
import { Container, PIXI, Texture } from "./support/pixi-stub.mjs";

beforeEach(() => { globalThis.PIXI = PIXI; });
afterEach(() => { delete globalThis.PIXI; });
function display(raw = {}, entries = [{ element: "fire", code: "RS" }, { element: "ice", code: "IM" }]) {
  const token = new Container();
  const icons = { acquire(_element, settings) {
    // Exaggerated transparent padding proves it is not used as word spacing.
    const margin = 30 + settings.shadowBlur * 3, extent = 20 + 2 * margin;
    const result = { texture: new Texture(extent, extent), width: extent, height: extent, content: { x: margin, y: margin, width: 20, height: 20 } };
    return { result, promise: Promise.resolve(result), release() {} };
  } };
  const plate = new AffinityDisplay(token, icons, () => {}, assert.fail);
  const settings = normalizeSettings(raw);
  plate.applyStyle(settings, "#000000", 60); plate.setEntries(entries); plate.position.set(0, 0);
  const icon = key => token.children.find(child => child.name?.endsWith(`.icon.${key}`));
  const text = key => token.children.find(child => child.name?.endsWith(`.code.${key}`));
  return { plate, settings, token, icon, text };
}
test("codes sit one pixel from the artwork rather than the padded texture edge", () => {
  const { plate, icon, text } = display();
  const artRight = icon("fire").x + 30 + 20;
  assert.equal(text("fire").x - artRight, 1);
  assert.equal(plate.getLocalBounds().x, -30);
  plate.destroy();
});
test("element word spacing adjusts the gap between complete pairs", () => {
  const { plate, icon, text, settings } = display({ elementSpacing: 2 });
  const textEnd = text("fire").x + text("fire").getLocalBounds().width;
  assert.equal(icon("ice").x + 30 - textEnd, 2);
  const oldX = icon("ice").x;
  plate.applyStyle({ ...settings, elementSpacing: 12 }, "#000000", 60); plate.position.set(0, 0);
  assert.equal(icon("ice").x - oldX, 10);
  plate.destroy();
});
test("all nine elements stay on one line by default even on small tokens", () => {
  const { plate, token } = display({}, ELEMENTS.map(([element]) => ({ element, code: "VU" })));
  const labels = token.children.filter(child => child.affinityElement && child instanceof PIXI.Text);
  assert.equal(new Set(labels.map(label => label.y)).size, 1);
  plate.destroy();
});
test("optional wrapping breaks only between complete icon/code pairs", () => {
  const { plate, text, icon } = display({ wrapElements: true });
  assert.ok(text("ice").y > text("fire").y);
  assert.equal(icon("ice").y - icon("fire").y, text("ice").y - text("fire").y);
  plate.destroy();
});
test("shadow blur grows render bounds without changing layout bounds or glyph positions", () => {
  const { plate, text, settings } = display({ shadowEnabled: true, shadowBlur: 0 });
  const layout = { ...plate.getLayoutBounds() }, render = { ...plate.getLocalBounds() };
  const position = { x: text("fire").x, y: text("fire").y };
  plate.applyStyle({ ...settings, shadowBlur: 12 }, "#000000", 60); plate.position.set(0, 0);
  assert.deepEqual(plate.getLayoutBounds(), layout);
  assert.deepEqual({ x: text("fire").x, y: text("fire").y }, position);
  assert.ok(plate.getLocalBounds().x < render.x);
  assert.ok(plate.getLocalBounds().width > render.width);
  plate.destroy();
});
