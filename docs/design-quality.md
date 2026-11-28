# Design quality

Measurable rules for how every screen of the app looks and feels. A reviewer checks a change against this page; the audit of each screen (ZHA-8110, stage 2) reports a finding as a broken rule from here; the regression guard (stage 4) turns the rules marked **lint** into checks. Comfort (touch size, spacing, steps, legibility) and beauty count the same: a rule never trades one for the other.

The tokens in `src/theme` stay the source of truth. This page names their values, adds the rules the tokens do not carry, and says which literal values are allowed outside them. A token changes only when a measurement shows the token itself causes the problem; the one such case found today is under [Contrast](#contrast).

Units are dp (Android) and pt (iOS); one number is used for both unless a row says otherwise. "Mblu 21" is the test phone (Android, 720 by 1640 px). Its density is 1.75 px per dp, measured from a 48 dp `Avatar` that is 81 to 82 px tall in a 702 px wide screenshot (1.70 px per dp at that scale). `StyleSheet.hairlineWidth` is one physical pixel there, 0.57 dp.

## References

Every value below names where it comes from. Zhafron's screenshots win over the other references; when he sends screenshots of apps he finds tidy, they replace a value here in the same PR that adds them.

| Id | Source | What it shows |
|---|---|---|
| Z1 | ZHA-6382 attachment `6c51fc02` (28 Nov, Zhafron's phone) | WhatsApp chat list, light |
| Z2 | ZHA-6382 attachment `a072fcbc` (28 Nov) | WhatsApp chat list with filter chips and archive row, light |
| Z3 | ZHA-6382 attachment `bd04be99` (28 Nov) | Kaitech chat list, dark, with Tiket and Berbintang rows |
| Z4 | ZHA-6382 attachment `c731025c` (28 Nov) | Kaitech chat list, dark, Berbintang only |
| Z5 | ZHA-6382 attachment `4a9210cc` (28 Nov) | crop of Z3: chips, Tiket and Berbintang cards |
| Z6 | ZHA-6382 attachment `6dc1e82c` (28 Nov) | Kaitech Coworker thread, dark, bubbles and ticket card |
| Z7 | ZHA-6382 attachment `e58a6d54` (21 Nov) | Telegram channel comments, dark: bubbles, avatars, composer |
| Z8 | ZHA-6382 attachment `9dcf21be` (24 Nov) | Kaitech chat list, light, refresh pill and nav bar |
| Z9 | ZHA-6382 attachment `aba882ba` (27 Nov) | Kaitech call control pill |
| S | Signal Android `app/src/main/res/values/dimens.xml` and `layout/conversation_list_item_view.xml` at `2dd5703` | list, bubble and control dimensions |
| T | Telegram Android `DialogCell.java`, `SharedConfig.java`, `Theme.java` at `21f7d10` | list row and bubble dimensions |
| M3 | Material 3 specification (m3.material.io): elevation, state layers, chips, FAB, navigation bar | Android platform values |
| W | WCAG 2.2: 1.4.3 (text contrast), 1.4.11 (non-text contrast), 2.5.8 (target size) | accessibility floors |

Pixel values from Z-images were measured with Pillow on the original JPEGs at 1.70 px per dp (the scale above). WhatsApp, Telegram and Signal were not captured on the Mblu 21 for this page: the phone lock was held by other runs. Z1, Z2 and Z7 come from Zhafron's own phone of the same size, so they stand in for them.

## Spacing

| Rule | Value | Reference |
|---|---|---|
| Spacing scale | 4, 8, 12, 16, 24, 32, 40 (`space.xs` to `space.xxxl`); 2 for optical nudges inside one control (icon to label, badge to edge) | tokens; S uses 4, 8, 12, 16 for list and bubble padding |
| Screen edge inset | 16 | S `conversation_individual_left_gutter` and `dsl_settings_gutter` 16dp; Z2 WhatsApp is tighter, avatars 21 px (12 dp) from the edge |
| Gap between related items (icon and its label, chips in a row) | 8 | M3 chips; Z2 WhatsApp chip gap 12 px (7 dp) |
| Gap between groups (section to section) | 24 | M3 |
| List row text inset | 16 + avatar + 12 = 76 with a 48 avatar; separators start at the text, not at the edge | Z2 (74 dp), T (72) |
| **lint** | padding, margin and gap use `space.*`, 2 or 0; any other literal is a finding (`spacing-literal`); `spacing-off-scale` counts the literals whose value is also off the scale | |

## Radius

| Rule | Value | Reference |
|---|---|---|
| Radius scale (Android) | `sm` 8, `md` 12, `field` 14, `card` 16, `sheet` 28, `pill` 999 | tokens; M3 shape scale (small 8, medium 12, large 16, extra-large 28, full) |
| Radius scale (iOS) | `sm` 6, `md` 10, others as Android | tokens |
| Outlined text field and inline code | 4 | M3 extra-small; `TextField.android.tsx` |
| Circles and capsules | `radius.pill`, or exactly half the element's size | |
| Message bubble | `card` 16 | S `message_corner_radius` 18, T `bubbleRadius` 17; 16 is inside that band |
| Nested shapes | inner radius = outer radius minus the padding between them, floored at `sm` | M3 |
| **lint** | a border radius literal must be on the scale or half the element's `width`/`height` | |

## Line width

| Rule | Value | Reference |
|---|---|---|
| Border on any curved edge (radius above 0): cards, chips, bubbles, pills, fields | 1 dp, never `StyleSheet.hairlineWidth` | Z2: WhatsApp's unselected chip outline is 2 px at 1.70 px per dp (about 1 dp) and reads smooth; Z3: the Kaitech Tiket card outline is a single pixel (row 283 of `bd04be99`, one pixel at `#323136` between two background pixels), which aliases on the curve; device proof pending in ZHA-8109, which also adds the line width token and its own lint guard: once it merges, this rule refers to that token and stage 4 reuses that guard instead of adding a second one |
| Straight full-width divider (list separators, app bar bottom) | `StyleSheet.hairlineWidth` allowed | S and T draw 1 px separators |
| Selected, focused or error outline | 2 | M3 outlined text field; `TextField.android.tsx` |
| Keyboard focus ring | 3, offset 2 | M3 focus indicator; `PillBar.android.tsx` |
| Badge edge against the bar | 2 | `PillBadge.tsx` |
| **lint** | `hairlineWidth` in a style object that also sets a border radius is a finding | |

## Typography

Text goes through `<Text variant>` (`src/ui/Text.tsx`); `type` in `src/theme/index.ts` holds two scales.

| Variant | Android size / line height | iOS size / line height | Use |
|---|---|---|---|
| display | 32 / 40 | 34 / 40 | screen title (Chat, Discovery) |
| title | 22 / 28 | 22 / 28 | sheet and dialog title |
| headline | 16 / 24, 600 | 17 / 22, 600 | list row name |
| body | 16 / 24 | 16 / 22 | message text, form values |
| callout | 14 / 20 | 15 / 20 | list preview, secondary lines |
| footnote | 12 / 16 | 13 / 18 | time, meta |
| label | 12 / 16, 500 | 12 / 16, 600 | chips, buttons, badges |

| Rule | Value | Reference |
|---|---|---|
| Body and message text | 16 | S `conversation_item_body_text_size` 16sp; T `SharedConfig.fontSize` 16, list message 16 |
| List row name | 16 to 17 | T `dialogs_namePaint` 17 |
| Time and meta | 12 | S date 12sp; T `dialogs_timePaint` 12 |
| Smallest text | 11 (badge counts only, M3 label small); nothing smaller | M3 |
| Line height | from the variant; a literal must be one of the token line heights (16, 18, 20, 22, 24, 28, 40) or 1.18 to 1.5 times its font size | the token range: iOS display 40/34 = 1.18 to Android body 24/16 = 1.5 |
| Emoji and recorder digits | 28, 32, 48, 64 allowed as display sizes for glyphs that are not words | `EmojiPicker`, `RecorderScreen` |
| Font scale | every text row survives system font scale 2.0: rows use `minHeight`, never a fixed `height` around text | ZHA-8110 audit asks for one 2.0 sample per screen |
| Weights | 400, 500, 600 for system text; Plus Jakarta Sans 600 to 800 only in display and title | `brandFaces` |
| **lint** | `fontSize` literals outside `src/theme` must be on the scale above; `lineHeight` literals follow the line height row | |

## Surfaces and elevation

| Layer | Light / dark | Elevation (Android) | Reference |
|---|---|---|---|
| canvas (screen background) | `#F4F4F5` / `#100F11` | 0 | tokens |
| surface (cards, sheets, bubbles from others) | `#FFFFFF` / `#1C1B1F` | 0; separation by tone and a 1 dp `line` border | M3 level 0 to 1 |
| surface2 (chips, wells, pressed rows) | `#EFEFF1` / `#28272B` | 0 | tokens |
| navigation bar | `surfaceContainer` | 3 | M3 navigation bar level 2; `PillBar.android.tsx` |
| FAB | `primary` | 6 | M3 FAB level 3; `Fab.android.tsx` |
| bottom sheet | surface plus scrim | 1 | M3 |
| dialog | surface plus scrim | 6 | M3 level 3 |
| scrim | `#00000073` / `#0000009E` | | tokens |

| Rule | Value | Reference |
|---|---|---|
| Allowed elevations | 0, 1, 3, 6, 8, 12 | M3 levels 0 to 5 |
| Stacking order | `zIndex`, not elevation; elevation above 12 draws a heavy shadow on Android | |
| Adjacent surfaces | each step differs by at least 1.10:1 luminance in both themes | today canvas to surface 1.10 / 1.12, surface to surface2 1.15 / 1.15 |
| iOS shadow | one recipe: `0 6 20 -4`, black at 18% light / 45% dark | `glassMaterial.ts`; `PillBar.tsx` uses a second recipe (0, 6, blur 16, 12% / 45%) and is an audit item |
| Cards | a card only where the item is a separate object; never a card inside a card; no coloured stripe on one side | ZHA-8110 design rules |
| **lint** | elevation literals off the levels; colour literals outside `src/theme` except the wallpaper and icon mask files | |

## Icons

The in-house set in `src/ui/icons` is the only icon source ([Development](development.md#icons-and-splash)).

| Rule | Value | Reference |
|---|---|---|
| Optical sizes | 16, 20, 24, 32; 48 only for empty-state art | icon spec; `strokeFor` |
| Stroke | 2.25 at 16, 2.1 at 20, 2 at 24, 1.75 at 32; butt caps, miter joins | `glyphs.ts` |
| Selected state | the `fill` variant, never a colour change alone | icon spec, `line` and `fill` variants |
| Icon in a control | 24 in a 40 visible, 48 reach button; 20 in chips and rows | M3 icon button |
| Colour | `ink` or `inkSoft` on surfaces; `primary` only for an active state | |
| **lint** | an `Icon` size literal must be one of the optical sizes | |

## Press, focus and disabled

| Rule | Value | Reference |
|---|---|---|
| Android press | ripple from `src/ui/Pressable`, ink at 10% (`1A`), clipped to the control's shape: `overflow: 'hidden'` on the curved Pressable itself | M3 pressed state layer 10%; ZHA-8109 (square ripple on round controls) |
| iOS press | opacity 0.8 | most used value in the code today (4 of 13); one value replaces 0.7, 0.75, 0.85 |
| Hover and focus state layer | 8% and 10% | M3 |
| Disabled | content and container at 0.38 opacity, no ripple, `accessibilityState.disabled` | M3; `IconButton.android.tsx` |
| Keyboard focus | 3 dp ring in `focus` | M3 |
| **lint** | a Pressable whose own style has a radius must clip (`overflow: 'hidden'`) or use a borderless ripple | |

## Motion

| Rule | Value | Reference |
|---|---|---|
| Durations | `quick` 120 (press feedback, small fades), `base` 180 (chips, toggles), `slow` 240 (sheets, panels), `axis` 300 (screen push), `hero` 320 (shared element) | `motion.ts` |
| Exit | no longer than the matching enter; `easing.exit` | M3 |
| Enter | `easing.standard` or `easing.expo`; no bounce or elastic | `motion.ts` |
| Springs | `spring.*` only; damping ratio 0.6 to 1 | `motion.ts` |
| Loops (pulse, recording) | 600 per half cycle, only while something is live | `Controls.tsx`, `states.tsx` |
| Reduced motion | every animation goes through `useMotion` or `useReduceMotion` and is skipped, content visible at rest | `motion.ts`: Reanimated `entering` never finishes under reduced motion and left content at opacity 0 |
| **lint** | a `duration` literal must be on the scale above | |

## Empty, loading, error and offline

| State | Rule | Reference |
|---|---|---|
| Empty | 48 icon in `inkFaint`, one line in `headline`, one optional line in `callout` `inkSoft`, one optional action; centred, 32 from the top of the list area | decision for this standard; the audit checks every empty screen against it |
| Loading a list | skeleton rows with the real row height; a spinner only inside a sheet or an inline load-more | `GifTab`, `StickerTab` skeletons |
| Spinner | `ActivityIndicator` in `primary`, small (20) inline, large (36) for a whole sheet | 29 call sites in 25 files use this today |
| Error | `Banner` with `dangerBand` / `dangerInk`, icon 20, the cause in plain words and a retry action | `Banner.tsx` has warn and info tones; danger is the missing tone |
| Offline | `Banner` warn tone, `cloudOff` icon, the queued count | `ConversationList.tsx` |
| Pull to refresh | `Refresh` from `src/ui/Refresh` | lint rule in `eslint.config.js` |

## Light and dark parity

| Rule | Value |
|---|---|
| Colours | every colour comes from a token pair; no literal |
| Review | every changed screen is shown in light and dark, same scene, same data |
| Depth | in dark, depth comes from the surface tone step, not from shadow; a shadow kept in dark uses at least 0.45 opacity or it disappears |
| Images and avatars | the same in both themes; outlines around images use `line` |

## Contrast

Ratios from `node scripts/design-quality.mjs --contrast` on the tokens (light / dark).

| Rule | Value | Reference |
|---|---|---|
| Text | 4.5:1 against its background; 3:1 for text of 18 and up or 14 bold | W 1.4.3 |
| Icons, input outlines, focus rings, selected indicators | 3:1 | W 1.4.11 |
| Decorative separators and card outlines | no minimum; the item's own text identifies it | W 1.4.11 |
| `primary` as text | not allowed in dark (3.15 to 4.06 against the surfaces); use `link` (7.19 to 9.27) | measured |
| `inkFaint` | lowest text token: 4.89 on `surface2` dark, keep it for meta only | measured |

One failure is in the tokens' use, not in the code style: white (`onPrimary`) on `danger` is 4.23 light and 3.15 dark. The iOS tab badge (`PillBar.tsx`) draws its count that way. Android already uses `material.error` with `onError` (6.47 light, 9.63 dark), so the fix is to give iOS the same pair, not a new token. White icons on `danger` (call decline, record) pass the 3:1 icon floor.

## Touch targets

| Rule | Value | Reference |
|---|---|---|
| Reach | 48 on Android, 44 on iOS; the visible shape may be smaller, `hitSlop` or `reach()` makes up the rest | M3; Apple HIG; W 2.5.8 floor 24 |
| Space between targets | 8, or their reaches must not overlap | M3 |
| Chips | 32 to 36 visible, reach to 48 | M3 filter chip 32; Z2 WhatsApp chips 31 to 32 dp; ours are 36 (`chipHeight`), which passes; the reach stops at 44 through `touchTarget`, the gap below |
| List rows | 72 minimum for two-line rows | Z1 WhatsApp row pitch 130 px = 76 dp; T `heightDefault` 70 plus separator; ours 76 |
| Search field | 48 | Z2 WhatsApp 48 dp |
| FAB | 56, radius 16 | M3; Z1 WhatsApp 55 dp; ours 56 (Z3) |

`touchTarget` in `src/ui/touch.ts` is 44 on both platforms, so `reach()` stops at 44 on Android. That is a token-rooted gap against the 48 dp Android rule; the audit measures which controls end below 48 before the value changes.

## Measured today

Counts on `main` at `1cbf970` (0.15.0), from

```bash
node scripts/design-quality.mjs          # counts per rule
node scripts/design-quality.mjs --list   # every hit as rule, file:line, value
node scripts/design-quality.mjs --contrast
```

The script parses `src` with the TypeScript compiler (`src/theme` excluded) and needs no build. It is static: a value passed through a variable is not seen, and `ripple-unclipped` cannot see a parent that clips, so it is an upper bound.

| Rule | Count | Meaning |
|---|---|---|
| color-literal | 18 | colour literal outside `src/theme` (wallpaper presets, plain backgrounds and the icon mask are content and excluded) |
| font-size-literal | 28 | `fontSize` literal |
| font-size-off-scale | 7 | of those, off the type scale (26, 30, 10, 4) |
| line-height-off-scale | 2 | `lineHeight` literal not a token line height and outside 1.18 to 1.5 times its font size |
| radius-literal | 49 | border radius literal |
| radius-off-scale | 2 | off the radius scale and not half the element's size (5, 2) |
| spacing-literal | 35 | padding, margin or gap literal other than 0 or 2 |
| spacing-off-scale | 15 | of those, off the spacing scale (1, 3, 5, 6, 11, 14, 30) |
| hairline-on-curve | 79 | `hairlineWidth` border in a style object that also sets a radius, in 57 files |
| ripple-unclipped | 111 | Pressable with a radius in its own style and no `overflow: 'hidden'` |
| icon-size-off-scale | 28 | `Icon` size 12, 14, 18, 22, 28 or 40 |
| duration-off-scale | 8 | animation duration 70, 80, 150, 160, 280 or 500 |
| elevation-off-scale | 2 | elevation 10 and 40, used for stacking |

Broader counts from the same commit, for scale: 264 `.tsx` files, 116 `hairlineWidth` uses in 71 files, 237 `radius.*` and 1002 `space.*` token uses.
