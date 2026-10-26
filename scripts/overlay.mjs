import { MODULE_ID } from "./constants.mjs";
import { affinityEntries } from "./affinities.mjs";
import { tokenVisible } from "./visibility.mjs";
import { publishedEntries, configuredElements } from "./gm-reveals.mjs";
import { readSettings, outlineColor } from "./settings.mjs";
import { AffinityDisplay } from "./affinity-display.mjs";
import { IconCache } from "./icons.mjs";
import { tokenEnabled } from "./token-config.mjs";
import {
  integrationActive, barBrawlActive, measureNameplates, nameplateSignature,
  placeOverlay, signaturesEqual, wrapWidth
} from "./nameplate-adapter.mjs";

export class OverlayManager {
  #states = new WeakMap();
  #tokens = new Set();
  #pending = new Set();
  #frame = null;
  #ticker = null;
  #settings = null;
  #fontRequests = new Set();
  #warned = new Set();
  #epoch = 0;
  #active = true;

  constructor({ icons = new IconCache() } = {}) { this.icons = icons; }

  #warnOnce(key, error) {
    if (this.#warned.has(key)) return;
    this.#warned.add(key);
    console.warn(`${MODULE_ID} | ${key}`, error ?? "");
  }

  #valid(token) {
    const sceneId = token?.scene?.id ?? token?.document?.parent?.id;
    return this.#active && !!token && !token.destroyed && typeof token.addChild === "function" &&
      !!globalThis.canvas?.scene && sceneId === canvas.scene.id;
  }

  get settings() { return this.#settings ??= readSettings(); }


  /** Reuse only our own live child. Core can destroy children during redraw. */
  ensureOverlay(token) {
    if (!this.#valid(token)) return null;
    let state = this.#states.get(token);
    if (state && !state.text.destroyed && state.text.parent === token) return state;
    if (state) this.destroyOverlay(token);
    const text = new AffinityDisplay(token, this.icons, () => this.queue(token), error => this.#warnOnce("Affinity icon failed to load.", error));
    state = { text, styleKey: "", signature: null, content: "" };
    this.#states.set(token, state);
    this.#tokens.add(token);
    return state;
  }

  updateContent(token) {
    const state = this.ensureOverlay(token);
    if (!state) return;
    const entries = !tokenEnabled(token.document) ? [] : game.user?.isGM ? affinityEntries(token.actor, {
      allowed: configuredElements(token.document),
      onInvalid: () => this.#warnOnce("Unsupported affinity entry; expected a prepared integer .current between -1 and 3.")
    }) : publishedEntries(token.document);
    const content = entries.length ? JSON.stringify(entries) : "";
    if (state.content !== content) {
      state.text.setEntries(entries);
      state.content = content;
      state.signature = null;
    }
    // Do not leave a previously disclosed value visible while waiting for layout.
    if (!content || !tokenVisible(token)) state.text.visible = false;
  }

  applyStyle(token) {
    const state = this.#states.get(token);
    if (!state || state.text.destroyed) return;
    const settings = this.settings;
    const width = wrapWidth(token, settings.fontSize);
    const color = outlineColor(token, settings);
    const key = JSON.stringify([settings, color, width]);
    if (state.styleKey === key) return;
    state.styleKey = key;
    state.signature = null;
    state.text.applyStyle(settings, color, width);
    this.#loadFont(settings);
  }

  #loadFont(settings) {
    const fonts = globalThis.document?.fonts;
    if (!fonts?.load) return;
    const key = `${settings.fontSize}px ${settings.fontFamily}`;
    if (this.#fontRequests.has(key)) return;
    this.#fontRequests.add(key);
    const epoch = this.#epoch;
    // Font loading is asynchronous. Ignore callbacks from a previous canvas.
    Promise.resolve().then(() => fonts.load(key)).then(() => {
      if (epoch !== this.#epoch || !this.#active) return;
      PIXI.TextMetrics?.clearMetrics?.();
      for (const token of this.#tokens) {
        const state = this.#states.get(token);
        if (!state || state.text.destroyed) continue;
        // PIXI caches metrics for a font that may initially have used fallback.
        state.text.invalidateMetrics();
        state.signature = null;
        this.queue(token);
      }
    }).catch(error => this.#warnOnce("Font could not be loaded; browser font fallback will be used.", error));
  }

  layoutOverlay(token) {
    const state = this.#states.get(token);
    if (!state || state.text.destroyed || !this.#valid(token)) return;
    this.applyStyle(token);
    const text = state.text;
    text.visible = false;
    if (!state.content || !tokenEnabled(token.document) || !tokenVisible(token) || !text.ready || !this.settings.textOpacity) {
      state.signature = nameplateSignature(token);
      return;
    }
    const plates = measureNameplates(token);
    // Position the artwork and glyphs, not the padded shadow texture rectangle.
    const bounds = text.getLayoutBounds();
    const position = placeOverlay(plates, bounds, token, this.settings);
    if (position) {
      // Align the stable content boundary; effects can extend outside it.
      text.position.set(position.x - (bounds.x + bounds.width / 2), position.y - bounds.y);
      text.visible = true;
    }
    state.signature = nameplateSignature(token);
  }

  /** Called by drawToken and refreshToken; never requests a token redraw. */
  refreshToken(token) {
    try {
      if (!this.ensureOverlay(token)) return;
      this.updateContent(token);
      this.layoutOverlay(token);
      this.queue(token);
    } catch (error) {
      const state = this.#states.get(token);
      if (state && !state.text.destroyed) state.text.visible = false;
      this.#warnOnce("Could not update affinity overlay.", error);
    }
  }

  queue(token) {
    if (!this.#valid(token)) return;
    this.#pending.add(token);
    if (this.#frame !== null) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = null;
      const pending = [...this.#pending];
      this.#pending.clear();
      for (const target of pending) {
        if (!this.#valid(target)) { this.destroyOverlay(target); continue; }
        try {
          // Read again after system effect/item preparation has settled.
          this.updateContent(target);
          this.layoutOverlay(target);
        } catch (error) {
          const state = this.#states.get(target);
          if (state && !state.text.destroyed) state.text.visible = false;
          this.#warnOnce("Deferred affinity layout failed.", error);
        }
      }
    });
  }

  updateActor(actor) {
    const affected = new Set(actor.getActiveTokens?.() ?? []);
    // Include drag previews, whose synthetic actor need not be the same object.
    for (const token of this.#tokens) {
      if (token.actor === actor || (token.isPreview && token._original?.actor === actor)) affected.add(token);
    }
    for (const token of affected) this.refreshToken(token);
  }

  refreshAllOverlays({ settingsChanged = false } = {}) {
    if (settingsChanged) this.#settings = null;
    const tokens = new Set([...this.#tokens, ...(globalThis.canvas?.tokens?.placeables ?? [])]);
    for (const token of tokens) {
      if (this.#valid(token)) this.refreshToken(token);
      else this.destroyOverlay(token);
    }
  }

  #watch = () => {
    for (const token of this.#tokens) {
      if (!this.#valid(token)) { this.destroyOverlay(token); continue; }
      try {
        const state = this.#states.get(token);
        if (!state || state.text.destroyed) { this.refreshToken(token); continue; }
        const signature = nameplateSignature(token);
        if (!signaturesEqual(state.signature, signature)) this.layoutOverlay(token);
      } catch (error) {
        const state = this.#states.get(token);
        if (state && !state.text.destroyed) state.text.visible = false;
        this.#warnOnce("Token nameplate or resource bar geometry could not be measured.", error);
      }
    }
  };

  beginScene() { this.#active = true; }

  canvasReady() {
    this.#active = true;
    this.refreshAllOverlays();
    this.#ticker?.remove(this.#watch, this);
    this.#ticker = null;
    if ((integrationActive() || barBrawlActive()) && globalThis.canvas?.app?.ticker) {
      this.#ticker = canvas.app.ticker;
      // PIXI's Application renders at LOW; inspect after normal token updates.
      this.#ticker.add(this.#watch, this, (PIXI.UPDATE_PRIORITY?.LOW ?? -25) + 1);
    }
  }

  destroyOverlay(token) {
    this.#pending.delete(token);
    this.#tokens.delete(token);
    const state = this.#states.get(token);
    this.#states.delete(token);
    if (!state?.text) return;
    state.text.destroy();
  }

  tearDown() {
    this.#active = false;
    this.#epoch++;
    if (this.#frame !== null) cancelAnimationFrame(this.#frame);
    this.#frame = null;
    this.#ticker?.remove(this.#watch, this);
    this.#ticker = null;
    for (const token of [...this.#tokens]) this.destroyOverlay(token);
    this.#pending.clear();
    this.#fontRequests.clear();
  }

  /** Read-only diagnostic data; no undisclosed text is returned. */
  diagnostics() {
    return {
      version: game.modules.get(MODULE_ID)?.version,
      foundry: game.version,
      system: { id: game.system.id, version: game.system.version },
      tokenNameplates: {
        active: integrationActive(), version: game.modules.get("token-nameplates")?.version ?? null
      },
      barBrawl: { active: barBrawlActive(), version: game.modules.get("barbrawl")?.version ?? null },
      trackedTokens: this.#tokens.size, pendingLayouts: this.#pending.size,
      watchingNameplates: !!this.#ticker
    };
  }
}
