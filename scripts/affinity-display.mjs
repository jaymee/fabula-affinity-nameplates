import { MODULE_ID } from "./constants.mjs";
import { textStyle } from "./settings.mjs";

/** A logical plate made of direct token-child PIXI.Text labels and icon sprites. */
export class AffinityDisplay {
  #parts = [];
  #visible = false;
  #bounds = null;
  #layoutBounds = null;
  #position = { x: 0, y: 0 };
  #settings;
  #color;
  #width = 250;
  #destroyed = false;

  constructor(token, icons, onReady, onError) {
    this.token = token; this.icons = icons; this.onReady = onReady; this.onError = onError;
    this.position = { set: (x, y) => { this.#position = { x, y }; this.#place(); } };
  }
  get parent() { return this.token; }
  get destroyed() { return this.#destroyed || this.#parts.some(part => part.text.destroyed || part.sprite.destroyed || part.text.parent !== this.token || part.sprite.parent !== this.token); }
  get labels() { return this.#parts.map(part => part.text); }
  get ready() { return this.#parts.every(part => part.loaded); }
  get text() { return this.#parts.map(part => part.code).join(" | "); }
  get visible() { return this.#visible; }
  set visible(value) {
    this.#visible = value;
    for (const part of this.#parts) part.sprite.visible = part.text.visible = value && part.loaded;
  }

  setEntries(entries) {
    const previous = new Map(this.#parts.map(part => [part.element, part]));
    const next = [];
    for (const { element, code } of entries) {
      let part = previous.get(element);
      previous.delete(element);
      if (!part) {
        const text = new PIXI.Text(code, new PIXI.TextStyle());
        const sprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
        text.name = `${MODULE_ID}.code.${element}`;
        sprite.name = `${MODULE_ID}.icon.${element}`;
        text.affinityElement = sprite.affinityElement = element;
        text.eventMode = sprite.eventMode = "none";
        text.visible = sprite.visible = false;
        // Icons and codes are both directly attached to the token.
        this.token.addChild(sprite); this.token.addChild(text);
        part = { element, code, text, sprite, loaded: false, lease: null };
        if (this.#settings) this.#stylePart(part);
      } else if (part.code !== code) part.text.text = part.code = code;
      next.push(part);
    }
    for (const part of previous.values()) this.#destroyPart(part);
    this.#parts = next;
    this.#bounds = null;
  }

  applyStyle(settings, color, width) {
    this.#settings = settings; this.#color = color; this.#width = width;
    for (const part of this.#parts) this.#stylePart(part);
    this.#bounds = null;
  }

  #stylePart(part) {
    part.text.style = new PIXI.TextStyle(textStyle(this.#settings, this.#color));
    part.text.alpha = part.sprite.alpha = this.#settings.textOpacity / 100;
    // Keep the old texture alive until the new lease has been acquired.
    const old = part.lease;
    const lease = this.icons.acquire(part.element, this.#settings, this.#color);
    part.lease = lease; part.loaded = false;
    old?.release();
    part.text.visible = part.sprite.visible = false;
    const apply = result => {
      if (this.#destroyed || part.lease !== lease) return;
      part.sprite.texture = result.texture;
      part.sprite.width = result.width; part.sprite.height = result.height;
      part.iconWidth = result.width; part.iconHeight = result.height;
      part.iconContent = result.content ?? { x: 0, y: 0, width: result.width, height: result.height };
      part.loaded = true;
      this.#bounds = null;
      this.onReady();
    };
    if (lease.result) apply(lease.result);
    else lease.promise.then(apply).catch(error => {
      if (!this.#destroyed && part.lease === lease) this.onError(error);
    });
  }

  invalidateMetrics() {
    for (const part of this.#parts) part.text.dirty = true;
    this.#bounds = null;
  }

  getLocalBounds() {
    if (this.#bounds) return this.#bounds;
    const font = this.#settings?.fontSize ?? 16;
    const innerGap = 1, groupGap = this.#settings?.elementSpacing ?? 3, rowGap = Math.max(2, font * 0.15);
    const rows = [{ parts: [], width: 0, height: 0 }];
    for (const part of this.#parts) {
      const text = part.text.getLocalBounds();
      const content = part.iconContent ?? { x: 0, y: 0, width: font * 1.25, height: font * 1.25 };
      // Shadows need texture padding, not typographic spacing. Measure the code
      // without its shadow and position it beside the icon artwork itself.
      const metrics = PIXI.TextMetrics?.measureText?.(part.code, new PIXI.TextStyle({
        ...textStyle(this.#settings, this.#color), dropShadow: false, padding: 0
      })) ?? text;
      const width = content.width + innerGap + metrics.width;
      const height = Math.max(content.height, metrics.height);
      let row = rows.at(-1);
      if (this.#settings?.wrapElements && row.parts.length && row.width + groupGap + width > this.#width) {
        row = { parts: [], width: 0, height: 0 }; rows.push(row);
      }
      const x = row.width + (row.parts.length ? groupGap : 0);
      row.parts.push({ part, text, metrics, x, content });
      row.width = x + width; row.height = Math.max(row.height, height);
    }
    const width = Math.max(0, ...rows.map(row => row.width));
    let y = 0;
    for (const row of rows) {
      for (const { part, text, metrics, x, content } of row.parts) {
        const artworkX = (width - row.width) / 2 + x;
        part.iconX = artworkX - content.x;
        part.iconY = y + (row.height - content.height) / 2 - content.y;
        part.textX = artworkX + content.width + innerGap - text.x;
        part.textY = y + (row.height - metrics.height) / 2 - text.y;
      }
      y += row.height + rowGap;
    }
    // Anchor and collide using artwork/glyph dimensions. Keep the full render
    // bounds separately so shadow textures can grow without moving the plate.
    this.#layoutBounds = { x: 0, y: 0, width, height: Math.max(0, y - rowGap) };
    // Track full render extents separately. These margins are not used for
    // anchoring, wrapping, or clearance around names and bars.
    const rectangles = this.#parts.flatMap(part => {
      const text = part.text.getLocalBounds();
      return [
        { x: part.iconX, y: part.iconY, width: part.iconWidth ?? font * 1.25, height: part.iconHeight ?? font * 1.25 },
        { x: part.textX + text.x, y: part.textY + text.y, width: text.width, height: text.height }
      ];
    });
    const left = Math.min(0, ...rectangles.map(b => b.x)), top = Math.min(0, ...rectangles.map(b => b.y));
    this.#bounds = { x: left, y: top,
      width: Math.max(0, ...rectangles.map(b => b.x + b.width)) - left,
      height: Math.max(0, ...rectangles.map(b => b.y + b.height)) - top };
    return this.#bounds;
  }

  getLayoutBounds() {
    this.getLocalBounds();
    return this.#layoutBounds;
  }

  #place() {
    this.getLocalBounds();
    for (const part of this.#parts) {
      part.sprite.position.set(this.#position.x + part.iconX, this.#position.y + part.iconY);
      part.text.position.set(this.#position.x + part.textX, this.#position.y + part.textY);
    }
  }

  #destroyPart(part) {
    part.text.parent?.removeChild(part.text); part.sprite.parent?.removeChild(part.sprite);
    if (!part.text.destroyed) part.text.destroy({ texture: true, baseTexture: true });
    if (!part.sprite.destroyed) part.sprite.destroy({ texture: false, baseTexture: false });
    part.lease?.release(); part.lease = null;
  }

  destroy() {
    this.#destroyed = true;
    for (const part of this.#parts) this.#destroyPart(part);
    this.#parts = [];
  }
}
