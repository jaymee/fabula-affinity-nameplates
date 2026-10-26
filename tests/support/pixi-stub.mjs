// A deterministic affine scene graph for lifecycle/unit tests. This is not a
// substitute for the real PIXI/Foundry acceptance checks in TESTING.md.
function multiply(a, b) {
  return [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1],
    a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3],
    a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]];
}
function apply(m, p) { return { x: m[0]*p.x+m[2]*p.y+m[4], y: m[1]*p.x+m[3]*p.y+m[5] }; }
export function point(x = 0, y = 0) {
  return { x, y, set(a, b = a) { this.x = a; this.y = b; } };
}
export class Container {
  constructor() {
    this.position = point(); this.scale = point(1, 1); this.pivot = point(); this.skew = point();
    this.rotation = 0; this.alpha = 1; this.visible = true; this.renderable = true;
    this.children = []; this.parent = null; this.destroyed = false;
  }
  get x() { return this.position.x; }
  set x(v) { this.position.x = v; }
  get y() { return this.position.y; }
  set y(v) { this.position.y = v; }
  addChild(child) { child.parent?.removeChild(child); this.children.push(child); child.parent = this; return child; }
  removeChild(child) { this.children = this.children.filter(c => c !== child); child.parent = null; return child; }
  matrix() {
    const a = Math.cos(this.rotation)*this.scale.x, b = Math.sin(this.rotation)*this.scale.x;
    const c = -Math.sin(this.rotation)*this.scale.y, d = Math.cos(this.rotation)*this.scale.y;
    const local = [a,b,c,d,this.x-a*this.pivot.x-c*this.pivot.y,this.y-b*this.pivot.x-d*this.pivot.y];
    return this.parent ? multiply(this.parent.matrix(), local) : local;
  }
  toGlobal(p) { return apply(this.matrix(), p); }
  toLocal(p) {
    const [a,b,c,d,tx,ty] = this.matrix(); const determinant = a*d-b*c;
    return { x: (d*(p.x-tx)-c*(p.y-ty))/determinant, y: (-b*(p.x-tx)+a*(p.y-ty))/determinant };
  }
  destroy() { this.destroyed = true; }
}
let styleId = 1;
export class TextStyle { constructor(values = {}) { Object.assign(this, values); this.styleID = styleId++; } }
export class Text extends Container {
  constructor(text = "", style = new TextStyle()) {
    super(); this.anchor = point(); this.style = style; this.assignments = 0; this.text = text; this.measurements = 0;
  }
  set text(value) { this._text = value; this.assignments++; }
  get text() { return this._text; }
  getLocalBounds() {
    this.measurements++;
    const size = this.style.fontSize ?? 16;
    const natural = this.text.length * size * 0.55;
    const width = Math.min(natural, this.style.wordWrapWidth ?? Infinity);
    const height = Math.max(1, Math.ceil(natural / Math.max(width, 1))) * size * 1.2;
    return { x: -this.anchor.x * width, y: -this.anchor.y * height, width, height };
  }
}
export class Texture {
  constructor(width = 32, height = 32) { this.width = width; this.height = height; this.destroyed = false; }
  destroy() { this.destroyed = true; }
  static EMPTY = new Texture(1, 1);
}
export class Sprite extends Container {
  constructor(texture) { super(); this.texture = texture; this.width = texture.width; this.height = texture.height; }
  getLocalBounds() { return { x: 0, y: 0, width: this.width, height: this.height }; }
}
export const PIXI = { Text, TextStyle, Sprite, Texture, UPDATE_PRIORITY: { LOW: -25 }, TextMetrics: { clearMetrics() {} } };

export function fakeIconCache() {
  return { acquire() {
    const result = { texture: new Texture(), width: 24, height: 24 };
    return { result, promise: Promise.resolve(result), release() { result.texture.destroy(); } };
  } };
}
