# Version 0.4.0 selective reveal verification

- New actor Prototype Token: Show Affinities and all element checkboxes start unchecked. Place a token; confirm no player affinity display.
- GM: enable Show Affinities, Clear All, check Fire, save. Confirm only non-neutral Fire appears to GM and players who can see the token.
- Add Ice and save; hide Fire and save; verify both viewers update immediately. Select All / Clear All affect every element checkbox; saving applies changes.
- Select a currently neutral element; change its prepared affinity on the sheet and confirm it appears. Unselected element changes must stay hidden.
- Existing explicitly enabled tokens without selections keep all elements. Existing unconfigured tokens now default to hidden.
- Players cannot edit visibility or selections on owned tokens/prototypes; style controls remain GM only.
- Install from the hosted manifest, verify no missing-icon requests, then check for updates in Foundry Setup.

Automated tests cover default visibility, selection filtering, live neutral-to-affinity changes, and preventing untrusted flags from expanding published selections. Browser tests use real PIXI with a Foundry document facade; they do not exercise actual Foundry network propagation.

# Verification and Foundry acceptance checks

## Automated checks

Run `npm test` with Node 20+. Tests use an affine scene graph double to check transforms and lifecycle behavior without importing Foundry's proprietary runtime. They fail if an update calls token/canvas `draw`, exercise immediate and deferred data preparation, and cover disclosure, synthetic actors, all settings, redraw recovery, font loading, cleanup, and idle nameplate watching. These tests do not establish Foundry runtime compatibility.

`tests/browser.html` is a separate real PIXI 7.4.3 smoke harness. Serve this module folder with a static HTTP server and open `/tests/browser.html` in a browser with WebGL. It downloads PIXI from jsDelivr for testing only, drives the actual module hooks using a small Foundry document facade, and reports assertion results on the page. Its reference-token graphics are diagnostic fixtures. It does not emulate Foundry's vision, permissions, document lifecycle, system ActiveEffects, or the actual Token Nameplates mixin.

## Version 0.3.0 GM/player verification

- Upgrade with an existing GM local style. Log in as the first active GM and verify the style migrates once to world scope. Existing world values must not be overwritten. Hard-refresh both GM and player browsers.
- Connect a separate player account with no ownership of an NPC, no assigned character, and no Party/Study profile. Enable Show Affinities as GM and save; the player must see the same codes on a visible token. Disable and save; the player overlay must disappear.
- Check an owned player character and its Prototype Token configuration: no affinity visibility checkbox should be present for the player. The player must have no module styling controls. Confirm other modules' controls are unaffected.
- Change GM font, opacity, outline, shadow, spacing, and placement settings. Both canvases must update. Player preferences from older releases must not override the world style.
- Change affinities and active effects on linked and synthetic actors; compare GM and player updates. Test with the player lacking access to the actor document, hidden tokens, ownership changes, actor/token deletion, scene changes, and browser reconnects.
- Confirm the active GM alone handles automatic snapshot publishing when multiple GMs are connected. Disconnect/reconnect GMs; cached values should persist and synchronize when a GM returns.
- These automated/browser tests use role switches and a shared-world-store facade, not actual Foundry client sockets. A real GM/player world test remains required.

## Version 0.2.3 regressions

- With a visible bar or nameplate, increase shadow blur from 0 to 3, 12, and 24. Confirm main glyph pixels, icon artwork, word spacing, wrapping, and plate position remain stable; only the shadow grows/softens.
- Set Vertical Padding to -0.5, -1, -2, -3, and -8 beside bars. Each increment must translate the plate exactly, without snapping back or requiring it to bypass the bar completely. Check Horizontal Padding as well.
- Set Clearance from Names / Bars to 2 and 0; verify tight content-to-bar spacing. Deliberate manual offsets may overlap obstacles.
- Upgrade with a previously saved spacing value and confirm it survives the renamed control. An unset setting should use the new 2-pixel default.

## Version 0.2.2 regressions

- With all nine non-neutral affinities, confirm a single line by default. Set Element Word Spacing to 0, 3, and 12; verify tighter/looser gaps without font-size changes. Enable Wrap Elements and verify whole pairs wrap together.
- Enable a large shadow blur/distance and verify codes remain beside the icon artwork instead of after the transparent effect margins.
- Enable Bar Brawl alone, then alongside Token Nameplates. Check bottom/top/left/right inner and outer bars, multiple bars, bar text, offsets, image bars, rotation, hover/controlled/owner visibility, hidden parents, and zero opacity.
- Move a bar farther outside the token than the initial affinity position; affinities must move past the bar, not remain in the gap before it. Hide/delete it and confirm the plate moves back.
- Exercise asynchronous Bar Brawl redraws through actor resource and token flag changes, including while hovering and dragging. Check the crowded-scene idle benchmark for unnecessary bounds measurements.
- Record the actual installed Bar Brawl version. Source baseline is the official 1.9.0 package; browser tests use equivalent PIXI container fixtures, not a running Foundry Bar Brawl installation.

## Version 0.2.1 regressions

- Set Token Name to Never Displayed. Affinities must remain visible without any other nameplates, subject to the token flag and normal token/disclosure visibility.
- Enable top-only Token Nameplates. Choose Bottom and then Top for affinities: each selection must remain on that side, with an empty side anchored to the corresponding token edge. Repeat with bottom-only and no labels.
- In Configure Settings, confirm Font, Drop Shadow, Outline, and Positioning fieldsets. Switch categories, reopen the application, and save controls from each group. Confirm other modules' fields and form submission still work.
- Confirm padding fields are numeric, support negative and fractional values, and preserve values on save/reopen.
- Exercise shadow blur at 0, 3, and 12 for both text and supplied icons. Check soft edges, alpha, clipping, settings updates, and texture cleanup.

## Version 0.2.0 acceptance additions

- Save Show Affinities on one of two tokens for the same actor. Reopen the config and reload the scene; the hidden token must stay hidden for GM and player clients. Re-enable and verify live recovery. Test both linked and unlinked tokens.
- Save the checkbox in Prototype Token config; new tokens must inherit it while existing tokens stay unchanged. Test permission denial and customized token config sheets alongside Token Nameplates.
- Verify the supplied PNG icons for all nine elements and exact VU / AB / IM / RS codes. All-neutral tokens must remain empty.
- Exercise font family/size/color and 0/50/100% opacity. Verify outline enable/color/disposition/thickness/transparency and shadow enable/color/distance/angle/transparency on both icons and text.
- Check all eight anchors plus positive/negative horizontal and vertical padding. Verify wrapping keeps each icon/code pair together, including at font size 48.
- Change dispositions, effects, actors, and scenes repeatedly. Watch for stale styled icon textures, orphan sprites, duplicate code labels, or late asynchronous loads after deletion.

## Actual Foundry V13 matrix — requires a running world

Record Foundry build, Project FU version, Token Nameplates version, browser, and enabled modules. This matrix is not marked complete by passing the standalone tests.

1. Install into a disposable V13 Project FU world. Enable only this module initially. Check the console for load errors.
2. Create a PC and NPC. Set each of the nine affinities to each available value; verify the abbreviation and order. All neutral should show no line.
3. Place multiple linked tokens. Edit a sheet affinity with the canvas visible: all applicable labels should update immediately without flicker. Set breakpoints/spies on `Token.draw`/`canvas.draw` to confirm no forced redraw.
4. Place unlinked tokens for the same NPC. Edit one synthetic actor: siblings must retain their values. Change the base actor: dependent token overlays must read each token's effective actor.
5. Equip/unequip an affinity-granting item and add/disable/delete an ActiveEffect. Confirm effective values and rule precedence match the sheet. Repeat for effects embedded in items.
6. As GM, toggle Show Affinities on owned/unowned PCs and NPCs. Players must see GM-enabled tokens without actor access, assigned characters, or Party/Study profiles. GM-disabled and hidden tokens must stay hidden. Players must have no reveal/style controls, including on owned tokens.
7. Exercise all name display modes, hover/control transitions, hidden tokens, walls/vision, token ownership, and hidden parent containers.
8. Change each styling setting during play. Check invalid colors and absent fonts. Use both a loaded web font and a local font. Confirm no reload and correct final spacing.
9. Test multiline names, all nine affinities, token sizes/aspect ratios, zoom, movement, rotation, drag previews, scene switching, and repeated redraws.
10. Enable Token Nameplates and repeat: global, actor-type, actor, and token overrides; several bottom labels; top-only and side-only labels; custom anchors/rotation/padding/scale; hover/control/owner display; nameplate settings changed while the canvas is open; `placeAbovePlaceables` on/off. Check both geometry and the documented draw-order limitation.
11. On a representative crowded scene, compare frame time with the module on/off. Confirm idle watching does not continually measure plate bounds or generate text textures. Check memory after repeated scene switches and deletions.

## Development verification record

- Source baseline: Project FU v4.16.3, Foundry V13 public API documentation, and Token Nameplates source retrieved 2026-10-25.
- Automated Node tests: **80 passed, 0 failed** during module creation (Node 24.12.0).
- Real PIXI browser harness: **35 passed, 0 failed** with PIXI 7.4.3 in the in-app browser. This included actual text bounds, color normalization, external-parent nameplates, live actor/ActorDelta/effect/item hooks, settings, disclosure revocation, zoom, and teardown/recreation.
- Actual Foundry V13 world: not available during module creation; acceptance matrix remains open.

When reporting a problem, include diagnostics from the module API, the failing matrix step, actor linkage, nameplate settings, and whether the issue reproduces with other optional modules disabled. Avoid sharing private actor data.
