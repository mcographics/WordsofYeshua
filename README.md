# Words of Yeshua

Words of Yeshua is a Christ-centered Electron desktop study companion for exploring the recorded words of Jesus across Matthew, Mark, Luke, John, Acts, and Revelation. It organizes the locally generated KJV catalogue by event, theme, person, place, object, and biblical period in a responsive interface that also works at phone-sized window widths.

## Application stack

- Electron 43 main process and sandboxed desktop window
- React 18 and Vite 6 renderer
- TypeScript application and biblical-content model
- C++20 Node-API search and ranking engine
- Electron Forge Windows packaging

The renderer has no Node.js or filesystem authority. A narrow preload bridge sends validated search candidates to the Electron main process, which invokes the native C++ engine. If the interface is opened as an ordinary Vite browser preview, it uses a JavaScript search fallback.

## Biblical content source

`data/words-of-yeshua` contains the generated app catalogue, documented speaker corrections, and its TypeScript adapter:

```text
data/words-of-yeshua/generated-catalogue.json
data/words-of-yeshua/speaker-overrides.json
data/words-of-yeshua/sayings.ts
```

Run `npm run content:build` to regenerate the catalogue entirely from the local KJV DOCX, speaker spans, OpenBible topic scores and cross-references, Strong’s-tagged New Testament data, N1904 alignment, and Vine’s entries. Run `npm run content:check` to enforce coverage, structure, required sayings, and known non-Jesus-speaker exclusions. Every record includes the exact quotation, complete KJV verse, event heading, themes, audience, place, objects, biblical period, context, related references, topic evidence, and Greek lexical connections.

Acts and Revelation use a conservative reviewed allowlist. It includes passages where Jesus is explicitly identified as the speaker or His words are explicitly quoted, while excluding speech from the Father, Holy Spirit, angels, narrators, worshippers, and other speakers.

Vite compiles only the compact generated catalogue into the renderer bundle. Forge excludes the raw root `data` directory from the packaged application, preventing the multi-gigabyte research library, personal notes, and unrelated resources from being copied beside the executable.

## Current features

- Responsive phone, tablet, and desktop interface
- Full-text search across sayings and contextual metadata
- Book, event, theme, people, place, object, and timeline filters
- Context sheets showing what was happening, to whom, where, and when
- Device-local bookmarks with no account or sign-in
- Device-local settings for theme, text size, Scripture typeface, reading width, result-page size, compact cards, study-detail visibility, reduced motion, and startup screen
- Installable web-app manifest
- A generated catalogue of 2,171 speech units across 2,165 KJV New Testament verses, including 26 Acts passages and 62 Revelation passages, with documented speaker boundaries and source connections

## Local Electron development

Node.js 22.12 or newer and the Visual Studio C++ desktop toolchain are required on Windows.

```powershell
npm install
npm run dev
```

`npm run dev` compiles the C++ addon against Electron 43.3.0 x64, starts Vite on `127.0.0.1:5173`, and launches the isolated Electron window.

## Verification

```powershell
npm run lint
npm test
npm run build
npm run native:smoke
npm run electron:smoke
```

## Windows packaging

```powershell
npm run package
npm run make
```

`npm run package` creates an unpacked Windows application. `npm run make` creates a Squirrel Setup executable and a portable ZIP under `out/make`.

The native addon is deliberately packaged as `resources/words_of_yeshua_native.node` outside `app.asar`; the main process loads it only from the application resources directory. The renderer, preload, compiled biblical content, and Electron main process remain protected inside `app.asar`.

## Phone architecture

Electron is a desktop runtime and cannot package a native phone application. This shared React/Vite interface is suitable for a later Capacitor Android wrapper, but the current distributable is a Windows desktop application.

Scripture quotations and complete verse text are generated from the local public-domain King James Version source. Speech segmentation, context summaries, taxonomy metadata, and source connections require continued editorial review.
