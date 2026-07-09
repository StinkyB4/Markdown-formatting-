// theme.js — the sorbet flavor switcher.
//
// Each flavor is a light, pastel palette. The palette values themselves live in
// style.css under [data-sorbet="..."]; this module just sets that attribute on
// <html>, remembers the choice, and keeps the swatch buttons in sync.

const FLAVORS = ['strawberry', 'lime', 'orange', 'blueberry', 'grape'];
const DEFAULT = 'strawberry';
const KEY = 'pp-flavor';

function setThemeColorMeta() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const accent = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent')
    .trim();
  if (accent) meta.setAttribute('content', accent);
}

function applyFlavor(id) {
  const flavor = FLAVORS.includes(id) ? id : DEFAULT;
  document.documentElement.dataset.sorbet = flavor;
  try {
    localStorage.setItem(KEY, flavor);
  } catch {
    /* private mode — theme still applies for this session */
  }
  document.querySelectorAll('.flavor-swatch').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.flavor === flavor));
  });
  setThemeColorMeta();
}

export function initFlavors() {
  let saved = DEFAULT;
  try {
    saved = localStorage.getItem(KEY) || DEFAULT;
  } catch {
    /* ignore */
  }
  applyFlavor(saved);
  document.querySelectorAll('.flavor-swatch').forEach((btn) => {
    btn.addEventListener('click', () => applyFlavor(btn.dataset.flavor));
  });
}
