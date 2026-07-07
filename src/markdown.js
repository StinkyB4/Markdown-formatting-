// markdown.js — converts messy Markdown-style text into clean, fully-formatted
// HTML that survives a paste into Word / Google Docs.
//
// Two hard-won lessons baked in here:
//  1. The clipboard's text/html flavor is what Word and Docs read for
//     formatting — but they IGNORE <style> sheets. Every style that must
//     survive (monospace code, table borders) has to be an INLINE style
//     attribute. So after rendering we walk the DOM and inline the styles.
//  2. Typographic substitution (smart quotes/dashes) silently corrupts code,
//     so it is turned OFF.

import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import taskLists from 'markdown-it-task-lists';
import DOMPurify from 'dompurify';

const md = new MarkdownIt({
  html: false, // don't trust raw HTML from pasted text
  linkify: true, // turn bare URLs into links
  breaks: true, // a single newline becomes a <br> — matches what people expect
  typographer: false, // NEVER rewrite quotes/dashes — it corrupts code
})
  .use(footnote)
  .use(taskLists, { label: true, labelAfter: true });

// Inline styles applied at copy time so formatting survives the clipboard.
// Keyed by tag name (lowercase).
const INLINE_STYLES = {
  pre:
    'background:#f4f4f4; border:1px solid #d0d0d0; border-radius:6px; ' +
    'padding:10px 12px; white-space:pre; overflow-x:auto; ' +
    "font-family:'Courier New',Consolas,monospace; font-size:0.95em;",
  code:
    "font-family:'Courier New',Consolas,monospace; " +
    'background:#f4f4f4; padding:1px 4px; border-radius:4px; font-size:0.95em;',
  table: 'border-collapse:collapse; width:auto;',
  th:
    'border:1px solid #999; padding:6px 10px; background:#efefef; ' +
    'text-align:left; font-weight:bold;',
  td: 'border:1px solid #999; padding:6px 10px;',
  blockquote:
    'border-left:4px solid #ccc; margin:0.5em 0; padding:0.2em 0 0.2em 1em; ' +
    'color:#555;',
  h1: 'font-size:2em; margin:0.4em 0;',
  h2: 'font-size:1.6em; margin:0.4em 0;',
  h3: 'font-size:1.3em; margin:0.4em 0;',
};

// A <code> inside a <pre> is a code block — it should not get the little
// inline-code chip styling (padding/background), the <pre> already handles it.
function styleElement(el) {
  const tag = el.tagName.toLowerCase();
  if (tag === 'code' && el.parentElement && el.parentElement.tagName.toLowerCase() === 'pre') {
    el.setAttribute(
      'style',
      "font-family:'Courier New',Consolas,monospace; background:none; padding:0; font-size:1em;"
    );
    return;
  }
  const style = INLINE_STYLES[tag];
  if (style) el.setAttribute('style', style);
}

// Render Markdown -> sanitized HTML string, used for the on-screen PREVIEW.
export function renderPreviewHtml(markdownText) {
  const raw = md.render(markdownText || '');
  return DOMPurify.sanitize(raw, {
    // Keep the useful inline tags a power user might paste, plus everything
    // needed for GFM tables / task lists / footnotes.
    ADD_TAGS: ['kbd', 'sub', 'sup', 'details', 'summary'],
    // Keep the checkbox inputs from task lists (disabled) and inline styles.
    ADD_ATTR: ['checked', 'disabled', 'type', 'style', 'target', 'rel', 'id', 'href'],
  });
}

// Render Markdown -> sanitized, INLINE-STYLED HTML fragment for the CLIPBOARD.
// This is the version that gets pasted into Word / Google Docs.
export function renderClipboardHtml(markdownText) {
  const clean = renderPreviewHtml(markdownText);
  const container = document.createElement('div');
  container.innerHTML = clean;
  container.querySelectorAll('*').forEach(styleElement);
  // A wrapping div carrying the base font so the whole paste is consistent.
  return (
    '<div style="font-family:Calibri,Arial,sans-serif; font-size:11pt; ' +
    'line-height:1.4; color:#000;">' +
    container.innerHTML +
    '</div>'
  );
}

// Plain-text fallback flavor for the clipboard — the original Markdown text.
export function plainTextFallback(markdownText) {
  return markdownText || '';
}
