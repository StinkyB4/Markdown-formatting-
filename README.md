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
2. Copy it out one of two ways:
   - **Copy formatted text** — keeps headings, bold, lists, tables and code,
     ready to paste into Word or Google Docs.
   - **Copy as plain text** — strips every Markdown symbol and gives you clean,
     unformatted prose (lists still keep their bullets and numbers).
3. Open Word or Google Docs and paste (long-press → Paste, or Ctrl/Cmd+V).

A big confirmation stays on screen until you dismiss it, so you always know it
worked.

> **Pasting into Google Docs on a phone?** The Google Docs *phone app* always
> pastes external content as plain text — that's a Docs-app limitation, not a
> copy failure (the same copy pastes formatted into Gmail, Word, and Docs in a
> browser). Open **docs.google.com** in your phone's browser and paste there.
> The app shows this tip after every formatted copy on Android. A one-tap
> **Send to Google Docs** feature is in the works — see "Connect to Google"
> below.

### Advanced formatting

Tap **⚙ Advanced formatting** to open a panel where you can tune exactly how the
copied text looks — font and text size, line spacing, text and heading colors,
heading sizes, and the styling of code, tables and quotes. You can also toggle
how the text is read (auto-linking, single line breaks, smart quotes). The
preview updates live and your choices are remembered on the device. **Reset to
defaults** puts everything back.

**More options** still offers "Copy as plain Markdown" (the raw source) and
"View HTML" for technical users.

## Connect to Google (optional, one-time setup)

Sign-in is the foundation for **Send to Google Docs** — pushing your formatted
text straight into a Google Doc, bypassing the Docs phone app's plain-text
paste entirely. The app works fully without it; the **Google account** row in
*More options* simply explains that setup is needed until you do this.

You need two free OAuth client IDs from Google Cloud Console (~10 minutes):

1. Go to [console.cloud.google.com](https://console.cloud.google.com), create a
   project (call it anything, e.g. *Paste Pretty*).
2. **APIs & Services → Library**: enable the **Google Docs API** and the
   **Google Drive API**.
3. **APIs & Services → OAuth consent screen**: choose **External**, fill in the
   app name and your email, and add your own Google account under **Test
   users**. Leave the app in *Testing* mode — that's all you need for personal
   use (no verification process required).
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Type **Android** — package name `church.osbornevillage.pastepretty`,
     SHA-1 certificate fingerprint:

     ```
     8D:56:04:85:2C:EB:94:E8:0A:AA:12:29:25:79:54:2E:B8:42:14:CF
     ```

     (That's the fingerprint of the repo's committed debug keystore —
     `android/keystores/debug.keystore.p12` — which signs every CI build, so
     the fingerprint never changes.)
   - Type **Web application** — add the address where you host the web app to
     **Authorized JavaScript origins**. Only needed for the browser/PWA
     version; skip it if you only use the APK.
5. Paste both client IDs into `src/google-config.js`, commit, and rebuild the
   APK from the Actions tab.

Privacy: sign-in talks only to Google, tokens stay on the device, and the
requested `drive.file` scope means the app can only ever see Docs you
explicitly pick or that it creates — never the rest of your Drive.

> **Note on the committed keystore:** builds are debug-signed with a keystore
> checked into the repo so the signature is stable (Google's OAuth requires a
> fixed SHA-1, and Android requires matching signatures to update an app in
> place). It's fine for self-distribution; for Google Play you'd add a private
> release keystore. Because the signature changed with this feature, you must
> **uninstall any previously installed Paste Pretty once** before installing a
> new APK.

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
