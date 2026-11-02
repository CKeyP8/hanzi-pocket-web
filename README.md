# Hanzi Pocket

A light Editorial Focus Chinese vocabulary web app, with HSK 1–5, unlimited swipe reviews, a personal Pocket, remembered learning progress, local Mandarin pronunciation and bundled stroke animations.

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
