import test from "node:test";
import assert from "node:assert/strict";
import { MODULE_ID, ELEMENTS } from "../scripts/constants.mjs";
import { initializePrototype, initializeToken, prototypeEnabled } from "../scripts/defaults.mjs";
import { configuredElements, revealRecord } from "../scripts/gm-reveals.mjs";

function sourceDocument(properties = {}) {
  return Object.assign({ flags: {}, updateSource(changes) {
    for (const [path, value] of Object.entries(changes)) {
      const parts = path.split('.');let target = this;
      for (const part of parts.slice(0,-1)) target = target[part] ??= {};
      target[parts.at(-1)] = value;
    }
  } }, properties);
}
const npc = {type:'npc',system:{affinities:{physical:{current:-1},fire:{current:3}}}};

test('new actor prototypes enable the plate with all elements unchecked and reveal nothing',()=>{
  const actor = sourceDocument({prototypeToken:sourceDocument()});initializePrototype(actor);
  assert.equal(actor.prototypeToken.flags[MODULE_ID].enabled,true);
  assert.deepEqual(Object.keys(actor.prototypeToken.flags[MODULE_ID].revealedElements),ELEMENTS.map(([key])=>key));
  assert.equal(configuredElements(actor.prototypeToken).size,0);
  const token=sourceDocument({actor:{...npc,prototypeToken:actor.prototypeToken}});initializeToken(token);
  assert.equal(token.flags[MODULE_ID].enabled,true);
  assert.deepEqual(revealRecord(token),{enabled:true,entries:[],elements:[]});
});
test('unconfigured existing prototypes show enabled but select no elements when placed',()=>{
  const prototype = sourceDocument();assert.equal(prototypeEnabled(prototype),true);
  const token=sourceDocument({actor:{...npc,prototypeToken:prototype}});initializeToken(token);
  assert.equal(token.flags[MODULE_ID].enabled,true);assert.equal(configuredElements(token).size,0);
  assert.deepEqual(revealRecord(token).entries,[]);
});
test('saved prototype choices survive creation and transfer to scene tokens',()=>{
  const prototype=sourceDocument({flags:{[MODULE_ID]:{enabled:false,revealedElements:{fire:true}}}});
  const actor=sourceDocument({prototypeToken:prototype});initializePrototype(actor);
  assert.equal(prototypeEnabled(prototype),false);
  assert.deepEqual(prototype.flags[MODULE_ID].revealedElements,{fire:true});
  const token=sourceDocument({actor:{...npc,prototypeToken:prototype}});initializeToken(token);
  assert.equal(token.flags[MODULE_ID].enabled,false);assert.deepEqual([...configuredElements(token)],['fire']);
});
test('explicit token selections and enabled state override inherited defaults',()=>{
  const token=sourceDocument({flags:{[MODULE_ID]:{enabled:false,revealedElements:{ice:true}}},actor:{...npc,prototypeToken:sourceDocument()}});
  initializeToken(token);assert.equal(token.flags[MODULE_ID].enabled,false);
  assert.deepEqual(token.flags[MODULE_ID].revealedElements,{ice:true});
});
test('tokens with no actor remain hidden by default',()=>{
  const token=sourceDocument();initializeToken(token);assert.equal(token.flags[MODULE_ID].enabled,false);
  assert.equal(configuredElements(token).size,0);
});
