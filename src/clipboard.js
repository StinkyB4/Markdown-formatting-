// clipboard.js — the make-or-break part of the app.
//
// Goal: put BOTH a text/html flavor (formatted, what Word/Docs read) and a
// text/plain flavor (fallback) on the clipboard, from inside a user tap.
//
// Hard lesson from the field: in the Android WebView (Capacitor), NOTHING JS
// does can put a text/html flavor on the system clipboard — both
// navigator.clipboard.write() and the copy-event setData('text/html', …) trick
// deliver only text/plain, so Word/Docs paste the raw Markdown. The only
// reliable fix on Android is to build the ClipData natively (see
// RichClipboardPlugin.java), which we reach through the Capacitor bridge.
//
// On the desktop/web build there is no native bridge, so we fall back to the
// copy-event interception (reliable in real browsers and iOS Safari) and then
// the async Clipboard API.

import { Capacitor, registerPlugin } from '@capacitor/core';

// A native-only plugin. registerPlugin() returns a proxy that works on device
// and, on the plain web build, simply rejects — which is fine because we only
// call it when Capacitor.isNativePlatform() is true.
const RichClipboard = registerPlugin('RichClipboard');

// Returns { ok: true } or { ok: false, reason: string }.
export async function copyRichText(html, plain) {
  // On a native build (Capacitor/Android) the WebView silently drops the
  // text/html flavor no matter how we write it from JS — both
  // navigator.clipboard.write() and the copy-event trick deliver only
  // text/plain, so Word/Docs paste raw Markdown. The native bridge builds the
  // ClipData directly, so it MUST be tried first when it's available.
  const native = await nativeRichCopy(html, plain);
  if (native) return native;

  // Primary web path: copy-event interception (reliable for rich text in
  // desktop browsers and iOS Safari).
  if (richCopyViaEvent(html, plain)) return { ok: true };

  // Fallback: async Clipboard API with two flavors.
  if (
    navigator.clipboard &&
    typeof navigator.clipboard.write === 'function' &&
    typeof ClipboardItem !== 'undefined'
  ) {
    try {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([item]);
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: describeError(err) };
    }
  }

  return { ok: false, reason: 'This browser will not let the app copy for you.' };
}

// Native rich-clipboard bridge (Capacitor/Android). Returns:
//   { ok: true } / { ok: false, reason }  when it handled the copy, or
//   null                                    when there is no native bridge, so
//                                           the caller falls back to the web
//                                           paths.
//
// On native we do NOT fall back to the web copy paths: they are known to drop
// the HTML on Android, so a "fallback" there would silently paste Markdown and
// wrongly report success. If the native call fails we surface the error.
async function nativeRichCopy(html, plain) {
  if (!isNativePlatform()) return null;
  try {
    const res = await RichClipboard.copyHtml({ html, plain });
    if (res && res.copied) return { ok: true };
    return { ok: false, reason: 'The clipboard did not accept the formatted text.' };
  } catch (err) {
    return { ok: false, reason: describeError(err) };
  }
}

// True only inside the Capacitor native shell (Android app), false on web.
export function isNativePlatform() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

// Select an off-screen rich node, intercept the copy event, and write both
// flavors explicitly. The setData('text/html', …) is what makes formatting
// survive the paste into Word / Google Docs.
function richCopyViaEvent(html, plain) {
  let wroteData = false;

  const onCopy = (e) => {
    if (!e.clipboardData) return;
    e.clipboardData.setData('text/html', html);
    e.clipboardData.setData('text/plain', plain);
    e.preventDefault();
    wroteData = true;
  };

  // execCommand('copy') only fires the copy event when something is selected,
  // so we select a hidden holder that also carries the rich HTML (belt and
  // suspenders: even if setData were ignored, the selection serialises to HTML).
  const holder = document.createElement('div');
  holder.setAttribute('contenteditable', 'true');
  holder.setAttribute('aria-hidden', 'true');
  holder.style.position = 'fixed';
  holder.style.left = '-9999px';
  holder.style.top = '0';
  holder.style.opacity = '0';
  holder.style.pointerEvents = 'none';
  holder.innerHTML = html;
  document.body.appendChild(holder);

  const selection = window.getSelection();
  const savedRanges = [];
  for (let i = 0; i < selection.rangeCount; i++) savedRanges.push(selection.getRangeAt(i));

  const range = document.createRange();
  range.selectNodeContents(holder);
  selection.removeAllRanges();
  selection.addRange(range);

  let commandOk = false;
  document.addEventListener('copy', onCopy, true);
  try {
    commandOk = document.execCommand('copy');
  } catch {
    commandOk = false;
  } finally {
    document.removeEventListener('copy', onCopy, true);
    selection.removeAllRanges();
    savedRanges.forEach((r) => selection.addRange(r));
    holder.remove();
  }

  return wroteData && commandOk;
}

function describeError(err) {
  if (err && err.name === 'NotAllowedError') {
    return 'The browser blocked the copy. Please tap the button again.';
  }
  return 'Something stopped the copy. Please tap the button again.';
}
