import { MODULE_ID, localize } from "./constants.mjs";
import { registerSettings, migrateWorldStyles, syncSettingsVisibility } from "./settings.mjs";
import { OverlayManager } from "./overlay.mjs";
import { renderTokenConfig } from "./token-config.mjs";
import { renderSettingsConfig, closeSettingsConfig } from "./settings-ui.mjs";
import { GMRevealPublisher, configuredEnabled, guardRevealUpdate, isPublisher } from "./gm-reveals.mjs";

let manager;
const publisher = new GMRevealPublisher();

Hooks.once("init", () => {
  registerSettings(() => manager?.refreshAllOverlays({ settingsChanged: true }));
  if (game.system.id !== "projectfu" || Number(game.release.generation) !== 13) return;
  manager = new OverlayManager();
  game.modules.get(MODULE_ID).api = Object.freeze({
    refresh: () => manager.refreshAllOverlays({ settingsChanged: true }),
    diagnostics: () => manager.diagnostics()
  });
});

Hooks.once("ready", async () => {
  if (!manager) ui.notifications.warn(localize("unsupported", "Affinity Nameplates requires Foundry VTT 13 and Project FU."));
  syncSettingsVisibility();
  if (manager && isPublisher()) {
    await migrateWorldStyles();
    publisher.queueScene();
    manager.refreshAllOverlays({ settingsChanged: true });
  }
});

Hooks.on("canvasInit", () => manager?.beginScene());
Hooks.on("canvasReady", () => { manager?.canvasReady(); publisher.queueScene(); });
Hooks.on("canvasTearDown", () => manager?.tearDown());
Hooks.on("drawToken", token => manager?.refreshToken(token));
Hooks.on("refreshToken", token => manager?.refreshToken(token));
Hooks.on("destroyToken", token => manager?.destroyOverlay(token));
Hooks.on("renderTokenConfig", (application, element) => {
  if (manager) renderTokenConfig(application, element);
});
Hooks.on("renderPrototypeTokenConfig", (application, element) => {
  if (manager) renderTokenConfig(application, element);
});
Hooks.on("renderSettingsConfig", renderSettingsConfig);
Hooks.on("closeSettingsConfig", closeSettingsConfig);
Hooks.on("hoverToken", token => manager?.queue(token));
Hooks.on("controlToken", token => manager?.queue(token));
function gmUpdate(userId) {
  return userId ? game.users?.get(userId)?.isGM === true : game.user?.isGM === true;
}
Hooks.on("updateToken", (document, _changes, _options, userId) => {
  if (document.object) manager?.refreshToken(document.object);
  publisher.queue(document, { visibility: gmUpdate(userId) });
});
Hooks.on("createToken", (document, _options, userId) => {
  const fromGM = gmUpdate(userId);
  publisher.queue(document, {
    visibility: fromGM || configuredEnabled(document.actor?.prototypeToken),
    authority: fromGM ? document : document.actor?.prototypeToken
  });
});
Hooks.on("deleteToken", document => publisher.remove(document));
Hooks.on("deleteScene", scene => {
  for (const document of scene.tokens?.contents ?? scene.tokens ?? []) publisher.remove(document);
});
Hooks.on("preUpdateToken", (document, changes) => guardRevealUpdate(document, changes));
Hooks.on("preUpdateActor", (actor, changes) => guardRevealUpdate(actor, changes, true));
Hooks.on("updateActorDelta", delta => {
  if (delta.parent?.object) manager?.refreshToken(delta.parent.object);
  publisher.queue(delta.parent);
});

// Recheck all actor updates: derived affinity changes need not include an
// explicit system.affinities key. getActiveTokens is handled by the manager.
Hooks.on("updateActor", actor => { manager?.updateActor(actor); publisher.queueActor(actor); });
Hooks.on("createActor", () => manager?.refreshAllOverlays());
Hooks.on("deleteActor", actor => { manager?.refreshAllOverlays(); publisher.queueActor(actor); });
Hooks.on("updateUser", () => {
  syncSettingsVisibility();
  manager?.refreshAllOverlays({ settingsChanged: true });
  publisher.queueScene();
});
Hooks.on("userConnected", () => publisher.queueScene());

function actorAncestor(document) {
  for (let parent = document.parent; parent; parent = parent.parent) {
    if (parent.documentName === "Actor") return parent;
  }
  return null;
}

for (const type of ["Item", "ActiveEffect"]) {
  for (const action of ["create", "update", "delete"]) {
    Hooks.on(`${action}${type}`, document => {
      const actor = actorAncestor(document);
      if (actor) { manager?.updateActor(actor); publisher.queueActor(actor); }
    });
  }
}

Hooks.on("updateSetting", setting => {
  if (setting.key?.startsWith("token-nameplates.") || setting.key?.startsWith("barbrawl.")) {
    manager?.refreshAllOverlays();
  }
});
