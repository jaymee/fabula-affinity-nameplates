# 0.4.1

- Show full element names in the GM reveal controls.
- New prototypes enable Show Affinities with all element selections unchecked; scene tokens inherit those defaults without revealing anything.
- Preserve saved prototype and token choices.
- Simplify the public README and keep personal integration, validation, and development references local.

# 0.4.0

- GM-only per-element reveal checkboxes, Select All, and Clear All in token/prototype configuration.
- Unconfigured tokens and prototypes default to disabled; previously explicit enabled choices remain intact.
- Selected elements synchronize through GM-controlled world snapshots; player edits cannot expand a reveal.
- Correct Project FU icon credits to t3nshi, with upstream's separate water credit to Mildew. Load installed system icons instead of bundling artwork.
- Publish GitHub release ZIPs and a stable install/update manifest.

# Changelog

## 0.3.0

- Make Show Affinities a GM reveal action. Enabled tokens publish affinity codes to players regardless of actor ownership, assigned character, or Party/Study profile.
- Hide reveal controls on player token/prototype configuration and block normal player edits to module reveal flags.
- Publish minimal per-token affinity snapshots through a GM-controlled world setting, allowing players to render without access to actor data. Hidden tokens publish no affinity values. The active GM refreshes snapshots on token, actor, effect, item, and ActorDelta updates.
- Convert all styling controls to world settings, hide them from player configuration, and apply GM style changes on all clients.
- Migrate the first active GM's old local style preferences once without overwriting existing world values. Preserve token flags and all existing setting keys.
- Require a hard refresh on GM/player browsers after upgrading to clear cached older module files.

## 0.2.3

- Separate logical artwork/glyph bounds from full shadow render bounds. Blur and shadow texture margins no longer add plate spacing, move the plate, or enlarge bar clearance.
- Apply horizontal and vertical padding after automatic obstacle clearance. Small negative offsets now move smoothly and can intentionally overlap names/bars instead of snapping back.
- Rename Spacing to Clearance from Names / Bars, preserving its setting key and saved values. Use content-to-obstacle distance; the default for unset settings is now 2 canvas pixels, and 0 is supported.
- Verify stable glyph fill pixels at blur 0, 3, 12, and 24, plus fractional negative offsets and zero bar clearance.

## 0.2.2

- Position affinity codes one pixel from the icon artwork, excluding transparent shadow/outline texture margins from internal spacing.
- Condense the default gap between element pairs to 3 canvas pixels and add the numeric Element Word Spacing control.
- Keep all element pairs on one line by default; add an opt-in Wrap Elements setting.
- Clear Bar Brawl's visible rendered bars on the chosen side, including stacked outer bars, side rotations, offsets, and bar labels. Watch asynchronous redraws and hover/control visibility changes even when Token Nameplates is disabled.
- Inspect Bar Brawl v1.9.0 (Foundry 13.341 minimum, verified 13.351) as the source baseline; no third-party bar renderer is patched or bundled.

## 0.2.1

- Make affinity visibility independent of token names and other nameplates, including Never Displayed names and absent core nameplate objects.
- Keep affinities on the selected side. Empty sides fall back to that token edge instead of following a stack on another side.
- Replace horizontal and vertical padding sliders with signed numeric inputs supporting fractional values.
- Add drop shadow blur for icons and text, with padded runtime textures and blur-aware texture caching.
- Group Configure Settings controls into Font, Drop Shadow, Outline, and Positioning fieldsets. Preserve existing controls and values and support V13's lazy category loading.

## 0.2.0

- Add a per-token **Show Affinities** checkbox in Token Configuration and support Prototype Token defaults for newly created tokens. The flag is shared across viewers and defaults to enabled for existing tokens.
- Replace element abbreviations with the user-supplied PNG icons, paired with exact `VU`, `AB`, `IM`, and `RS` codes.
- Add text/nameplate opacity, horizontal/vertical padding, and top/bottom/left/right anchors.
- Add drop shadow enable, color, distance, angle, and transparency settings.
- Add outline enable, color, token disposition color, thickness, and transparency settings.
- Apply shadows/outlines to both icons and codes. Cache styled icon textures with reference counting and release them on style changes, deletion, redraw, and scene teardown.
- Preserve client font settings, immediate actor/ActorDelta/effect/item updates, NPC disclosure, and Token Nameplates geometry integration.

## 0.1.0

- Initial V13 Project FU affinity sub-nameplate module with live updates, local font/color/placement settings, and NPC information disclosure handling.
