# Words of Yeshua

Words of Yeshua is a Christ-centred, local-first Windows Bible reader and study companion for exploring the recorded words of Jesus in biblical context. It combines continuous King James Version chapter reading with a searchable catalogue of sayings attributed to Yeshua across Matthew, Mark, Luke, John, Acts, and Revelation.

The application does not require an account, subscription, cloud database, or internet connection for its reading, search, saved-passage, and preference features.

## Current release

The current release is **0.5.2**.

- [GitHub releases](https://github.com/mcographics/WordsofYeshua/releases)
- Windows architecture: x64
- Primary installer format: assisted NSIS `.exe`
- Optional distribution: portable Windows ZIP

Locally built installers are not Authenticode-signed. Windows SmartScreen may therefore identify the publisher as unknown until a code-signing certificate is configured.

## Reader and study features

- A clean, continuous Bible reading layout instead of a verse-card-only experience
- **Read Chapter Mode** with the complete local KJV chapter and previous/next chapter navigation
- Optional **Words of Christ in red** treatment inside Read Chapter Mode
- Clickable Words of Yeshua passages that open their complete study context
- Full-text search across quotations, complete verses, references, people, places, events, themes, objects, periods, related passages, Greek lemmas, and Strong's numbers
- Exact-reference search such as `John 8:12`, `Acts 9:5`, and `Revelation 3:20`
- Book, event, theme, people, place, object, and timeline filters
- Context sheets describing what was happening, to whom the words were spoken, where the event occurred, and its place in the biblical timeline
- Device-local saved passages with no sign-in
- Device-local preferences for colour theme, text size, Scripture typeface, reading width, result-page size, compact cards, visible study details, reduced motion, startup screen, and red-letter display
- Responsive desktop and narrow-window layouts
- A rounded, transparent, frameless Electron window with custom minimize and close controls
- Branded executable, taskbar, installer, uninstaller, desktop-shortcut, and Start Menu icons

## Biblical catalogue

The generated catalogue currently contains **2,169 speech units across 2,163 KJV New Testament verses**:

| Book | Speech units | Verses |
| --- | ---: | ---: |
| Matthew | 683 | 681 |
| Mark | 276 | 276 |
| Luke | 632 | 632 |
| John | 490 | 486 |
| Acts | 26 | 26 |
| Revelation | 62 | 62 |

`data/words-of-yeshua` contains the generated catalogue, documented speaker corrections, and its TypeScript adapter:

```text
data/words-of-yeshua/generated-catalogue.json
data/words-of-yeshua/speaker-overrides.json
data/words-of-yeshua/sayings.ts
```

The generator reads the local public-domain KJV DOCX and enriches catalogue records with locally retained cross-references, Strong's-tagged New Testament data, N1904 alignment, Vine's entries, and optional topic-score data. The copied `data/speaker_segments` directory from the earlier Bible project is not required: when it is absent, the generator reconstructs source ranges from the current reviewed Words of Yeshua catalogue and applies the documented speaker overrides.

Every generated saying includes its quotation, complete KJV verse, event heading, themes, audience, place, objects, biblical period, context, related references, and available Greek lexical connections.

Acts and Revelation use a conservative reviewed allowlist. It includes passages where Jesus is explicitly identified as the speaker or His words are explicitly quoted, while excluding speech attributed to the Father, Holy Spirit, angels, narrators, worshippers, and other speakers. This catalogue remains an editorial study aid and is not presented as a substitute for reading each passage in its complete scriptural context.

Regenerate and validate the catalogue with:

```powershell
npm run content:build
npm run content:check
```

## Application stack

- Electron 43.3.0 desktop runtime
- React 18 renderer
- Vite 6 production build and development server
- TypeScript application and biblical-content model
- C++20 Node-API search and ranking engine
- Narrow, context-isolated preload bridge
- electron-builder with NSIS for Windows installers

The renderer has no Node.js or filesystem authority. Search requests and window controls use a narrow preload API. The Electron main process validates window-control senders before minimizing or closing a BrowserWindow. If the interface is opened through the ordinary Vite browser preview, search falls back to the JavaScript implementation and Electron-only window controls are not rendered.

Packaged builds retain the existing security controls:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- `webSecurity: true`
- blocked unexpected navigation and new windows
- custom secure `woy://` application protocol
- Electron security fuses
- embedded ASAR integrity validation
- application code loaded only from `app.asar`

The C++ addon is packaged as `resources/words_of_yeshua_native.node` outside `app.asar`, and the main process loads it only from the application resources directory.

## Local development

Windows development requires:

- Node.js 22.12 or newer
- npm
- Visual Studio 2022 with the Desktop development with C++ workload
- CMake tooling used by `cmake-js`

Install dependencies and launch Vite plus Electron:

```powershell
npm install
npm run dev
```

`npm run dev` regenerates and validates the biblical content, compiles the C++ addon for Electron 43.3.0 x64, starts Vite on `127.0.0.1:5173`, and launches the isolated Electron desktop window.

Web-only and Electron-only development commands are also available:

```powershell
npm run dev:web
npm run dev:electron
```

## Verification

Run the source, native, and Electron verification suite with:

```powershell
npm run lint
npm test -- --run
npm run build
npm run native:smoke
npm run electron:smoke
```

The packaged application should also be smoke-tested from `releases/nsis/win-unpacked/WordsOfYeshua.exe` before publishing an installer. A successful packaged smoke verifies the real renderer, preload bridge, C++ engine, search behavior, settings behavior, and ASAR-packaged application path.

## Windows installer

Build the assisted NSIS installer:

```powershell
npm run make
```

The installer is written to:

```text
releases/nsis/Words-of-Yeshua-Setup-<version>.exe
```

The NSIS installer provides a conventional Windows wizard, selectable installation directory, per-user installation by default, elevation support when needed, branded installer and uninstaller icons, and desktop and Start Menu shortcuts. Uninstalling does not delete the user's saved passages and preferences.

Build the optional portable ZIP separately:

```powershell
npm run make:portable
```

The Windows distribution no longer uses Squirrel. New NSIS builds do not contain the Squirrel `Update.exe`, version-folder launcher, package cache, or `.nupkg` payload structure.

`npm run package` creates an unpacked electron-builder application when a directly runnable package is useful for diagnostics. Release installers are produced by `npm run make`.

## Windows branding

The source branding files are:

```text
Assets/icon.png
Assets/icon.ico
Assets/logo.png
```

- `logo.png` is the optimized transparent logo used inside the React interface; it is derived from `logo_upscaled.png`.
- `icon.png` is the full-resolution transparent source artwork for the Windows icon set; it is derived from `icon_upscaled.png`.
- `icon.ico` is embedded into the executable, Electron window, taskbar identity, NSIS installer, uninstaller, and shortcuts.
- `public/icon-192.png` and `public/icon-512.png` provide the same icon artwork to the browser favicon and web-app manifest.

Regenerate the multi-resolution ICO after replacing `Assets/icon.png`:

```powershell
npm run icon:build
```

The generated ICO includes 16, 20, 24, 32, 40, 48, 64, 128, and 256 pixel frames. The icon source should be a simple square composition that remains recognizable at taskbar size; poster text and fine detail will become unreadable when reduced to 16–32 pixels.

## Repository and local data

The repository tracks the runtime KJV source and generated application catalogue. The larger translation/reference library under `data` is intentionally kept on development machines and excluded from ordinary Git and packaged-application output. Generated Windows artifacts under `releases/`, legacy package output under `out/`, renderer output under `dist/`, and native build output under `native/build/` are also ignored.

The electron-builder `files` allowlist includes only the compiled renderer, Electron runtime files, and package metadata. Raw research data, translation PDFs, personal notes, and unrelated copied resources are not distributed with the application.

## Phone architecture

Electron is a Windows desktop runtime and does not produce a native Android application. The responsive React/Vite interface can provide a foundation for a future Android wrapper, but the current distributable is a Windows x64 desktop application.

## Scripture, provenance, and editorial responsibility

Scripture quotations and complete chapter text are generated from the local public-domain King James Version source. Speech segmentation, speaker attribution outside the four Gospels, contextual summaries, taxonomy metadata, and source connections require continued human editorial review.

Words of Yeshua is intended to encourage careful reading of Scripture in context. Generated metadata, search connections, and editorial classifications should be checked against the biblical text rather than treated as independent authority.
