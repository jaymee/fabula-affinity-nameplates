# Fabula Ultima Affinity Nameplates

A Foundry VTT **Version 13** module for **Project FU** (`projectfu`), with optional Token Nameplates and Bar Brawl integration. Version **0.4.0** displays the supplied elemental icons alongside **VU**, **AB**, **IM**, or **RS**, with live updates and per-token visibility.

## Install or update

1. In Foundry's Setup screen, open **Add-on Modules → Install Module**.
2. Paste this **Manifest URL**, then install:

   `https://github.com/jaymee/fabula-affinity-nameplates/releases/latest/download/manifest.json`

3. Open a Project FU world and enable **Fabula Ultima Affinity Nameplates** in **Manage Modules**.
4. Have the GM connect first. New and unconfigured tokens/prototypes are disabled. Explicitly enabled tokens from older versions remain enabled; inspect their reveal selections before play.

For future releases, use Foundry's **Check for Updates** / **Update** controls. The stable manifest points to the latest release; each release downloads its matching versioned ZIP. The installed file remains `module.json`, as Foundry requires.

If upgrading an older local installation that has no manifest URL, close the world and replace its module files once with the latest release ZIP, or reinstall from the manifest using the same module ID. Back up your world first. World settings and token flags retain their existing keys.

## Show or hide individual tokens

As a GM, open a token's **Token Configuration**. In **Identity → Affinity Nameplate**, toggle **Show Affinities**, then save the configuration. If a customized sheet has no Identity tab, the fieldset appears in its main form.

- The checkbox is saved as `flags.fabula-affinity-nameplates.enabled` on the TokenDocument. It applies to that token for every viewer.
- Unchecking it removes that token's affinity icons and text without affecting sibling tokens for the same actor.
- Setting it in an actor's **Prototype Token** configuration controls newly created tokens; existing tokens retain their own flags.
- Reveal controls are shown only to GMs. Players do not receive the checkbox, even on owned tokens or their actor’s prototype, and normal player edits to module visibility flags are blocked.
- To reveal just one affinity: enable **Show Affinities**, click **Clear All**, check one element (for example, Fire), and save. Later, check another element and save to reveal it too. Uncheck an element to hide it again. **Select All** reveals all non-neutral affinities.
- Selections are per token and also available on Prototype Token. New/unconfigured prototypes start disabled with no selected elements. Previously explicitly enabled tokens without selections preserve their all-elements behavior until the GM changes it.
- Only selected, non-neutral affinities appear to players who can see the token, without requiring actor ownership or a Party/Study profile. Hidden tokens and tokens outside normal vision remain hidden. Neutral values produce no label, even when selected.
- These controls support the GM's manual reveal decisions; they do not automate the Study action or decide what the rules reveal.
- An absent enabled flag now means disabled. Explicitly saved prototype choices apply to newly created tokens; existing placed tokens keep their own flags.

## Shared GM customization

As a GM, use **Configure Settings → Module Settings → Fabula Ultima Affinity Nameplates**. The controls are grouped into **Font**, **Drop Shadow**, **Outline**, and **Positioning** sections. All 21 controls are **world-scope** and apply to every client. Player clients have no module customization fields. Changes update existing labels on GM and player canvases without a full redraw or reload.

| Controls | Behavior |
| --- | --- |
| Font Family, Size, Color | Style the affinity codes; icons scale with font size and retain the supplied colors |
| Element Word Spacing | Numeric gap between complete icon/code pairs; default 3 canvas pixels, zero is most condensed |
| Wrap Elements | Off by default, keeping all affinities on one line; enable to wrap at the token-relative width |
| Text Opacity | 0–100%; applies to icons, codes, outlines, and shadows |
| Section and Anchor | Top, bottom, left, or right; follow same-side nameplates or anchor to the token |
| Clearance from Names / Bars | Gap from the affinity artwork/text body to nearby names/bars. Default 2 canvas pixels; 0 gives the tightest fit. Shadow margins are excluded |
| Horizontal / Vertical Padding | Final signed numeric offsets applied after automatic clearance. Positive X moves right; positive Y moves down. Small negative values work immediately and may intentionally overlap obstacles |
| Drop Shadow: Enabled, Color, Distance, Blur, Angle, Transparency | Independent shadow controls for both icons and codes |
| Outline: Enabled, Color, Use Token Disposition, Thickness, Transparency | Independent outline controls for both icons and codes |

Opacity and transparency use opposite conventions: **100% opacity is fully visible**, whereas **100% transparency is invisible**. Shadow/outline transparency is multiplied by the overall Text Opacity. For example, 50% text opacity plus 50% shadow transparency produces an effective shadow opacity of 25%, before any inherited token opacity.

Shadow blur is measured in canvas pixels before zoom: zero gives a sharp shadow, and higher values soften both icon and code shadows. Blur affects rendering only: it does not add layout padding or change affinity position, wrapping, or clearance. The effect textures retain room for the shadow so it is not clipped. Horizontal and vertical padding use number inputs rather than sliders.

Shadow angles are degrees clockwise: 0° right, 90° down, 180° left, 270° up. Distances, padding, thickness, and font sizes are canvas units before zoom. Colors use six-digit hexadecimal notation, such as `#FFFFFF`.

**Use Token Disposition** uses Foundry's `token.getDispositionColor()` and updates when the token's disposition changes. Disable it to use the custom outline color. Font names must already be available to Foundry or the browser; no fonts are downloaded by this module. Invalid colors fall back to safe defaults, and unavailable fonts use the browser fallback.

Affinity codes sit one pixel from the icon artwork. Transparent shadow/outline margins no longer create large gaps inside each pair. **Element Word Spacing** controls the space between pairs without changing font size.

The default is a single line, even when it extends beyond the token width. Enable **Wrap Elements** to wrap between complete icon/code pairs; an icon is never separated from its code. Automatic placement avoids visible nameplates and Bar Brawl bars using the affinity artwork/text body. Your horizontal and vertical padding is applied afterward as an explicit override; it is never cancelled by collision avoidance.

## Affinity mapping and rules

| Effective value | Code | Meaning |
| --- | --- | --- |
| -1 | VU | Vulnerability |
| 0 | Omitted | No affinity |
| 1 | RS | Resistance |
| 2 | IM | Immunity |
| 3 | AB | Absorption |

Element order is **physical, air, bolt, dark, earth, fire, ice, light, poison**, using the corresponding supplied PNG icons. Water and untyped assets do not add new affinity types. The codes are fixed as requested; they are not replaced by long names or alternate localized abbreviations.

The module reads each token actor's effective prepared `system.affinities[element].current`, including synthetic actor overrides. It does not use a stored `base` as a substitute or edit actor data. Project FU resolves overlapping effects: Resistance and Vulnerability cancel, Immunity supersedes both, and Absorption supersedes the others (Fabula Ultima Core Rulebook, p. 92).

## GM reveal synchronization

Show Affinities publishes the token's effective element/code pairs into a GM-controlled world setting. Players render that published snapshot instead of reading an actor sheet, so the overlay works when they have no ownership or actor data access. The enabled state, selected element keys, and selected non-neutral affinity codes are published, not actor statistics, names, items, or other sheet data. Hidden tokens publish no affinity values.

The module no longer applies an additional Party/Study filter after a GM enables the display. The GM controls when learned information is revealed. This affects disclosure only; affinity values and precedence still come from Project FU.

The active GM coalesces snapshot updates after actor, token, ActorDelta, item, and effect preparation. Unchanged values cause no world-setting write. Disabling Show Affinities clears the published values; deleted tokens are removed. Player-editable token flags alone cannot authorize a reveal. No custom socket listener is needed: Foundry distributes world-setting changes to connected clients.

A GM must be connected to publish new values. Already published snapshots persist when the GM disconnects; the next active GM resynchronizes the active scene. If the GM is privately viewing an inactive scene, it is not automatically bootstrapped for players. Explicit GM token updates can still publish an individual reveal.

## Token Nameplates compatibility

The module reads public plate references and measures their rendered bounds, including externally parented labels. It does not replace token classes, patch core rendering methods, or add anything to Token Nameplates' own collections.

Affinity visibility is independent of token names and other nameplates. Setting the token name to **Never Displayed** leaves affinities visible when the per-token Show Affinities flag and token/disclosure rules permit them.

**After Same-Side Nameplates** anchors follow only the matching directional stack. If that side has no visible labels, the affinity plate uses that token edge. A top-only nameplate can never pull a Bottom affinity plate onto the top. **Token** anchors use the selected token edge directly. Both modes still avoid collisions with visible labels.

A lightweight watcher runs while Token Nameplates or Bar Brawl is active. It compares geometry signatures and remeasures only when a label or transform changes. Textures are reused; icon PNGs load once, and styled textures are shared between matching displays. Outdated asynchronous loads cannot revive deleted labels.

**Draw-order limit:** when Token Nameplates uses `placeAbovePlaceables`, its labels can occupy a higher canvas parent. This module's text and sprites remain direct token children, so they follow the geometry but do not automatically share the higher draw order. Other overlays may cover them.

## Bar Brawl compatibility

The adapter inspects the visible bar containers in `token.bars`, measures their bounds in token-local coordinates, and reserves space beyond the outermost visible bar on the selected side. Bar labels and rotated side bars are included in those bounds. Hidden bars, zero-opacity bars, and hidden parent containers reserve no space.

The plate clears bars even when they are farther outside the token than the initial label position. A geometry watcher tracks new bar containers, movement, redraws, and hover/control visibility changes, including asynchronous bar rendering. It runs when Bar Brawl is active even if Token Nameplates is disabled. Both modules' obstacles are considered together. No Bar Brawl methods are patched, and its visibility rules are left intact.

**Tighter bar spacing:** set Clearance from Names / Bars to 0–2. For further adjustment, use small negative Vertical Padding values such as -1 or -2; they move the plate up immediately. The existing `spacing` setting key is retained, so an explicitly saved old value is preserved when upgrading.

Source baseline: **Bar Brawl 1.9.0**, declaring minimum Foundry 13.341 and verified 13.351. The actual release source was inspected; automated/browser checks use matching PIXI bar-container fixtures. A real-world integration check with the user's installed Bar Brawl version remains necessary. Levels3D rendering is outside this module's 2D canvas scope.

## Requirements and validation

- Foundry VTT **13**; Project FU **4.16.3** or a later V13 release preserving that affinity model.
- Token Nameplates and Bar Brawl are optional. Adapter source baseline: its source retrieved 2026-10-25.
- No runtime dependency, custom sockets, build step, libWrapper, or font download is required.
- Version 0.4.0 passes 85 automated tests and 37 real PIXI 7.4.3 browser checks. The browser checks include actual PNG loading, translucent shadow/outline pixels, configuration field injection, per-token flags, geometry, and live hook updates.
- Previous versions were tested by the user in Foundry. Each release still requires a real GM-plus-player world check of form submission, world-setting propagation, system effects, vision, Token Nameplates, and Bar Brawl. See [TESTING.md](TESTING.md).

## Diagnostics and development

```js
game.modules.get("fabula-affinity-nameplates").api.diagnostics()
game.modules.get("fabula-affinity-nameplates").api.refresh()
```

Diagnostics reports versions and counts, without affinity contents. Refresh rereads shared settings and the current GM/local or player/published display data without drawing tokens or the canvas.

```sh
npm test
npm run package
```

Node 20+ runs the dependency-free tests. Python 3 creates the ZIP and checksum in `dist/`, verifies imports and translations, and includes runtime files and documentation only. The source-only browser harness uses PIXI 7.4.3 from jsDelivr; installed modules use Foundry's bundled PIXI and the installed Project FU icons. For browser tests, run `python3 tools/serve_tests.py --projectfu /path/to/projectfu`, then open `http://localhost:8768/tests/browser.html`.

## Attribution and references

Software is MIT licensed. Icons are loaded from the installed Project FU system and are not redistributed in this repository or release ZIP. Project FU credits **t3nshi** for these icons; see [ASSET_NOTICE.md](ASSET_NOTICE.md). No rulebook, publisher fonts, or Project FU implementation source is bundled.

Project FU describes itself as an independent, unofficial implementation. This module is independent and is not affiliated with Need Games or Rooster Games.

- [Foundry V13 Token API](https://foundryvtt.com/api/v13/classes/foundry.canvas.placeables.Token.html)
- [Foundry V13 TokenConfig API](https://foundryvtt.com/api/v13/classes/foundry.applications.sheets.TokenConfig.html)
- [Project FU v4.16.3](https://github.com/League-of-Fabulous-Developers/FoundryVTT-Fabula-Ultima/tree/v4.16.3)
- [Token Nameplates](https://git.gay/unarekin/FoundryVTT-Token-Nameplates)
- [Bar Brawl source](https://gitlab.com/woodentavern/foundryvtt-bar-brawl)
- Fabula Ultima Core Rulebook, p. 92 and the Study action; applicable publisher errata.

## Publishing a release

Update the version in `module.json` and `package.json`, and update the version-specific `download` URL in `module.json`. Run `npm test` and `npm run package`, commit, then push a matching tag such as `v0.4.0`. The release workflow validates the tag and publishes the ZIP, checksum, `module.json`, and identical `manifest.json` alias. Keep the stable `manifest` URL unchanged.
