# Fabula Ultima Affinity Nameplates

A Foundry VTT **Version 13** module for **Project FU** (`projectfu`). Version **0.4.1** displays the supplied elemental icons alongside **VU**, **AB**, **IM**, or **RS**, with live updates and per-token visibility.

## Install or update

1. In Foundry's Setup screen, open **Add-on Modules → Install Module**.
2. Paste this **Manifest URL**, then install:

   `https://github.com/jaymee/fabula-affinity-nameplates/releases/latest/download/manifest.json`

3. Open a Project FU world and enable **Fabula Ultima Affinity Nameplates** in **Manage Modules**.
4. Have the GM connect first. New prototypes have **Show Affinities** enabled with every element unchecked, so no affinity is revealed until the GM selects it. Saved token and prototype choices are preserved.

For future releases, use Foundry's **Check for Updates** / **Update** controls. The stable manifest points to the latest release; each release downloads its matching versioned ZIP. The installed file remains `module.json`, as Foundry requires.

If upgrading an older local installation that has no manifest URL, close the world and replace its module files once with the latest release ZIP, or reinstall from the manifest using the same module ID. Back up your world first. World settings and token flags retain their existing keys.

## Show or hide individual tokens

As a GM, open a token's **Token Configuration**. In **Identity → Affinity Nameplate**, toggle **Show Affinities**, then save the configuration. If a customized sheet has no Identity tab, the fieldset appears in its main form.

- The checkbox is saved as `flags.fabula-affinity-nameplates.enabled` on the TokenDocument. It applies to that token for every viewer.
- Unchecking it removes that token's affinity icons and text without affecting sibling tokens for the same actor.
- Setting it in an actor's **Prototype Token** configuration controls newly created tokens; existing tokens retain their own flags.
- Reveal controls are shown only to GMs. Players do not receive the checkbox, even on owned tokens or their actor’s prototype, and normal player edits to module visibility flags are blocked.
- To reveal just one affinity: enable **Show Affinities**, click **Clear All**, check one element (for example, Fire), and save. Later, check another element and save to reveal it too. Uncheck an element to hide it again. **Select All** reveals all non-neutral affinities.
- Selections are per token and also available on Prototype Token. New/unconfigured prototypes start with **Show Affinities** enabled and no selected elements. Previously explicitly enabled tokens without selections preserve their all-elements behavior until the GM changes it.
- Only selected, non-neutral affinities appear to players who can see the token, without requiring actor ownership or a Party/Study profile. Hidden tokens and tokens outside normal vision remain hidden. Neutral values produce no label, even when selected.
- These controls support the GM's manual reveal decisions; they do not automate the Study action or decide what the rules reveal.
- Newly placed tokens inherit the prototype’s enabled state and element selections. Existing placed tokens keep their saved choices. An older placed token without any configuration remains hidden.

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

The default is a single line, even when it extends beyond the token width. Enable **Wrap Elements** to wrap between complete icon/code pairs; an icon is never separated from its code. Automatic placement avoids visible names and resource bars using the affinity artwork/text body. Your horizontal and vertical padding is applied afterward as an explicit override; it is never cancelled by collision avoidance.

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

## Requirements

- Foundry VTT **13**.
- Project FU **4.16.3** or a later V13 release using the same affinity data and icons.

## Attribution and references

Software is MIT licensed. Icons are loaded from the installed Project FU system and are not redistributed in this repository or release ZIP. Project FU credits **t3nshi** for these icons; see [ASSET_NOTICE.md](ASSET_NOTICE.md). No rulebook, publisher fonts, or Project FU implementation source is bundled.

Project FU describes itself as an independent, unofficial implementation. This module is independent and is not affiliated with Need Games or Rooster Games.

- [Foundry V13 Token API](https://foundryvtt.com/api/v13/classes/foundry.canvas.placeables.Token.html)
- [Foundry V13 TokenConfig API](https://foundryvtt.com/api/v13/classes/foundry.applications.sheets.TokenConfig.html)
- [Project FU v4.16.3](https://github.com/League-of-Fabulous-Developers/FoundryVTT-Fabula-Ultima/tree/v4.16.3)
- Fabula Ultima Core Rulebook, p. 92 and the Study action; applicable publisher errata.
