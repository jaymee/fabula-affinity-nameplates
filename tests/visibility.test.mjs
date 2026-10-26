import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { tokenVisible } from "../scripts/visibility.mjs";
import { tokenEnabled } from "../scripts/token-config.mjs";
import { GMRevealPublisher, configuredEnabled, publishedEntries, guardRevealUpdate, REVEALS_SETTING } from "../scripts/gm-reveals.mjs";
import { migrateWorldStyles, registerSettings, settingDefinitions } from "../scripts/settings.mjs";
import { MODULE_ID } from "../scripts/constants.mjs";

let values, writes, definitions;
const key = 'Scene.scene.Token.token';
function document() {
  return { id:'token', uuid:key, parent:{id:'scene'}, actorId:'enemy', flags:{[MODULE_ID]:{enabled:true}},
    actor:{ type:'npc', system:{affinities:{ fire:{current:1}, physical:{current:-1} }} } };
}
beforeEach(() => {
  values = new Map([[REVEALS_SETTING,{}]]); writes=[]; definitions=new Map();
  globalThis.game={user:{id:'gm',isGM:true},users:{activeGM:{id:'gm'}},settings:{
    get:(_id,k)=>values.has(k)?values.get(k):definitions.get(k)?.default,
    set:async(_id,k,v)=>{if(!game.user.isGM)throw new Error('GM only');values.set(k,v);writes.push(k);return v;},
    register:(_id,k,definition)=>definitions.set(k,definition)
  }};
});
afterEach(()=>{delete globalThis.game;});

test('GM Show Affinities publishes only affinity codes for every player',async()=>{
  const doc=document(),publisher=new GMRevealPublisher();
  publisher.queue(doc,{visibility:true});await publisher.flush();
  game.user={id:'player',isGM:false};
  assert.equal(tokenEnabled(doc),true);
  assert.deepEqual(publishedEntries(doc),[{element:'physical',code:'VU'},{element:'fire',code:'RS'}]);
  assert.deepEqual(Object.keys(values.get(REVEALS_SETTING)[key]).sort(),['elements','enabled','entries']);
});
test('published affinities work without access to the actor or a Party/Study profile',()=>{
  values.set(REVEALS_SETTING,{[key]:{enabled:true,entries:[{element:'fire',code:'AB'}]}});
  game.user={id:'player',isGM:false};const doc={uuid:key,flags:{}};
  assert.equal(tokenEnabled(doc),true);assert.deepEqual(publishedEntries(doc),[{element:'fire',code:'AB'}]);
});
test('owned token flags cannot self-reveal without a GM-published reveal',()=>{
  game.user={id:'player',isGM:false};const doc=document();
  assert.equal(configuredEnabled(doc),true);assert.equal(tokenEnabled(doc),false);
  assert.deepEqual(publishedEntries(doc),[]);
});
test('players cannot change reveal flags or prototype defaults through normal updates',()=>{
  game.user={id:'player',isGM:false};const doc=document();doc.flags[MODULE_ID].enabled=false;
  assert.equal(guardRevealUpdate(doc,{['flags.'+MODULE_ID+'.enabled']:true}),false);
  assert.equal(guardRevealUpdate({prototypeToken:doc},{prototypeToken:{flags:{[MODULE_ID]:{enabled:true}}}},true),false);
  assert.equal(guardRevealUpdate(doc,{['flags.-='+MODULE_ID]:null}),false);
  assert.equal(guardRevealUpdate(doc,{x:250}),undefined);
  game.user.isGM=true;assert.equal(guardRevealUpdate(doc,{['flags.'+MODULE_ID+'.enabled']:true}),undefined);
});
test('non-GM flag changes do not grant authority through the GM publisher',async()=>{
  values.set(REVEALS_SETTING,{[key]:{enabled:false,entries:[]}});
  const doc=document(),publisher=new GMRevealPublisher();publisher.queue(doc);await publisher.flush();
  assert.deepEqual(values.get(REVEALS_SETTING)[key],{enabled:false,entries:[]});
});
test('GM revocation removes published data and hidden tokens publish no values',async()=>{
  const doc=document(),publisher=new GMRevealPublisher();publisher.queue(doc,{visibility:true});await publisher.flush();
  doc.flags[MODULE_ID].enabled=false;publisher.queue(doc,{visibility:true});await publisher.flush();
  assert.deepEqual(values.get(REVEALS_SETTING)[key],{enabled:false,entries:[]});
  doc.flags[MODULE_ID].enabled=true;doc.hidden=true;publisher.queue(doc,{visibility:true});await publisher.flush();
  assert.deepEqual(values.get(REVEALS_SETTING)[key],{enabled:false,entries:[]});
});
test('live prepared affinities synchronize and unchanged values do not cause writes',async()=>{
  const doc=document(),publisher=new GMRevealPublisher();publisher.queue(doc,{visibility:true});await publisher.flush();
  const initial=writes.length;publisher.queue(doc);await publisher.flush();assert.equal(writes.length,initial);
  doc.actor.system.affinities.fire.current=3;publisher.queue(doc);await publisher.flush();
  assert.equal(values.get(REVEALS_SETTING)[key].entries[1].code,'AB');
});
test('deleted tokens are removed, coalesced writes preserve other token records',async()=>{
  const first=document(),second={...document(),id:'second',uuid:'Scene.scene.Token.second'};
  const publisher=new GMRevealPublisher();publisher.queue(first,{visibility:true});publisher.queue(second,{visibility:true});await publisher.flush();
  assert.equal(Object.keys(values.get(REVEALS_SETTING)).length,2);
  publisher.remove(first);await publisher.flush();assert.deepEqual(Object.keys(values.get(REVEALS_SETTING)),[second.uuid]);
});
test('players and secondary GMs do not run automatic world publishing',async()=>{
  const publisher=new GMRevealPublisher();game.user={id:'player',isGM:false};publisher.queue(document(),{visibility:true});await publisher.flush();assert.equal(writes.length,0);
  game.user={id:'other-gm',isGM:true};publisher.queue(document(),{visibility:true});await publisher.flush();assert.equal(writes.length,0);
});
test('new scene bootstrap preserves existing enabled flags without publishing hidden values',async()=>{
  const doc=document(),hidden={...document(),id:'hidden',uuid:'Scene.scene.Token.hidden',hidden:true};
  const publisher=new GMRevealPublisher();publisher.queueScene({active:true,tokens:[doc,hidden]});await publisher.flush();
  assert.equal(values.get(REVEALS_SETTING)[key].enabled,true);
  assert.deepEqual(values.get(REVEALS_SETTING)[hidden.uuid],{enabled:false,entries:[]});
});
test('style settings are world-scoped and not shown on player clients',()=>{
  game.user.isGM=false;registerSettings(()=>{});
  for(const key of Object.keys(settingDefinitions())){assert.equal(definitions.get(key).scope,'world');assert.equal(definitions.get(key).config,false);}
});
test('first GM migrates old local styles once, without overwriting existing world values',async()=>{
  const client=new Map([[MODULE_ID+'.fontSize','25'],[MODULE_ID+'.fontFamily','"Arial"'],[MODULE_ID+'.paddingY','-3']]);
  const world=new Map([[MODULE_ID+'.textColor','#ABCDEF']]);
  game.settings.storage=new Map([['client',{getItem:k=>client.get(k)??null}],['world',world]]);
  registerSettings(()=>{});await migrateWorldStyles();
  assert.equal(values.get('fontSize'),25);assert.equal(values.get('fontFamily'),'Arial');assert.equal(values.get('paddingY'),-3);
  assert.equal(writes.includes('textColor'),false);assert.equal(values.get('worldStyleVersion'),1);
  const count=writes.length;await migrateWorldStyles();assert.equal(writes.length,count);
});
test('player style writes are rejected by the world store in the client harness',async()=>{
  game.user.isGM=false;await assert.rejects(game.settings.set(MODULE_ID,'fontSize',30),/GM only/);
});
test('hidden and invisible tokens remain invisible to players after revelation',()=>{
  const token={parent:{},visible:true,isVisible:true,document:{hidden:true}};
  assert.equal(tokenVisible(token,{isGM:false}),false);assert.equal(tokenVisible(token,{isGM:true}),true);
  token.parent.visible=false;assert.equal(tokenVisible(token,{isGM:true}),false);
});

test('unconfigured tokens and prototypes publish no affinities by default',async()=>{
  const doc=document();doc.flags={};assert.equal(configuredEnabled(doc),false);
  const publisher=new GMRevealPublisher();publisher.queueScene({active:true,tokens:[doc]});await publisher.flush();
  assert.deepEqual(values.get(REVEALS_SETTING)[key],{enabled:false,entries:[]});
});
test('only selected elements publish, including later changes from neutral',async()=>{
  const doc=document();doc.flags[MODULE_ID].revealedElements={fire:true,ice:true};
  const publisher=new GMRevealPublisher();publisher.queue(doc,{visibility:true});await publisher.flush();
  assert.deepEqual(publishedEntries(doc),[{element:'fire',code:'RS'}]);
  doc.actor.system.affinities.ice={current:2};publisher.queue(doc);await publisher.flush();
  assert.deepEqual(publishedEntries(doc),[{element:'fire',code:'RS'},{element:'ice',code:'IM'}]);
  doc.flags[MODULE_ID].revealedElements={};publisher.queue(doc,{visibility:true});await publisher.flush();
  assert.deepEqual(publishedEntries(doc),[]);
});
test('untrusted selection edits cannot broaden published choices during actor updates',async()=>{
  const doc=document();doc.flags[MODULE_ID].revealedElements={fire:true};
  const publisher=new GMRevealPublisher();publisher.queue(doc,{visibility:true});await publisher.flush();
  doc.flags[MODULE_ID].revealedElements.physical=true;
  publisher.queue(doc);await publisher.flush();assert.deepEqual(publishedEntries(doc),[{element:'fire',code:'RS'}]);
  game.user.isGM=false;
  assert.equal(guardRevealUpdate(doc,{[`flags.${MODULE_ID}.revealedElements.physical`]:true}),false);
  assert.equal(guardRevealUpdate(doc,{[`flags.${MODULE_ID}.-=revealedElements`]:null}),false);
});
test('an old default-enabled snapshot is revoked when its token was never explicitly enabled',async()=>{
  const doc=document();doc.flags={};values.set(REVEALS_SETTING,{[key]:{enabled:true,entries:[{element:'fire',code:'RS'}]}});
  const publisher=new GMRevealPublisher();publisher.queueScene({active:true,tokens:[doc]});await publisher.flush();
  assert.deepEqual(values.get(REVEALS_SETTING)[key],{enabled:false,entries:[]});
});
test('player-created tokens inherit only the GM prototype selection',async()=>{
  const doc=document(),prototype={flags:{[MODULE_ID]:{enabled:true,revealedElements:{fire:true}}}};
  const publisher=new GMRevealPublisher();publisher.queue(doc,{visibility:true,authority:prototype});await publisher.flush();
  assert.deepEqual(publishedEntries(doc),[{element:'fire',code:'RS'}]);
});
