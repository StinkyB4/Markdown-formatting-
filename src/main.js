// Paste Pretty — Copyright © 2026 dulos.net. All rights reserved.
//
// main.js — wires the screen together. All processing is on-device.

import {
  renderClipboardHtml,
  plainTextFallback,
  plainTextFromMarkdown,
} from './markdown.js';
import { copyRichText } from './clipboard.js';
import { initFlavors } from './theme.js';
import { loadSettings, initAdvancedPanel } from './settings.js';
import { initGoogleAuth, signIn, signOut } from './google-auth.js';
import './style.css';

const EXAMPLE = `# Welcome to Paste Pretty

This is an **example** so you can see what happens.

Paste your own text and it turns messy symbols into *real* formatting:

- Bulleted lists
- **Bold** and *italic* words
- [Links](https://example.com)

> Then tap the big button, open Word or Google Docs, and paste.

When you're ready, tap **Clear** and paste your own text.`;

const el = (id) => document.getElementById(id);

const input = el('input');
const preview = el('preview');
const copyBtn = el('copy-btn');
const copyPlainBtn = el('copy-plain-btn');
const clearBtn = el('clear-btn');
const banner = el('banner');
const bannerText = el('banner-text');
const bannerDismiss = el('banner-dismiss');
const previewToggle = el('preview-toggle');
const copyMdBtn = el('copy-md-btn');
const viewHtmlBtn = el('view-html-btn');
const htmlView = el('html-view');
const bannerHint = el('banner-hint');
const gStatus = el('g-status');
const gConnect = el('g-connect');
const gDisconnect = el('g-disconnect');

// The Google Docs PHONE app pastes external clipboard content as plain text no
// matter what flavors are on the clipboard (Gmail, Word and Docs-in-a-browser
// all read the HTML fine). Only Android users can hit this, so only they get
// the heads-up.
const onAndroid = /android/i.test(navigator.userAgent);
const DOCS_TIP =
  'Heads-up for Google Docs: the Docs phone app pastes without formatting. ' +
  'Open docs.google.com in your browser and paste there — or paste into ' +
  'Gmail or Word.';

// The live formatting options. Shared by reference with the Advanced panel,
// which mutates this same object in place, so every render below always reads
// the current settings.
const settings = loadSettings();

// Whether a phone can buzz. Used as an extra success signal.
function haptic() {
  if (navigator.vibrate) {
    try {
      navigator.vibrate(30);
    } catch {
      /* ignore */
    }
  }
}

// The seeded example is disposable: the first time the user taps the box,
// clear it so they can paste straight in without selecting-all first.
let exampleShowing = true;
function dismissExample() {
  if (!exampleShowing) return;
  exampleShowing = false;
  input.value = '';
  renderPreview();
}

// --- Preview (debounced so big pastes stay smooth) ---
let previewTimer = null;
function schedulePreview() {
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, 120);
}
function renderPreview() {
  // Show the fully-styled clipboard output so the preview is a true
  // "how it will look" — every Advanced formatting change is visible here.
  preview.innerHTML = renderClipboardHtml(input.value, settings);
  // Keep the raw-HTML inspector fresh if it's currently open.
  if (htmlView && !htmlView.hidden) {
    htmlView.textContent = renderClipboardHtml(input.value, settings);
  }
}

// --- Confirmation banner (persistent, never auto-hides) ---
function showBanner(message, isError, hint) {
  bannerText.textContent = message;
  bannerHint.textContent = hint || '';
  bannerHint.hidden = !hint;
  banner.classList.toggle('banner-error', !!isError);
  banner.hidden = false;
  bannerDismiss.focus();
}
function hideBanner() {
  banner.hidden = true;
}

// --- Copy formatted (the main action) ---
async function handleCopy() {
  const text = input.value.trim();
  if (!text) {
    showBanner('Nothing to copy yet. Paste your text in the box first.', true);
    return;
  }
  // Render synchronously BEFORE the clipboard write so nothing async sits
  // between the tap and the write (iOS Safari requirement).
  const html = renderClipboardHtml(input.value, settings);
  const plain = plainTextFallback(input.value);

  const result = await copyRichText(html, plain);
  if (result.ok) {
    haptic();
    showBanner(
      'Done! Your formatted text is copied. Paste it wherever you like!',
      false,
      onAndroid ? DOCS_TIP : ''
    );
  } else {
    showBanner('Sorry, the copy did not work. ' + result.reason, true);
  }
}

// --- Copy as plain text (markdown symbols stripped out) ---
async function handleCopyPlain() {
  const text = input.value.trim();
  if (!text) {
    showBanner('Nothing to copy yet. Paste your text in the box first.', true);
    return;
  }
  const plain = plainTextFromMarkdown(input.value, settings);
  try {
    await navigator.clipboard.writeText(plain);
    haptic();
    showBanner('Done! Plain text copied — no formatting symbols.', false);
  } catch {
    // Older browsers: fall back to a hidden textarea + execCommand.
    if (copyPlainViaTextarea(plain)) {
      haptic();
      showBanner('Done! Plain text copied — no formatting symbols.', false);
    } else {
      showBanner('Sorry, the copy did not work. Please try again.', true);
    }
  }
}

// Fallback plain-text copy for browsers without the async clipboard API.
function copyPlainViaTextarea(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  ta.style.top = '0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

// --- Clear (guarded so a stray tap can't wipe your work) ---
function handleClear() {
  if (!input.value.trim()) {
    input.value = '';
    renderPreview();
    return;
  }
  const ok = window.confirm('Clear everything you pasted? This cannot be undone.');
  if (ok) {
    input.value = '';
    renderPreview();
    hideBanner();
    input.focus();
  }
}

// --- More options ---
async function handleCopyMarkdown() {
  const text = input.value;
  if (!text.trim()) {
    showBanner('Nothing to copy yet. Paste your text in the box first.', true);
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showBanner('Copied the plain Markdown text.', false);
  } catch {
    showBanner('Sorry, the copy did not work. Please try again.', true);
  }
}
function handleViewHtml() {
  htmlView.textContent = renderClipboardHtml(input.value, settings);
  htmlView.hidden = !htmlView.hidden;
}

function togglePreview() {
  const expanded = previewToggle.getAttribute('aria-expanded') === 'true';
  previewToggle.setAttribute('aria-expanded', String(!expanded));
  preview.hidden = expanded;
}

// --- Google account (foundation for "Send to Google Docs") ---
function renderGoogleStatus(account) {
  const connected = !!account;
  gStatus.textContent = connected
    ? 'Connected' + (account.email ? ' as ' + account.email : '')
    : 'Not connected';
  gConnect.hidden = connected;
  gDisconnect.hidden = !connected;
}
async function handleGoogleConnect() {
  gConnect.disabled = true;
  try {
    await signIn();
    showBanner('Connected! Your Google account is ready.', false);
  } catch (err) {
    showBanner(err.message || 'Google sign-in did not work. Please try again.', true);
  } finally {
    gConnect.disabled = false;
  }
}
async function handleGoogleDisconnect() {
  await signOut();
  showBanner('Disconnected from Google.', false);
}

// --- Wire up ---
// Clear the example the instant the field is engaged (tap, focus, or paste).
input.addEventListener('focus', dismissExample);
input.addEventListener('pointerdown', dismissExample);
input.addEventListener('input', () => {
  exampleShowing = false;
  schedulePreview();
});
copyBtn.addEventListener('click', handleCopy);
copyPlainBtn.addEventListener('click', handleCopyPlain);
clearBtn.addEventListener('click', handleClear);
bannerDismiss.addEventListener('click', hideBanner);
previewToggle.addEventListener('click', togglePreview);
copyMdBtn.addEventListener('click', handleCopyMarkdown);
viewHtmlBtn.addEventListener('click', handleViewHtml);
gConnect.addEventListener('click', handleGoogleConnect);
gDisconnect.addEventListener('click', handleGoogleDisconnect);

// Google sign-in: wires the OAuth redirect listener and keeps the status
// row in sync. Safe when unconfigured — Connect explains the setup steps.
initGoogleAuth(renderGoogleStatus);

// Apply the saved sorbet flavor (defaults to strawberry) and wire the swatches.
initFlavors();

// Wire the Advanced formatting panel; it mutates `settings` and asks us to
// re-render the preview after each change.
initAdvancedPanel(settings, renderPreview);

// Seed the worked example so the box is never an intimidating blank.
input.value = EXAMPLE;
renderPreview();

// Register the service worker for offline use (added by the PWA plugin).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    import('virtual:pwa-register')
      .then(({ registerSW }) => registerSW({ immediate: true }))
      .catch(() => {
        /* offline support is a bonus; the app still works without it */
      });
  });
}
