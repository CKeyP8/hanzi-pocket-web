# Hanzi Pocket

Hanzi Pocket 3.0: the approved light Editorial Focus app with full HSK 1–5, official CSCA STEM/foundation vocabulary, unlimited Flashcards and Dictation, mixed personal collections, generated listening quizzes, an offline dictionary and cumulative stroke discovery. The selected Fire Horse portrait is the app and Home Screen icon.

## GitHub Pages

This repository contains the web app and all its dictionary, curriculum and stroke data. Building and running it do not require Sites or another asset host.

In repository **Settings → Pages**, select **GitHub Actions** as the publishing source. The included workflow checks the data, runs tests, builds the app for the repository's URL path, and publishes `dist`. Push updates to `main` to publish again, or run the workflow manually from Actions. GitHub Pages must be enabled before the first successful workflow run.

The expected project address for `CKeyP8/hanzi-pocket-web` is `https://ckeyp8.github.io/hanzi-pocket-web/`. This address is only live after a successful Pages deployment.

## Offline use and updates

Open the published app online and wait for **Ready for offline use** before trying airplane mode. The app, HSK catalog, dictionary and stroke data are cached locally. Offline pronunciation uses a Mandarin voice installed on the device.

When an update is published, the app can download changed assets while connected and show **Open latest version**. Workbox reuses unchanged precached assets; an edited JavaScript bundle is downloaded as a whole new file. An already-open app may continue using its earlier version until the update is activated. Users do not download the repository or its Git history.

Words, collections, settings and learning progress stay in the current browser or installed web app. They are not committed to this repository or synchronized between Chrome, Safari and other devices. A different hostname starts a separate data space. Builds under a repository path also use a database name specific to that path. Keep the same public URL for future updates to preserve the same local data space.

## Local development

Requires Node.js 22.12 or later; the Pages workflow uses Node.js 24.

```sh
npm ci
npm run check:data
npm test
npm run build
npm run preview
```

The default build is for `/`. For a project Pages URL, set `POCKET_BASE_PATH` to its repository path, including the final slash, such as `/hanzi-pocket-web/`, before running `npm run build`.

## Data credits

Dictionary: CC-CEDICT contributors / MDBG, CC BY-SA 4.0. HSK catalog: CTI syllabus / profesorm, CC BY 4.0; English glosses use CC-CEDICT. Stroke data: Make Me a Hanzi / Arphic Public License. Attribution and license details are included in `public/DATA-ATTRIBUTION.txt`, `DICTIONARY-LICENSE.txt`, `HSK-LICENSE.txt` and `STROKES-LICENSE.txt` and in the app's Settings.

The native iPhone project is maintained separately; this repository publishes the browser/Home Screen web app.

## Version 3 release and data preservation

The approved experience is bootstrapped by `src/production.ts`; the tested interface, local icon renderer and question generator are bundled under `public/pocket-*`. No Sites, login or paid AI service is required. HSK has 3,600 entries; official CSCA STEM has 950 source rows / 948 distinct cards and foundation has 5,164 rows / 5,062 cards. Source references and licensing remain bundled. Listening sentences are original local exercises rather than official past questions.

On the same app origin/path, `src/experience-storage.ts` reads the previous Pocket database once, carries saved words and edits, collection membership, HSK history, latest results and remaining queues into the new experience, and archives the original records atomically. Original tables are retained. New records use a path-specific IndexedDB store with serialized writes and conflict detection across windows. Preview storage is not automatically imported. Failed migration leaves the old records intact; a boot-error fallback can open the previous interface. The migration is idempotent.

Settings offers full JSON backups, restoration of both original version-1 and current backups, additive CSV import/export and offline readiness. A recovery snapshot is retained before importing. Manual words can use the offline dictionary; saved words remain editable. Removing a word from Pocket preserves library entries and learning history.

Next stroke draws one additional permanent stroke. Reset clears; Replay leaves a complete character. The 1,527-character bundled stroke pack covers every HSK 1–5 character; unsupported additional technical/personal characters show an availability message. Downloaded Mandarin device voices provide pronunciation. Workbox precaches the complete release, including curriculum, scripts, dictionary, stroke data and icons; wait for Ready for offline use in Settings.

The chosen icon is included unchanged as a 1254 × 1254 PNG, accurately declared in the manifest; browsers scale it for the device. No image generation or cloud call occurs in the app. The source of the previous interface is retained for recovery, and the same GitHub Pages URL is used.
