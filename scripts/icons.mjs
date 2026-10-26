import { MODULE_ID } from "./constants.mjs";

export function iconURL(element) {
  return new URL(`../../../systems/projectfu/styles/static/affinities/icons/${element}.png`, import.meta.url).href;
}

/** Original PNGs remain unchanged; effects are composed into runtime textures. */
export function renderIcon(source, settings, color) {
  const size = settings.fontSize * 1.25;
  const radius = settings.outlineEnabled ? settings.outlineThickness / 2 : 0;
  const distance = settings.shadowEnabled ? settings.shadowDistance : 0;
  const blur = settings.shadowEnabled ? settings.shadowBlur ?? 0 : 0;
  const margin = Math.ceil(Math.max(radius, distance + blur * 3)) + 2;
  const extent = size + 2 * margin;
  const resolution = 2;
  function canvas(width, height) {
    const result = document.createElement("canvas");
    result.width = Math.ceil(width * resolution); result.height = Math.ceil(height * resolution);
    const context = result.getContext("2d");
    if (!context) throw new Error("Canvas 2D is required to style affinity icons.");
    context.scale(resolution, resolution);
    return [result, context];
  }
  const image = source.baseTexture.resource.source;
  const [output, ctx] = canvas(extent, extent);
  const [silhouette, silhouetteContext] = canvas(size, size);
  silhouetteContext.drawImage(image, 0, 0, size, size);
  silhouetteContext.globalCompositeOperation = "source-in";
  silhouetteContext.fillStyle = "#FFFFFF";
  silhouetteContext.fillRect(0, 0, size, size);

  function mask(draw, tint, alpha, blurAmount = 0) {
    if (alpha <= 0) return;
    const [layer, layerContext] = canvas(extent, extent);
    draw(layerContext);
    layerContext.globalCompositeOperation = "source-in";
    layerContext.fillStyle = tint;
    layerContext.fillRect(0, 0, extent, extent);
    ctx.globalAlpha = alpha;
    // Canvas filter lengths are in backing pixels, independent of our transform.
    ctx.filter = blurAmount ? `blur(${blurAmount * resolution}px)` : "none";
    ctx.drawImage(layer, 0, 0, extent, extent);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
  }
  if (settings.shadowEnabled) {
    const angle = settings.shadowAngle * Math.PI / 180;
    mask(layer => layer.drawImage(silhouette, margin + Math.cos(angle) * distance,
      margin + Math.sin(angle) * distance, size, size), settings.shadowColor, 1 - settings.shadowTransparency / 100, blur);
  }
  if (radius > 0) {
    mask(layer => {
      // Build an opaque dilation mask first, then apply alpha exactly once.
      // Subpixel steps keep thin strokes continuous at small icon sizes.
      const step = radius < 1 ? radius : 0.5;
      for (let x = -radius; x <= radius; x += step) {
        for (let y = -radius; y <= radius; y += step) {
          if (x * x + y * y <= radius * radius) layer.drawImage(silhouette, margin + x, margin + y, size, size);
        }
      }
    }, color, 1 - settings.outlineTransparency / 100);
  }
  ctx.drawImage(image, margin, margin, size, size);
  return { texture: PIXI.Texture.from(output), width: extent, height: extent,
    content: { x: margin, y: margin, width: size, height: size } };
}

/** Shared source loads and reference-counted styled textures; no per-frame paint. */
export class IconCache {
  #sources = new Map();
  #styled = new Map();
  constructor({ load = url => PIXI.Assets.load(url), render = renderIcon } = {}) {
    this.load = load; this.render = render;
  }

  acquire(element, settings, color) {
    const key = JSON.stringify([element, settings.fontSize, settings.outlineEnabled, color,
      settings.outlineThickness, settings.outlineTransparency, settings.shadowEnabled,
      settings.shadowColor, settings.shadowDistance, settings.shadowAngle, settings.shadowTransparency, settings.shadowBlur]);
    let record = this.#styled.get(key);
    if (!record) {
      if (!this.#sources.has(element)) {
        this.#sources.set(element, Promise.resolve().then(() => this.load(iconURL(element))).catch(error => {
          this.#sources.delete(element);
          throw error;
        }));
      }
      record = { refs: 0, result: null };
      this.#styled.set(key, record);
      record.promise = this.#sources.get(element).then(source => {
        const result = this.render(source, settings, color);
        record.result = result;
        if (!record.refs) result.texture.destroy(true);
        return result;
      }).catch(error => {
        if (this.#styled.get(key) === record) this.#styled.delete(key);
        throw new Error(`${MODULE_ID}: ${element} icon could not be loaded or rendered.`, { cause: error });
      });
    }
    record.refs++;
    let released = false;
    return {
      result: record.result,
      promise: record.promise,
      release: () => {
        if (released) return;
        released = true;
        if (--record.refs) return;
        if (this.#styled.get(key) === record) this.#styled.delete(key);
        record.result?.texture.destroy(true);
      }
    };
  }
}
