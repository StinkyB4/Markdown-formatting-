// clipboard.js — the make-or-break part of the app.
//
// Goal: put BOTH a text/html flavor (formatted, what Word/Docs read) and a
// text/plain flavor (fallback) on the clipboard, from inside a user tap.
//
// Hard lesson from the field: in the Android WebView (Capacitor), the async
// Clipboard API `navigator.clipboard.write()` RESOLVES SUCCESSFULLY but only
// delivers the text/plain flavor to other apps — the text/html is dropped. So
// Word/Docs paste the raw Markdown. Because it doesn't throw, you can't tell.
//
// The reliable technique — used by every rich editor, including Google Docs —
// is to intercept the `copy` event and call clipboardData.setData() for both
// flavors explicitly, driven by execCommand('copy'). That lands genuine HTML on
// the system clipboard, and it runs synchronously inside the tap (which also
// keeps iOS Safari happy). We try that first, and only fall back to the async
// API if it's unavailable.

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
async function nativeRichCopy(html, plain) {
  const cap = typeof window !== 'undefined' ? window.Capacitor : undefined;
  // Only take this path on an actual native build. On the plain web app
  // window.Capacitor is undefined (or isNativePlatform() is false).
  const isNative =
    cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform();
  if (!isNative) return null;

  const plugin = cap.Plugins && cap.Plugins.RichClipboard;
  if (!plugin || typeof plugin.copyHtml !== 'function') return null;

  try {
    const res = await plugin.copyHtml({ html, plain });
    if (res && res.copied) return { ok: true };
    return { ok: false, reason: 'The clipboard did not accept the formatted text.' };
  } catch (err) {
    return { ok: false, reason: describeError(err) };
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
