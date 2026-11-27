# Branding

## Logo source

The app icon uses the Kaitech mark from the kaitech.io favicon. `https://kaitech.io/web/image/website/1/favicon` and `https://lab0.kaitech.io/kaitech_theme/static/description/icon.svg` serve the same 806-byte SVG (SHA-256 `101fe16f0b10198dfa45f51665480a3df6d2d3cfedbef1637db1439c9bba9f3d`, checked 2026-11-27): a flat `#441D65` square with `rx="200"` corners and one white path, the K mark. `scripts/brand-assets.mjs` carries that path as `k` and its bounding box as `box` (x 313, y 294.5, width 380.362, height 416 in the favicon's 1006 viewBox, measured with `inkscape --query-all`). When the favicon changes, replace both and rerun the script.

The colour is `#441D65`, the same value as the theme seed (`src/theme/materialSeed.ts`). The icon has no gradient, shine, shadow or outline; on iOS 26 the system adds its own glass and depth.

The wordmark inside the app (`src/ui/Wordmark.tsx`, `src/ui/wordmarkPath.ts`) and the README banner (`docs/assets/banner.svg`) are the "Kaitech" lettering from the kaitech.io header logo, not the app icon, and do not come from this script.

## Regenerating

```bash
node scripts/brand-assets.mjs
```

It needs Inkscape 1.x on `PATH`. The script writes the SVG sources to `assets/brand/`, renders each one to `assets/<name>.png`, and writes the Icon Composer package `assets/AppIcon.icon/`. The output is deterministic: rerunning the script on an unchanged script leaves `git status` clean. `__tests__/brand-assets.test.ts` reads the PNG files and fails when a size, an alpha channel, a colour or the Android safe zone is wrong.

| File | Size | Content | Used by |
|---|---|---|---|
| `assets/icon.png` | 1024 px, RGB | mark on `#441D65`, full square | `icon` (store and legacy launchers) |
| `assets/AppIcon.icon/` | Icon Composer package | `#441D65` background fill, mark layer `Assets/mark.svg`; the dark appearance uses the system dark background | `ios.icon` |
| `assets/android-icon-background.png` | 432 px, RGB | flat `#441D65` | `android.adaptiveIcon.backgroundImage` |
| `assets/android-icon-foreground.png` | 432 px, RGBA | white mark on transparent | `android.adaptiveIcon.foregroundImage` |
| `assets/android-icon-monochrome.png` | 432 px, RGBA | white mark on transparent | `android.adaptiveIcon.monochromeImage` (themed icons, Android 13 and later) |
| `assets/splash-icon.png` | 1024 px, RGBA | white mark filling the canvas height | `expo-splash-screen` `image`, drawn `imageWidth` 96 dp wide |
| `assets/notification-icon.png` | 96 px, RGBA | white mark, 80 px tall | `expo-notifications` `icon` |

## Sizes and safe zones

- The mark is 48% of the icon height (`iconMark`). It was chosen from a contact sheet of 42%, 48% and 54% at 29, 48 and 144 px in the iOS, circle, squircle and rounded-square shapes: at 42% the mark was hard to read at 29 px, at 54% it left the least margin inside the circle mask.
- iOS and Android cut the icon shape themselves. `icon.png` is a full square without rounded corners and without alpha: the favicon's `rx="200"` corners are not part of the icon, and baked-in corners would show as a second, darker rim inside the system mask.
- Android adaptive layers are 108 dp (432 px); the launcher shows the middle 72 dp (288 px) and every mask keeps a centred circle of 66 dp (264 px). The mark is drawn at 48% of the 72 dp visible part (128 by 140 px), so no pixel is more than 95 px from the centre, inside the 132 px radius of the safe circle. The unit test measures that radius on the real PNG.
- The splash on Android 12 and later sits in a 288 dp canvas and is cut to a 192 dp circle. The mark is 96 dp tall there, so its corners stay about 65 dp from the centre. The splash background is `#441D65` in the light and the dark theme, the same colour as the launcher icon.
- The notification icon is white on transparent; Android draws it in one colour. The mark is 80 of 96 px tall, which keeps it legible at 24 dp.

## iOS appearances

`ios.icon` points at the Icon Composer package, which Expo SDK 54 and later copy into the Xcode project; Xcode 26 compiles it into the glass icon for iOS 26 and generates flat images for older iOS. The package has two parts, the background fill and the mark layer, so the system can apply glass, the dark appearance (system dark background, white mark) and the tinted appearance on its own. Light, dark and tinted PNG variants are not needed with the package.

Android keeps showing the old icon on some launchers until the app is reinstalled or the launcher cache is cleared. An icon or splash change reaches users only through a new APK or IPA, never through a JS-only update.
