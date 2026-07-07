# Paste Pretty

Paste messy Markdown-style text (the kind ChatGPT gives you, full of `**` and
`#` symbols), tap one button, and copy it out **fully formatted** — ready to
paste straight into Word or Google Docs with headings, bold, lists, tables and
code intact.

Everything runs **on your phone**. No server, no account, no internet needed
after the first load. It installs to your home screen like a normal app.

## Why it works

Word and Google Docs pick up formatting from the clipboard's **HTML flavor**.
Paste Pretty converts your text to HTML on-device and writes both a formatted
`text/html` and a plain `text/plain` copy to the clipboard in one tap. Because
those apps ignore stylesheets when pasting, every style that has to survive
(monospace code, table borders) is written as an **inline style** at copy time.

## Install as an Android app (APK)

A real `.apk` is built automatically by GitHub Actions (the Android SDK can't be
installed in every dev sandbox, so the compile happens on GitHub's runners). The
finished APK is published as a release you can download straight to your phone.

1. On your phone, open the **[latest APK release](../../releases/tag/apk-latest)**
   and download **`paste-pretty.apk`**.
2. Open the downloaded file. Android will ask you to allow installing apps from
   your browser/Files — turn that on, then tap **Install**.
3. Launch **Paste Pretty** from your app drawer. Everything runs on-device.

To rebuild the APK at any time: go to the repo's **Actions** tab → **Build
Android APK** → **Run workflow**.

> The APK is *debug-signed* (fine for installing on your own phone). For Google
> Play distribution you'd add a release keystore and build `assembleRelease`.

## Or install it as a web app (no APK needed)

1. Open the app's web address in your phone browser.
2. **iPhone (Safari):** tap the Share button → **Add to Home Screen**.
   **Android (Chrome):** tap the ⋮ menu → **Install app** / **Add to Home screen**.
3. Launch it from the new icon. It now works offline.

## Using it

1. Paste your text into the box.
2. Tap **Copy formatted text**.
3. Open Word or Google Docs and paste (long-press → Paste, or Ctrl/Cmd+V).

A big confirmation stays on screen until you dismiss it, so you always know it
worked. **More options** offers "Copy as plain Markdown" and "View HTML" for
technical users.

## What it handles

Headings, bold/italic, bulleted & numbered lists (including nested), links,
blockquotes, inline code, fenced code blocks (indentation preserved), tables,
task lists, strikethrough, footnotes, and horizontal rules.

## Accessibility

Built to be usable with low vision: AAA-level contrast, large text that scales
with your phone's font-size setting, 60px+ buttons, full screen-reader labels, a
persistent (never-fading) confirmation that is announced aloud, a haptic buzz on
success, and reduced-motion support. The **Clear** button is separated from
**Copy** and asks before wiping your text.

## Develop

```bash
npm install
npm run dev      # http://localhost:3000-ish (Vite dev server)
npm run build    # production build → dist/
npm run preview  # preview the production build
```

Stack: vanilla JS + [Vite](https://vitejs.dev/) + `vite-plugin-pwa`, with
[markdown-it](https://github.com/markdown-it/markdown-it) (+ footnote and
task-list plugins) for conversion and [DOMPurify](https://github.com/cure53/DOMPurify)
for sanitizing. No backend of any kind.
