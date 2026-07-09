// markdown.js — converts messy Markdown-style text into clean, fully-formatted
// HTML that survives a paste into Word / Google Docs.
//
// Two hard-won lessons baked in here:
//  1. The clipboard's text/html flavor is what Word and Docs read for
//     formatting — but they IGNORE <style> sheets. Every style that must
//     survive (monospace code, table borders) has to be an INLINE style
//     attribute. So after rendering we walk the DOM and inline the styles.
//  2. Typographic substitution (smart quotes/dashes) silently corrupts code,
//     so it is OFF by default (the user can opt in via Advanced formatting).
//
// Everything here is driven by a formatting-options object (see settings.js).
// Passing no options falls back to the built-in defaults, so callers that
// don't care about customization keep working unchanged.

import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import taskLists from 'markdown-it-task-lists';
import DOMPurify from 'dompurify';
import { DEFAULTS } from './settings.js';

// markdown-it instances are relatively expensive to build, and only three of
// its constructor flags are user-adjustable (linkify / breaks / typographer).
// Cache one instance per unique combination of those flags.
const mdCache = new Map();
function getMd(opts) {
  const key = `${opts.linkify}|${opts.breaks}|${opts.typographer}`;
  let instance = mdCache.get(key);
  if (!instance) {
    instance = new MarkdownIt({
      html: false, // don't trust raw HTML from pasted text
      linkify: opts.linkify,
      breaks: opts.breaks,
      typographer: opts.typographer,
    })
      .use(footnote)
      .use(taskLists, { label: true, labelAfter: true });
    mdCache.set(key, instance);
  }
  return instance;
}

// Build the per-tag inline styles from the formatting options. These are
// applied at copy time so the formatting survives the clipboard.
function buildInlineStyles(o) {
  return {
    pre:
      `background:${o.codeBg}; border:1px solid ${o.codeBorder}; ` +
      'border-radius:6px; padding:10px 12px; white-space:pre; overflow-x:auto; ' +
      `font-family:${o.codeFont}; font-size:0.95em;`,
    code:
      `font-family:${o.codeFont}; ` +
      `background:${o.codeBg}; padding:1px 4px; border-radius:4px; font-size:0.95em;`,
    table: 'border-collapse:collapse; width:auto;',
    th:
      `border:1px solid ${o.tableBorder}; padding:6px 10px; ` +
      `background:${o.tableHeaderBg}; text-align:left; font-weight:bold;`,
    td: `border:1px solid ${o.tableBorder}; padding:6px 10px;`,
    blockquote:
      `border-left:4px solid ${o.quoteBar}; margin:0.5em 0; ` +
      `padding:0.2em 0 0.2em 1em; color:${o.quoteColor};`,
    h1: `font-size:${o.h1Size}em; margin:0.4em 0; color:${o.headingColor};`,
    h2: `font-size:${o.h2Size}em; margin:0.4em 0; color:${o.headingColor};`,
    h3: `font-size:${o.h3Size}em; margin:0.4em 0; color:${o.headingColor};`,
  };
}

// A <code> inside a <pre> is a code block — it should not get the little
// inline-code chip styling (padding/background), the <pre> already handles it.
function styleElement(el, inlineStyles, codeFont) {
  const tag = el.tagName.toLowerCase();
  if (tag === 'code' && el.parentElement && el.parentElement.tagName.toLowerCase() === 'pre') {
    el.setAttribute(
      'style',
      `font-family:${codeFont}; background:none; padding:0; font-size:1em;`
    );
    return;
  }
  const style = inlineStyles[tag];
  if (style) el.setAttribute('style', style);
}

// Merge caller options over the defaults so a partial object is always safe.
function withDefaults(options) {
  return { ...DEFAULTS, ...(options || {}) };
}

// Render Markdown -> sanitized HTML string, used for the on-screen PREVIEW.
export function renderPreviewHtml(markdownText, options) {
  const o = withDefaults(options);
  const raw = getMd(o).render(markdownText || '');
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
export function renderClipboardHtml(markdownText, options) {
  const o = withDefaults(options);
  const clean = renderPreviewHtml(markdownText, o);
  const inlineStyles = buildInlineStyles(o);
  const container = document.createElement('div');
  container.innerHTML = clean;
  container.querySelectorAll('*').forEach((el) => styleElement(el, inlineStyles, o.codeFont));
  // A wrapping div carrying the base font so the whole paste is consistent.
  return (
    `<div style="font-family:${o.fontFamily}; font-size:${o.fontSize}pt; ` +
    `line-height:${o.lineHeight}; color:${o.textColor};">` +
    container.innerHTML +
    '</div>'
  );
}

// Plain-text fallback flavor for the clipboard — the original Markdown text.
// Used as the text/plain companion to the rich HTML copy.
export function plainTextFallback(markdownText) {
  return markdownText || '';
}

// --- Plain text (markdown stripped out) -----------------------------------
// Renders the Markdown, then walks the resulting DOM to produce clean prose:
// no #, *, backticks or other syntax — just the words, with sensible line
// breaks and list bullets so structure is still readable.
export function plainTextFromMarkdown(markdownText, options) {
  const clean = renderPreviewHtml(markdownText, options);
  const container = document.createElement('div');
  container.innerHTML = clean;
  const text = domToPlainText(container);
  // Collapse runs of blank lines and trim the edges.
  return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Block-level tags force a line break before/after their text so paragraphs,
// headings and list items don't run together.
const BLOCK_TAGS = new Set([
  'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'pre', 'ul', 'ol', 'li', 'table', 'tr', 'hr',
]);

function domToPlainText(root) {
  let out = '';

  const walk = (node, listInfo) => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        out += child.nodeValue.replace(/\s+/g, ' ');
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;

      const tag = child.tagName.toLowerCase();

      if (tag === 'br') {
        out += '\n';
        continue;
      }
      if (tag === 'hr') {
        out += '\n\n';
        continue;
      }
      // Skip the disabled checkboxes markdown-it emits for task lists.
      if (tag === 'input') continue;

      if (tag === 'li') {
        if (out && !out.endsWith('\n')) out += '\n';
        if (listInfo && listInfo.ordered) {
          out += `${listInfo.index}. `;
          listInfo.index += 1;
        } else {
          out += '- ';
        }
        walk(child, null);
        continue;
      }

      if (tag === 'ul' || tag === 'ol') {
        if (out && !out.endsWith('\n')) out += '\n';
        walk(child, { ordered: tag === 'ol', index: 1 });
        out += '\n';
        continue;
      }

      const isBlock = BLOCK_TAGS.has(tag);
      if (isBlock && out && !out.endsWith('\n')) out += '\n';
      walk(child, listInfo);
      if (isBlock) out += '\n';
    }
  };

  walk(root, null);
  return out;
}
