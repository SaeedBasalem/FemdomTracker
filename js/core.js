/* ==========================================================================
 * core.js — namespace, constants, date/dom utilities, and local storage.
 * Everything is attached to the global `FT` object so the app works by
 * simply opening index.html (no bundler / no ES-module / no network calls).
 * ======================================================================== */
window.FT = window.FT || {};

/* ---------------------------------------------------------------- constants */
FT.constants = {
  STORAGE_KEY: 'ft_data_v1',

  SESSION_TYPES: [
    ['femdomPorn', 'Femdom porn'],
    ['gooning', 'Gooning'],
    ['masturbation', 'Masturbation'],
    ['orgasm', 'Orgasm'],
  ],

  // 0–10 intensity sliders captured on every log entry.
  INTENSITY_SLIDERS: [
    ['urges', 'Urges'],
    ['intrusiveThoughts', 'Intrusive thoughts'],
    ['craving', 'Craving'],
    ['dependencyFeeling', 'Dependency feeling'],
    ['identityAttachment', 'Identity attachment'],
    ['feelingOwned', 'Feeling owned by femdom'],
    ['emotionalConnection', 'Feeling emotionally connected to femdom'],
  ],

  // 0–10 identity sliders (Identity Tracker).
  IDENTITY_SLIDERS: [
    ['partOfWhoIAm', 'Femdom feels like part of who I am'],
    ['centralToLife', 'Femdom feels central to my life'],
    ['primarySexualOutlet', 'Femdom is my primary sexual outlet'],
    ['emotionallyImportant', 'Femdom is emotionally important to me'],
    ['moreThanRelationships', 'Femdom feels more important than relationships'],
    ['defineMyself', 'I define myself through femdom'],
    ['belonging', 'I feel belonging through femdom'],
  ],

  EMOTIONS: [
    'Lonely', 'Accepted', 'Comforted', 'Happy', 'Excited',
    'Hopeless', 'Relaxed', 'Motivated', 'Neutral',
  ],

  LEVELS: [
    {
      n: 1, name: 'Casual Interest',
      chars: ['Occasional usage', 'Low emotional attachment', 'Low identity attachment'],
    },
    {
      n: 2, name: 'Regular Habit',
      chars: ['Frequent usage', 'Routine behaviour', 'Increasing emotional reliance'],
    },
    {
      n: 3, name: 'Strong Attachment',
      chars: ['Daily thoughts', 'Emotional comfort from femdom', 'Growing identity attachment'],
    },
    {
      n: 4, name: 'Integrated Lifestyle',
      chars: ['Regular daily use', 'Femdom influences self-image', 'Significant emotional connection'],
    },
    {
      n: 5, name: 'Central Identity',
      chars: ['Femdom viewed as a core part of self', 'Strong dependency', 'Most important sexual outlet', 'Strong emotional attachment'],
    },
  ],

  WEEKLY_REVIEW_QUESTIONS: [
    ['importance', 'How important did femdom feel this week?', 'slider'],
    ['dependence', 'How dependent did you feel this week?', 'slider'],
    ['centrality', 'How central was femdom to your identity this week?', 'slider'],
    ['changes', 'What changes did you notice?', 'text'],
  ],
};

/* ------------------------------------------------------------------ utils */
FT.util = (function () {
  const pad = (n) => String(n).padStart(2, '0');

  /** Local 'YYYY-MM-DD' (avoids UTC off-by-one from toISOString). */
  function dateKey(d) {
    d = d || new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function todayKey() { return dateKey(new Date()); }

  /** Parse 'YYYY-MM-DD' to a local-midnight Date. */
  function parseKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  /** Monday-based start of week. */
  function startOfWeek(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    const day = (x.getDay() + 6) % 7; // Mon=0 … Sun=6
    x.setDate(x.getDate() - day);
    return x;
  }

  function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  function monthKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }

  /** Whole-day difference a-b (a later → positive). */
  function diffDays(aKey, bKey) {
    const a = parseKey(aKey), b = parseKey(bKey);
    return Math.round((a - b) / 86400000);
  }

  /** Hours between 'HH:MM' start and end, wrapping past midnight. */
  function hoursBetween(start, end) {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60; // crossed midnight
    return Math.round((mins / 60) * 100) / 100;
  }

  function fmtHours(h) {
    h = h || 0;
    if (h === 0) return '0h';
    const hrs = Math.floor(h);
    const mins = Math.round((h - hrs) * 60);
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  }

  function fmtDate(key, opts) {
    return parseKey(key).toLocaleDateString(undefined,
      opts || { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const round1 = (v) => Math.round(v * 10) / 10;
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const sum = (arr) => arr.reduce((a, b) => a + b, 0);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** Tiny DOM builder: el('div', {class:'x'}, [children|string]). */
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.startsWith('on') && typeof attrs[k] === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else if (attrs[k] != null && attrs[k] !== false) {
          node.setAttribute(k, attrs[k]);
        }
      }
    }
    if (children != null) {
      (Array.isArray(children) ? children : [children]).forEach((c) => {
        if (c == null) return;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return node;
  }

  return {
    dateKey, todayKey, parseKey, addDays, startOfWeek, startOfMonth,
    monthKey, diffDays, hoursBetween, fmtHours, fmtDate,
    clamp, round1, avg, sum, uid, escapeHtml, el,
  };
})();

/* ---------------------------------------------------------------- storage */
FT.store = (function () {
  const KEY = FT.constants.STORAGE_KEY;

  function blank() {
    return { entries: [], reviews: [], settings: { created: new Date().toISOString() } };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      const data = JSON.parse(raw);
      data.entries = data.entries || [];
      data.reviews = data.reviews || [];
      data.settings = data.settings || {};
      return data;
    } catch (e) {
      console.error('Failed to load data', e);
      return blank();
    }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
    document.dispatchEvent(new CustomEvent('ft:datachanged'));
  }

  /* ---- entries ---- */
  function entries() {
    return load().entries.slice().sort((a, b) =>
      a.date === b.date
        ? (a.startTime || '').localeCompare(b.startTime || '')
        : a.date.localeCompare(b.date));
  }

  function upsertEntry(entry) {
    const data = load();
    const now = new Date().toISOString();
    if (entry.id) {
      const i = data.entries.findIndex((e) => e.id === entry.id);
      if (i >= 0) { data.entries[i] = { ...data.entries[i], ...entry, updatedAt: now }; }
      else { data.entries.push({ ...entry, createdAt: now, updatedAt: now }); }
    } else {
      entry.id = FT.util.uid();
      entry.createdAt = now;
      entry.updatedAt = now;
      data.entries.push(entry);
    }
    save(data);
    return entry.id;
  }

  function deleteEntry(id) {
    const data = load();
    data.entries = data.entries.filter((e) => e.id !== id);
    save(data);
  }

  function getEntry(id) {
    return load().entries.find((e) => e.id === id) || null;
  }

  /* ---- weekly reviews ---- */
  function reviews() {
    return load().reviews.slice().sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  }

  function upsertReview(review) {
    const data = load();
    const i = data.reviews.findIndex((r) => r.weekStart === review.weekStart);
    review.createdAt = review.createdAt || new Date().toISOString();
    if (i >= 0) data.reviews[i] = { ...data.reviews[i], ...review };
    else data.reviews.push(review);
    save(data);
  }

  /* ---- backup ---- */
  function exportJSON() { return JSON.stringify(load(), null, 2); }

  function importJSON(text) {
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.entries)) throw new Error('Invalid backup file');
    parsed.reviews = parsed.reviews || [];
    parsed.settings = parsed.settings || {};
    save(parsed);
  }

  function clearAll() { save(blank()); }

  /* ---- demo seed (for trying the app out) ---- */
  function seedDemo() {
    const data = blank();
    const rnd = (a, b) => a + Math.random() * (b - a);
    const today = new Date();
    for (let i = 90; i >= 0; i--) {
      if (Math.random() < 0.25) continue; // skip some days
      const d = FT.util.addDays(today, -i);
      const progress = (90 - i) / 90; // drift upward over time
      const sessions = Math.random() < 0.3 ? 2 : 1;
      for (let s = 0; s < sessions; s++) {
        const startH = Math.floor(rnd(19, 23));
        const len = rnd(0.5, 1.5 + progress * 2.5);
        const endTotal = startH + len;
        const eh = Math.floor(endTotal) % 24;
        const em = Math.floor((endTotal % 1) * 60);
        const goon = Math.random() < 0.4 + progress * 0.4;
        const org = Math.random() < 0.6;
        const lvl = (base) => Math.round(FT.util.clamp(base * progress + rnd(-1.5, 1.5), 0, 10));
        data.entries.push({
          id: FT.util.uid(),
          date: FT.util.dateKey(d),
          startTime: `${String(startH).padStart(2, '0')}:00`,
          endTime: `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`,
          totalHours: Math.round(len * 100) / 100,
          types: { femdomPorn: true, gooning: goon, masturbation: Math.random() < 0.8, orgasm: org },
          orgasmCount: org ? Math.round(rnd(1, 2 + progress * 2)) : 0,
          intensity: {
            urges: lvl(9), intrusiveThoughts: lvl(8), craving: lvl(9),
            dependencyFeeling: lvl(9), identityAttachment: lvl(8),
            feelingOwned: lvl(8), emotionalConnection: lvl(8),
          },
          identity: {
            partOfWhoIAm: lvl(9), centralToLife: lvl(8), primarySexualOutlet: lvl(9),
            emotionallyImportant: lvl(9), moreThanRelationships: lvl(7),
            defineMyself: lvl(7), belonging: lvl(8),
          },
          emotions: [FT.constants.EMOTIONS[Math.floor(Math.random() * FT.constants.EMOTIONS.length)]],
          notes: '',
          createdAt: d.toISOString(), updatedAt: d.toISOString(),
        });
      }
    }
    save(data);
  }

  return {
    load, save, entries, upsertEntry, deleteEntry, getEntry,
    reviews, upsertReview, exportJSON, importJSON, clearAll, seedDemo,
  };
})();
