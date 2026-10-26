const output = document.querySelector("#results"), summary = document.querySelector("#summary");
let passed = 0, failed = 0;
const report = (label, error) => {
  const item = document.createElement("li"); item.className = error ? "fail" : "pass";
  item.textContent = `${error ? "FAIL" : "PASS"} — ${label}${error ? `: ${error.message}` : ""}`;
  output.append(item); error ? failed++ : passed++;
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const near = (a, b, message) => assert(Math.abs(a - b) < 0.1, `${message}: ${a} vs ${b}`);
const check = async (name, fn) => { try { await fn(); report(name); } catch (error) { report(name, error); } };
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
const settle = async (condition = () => true) => {
  for (let i = 0; i < 300; i++) { await frame(); if (condition()) { await frame(); return; } }
  throw new Error("Assets or deferred layout did not settle.");
};
try {
  assert(globalThis.PIXI, "PIXI CDN did not load");
  const { MODULE_ID, ELEMENTS } = await import("../scripts/constants.mjs");
  const { boundsInToken, unionBounds } = await import("../scripts/nameplate-adapter.mjs");
  const { settingDefinitions, normalizeSettings } = await import("../scripts/settings.mjs");
  const { iconURL, renderIcon } = await import("../scripts/icons.mjs");
  const callbacks = new Map();
  globalThis.Hooks = {
    on(name, fn) { const list = callbacks.get(name) ?? []; list.push({ fn, once: false }); callbacks.set(name, list); },
    once(name, fn) { const list = callbacks.get(name) ?? []; list.push({ fn, once: true }); callbacks.set(name, list); },
    callAll(name, ...args) {
      const list = [...(callbacks.get(name) ?? [])]; callbacks.set(name, list.filter(item => !item.once));
      return Promise.all(list.map(({fn})=>fn(...args)));
    },
    call(name,...args){return !(callbacks.get(name)??[]).some(({fn})=>fn(...args)===false);}
  };
  const values = new Map(), definitions = new Map(), registered = new Map();
  globalThis.CONFIG = { defaultFontFamily: "Arial", FU: { studyRoll: { core: [10,13,16], revised: [7,10,13] } } };
  globalThis.game = {
    user: { id:"gm", isGM: true }, users:{activeGM:{id:"gm"},get:id=>({id,isGM:id==="gm"})}, actors: [], version: "13.facade", release: { generation: 13 }, system: { id: "projectfu", version: "4.16.3" },
    i18n: { localize: key => key },
    modules: new Map([[MODULE_ID, { version: "0.3.0" }], ["token-nameplates", { active: true, version: "fixture" }], ["barbrawl", { active: true, version: "1.9.0-fixture" }]]),
    settings: {
      settings:registered,
      register(id, key, definition) { values.set(`${id}.${key}`, definition.default); definitions.set(`${id}.${key}`, definition); registered.set(`${id}.${key}`,definition); },
      get(id, key) { return values.get(`${id}.${key}`); },
      set(id, key, value) {
        if(definitions.get(`${id}.${key}`)?.scope==="world"&&!game.user.isGM)throw new Error("GM only world setting");
        values.set(`${id}.${key}`, value); definitions.get(`${id}.${key}`)?.onChange?.(value);return Promise.resolve(value);
      }
    }
  };
  globalThis.ui = { notifications: { warn: message => report("Foundry warning", new Error(message)) } };
  const app = new PIXI.Application({ width: 1120, height: 460, backgroundColor: 0x192130, antialias: true, resolution: 1 });
  document.querySelector("#canvas").append(app.view);
  const tokens = app.stage.addChild(new PIXI.Container()); tokens.placeables = [];
  globalThis.canvas = { app, stage: app.stage, tokens, scene: { id: "test", active:true, tokens:[] }, draw: () => { throw new Error("Unexpected canvas redraw"); } };
  game.scenes=[canvas.scene];
  function makeToken(name, x, elements) {
    const token = tokens.addChild(new PIXI.Container());
    const actor = {
      type: "npc", uuid: `Actor.${name}`, documentName: "Actor", system: { affinities: Object.fromEntries(ELEMENTS.map(([key]) => [key, { current: elements[key] ?? 0 }])) },
      calls: 0, getActiveTokens() { this.calls++; return [token]; }
    };
    Object.assign(token, { actor, scene: canvas.scene, document: { id:name,uuid:`Scene.test.Token.${name}`, parent: canvas.scene, actorId: name, canUserModify: () => true, flags: { [MODULE_ID]: { enabled: true } }, actor }, w: 100, h: 100, isVisible: true });
    token.getDispositionColor = () => token.document.disposition === -1 ? 0xE85D68 : 0x6CB3FF;
    token.document.object = token; token.document.disposition = -1;
    token.position.set(x, 105);
    token.addChild(new PIXI.Graphics().beginFill(0x384e65).lineStyle(2, 0x789eb7).drawRoundedRect(0,0,100,100,16).endFill());
    token.nameplate = token.addChild(new PIXI.Text(name, { fontFamily: "Arial", fontSize: 20, fill: "#ffffff", align: "center" }));
    token.nameplate.anchor.set(0.5,0); token.nameplate.position.set(50,106);
    token.draw = () => { throw new Error("Unexpected token redraw"); };
    tokens.placeables.push(token); canvas.scene.tokens.push(token.document);game.actors.push(actor); return token;
  }
  const first = makeToken("Ashen Guardian", 130, { physical: -1, fire: 1, ice: 3 });
  const custom = makeToken("Custom stack", 510, { dark: 2, light: -1, poison: 1 });
  custom.nameplate.renderable = false;
  const external = tokens.addChild(new PIXI.Container()); external.position.copyFrom(custom.position);
  custom.nameplates = ["Custom stack", "Second nameplate"].map((value, index) => {
    const plate = external.addChild(new PIXI.Text(value, { fontFamily: "Arial", fontSize: 20, fill: index ? "#9eb9d7" : "#ffffff" }));
    plate.anchor.set(0.5,0); plate.position.set(50,106+index*28); plate.nameplatePosition = "bottom"; return plate;
  });
  const hidden = makeToken("Affinities hidden", 870, { fire: -1 });
  hidden.document.flags[MODULE_ID] = { enabled: false };
  await import("../scripts/main.mjs");
  Hooks.callAll("init"); game.settings.set(MODULE_ID,"spacing",4); Hooks.callAll("canvasInit", canvas);
  for (const token of tokens.placeables) Hooks.callAll("drawToken", token);
  Hooks.callAll("canvasReady", canvas);
  const labels = token => token.children.filter(child => child.name?.startsWith(`${MODULE_ID}.code.`));
  const icons = token => token.children.filter(child => child.name?.startsWith(`${MODULE_ID}.icon.`));
  const objects = token => [...labels(token), ...icons(token)];
  const code = (token, element) => labels(token).find(label => label.affinityElement === element);
  const bounds = token => {
    const settings=normalizeSettings(Object.fromEntries(Object.keys(settingDefinitions()).map(key=>[key,game.settings.get(MODULE_ID,key)])));
    const radius=settings.outlineEnabled?settings.outlineThickness/2:0;
    const distance=settings.shadowEnabled?settings.shadowDistance:0,blur=settings.shadowEnabled?settings.shadowBlur:0;
    const margin=Math.ceil(Math.max(radius,distance+blur*3))+2,size=settings.fontSize*1.25;
    return unionBounds([
      ...icons(token).map(icon=>{const b=boundsInToken(icon,token);return{x:b.x+margin,y:b.y+margin,width:size,height:size};}),
      ...labels(token).map(label=>{
        const style=label.style.clone();style.dropShadow=false;style.padding=0;
        const metrics=PIXI.TextMetrics.measureText(label.text,style),local=label.getLocalBounds();
        const p=token.toLocal(label.toGlobal({x:local.x,y:local.y}));
        return{x:p.x,y:p.y,width:metrics.width,height:metrics.height};
      })
    ]);
  };
  const ready = token => labels(token).length && objects(token).every(object => object.visible);
  const api = game.modules.get(MODULE_ID).api;
  await settle(() => ready(first) && ready(custom));
  await check("official PNG icons replace element names; VU / RS / AB are real direct-child PIXI.Text", () => {
    assert(labels(first).map(label => label.text).join(" / ") === "VU / RS / AB", "Wrong codes");
    assert(icons(first).map(icon => icon.affinityElement).join() === "physical,fire,ice", "Wrong icons");
    assert(labels(first).every(label => label instanceof PIXI.Text && label.parent === first), "Labels are not direct children");
  });
  await check("repeat drawing does not duplicate icons or labels", () => {
    Hooks.callAll("drawToken", first); assert(labels(first).length === 3 && icons(first).length === 3, "Duplicate children");
  });
  await check("the affinity code sits next to artwork, excluding icon effect padding", () => {
    const sprite = icons(first).find(icon => icon.affinityElement === "fire");
    const iconBounds = boundsInToken(sprite, first), labelBounds = boundsInToken(code(first,"fire"), first);
    near(labelBounds.x - (iconBounds.x + 4 + 20), 1, "Icon-to-code gap");
  });
  await check("element word spacing changes pair spacing without resizing fonts", async () => {
    game.settings.set(MODULE_ID,"elementSpacing",0); await settle(()=>ready(first));
    const condensed = bounds(first).width;
    game.settings.set(MODULE_ID,"elementSpacing",12); await settle(()=>ready(first));
    near(bounds(first).width-condensed,24,"Two word gaps");
    assert(code(first,"fire").style.fontSize===16,"Font size changed");
    game.settings.set(MODULE_ID,"elementSpacing",3); await settle(()=>ready(first));
  });
  await check("all nine affinities stay on one line by default; wrapping is optional", async () => {
    const saved = Object.fromEntries(ELEMENTS.map(([key])=>[key,first.actor.system.affinities[key].current]));
    for(const [key] of ELEMENTS)first.actor.system.affinities[key].current=1;
    Hooks.callAll("updateActor",first.actor);await settle(()=>labels(first).length===9&&ready(first));
    assert(new Set(labels(first).map(label=>label.y)).size===1,"Default line wrapped");
    game.settings.set(MODULE_ID,"wrapElements",true);await settle(()=>ready(first));
    assert(new Set(labels(first).map(label=>label.y)).size>1,"Optional wrap did not apply");
    game.settings.set(MODULE_ID,"wrapElements",false);
    for(const [key,value]of Object.entries(saved))first.actor.system.affinities[key].current=value;
    Hooks.callAll("updateActor",first.actor);await settle(()=>labels(first).length===3&&ready(first));
  });
  await check("actual icon-and-text plate boundary is below the core nameplate", () => {
    const b = boundsInToken(first.nameplate, first), sub = bounds(first);
    near(sub.y, b.y+b.height+4, "Vertical gap"); near(sub.x+sub.width/2, b.x+b.width/2, "Center");
  });
  await check("external custom stacks are measured instead of hidden core text", () => {
    const b = boundsInToken(custom.nameplates[1], custom), sub = bounds(custom); near(sub.y, b.y+b.height+4, "Custom gap");
  });
  await check("Never Displayed token names do not hide affinities", async () => {
    first.nameplate.visible = false; Hooks.callAll("refreshToken", first);
    await settle(() => ready(first));
    near(bounds(first).y, first.h + 4, "No-nameplate bottom edge");
    first.nameplate.visible = true; Hooks.callAll("refreshToken", first);
  });
  await check("top-only names preserve the user's chosen bottom or top side", async () => {
    const saved = custom.nameplates.map(plate => ({ y: plate.y, direction: plate.nameplatePosition }));
    custom.nameplates.forEach((plate, index) => { plate.nameplatePosition = "top"; plate.y = -70 + index * 28; });
    game.settings.set(MODULE_ID, "placement", "belowNameplates");
    await settle(() => ready(custom)); near(bounds(custom).y, custom.h + 4, "Bottom must not follow top names");
    game.settings.set(MODULE_ID, "placement", "aboveNameplates");
    await settle(() => ready(custom));
    const top = unionBounds(custom.nameplates.map(plate => boundsInToken(plate, custom)));
    near(bounds(custom).y + bounds(custom).height, top.y - 4, "Top stack boundary");
    custom.nameplates.forEach((plate, index) => { plate.y = saved[index].y; plate.nameplatePosition = saved[index].direction; });
    game.settings.set(MODULE_ID, "placement", "belowNameplates");
    await settle(() => ready(first) && ready(custom));
  });
  await check("Bar Brawl outer bars reserve their full extent and track visibility/redraws",async()=>{
    first.bars=first.addChild(new PIXI.Container());
    const bar=first.bars.addChild(new PIXI.Container());bar.name="hp";
    bar.addChild(new PIXI.Graphics().beginFill(0xE85D68).drawRect(0,0,100,14).endFill());bar.position.set(0,155);
    first.document.flags.barbrawl={resourceBars:{hp:{position:"bottom-outer"}}};
    await settle(()=>bounds(first).y>=173);
    near(bounds(first).y,173,"Bottom bar boundary");
    bar.visible=false;await settle(()=>bounds(first).y<155);assert(ready(first),"Hidden bar hid affinities");
    bar.visible=true;bar.y=185;await settle(()=>bounds(first).y>=203);near(bounds(first).y,203,"Moved bar boundary");
    first.bars.removeChild(bar);bar.destroy({children:true});delete first.document.flags.barbrawl;
    await settle(()=>bounds(first).y<155);
  });
  await check("small negative padding moves up smoothly after nameplate/bar clearance",async()=>{
    first.nameplate.visible=false;
    const bar=first.bars.addChild(new PIXI.Container());bar.name="hp";bar.position.set(0,155);
    bar.addChild(new PIXI.Graphics().beginFill(0xE85D68).drawRect(0,0,100,14).endFill());
    first.document.flags.barbrawl={resourceBars:{hp:{position:"bottom-outer"}}};
    Hooks.callAll("refreshToken",first);await settle(()=>ready(first)&&bounds(first).y>=173);
    const baseline=bounds(first).y;
    for(const padding of [-0.5,-1,-2,-3,-8]){
      game.settings.set(MODULE_ID,"paddingY",padding);await settle(()=>ready(first));
      near(bounds(first).y,baseline+padding,"Small signed offset");
    }
    game.settings.set(MODULE_ID,"paddingY",0);
    first.bars.removeChild(bar);bar.destroy({children:true});delete first.document.flags.barbrawl;
    first.nameplate.visible=true;Hooks.callAll("refreshToken",first);await settle(()=>ready(first));
  });
  await check("clearance can be reduced to two or zero pixels without shadow padding",async()=>{
    first.nameplate.visible=false;
    const bar=first.bars.addChild(new PIXI.Container());bar.name="hp";bar.position.set(0,155);
    bar.addChild(new PIXI.Graphics().beginFill(0xE85D68).drawRect(0,0,100,14).endFill());
    first.document.flags.barbrawl={resourceBars:{hp:{position:"bottom-outer"}}};
    for(const gap of [2,0]){
      game.settings.set(MODULE_ID,"spacing",gap);await settle(()=>ready(first));
      near(bounds(first).y,169+gap,"Content-to-bar gap");
    }
    first.bars.removeChild(bar);bar.destroy({children:true});delete first.document.flags.barbrawl;
    first.nameplate.visible=true;game.settings.set(MODULE_ID,"spacing",4);await settle(()=>ready(first));
  });
  await check("top and rotated side Bar Brawl bars are avoided on the selected side",async()=>{
    first.nameplate.visible=false;
    const bar=first.bars.addChild(new PIXI.Container());bar.name="hp";
    bar.addChild(new PIXI.Graphics().beginFill(0x6CB3FF).drawRect(0,0,100,14).endFill());
    for(const [direction,placement,x,y,angle]of [["top","aboveToken",0,-45,0],["left","leftToken",-35,100,-Math.PI/2],["right","rightToken",135,0,Math.PI/2]]){
      bar.position.set(x,y);bar.rotation=angle;first.document.flags.barbrawl={resourceBars:{hp:{position:`${direction}-outer`}}};
      game.settings.set(MODULE_ID,"placement",placement);await settle(()=>ready(first));
      const b=boundsInToken(bar,first),a=bounds(first);
      if(direction==="top")near(a.y+a.height,b.y-4,"Top bar gap");
      if(direction==="left")near(a.x+a.width,b.x-4,"Left bar gap");
      if(direction==="right")near(a.x,b.x+b.width+4,"Right bar gap");
    }
    first.bars.removeChild(bar);bar.destroy({children:true});delete first.document.flags.barbrawl;
    first.nameplate.visible=true;game.settings.set(MODULE_ID,"placement","belowNameplates");await settle(()=>ready(first));
  });
  await check("settings render in four fieldsets after lazy category insertion without replacing controls", async () => {
    const config = {}, form = document.createElement("form");
    Hooks.callAll("renderSettingsConfig", config, form);
    const original = new Map();
    const other = document.createElement("div"); other.className = "form-group";
    other.innerHTML = '<input name="other-module.option" value="untouched">'; form.appendChild(other);
    for (const [key, definition] of Object.entries(settingDefinitions())) {
      const row = document.createElement("div"); row.className = "form-group";
      const input = row.appendChild(document.createElement("input")); input.name = `${MODULE_ID}.${key}`;
      input.type = definition.type === Number ? definition.range ? "range" : "number" : definition.type === Boolean ? "checkbox" : "text";
      input.value = String(definition.default); original.set(key, input); form.appendChild(row);
    }
    await settle(() => form.querySelectorAll("fieldset").length === 4);
    assert([...form.querySelectorAll("legend")].map(item => item.textContent).join() === "Font,Drop Shadow,Outline,Positioning", "Wrong section order");
    for (const [key, input] of original) assert(form.querySelector(`[name="${MODULE_ID}.${key}"]`) === input, "Control was replaced");
    assert(original.get("paddingX").type === "number" && original.get("paddingY").step === "any", "Padding is not a numeric field");
    original.get("paddingX").value = "-350.75"; original.get("paddingY").value = "920.5";
    const data = new FormData(form);
    assert(data.get(`${MODULE_ID}.paddingX`) === "-350.75" && data.get(`${MODULE_ID}.paddingY`) === "920.5", "Padding values were lost");
    Hooks.callAll("renderSettingsConfig", config, form);
    assert(form.querySelectorAll("fieldset").length === 4 && other.parentElement === form, "Duplicate groups or other module affected");
    Hooks.callAll("closeSettingsConfig", config);
  });
  await check("per-token visibility flag hides one token without hiding other labels", () => {
    assert(!labels(hidden).length && ready(first), "Token flag not respected");
  });
  await check("Token Configuration checkbox is named, saved as a flag, and not duplicated", () => {
    const form = document.createElement("form"); form.innerHTML = '<div class="tab" data-tab="identity"></div>';
    const config = { id: "test-token", token: first.document, document: first.document };
    Hooks.callAll("renderTokenConfig", config, form); Hooks.callAll("renderTokenConfig", config, form);
    const input = form.querySelector(`input[name="flags.${MODULE_ID}.enabled"]`);
    assert(input?.checked && !input.disabled && form.querySelectorAll("input").length === 10, "Checkbox injection failed");
    input.checked = false;
    first.document.flags[MODULE_ID] = { enabled: input.checked }; Hooks.callAll("updateToken", first.document);
    assert(!labels(first).length && ready(custom), "Saved flag did not update only this token");
    first.document.flags[MODULE_ID].enabled = true; Hooks.callAll("updateToken", first.document);
  });
  await settle(() => ready(first));
  await check("GM can reveal one element, clear all, and restore all selections", async () => {
    const form = document.createElement("form");
    Hooks.callAll("renderTokenConfig", { token:first.document }, form);
    const buttons = [...form.querySelectorAll("button")];
    buttons.find(button => button.textContent === "Clear All").click();
    const fire = form.querySelector(`input[name="flags.${MODULE_ID}.revealedElements.fire"]`);
    fire.checked = true;
    first.document.flags[MODULE_ID].revealedElements = Object.fromEntries(ELEMENTS.map(([key]) => [key, form.querySelector(`input[name="flags.${MODULE_ID}.revealedElements.${key}"]`).checked]));
    Hooks.callAll("updateToken",first.document);
    await settle(() => ready(first));
    assert(labels(first).length === 1 && code(first,"fire"), "Selection leaked another element");
    buttons.find(button => button.textContent === "Select All").click();
    assert([...form.querySelectorAll('input[name*="revealedElements"]')].every(input => input.checked), "Select All missed elements");
    delete first.document.flags[MODULE_ID].revealedElements; Hooks.callAll("updateToken",first.document);
    await settle(() => ready(first) && labels(first).length === 3);
  });
  await check("unconfigured prototype controls enable the plate with no selected elements", () => {
    const form = document.createElement("form");
    Hooks.callAll("renderPrototypeTokenConfig", { isPrototype:true, token:{flags:{}}, actor:{canUserModify:()=>true} }, form);
    assert(form.querySelectorAll("input").length === 10 && form.querySelector(`input[name="flags.${MODULE_ID}.enabled"]`).checked && ![...form.querySelectorAll('input[name*="revealedElements"]')].some(input=>input.checked), "Unsafe prototype defaults");
  });
  await check("reveal controls use full element names without translations", () => {
    const form = document.createElement("form");
    Hooks.callAll("renderTokenConfig", {token:first.document}, form);
    const names=[...form.querySelectorAll('input[name*="revealedElements"]')].map(input=>input.parentElement.textContent.trim());
    assert(names.join() === "Physical,Air,Bolt,Dark,Earth,Fire,Ice,Light,Poison", "Element labels are abbreviated: " + names.join());
  });
  await check("Prototype Token configuration reads its own flag and actor edit permission", () => {
    const form = document.createElement("form");
    const prototype = { flags: { [MODULE_ID]: { enabled: false } } };
    Hooks.callAll("renderPrototypeTokenConfig", { id: "prototype", isPrototype: true, token: prototype, document: first.actor,
      actor: { canUserModify: () => true } }, form);
    const input = form.querySelector("input"); assert(input && !input.checked && !input.disabled, "Wrong prototype flag or permission");
  });
  await check("updateActor changes codes immediately and queries active tokens without drawing", () => {
    first.actor.system.affinities.fire.current = 2; Hooks.callAll("updateActor", first.actor, { "system.affinities.fire.base": 2 });
    assert(code(first,"fire").text === "IM" && first.actor.calls > 0, "Live update missed");
  });
  await check("all styling options are shared world settings and colors/fonts change immediately", () => {
    const styles=Object.keys(settingDefinitions()).map(key=>definitions.get(`${MODULE_ID}.${key}`));
    assert(styles.length === Object.keys(settingDefinitions()).length && styles.every(s => s.scope === "world"&&s.config), "Invalid settings");
    game.settings.set(MODULE_ID,"fontSize",22); game.settings.set(MODULE_ID,"fontFamily","Georgia"); game.settings.set(MODULE_ID,"textColor","#95E8BD");
    assert(code(first,"fire").style.fontSize === 22 && code(first,"fire").style.fontFamily === "Georgia", "Font unchanged");
    assert(new PIXI.Color(code(first,"fire").style.fill).toNumber() === 0x95E8BD,"Color unchanged");
  });
  await settle(() => ready(first) && ready(custom));
  await check("text opacity affects both icons and codes", () => {
    game.settings.set(MODULE_ID,"textOpacity",55); assert(objects(first).every(object => object.alpha === 0.55),"Opacity missed");
    game.settings.set(MODULE_ID,"textOpacity",100);
  });
  await check("outline has independent alpha, thickness, and disposition color", () => {
    game.settings.set(MODULE_ID,"outlineUseDisposition",true); game.settings.set(MODULE_ID,"outlineThickness",5); game.settings.set(MODULE_ID,"outlineTransparency",35);
    const stroke = new PIXI.Color(code(first,"fire").style.stroke);
    assert(stroke.toNumber() === 0xE85D68 && Math.abs(stroke.alpha-0.65)<0.01 && code(first,"fire").style.strokeThickness === 5, "Outline missed");
    first.document.disposition = 1; Hooks.callAll("updateToken", first.document);
    assert(new PIXI.Color(code(first,"fire").style.stroke).toNumber() === 0x6CB3FF,"Disposition did not update");
  });
  await check("drop shadow accepts enable, color, distance, degrees, and transparency", () => {
    for (const [key,value] of Object.entries({ shadowEnabled:true,shadowColor:"#101010",shadowDistance:5,shadowAngle:90,shadowTransparency:25 })) game.settings.set(MODULE_ID,key,value);
    const style = code(first,"fire").style;
    assert(style.dropShadow && style.dropShadowDistance === 5 && style.dropShadowAlpha === 0.75,"Shadow settings missed");
    near(style.dropShadowAngle,Math.PI/2,"Angle conversion");
  });
  await settle(() => ready(first) && ready(custom));
  await check("PNG icon outline transparency is actually present in rendered pixels", async () => {
    const source = await PIXI.Assets.load(iconURL("fire"));
    const result = renderIcon(source,normalizeSettings({ fontSize:24, outlineEnabled:true, outlineColor:"#FF00FF", outlineThickness:6, outlineTransparency:50,shadowEnabled:false }),"#FF00FF");
    const image = result.texture.baseTexture.resource.source;
    const data = image.getContext("2d").getImageData(0,0,image.width,image.height).data;
    let count=0; for(let i=0;i<data.length;i+=4) if(data[i]>240 && data[i+1]<10 && data[i+2]>240 && data[i+3]>50 && data[i+3]<200) count++;
    assert(count>0,"No translucent magenta outline pixels"); result.texture.destroy(true);
  });
  await check("PNG icon shadows honor their independent color and transparency", async () => {
    const source = await PIXI.Assets.load(iconURL("fire"));
    const result = renderIcon(source,normalizeSettings({fontSize:24,outlineEnabled:false,shadowEnabled:true,shadowColor:"#00FFFF",shadowDistance:9,shadowAngle:0,shadowTransparency:50}),"#000000");
    const image=result.texture.baseTexture.resource.source,data=image.getContext("2d").getImageData(0,0,image.width,image.height).data;
    let count=0; for(let i=0;i<data.length;i+=4) if(data[i]<10 && data[i+1]>240 && data[i+2]>240 && data[i+3]>50 && data[i+3]<200) count++;
    assert(count>0,"No translucent cyan shadow pixels"); result.texture.destroy(true);
  });
  await check("shadow blur softens real icon pixels and updates text shadow style", async () => {
    game.settings.set(MODULE_ID, "shadowBlur", 6);
    assert(code(first, "fire").style.dropShadowBlur === 6, "Text shadow blur not applied");
    const source = await PIXI.Assets.load(iconURL("fire"));
    function cyanPixels(blur) {
      const result = renderIcon(source, normalizeSettings({ fontSize:24, outlineEnabled:false, shadowEnabled:true, shadowColor:"#00FFFF", shadowDistance:9, shadowAngle:0, shadowTransparency:0, shadowBlur:blur }), "#000000");
      const image = result.texture.baseTexture.resource.source, data = image.getContext("2d").getImageData(0,0,image.width,image.height).data;
      let count = 0; for (let i=0;i<data.length;i+=4) if (data[i]<10 && data[i+1]>230 && data[i+2]>230 && data[i+3]>0 && data[i+3]<240) count++;
      result.texture.destroy(true); return count;
    }
    assert(cyanPixels(6) > cyanPixels(0), "Blur did not spread the shadow into softer pixels");
    await settle(() => ready(first) && ready(custom));
  });
  await check("increasing blur preserves glyph pixels and artwork position beside bars",async()=>{
    const keys=["shadowEnabled","shadowBlur","textColor","outlineEnabled"];
    const saved=Object.fromEntries(keys.map(key=>[key,game.settings.get(MODULE_ID,key)]));
    first.nameplate.visible=false;
    const bar=first.bars.addChild(new PIXI.Container());bar.name="hp";bar.position.set(0,155);
    bar.addChild(new PIXI.Graphics().beginFill(0xE85D68).drawRect(0,0,100,14).endFill());
    first.document.flags.barbrawl={resourceBars:{hp:{position:"bottom-outer"}}};
    for(const[key,value]of Object.entries({shadowEnabled:true,shadowBlur:0,textColor:"#00FF00",outlineEnabled:false}))game.settings.set(MODULE_ID,key,value);
    await settle(()=>ready(first));
    function greenGlyphOrigin(){
      const label=code(first,"fire"),image=label.canvas,data=image.getContext("2d").getImageData(0,0,image.width,image.height).data;
      let x=Infinity,y=Infinity;
      for(let i=0;i<data.length;i+=4)if(data[i]<10&&data[i+1]>240&&data[i+2]<10&&data[i+3]>200){x=Math.min(x,(i/4)%image.width);y=Math.min(y,Math.floor((i/4)/image.width));}
      assert(Number.isFinite(x),"No glyph fill pixels found");
      return{x:label.x+(label.texture.trim?.x??0)+x/label.resolution,y:label.y+(label.texture.trim?.y??0)+y/label.resolution};
    }
    const before=bounds(first),glyph=greenGlyphOrigin();
    const oldWidth=icons(first)[0].texture.width;
    for(const blur of [3,12,24]){
      game.settings.set(MODULE_ID,"shadowBlur",blur);await settle(()=>ready(first));
      const after=bounds(first),ink=greenGlyphOrigin();
      for(const key of["x","y","width","height"])near(after[key],before[key],"Blur changed content "+key);
      near(ink.x,glyph.x,"Glyph fill X");near(ink.y,glyph.y,"Glyph fill Y");
    }
    assert(icons(first)[0].texture.width>oldWidth,"Effect texture did not retain blur margins");
    first.bars.removeChild(bar);bar.destroy({children:true});delete first.document.flags.barbrawl;
    first.nameplate.visible=true;for(const[key,value]of Object.entries(saved))game.settings.set(MODULE_ID,key,value);
    await settle(()=>ready(first)&&ready(custom));
  });
  await check("top/left/right token sections and signed padding place the full plate correctly", async () => {
    // Isolate the anchor math from collision avoidance: a blurred, taller plate
    // can legitimately clear a long name by moving farther out on the same side.
    first.nameplate.visible = false;
    for(const placement of ["aboveToken","leftToken","rightToken"]){
      game.settings.set(MODULE_ID,"placement",placement); await settle(()=>ready(first));
      const b=bounds(first);
      if(placement==="aboveToken") near(b.y+b.height,-4,"Top edge");
      if(placement==="leftToken") near(b.x+b.width,-4,"Left edge");
      if(placement==="rightToken") near(b.x,104,"Right edge");
    }
    game.settings.set(MODULE_ID,"paddingX",12); game.settings.set(MODULE_ID,"paddingY",-8); await settle(()=>ready(first));
    near(bounds(first).x,116,"Horizontal padding");
    first.nameplate.visible = true;
    game.settings.set(MODULE_ID,"paddingX",0); game.settings.set(MODULE_ID,"paddingY",0); game.settings.set(MODULE_ID,"placement","belowNameplates");
  });
  await settle(()=>ready(first)&&ready(custom));
  await check("ActorDelta and embedded effect/item hooks refresh prepared values",()=>{
    first.actor.system.affinities.ice.current=2; Hooks.callAll("updateActorDelta",{parent:first.document}); assert(code(first,"ice").text==="IM","Delta missed");
    first.actor.system.affinities.fire.current=3; Hooks.callAll("updateActiveEffect",{parent:{documentName:"Item",parent:first.actor}}); assert(code(first,"fire").text==="AB","Effect missed");
    first.actor.system.affinities.fire.current=1; Hooks.callAll("deleteItem",{parent:first.actor}); assert(code(first,"fire").text==="RS","Item missed");
  });
  const oldY=bounds(custom).y; external.y+=15; custom.nameplates[1].text="Second nameplate\nwith another line";
  await settle(()=>bounds(custom).y>oldY+15);
  await check("geometry watcher follows externally parented multiline labels",()=>assert(bounds(custom).y>oldY+15,"Watcher missed change"));
  await check("zoom preserves token-local spacing",()=>{
    app.stage.scale.set(0.8);app.stage.position.set(10,10);Hooks.callAll("refreshToken",first);
    const b=boundsInToken(first.nameplate,first);near(bounds(first).y,b.y+b.height+4,"Zoom gap");
    app.stage.scale.set(1);app.stage.position.set(0);api.refresh();
  });
  await check("GM reveal renders to players without actor ownership or Study information",async()=>{
    await settle(()=>game.settings.get(MODULE_ID,"gmReveals")?.[first.document.uuid]?.enabled===true);
    const actor=first.actor;first.actor=undefined;
    game.user={id:"player",isGM:false};Hooks.callAll("updateUser",game.user);
    await settle(()=>ready(first));
    assert(code(first,"fire").text==="RS","Player did not receive GM affinity codes");
    assert(Object.keys(game.settings.get(MODULE_ID,"gmReveals")[first.document.uuid]).sort().join()==="elements,enabled,entries","Unrelated actor data published");
    first.actor=actor;game.user={id:"gm",isGM:true};Hooks.callAll("updateUser",game.user);
  });
  await check("players have no token/prototype reveal controls or module customization fields",async()=>{
    game.user={id:"player",isGM:false};Hooks.callAll("updateUser",game.user);
    for(const prototype of[false,true]){
      const form=document.createElement("form");
      Hooks.callAll(prototype?"renderPrototypeTokenConfig":"renderTokenConfig",{token:first.document,isPrototype:prototype,actor:first.actor},form);
      assert(!form.querySelector("input"),"Player has a reveal checkbox: "+JSON.stringify({user:game.user,prototype,html:form.innerHTML}));
    }
    assert(Object.keys(settingDefinitions()).every(key=>!definitions.get(`${MODULE_ID}.${key}`).config),"Player configuration exposed");
    const form=document.createElement("form");form.innerHTML=`<div class="form-group"><input name="${MODULE_ID}.fontSize"></div><div class="form-group"><input name="other.option"></div>`;
    const config={};Hooks.callAll("renderSettingsConfig",config,form);
    assert(!form.querySelector(`[name="${MODULE_ID}.fontSize"]`)&&form.querySelector('[name="other.option"]'),"Player settings not hidden correctly");
    Hooks.callAll("closeSettingsConfig",config);
    assert(Hooks.call("preUpdateToken",hidden.document,{[`flags.${MODULE_ID}.enabled`]:true})===false,"Player reveal edit accepted");
    assert(Hooks.call("preUpdateActor",{prototypeToken:hidden.document},{prototypeToken:{flags:{[MODULE_ID]:{enabled:true}}}})===false,"Player prototype edit accepted");
    let denied=false;try{await game.settings.set(MODULE_ID,"fontSize",40);}catch{denied=true;}assert(denied,"Player world style write allowed");
    game.user={id:"gm",isGM:true};Hooks.callAll("updateUser",game.user);
  });
  await check("GM world styles and reveal revocation propagate to the player renderer",async()=>{
    const oldFont=game.settings.get(MODULE_ID,"fontSize");
    game.user={id:"player",isGM:false};Hooks.callAll("updateUser",game.user);
    function receiveFromGM(key,value){values.set(`${MODULE_ID}.${key}`,value);definitions.get(`${MODULE_ID}.${key}`)?.onChange?.(value);}
    receiveFromGM("fontSize",26);await settle(()=>ready(first));assert(code(first,"fire").style.fontSize===26,"Player did not apply shared style");
    const records=game.settings.get(MODULE_ID,"gmReveals"),snapshot=records[first.document.uuid];
    receiveFromGM("gmReveals",{...records,[first.document.uuid]:{enabled:false,entries:[]}});
    assert(!labels(first).length,"GM revocation did not clear player label");
    receiveFromGM("gmReveals",{...records,[first.document.uuid]:snapshot});receiveFromGM("fontSize",oldFont);
    await settle(()=>ready(first));game.user={id:"gm",isGM:true};Hooks.callAll("updateUser",game.user);
  });
  await settle(()=>ready(first)&&ready(custom));
  await check("teardown releases owned text, sprites, and the watcher",()=>{
    Hooks.callAll("canvasTearDown",canvas);assert(!objects(first).length&&!first.nameplate.destroyed,"Cleanup failed");
    assert(api.diagnostics().trackedTokens===0&&!api.diagnostics().watchingNameplates,"Watcher leaked");
  });
  Hooks.callAll("canvasInit",canvas);Hooks.callAll("canvasReady",canvas);await settle(()=>ready(first)&&ready(custom));
  await check("new canvas lifecycle recreates icons and respects hidden-token flags",()=>assert(ready(first)&&!labels(hidden).length,"Scene recreation failed"));
  summary.textContent=`${passed} passed, ${failed} failed · PIXI ${PIXI.VERSION}`;summary.className=failed?"fail":"pass";
}catch(error){report("Harness initialization",error);summary.textContent=`${passed} passed, ${failed} failed`;summary.className="fail";}
