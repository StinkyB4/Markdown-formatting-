// clipboard.js — the make-or-break part of the app.
//
// Goal: put BOTH a text/html flavor (formatted, what Word/Docs read) and a
// text/plain flavor (fallback) on the clipboard, from inside a user tap.
//
// iOS Safari is the fussy one. Two rules that keep it working:
//  - Build the ClipboardItem SYNCHRONOUSLY inside the tap handler. Don't await
//    anything between the gesture and constructing the item, or Safari treats
//    the write as not-user-initiated and rejects it.
//  - Provide Blobs directly (already-resolved data), not async Promises.
//
// If the async Clipboard API isn't available or throws, we fall back to the
// old-but-reliable execCommand path, which also carries rich HTML. We surface
// the outcome to the caller either way — we never fail silently.

// Returns { ok: true } or { ok: false, reason: string }.
export async function copyRichText(html, plain) {
  // Preferred path: async Clipboard API with two flavors.
  if (navigator.clipboard && typeof navigator.clipboard.write === 'function' && typeof ClipboardItem !== 'undefined') {
    try {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([item]);
      return { ok: true };
    } catch (err) {
      // Fall through to the legacy path below.
      const legacy = legacyCopy(html);
      if (legacy) return { ok: true };
      return { ok: false, reason: describeError(err) };
    }
  }

  // Legacy-only path (older browsers).
  if (legacyCopy(html)) return { ok: true };
  return { ok: false, reason: 'This browser will not let the app copy for you.' };
}

// execCommand('copy') over a selected contentEditable region carries the HTML
// formatting with it. Deprecated but still widely supported and a good net.
function legacyCopy(html) {
  try {
    const holder = document.createElement('div');
    holder.setAttribute('contenteditable', 'true');
    holder.style.position = 'fixed';
    holder.style.left = '-9999px';
    holder.style.top = '0';
    holder.innerHTML = html;
    document.body.appendChild(holder);

    const range = document.createRange();
    range.selectNodeContents(holder);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const ok = document.execCommand('copy');
    sel.removeAllRanges();
    document.body.removeChild(holder);
    return ok;
  } catch {
    return false;
  }
}

function describeError(err) {
  if (err && err.name === 'NotAllowedError') {
    return 'The browser blocked the copy. Please tap the button again.';
  }
  return 'Something stopped the copy. Please tap the button again.';
}
