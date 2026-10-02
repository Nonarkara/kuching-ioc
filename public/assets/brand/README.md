# Greater Kuching IOC brand assets

Source: supplied “Logo Option 3” sheet, 2 October 2026. Transparent PNGs
were extracted with the built-in image extraction tool and sized with sharp.
All white cutouts remain alpha, including the river, skyline gaps and network.

- `colour-mark.png`: coloured city / river / infrastructure emblem, masthead.
- `mono-mark.png`: single-colour emblem, compact web-app control.
- `mono-lockup.png`: monochrome emblem and wordmark, installation guide.
- `app-mark.png`: transparent app tile; a downloadable source asset.
- `app-icon-{192,512}.png`: platform icons on an opaque blue-grey canvas.
- `app-maskable-512.png`: padded Android icon safe area.
- `apple-touch-icon.png`: 180px iPhone home-screen icon.

Extraction prompts: isolate the respective top colour emblem, lower-right
monochrome lockup, and lower-left APP MARK from the supplied sheet; preserve
geometry and lettering; remove sheet labels and make every white region actual
transparent alpha. The extraction tool outputs are preserved in Codex's image
output directory. `scripts/prepare-brand.mjs` reproduces the deployment sizes.

Logo PNGs must have transparent backgrounds, `object-fit: contain`, and no blend
mode. The dark theme uses a brighter colour mark and white monochrome display
through CSS filters; neither adds a white backing rectangle. Platform icons
have an opaque canvas because iOS and Android control their final masking.

Installation guidance follows [Apple's Safari guide](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios)
and [Chrome's web-app guide](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en).
Actual installation must be confirmed by the user on their device.
