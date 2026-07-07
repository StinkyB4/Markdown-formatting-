// main.js — wires the screen together. All processing is on-device.

import {
  renderPreviewHtml,
  renderClipboardHtml,
  plainTextFallback,
} from './markdown.js';
import { copyRichText } from './clipboard.js';
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
const clearBtn = el('clear-btn');
const banner = el('banner');
const bannerText = el('banner-text');
const bannerDismiss = el('banner-dismiss');
const previewToggle = el('preview-toggle');
const copyMdBtn = el('copy-md-btn');
const viewHtmlBtn = el('view-html-btn');
const htmlView = el('html-view');

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
  preview.innerHTML = renderPreviewHtml(input.value);
}

// --- Confirmation banner (persistent, never auto-hides) ---
function showBanner(message, isError) {
  bannerText.textContent = message;
  banner.classList.toggle('banner-error', !!isError);
  banner.hidden = false;
  bannerDismiss.focus();
}
function hideBanner() {
  banner.hidden = true;
}

// --- Copy (the main action) ---
async function handleCopy() {
  const text = input.value.trim();
  if (!text) {
    showBanner('Nothing to copy yet. Paste your text in the box first.', true);
    return;
  }
  // Render synchronously BEFORE the clipboard write so nothing async sits
  // between the tap and the write (iOS Safari requirement).
  const html = renderClipboardHtml(input.value);
  const plain = plainTextFallback(input.value);

  const result = await copyRichText(html, plain);
  if (result.ok) {
    haptic();
    showBanner(
      'Done! Your formatted text is copied. Now open Word or Google Docs and paste.',
      false
    );
  } else {
    showBanner('Sorry, the copy did not work. ' + result.reason, true);
  }
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
  htmlView.textContent = renderClipboardHtml(input.value);
  htmlView.hidden = !htmlView.hidden;
}

function togglePreview() {
  const expanded = previewToggle.getAttribute('aria-expanded') === 'true';
  previewToggle.setAttribute('aria-expanded', String(!expanded));
  preview.hidden = expanded;
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
clearBtn.addEventListener('click', handleClear);
bannerDismiss.addEventListener('click', hideBanner);
previewToggle.addEventListener('click', togglePreview);
copyMdBtn.addEventListener('click', handleCopyMarkdown);
viewHtmlBtn.addEventListener('click', handleViewHtml);

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
