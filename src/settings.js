// settings.js — the Advanced formatting panel.
//
// One object holds every knob that shapes the output. The defaults reproduce
// the app's original look exactly, so an untouched install behaves as before.
// The panel below is generated from a schema so there is a single source of
// truth: add a field to SCHEMA and it shows up in the UI and is persisted.

export const DEFAULTS = {
  // Parsing (markdown-it constructor flags)
  linkify: true, // turn bare URLs into links
  breaks: true, // a single newline becomes a line break
  typographer: false, // smart quotes / dashes — off: it corrupts code

  // Base text
  fontFamily: 'Calibri, Arial, sans-serif',
  fontSize: 11, // pt
  lineHeight: 1.4,
  textColor: '#000000',

  // Headings
  headingColor: '#000000',
  h1Size: 2, // em
  h2Size: 1.6,
  h3Size: 1.3,

  // Code
  codeFont: "'Courier New', Consolas, monospace",
  codeBg: '#f4f4f4',
  codeBorder: '#d0d0d0',

  // Tables
  tableBorder: '#999999',
  tableHeaderBg: '#efefef',

  // Blockquotes
  quoteBar: '#cccccc',
  quoteColor: '#555555',
};

const KEY = 'pp-format';

const FONT_CHOICES = [
  ['Calibri, Arial, sans-serif', 'Calibri (default)'],
  ['Arial, Helvetica, sans-serif', 'Arial'],
  ["'Times New Roman', Times, serif", 'Times New Roman'],
  ['Georgia, serif', 'Georgia'],
  ['Cambria, Georgia, serif', 'Cambria'],
  ["'Segoe UI', system-ui, sans-serif", 'Segoe UI'],
  ['Verdana, Geneva, sans-serif', 'Verdana'],
];

const CODE_FONT_CHOICES = [
  ["'Courier New', Consolas, monospace", 'Courier New (default)'],
  ['Consolas, monospace', 'Consolas'],
  ["'Cascadia Code', monospace", 'Cascadia Code'],
  ['monospace', 'System monospace'],
];

// The panel layout. Each field maps 1:1 to a key in DEFAULTS.
const SCHEMA = [
  {
    title: 'How your text is read',
    fields: [
      { key: 'linkify', type: 'toggle', label: 'Turn web addresses into clickable links' },
      { key: 'breaks', type: 'toggle', label: 'Keep single line breaks' },
      { key: 'typographer', type: 'toggle', label: 'Smart quotes and dashes (may change code)' },
    ],
  },
  {
    title: 'Main text',
    fields: [
      { key: 'fontFamily', type: 'select', label: 'Font', choices: FONT_CHOICES },
      { key: 'fontSize', type: 'number', label: 'Text size (pt)', min: 6, max: 48, step: 1 },
      { key: 'lineHeight', type: 'number', label: 'Line spacing', min: 1, max: 3, step: 0.1 },
      { key: 'textColor', type: 'color', label: 'Text color' },
    ],
  },
  {
    title: 'Headings',
    fields: [
      { key: 'headingColor', type: 'color', label: 'Heading color' },
      { key: 'h1Size', type: 'number', label: 'Big heading size', min: 1, max: 4, step: 0.1 },
      { key: 'h2Size', type: 'number', label: 'Medium heading size', min: 1, max: 4, step: 0.1 },
      { key: 'h3Size', type: 'number', label: 'Small heading size', min: 1, max: 4, step: 0.1 },
    ],
  },
  {
    title: 'Code',
    fields: [
      { key: 'codeFont', type: 'select', label: 'Code font', choices: CODE_FONT_CHOICES },
      { key: 'codeBg', type: 'color', label: 'Code background' },
      { key: 'codeBorder', type: 'color', label: 'Code border' },
    ],
  },
  {
    title: 'Tables',
    fields: [
      { key: 'tableBorder', type: 'color', label: 'Table lines' },
      { key: 'tableHeaderBg', type: 'color', label: 'Table header fill' },
    ],
  },
  {
    title: 'Quotes',
    fields: [
      { key: 'quoteBar', type: 'color', label: 'Quote bar' },
      { key: 'quoteColor', type: 'color', label: 'Quote text' },
    ],
  },
];

export function loadSettings() {
  let saved = {};
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) saved = JSON.parse(raw);
  } catch {
    /* corrupt or unavailable — fall back to defaults */
  }
  // Only accept keys we know about, so stray/old data can't leak in.
  const clean = {};
  for (const k of Object.keys(DEFAULTS)) {
    if (k in saved) clean[k] = saved[k];
  }
  return { ...DEFAULTS, ...clean };
}

function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* private mode — settings still apply for this session */
  }
}

// Build the controls inside the dialog and keep them in sync with `settings`.
// `onChange` is called (debounced by the caller if needed) after every edit.
export function initAdvancedPanel(settings, onChange) {
  const dialog = document.getElementById('advanced-dialog');
  const openBtn = document.getElementById('advanced-btn');
  const closeBtn = document.getElementById('advanced-close');
  const resetBtn = document.getElementById('advanced-reset');
  const body = document.getElementById('advanced-body');
  if (!dialog || !openBtn || !body) return;

  const controls = []; // { key, set(value) } — used to refresh on reset

  const commit = (key, value) => {
    settings[key] = value;
    saveSettings(settings);
    onChange();
  };

  for (const section of SCHEMA) {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'adv-section';

    const legend = document.createElement('legend');
    legend.className = 'adv-legend';
    legend.textContent = section.title;
    fieldset.appendChild(legend);

    for (const field of section.fields) {
      const { row, set } = buildControl(field, settings[field.key], commit);
      fieldset.appendChild(row);
      controls.push({ key: field.key, set });
    }
    body.appendChild(fieldset);
  }

  const openDialog = () => {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  };
  const closeDialog = () => {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  };

  openBtn.addEventListener('click', openDialog);
  if (closeBtn) closeBtn.addEventListener('click', closeDialog);
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      Object.assign(settings, DEFAULTS);
      saveSettings(settings);
      controls.forEach((c) => c.set(settings[c.key]));
      onChange();
    });
  }
}

// Create one labelled control. Returns the row element and a setter that
// updates the widget when settings change under it (e.g. Reset to defaults).
function buildControl(field, value, commit) {
  const row = document.createElement('label');
  row.className = `adv-row adv-${field.type}`;

  const text = document.createElement('span');
  text.className = 'adv-row-label';
  text.textContent = field.label;

  let input;
  let set;

  if (field.type === 'toggle') {
    input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'adv-checkbox';
    input.checked = !!value;
    input.addEventListener('change', () => commit(field.key, input.checked));
    set = (v) => { input.checked = !!v; };
    // Checkbox first, then the label text, for a natural toggle row.
    row.appendChild(input);
    row.appendChild(text);
    return { row, set };
  }

  if (field.type === 'select') {
    input = document.createElement('select');
    input.className = 'adv-select';
    for (const [val, label] of field.choices) {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = label;
      input.appendChild(opt);
    }
    input.value = value;
    input.addEventListener('change', () => commit(field.key, input.value));
    set = (v) => { input.value = v; };
  } else if (field.type === 'color') {
    input = document.createElement('input');
    input.type = 'color';
    input.className = 'adv-color';
    input.value = value;
    input.addEventListener('input', () => commit(field.key, input.value));
    set = (v) => { input.value = v; };
  } else {
    // number
    input = document.createElement('input');
    input.type = 'number';
    input.className = 'adv-number';
    input.min = field.min;
    input.max = field.max;
    input.step = field.step;
    input.value = value;
    input.addEventListener('change', () => {
      let v = parseFloat(input.value);
      if (Number.isNaN(v)) v = DEFAULTS[field.key];
      v = Math.min(field.max, Math.max(field.min, v));
      input.value = v;
      commit(field.key, v);
    });
    set = (v) => { input.value = v; };
  }

  row.appendChild(text);
  row.appendChild(input);
  return { row, set };
}
