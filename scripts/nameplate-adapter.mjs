import { displayObjectVisible } from "./visibility.mjs";

const identities = new WeakMap();
let nextIdentity = 1;
function identity(object) {
  if (!object) return 0;
  if (!identities.has(object)) identities.set(object, nextIdentity++);
  return identities.get(object);
}

export function integrationActive() {
  return globalThis.game?.modules?.get("token-nameplates")?.active === true;
}

export function barBrawlActive() {
  return globalThis.game?.modules?.get("barbrawl")?.active === true;
}

export function collectBars(token) {
  if (!barBrawlActive()) return [];
  return (token.bars?.children ?? []).filter(displayObjectVisible);
}

function barDirection(token, bar, bounds) {
  let position = token.document?.flags?.barbrawl?.resourceBars?.[bar.name]?.position;
  if (!position) {
    try { position = game.modules.get("barbrawl")?.api?.getBar?.(token.document, bar.name)?.position; }
    catch { /* Unknown/custom bars are classified from their rendered location. */ }
  }
  const direction = position?.split("-")[0];
  if (["top", "bottom", "left", "right"].includes(direction)) return direction;
  const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
  return [["top", Math.abs(y)], ["bottom", Math.abs(y - token.h)],
    ["left", Math.abs(x)], ["right", Math.abs(x - token.w)]]
    .sort((a, b) => a[1] - b[1])[0][0];
}

/** Only public plate references are read. Never touch the module's containers. */
export function collectNameplates(token) {
  const plates = [{ plate: token.nameplate, direction: "bottom" }];
  if (integrationActive() && Array.isArray(token.nameplates)) {
    for (const plate of token.nameplates) plates.push({ plate, direction: plate.nameplatePosition ?? "bottom" });
  }
  return plates.filter(({ plate }) => plate && !plate.destroyed && String(plate.text ?? "").trim() && displayObjectVisible(plate));
}

/** Transform local rectangle corners rather than mixing global/local bounds. */
export function boundsInToken(plate, token) {
  const b = plate.getLocalBounds();
  const points = [
    [b.x, b.y], [b.x + b.width, b.y],
    [b.x + b.width, b.y + b.height], [b.x, b.y + b.height]
  ].map(([x, y]) => token.toLocal(plate.toGlobal({ x, y })));
  if (!points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))) return null;
  const xs = points.map(point => point.x), ys = points.map(point => point.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

export function unionBounds(rectangles) {
  if (!rectangles.length) return null;
  const x = Math.min(...rectangles.map(b => b.x));
  const y = Math.min(...rectangles.map(b => b.y));
  return {
    x, y,
    width: Math.max(...rectangles.map(b => b.x + b.width)) - x,
    height: Math.max(...rectangles.map(b => b.y + b.height)) - y
  };
}

export function measureNameplates(token) {
  const candidates = collectNameplates(token);
  const measured = candidates.map(({ plate, direction }) => ({ direction, bounds: boundsInToken(plate, token) }))
    .filter(({ bounds }) => bounds && bounds.width > 0 && bounds.height > 0);
  const selected = ["bottom", "top", "left", "right"].map(direction =>
    measured.filter(candidate => candidate.direction === direction)
  ).find(group => group.length);
  const bars = collectBars(token).map(bar => {
    const bounds = boundsInToken(bar, token);
    return bounds && { bounds, direction: barDirection(token, bar, bounds) };
  }).filter(bar => bar && bar.bounds.width > 0 && bar.bounds.height > 0);
  return {
    anchor: unionBounds((selected ?? []).map(candidate => candidate.bounds)),
    all: [...measured.map(candidate => candidate.bounds), ...bars.map(bar => bar.bounds)],
    bars,
    sections: Object.fromEntries(["bottom", "top", "left", "right"].map(direction => [direction,
      unionBounds(measured.filter(candidate => candidate.direction === direction).map(candidate => candidate.bounds))
    ]))
  };
}

/** Cached comparison uses local properties; it does not regenerate text textures. */
export function nameplateSignature(token) {
  const signature = [token.w, token.h, token.isVisible, token.document?.hidden, token.document?.disposition];
  const plates = [token.nameplate, ...(integrationActive() && Array.isArray(token.nameplates) ? token.nameplates : [])];
  for (const plate of plates) {
    if (!plate || plate.destroyed) { signature.push(0); continue; }
    signature.push(identity(plate), plate.text, plate.nameplatePosition, plate.style?.styleID,
      plate.anchor?.x, plate.anchor?.y, plate.resolution);
    for (let object = plate; object; object = object.parent) {
      signature.push(identity(object), object.x, object.y, object.rotation, object.scale?.x, object.scale?.y,
        object.pivot?.x, object.pivot?.y, object.skew?.x, object.skew?.y,
        object.visible, object.renderable, object.alpha);
    }
  }
  // External plate parents need not contain the token's own transform.
  for (let object = token; object; object = object.parent) {
    signature.push(identity(object), object.x, object.y, object.rotation,
      object.scale?.x, object.scale?.y, object.skew?.x, object.skew?.y,
      object.pivot?.x, object.pivot?.y, object.visible, object.renderable, object.alpha);
  }
  if (barBrawlActive()) {
    const visit = object => {
      if (!object || object.destroyed) return;
      signature.push(identity(object), object.name, object.x, object.y, object.rotation,
        object.scale?.x, object.scale?.y, object.skew?.x, object.skew?.y, object.pivot?.x, object.pivot?.y,
        object.visible, object.renderable, object.alpha, object.contentWidth,
        object.text, object.style?.styleID, object.geometry?.dirty,
        object.texture?.frame?.width, object.texture?.frame?.height);
      for (const child of object.children ?? []) visit(child);
    };
    visit(token.bars);
  }
  return signature;
}

export function signaturesEqual(a, b) {
  return !!a && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
}

/** Stable wrapping is based only on token dimensions, never its child bounds. */
export function wrapWidth(token, fontSize) {
  return Math.max(fontSize * 10, (Number(token.w) || 100) * 2.5);
}

/** Move vertically to clear any labels intersecting the affinity line. */
export function placeOverlay({ all, sections = {}, bars = [] }, { width, height }, token, settings) {
  const gap = settings.spacing;
  const tokenMode = settings.placement.endsWith("Token");
  const direction = settings.placement.startsWith("above") ? "top" : settings.placement.startsWith("left") ? "left"
    : settings.placement.startsWith("right") ? "right" : "bottom";
  const shape = { x: 0, y: 0, width: token.w, height: token.h };
  // Nameplate visibility never controls this plate. Only follow labels on the
  // chosen side; an empty side falls back to that token edge, never another side.
  const b = tokenMode ? shape : sections[direction] ?? shape;
  const reserved = bars.filter(bar => bar.direction === direction).map(bar => bar.bounds);
  let center = b.x + b.width / 2;
  let y = direction === "top" ? Math.min(b.y, ...reserved.map(bar => bar.y)) - height - gap
    : Math.max(b.y + b.height, ...reserved.map(bar => bar.y + bar.height)) + gap;
  if (direction === "left" || direction === "right") {
    center = direction === "left" ? Math.min(b.x, ...reserved.map(bar => bar.x)) - width / 2 - gap
      : Math.max(b.x + b.width, ...reserved.map(bar => bar.x + bar.width)) + width / 2 + gap;
    y = b.y + (b.height - height) / 2;
  }
  const intersects = b => center + width / 2 > b.x && center - width / 2 < b.x + b.width &&
    y + height > b.y - gap && y < b.y + b.height + gap;
  // Every move crosses at least one rectangle boundary; no unbounded search.
  for (let pass = 0; pass <= all.length; pass++) {
    const collisions = all.filter(intersects);
    if (!collisions.length) break;
    if (direction === "left") center = Math.min(...collisions.map(b => b.x - width / 2 - gap));
    else if (direction === "right") center = Math.max(...collisions.map(b => b.x + b.width + width / 2 + gap));
    else if (direction === "top") y = Math.min(...collisions.map(b => b.y - height - gap));
    else y = Math.max(...collisions.map(b => b.y + b.height + gap));
  }
  // Manual offsets intentionally override automatic clearance. Applying them
  // before collision resolution snapped small negative values back out.
  return { x: center + (settings.paddingX ?? 0), y: y + (settings.paddingY ?? 0) };
}
