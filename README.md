# Femdom Porn Progress Tracker

A **private, offline, local-only** personal tracking app for your long-term
relationship with femdom porn — usage patterns, masturbation/gooning behaviour,
dependency, emotional attachment, identity attachment, and progression over time.

It is a single self-contained static web app: **no build step, no server, no
accounts, no network calls.** All data lives in your browser's `localStorage`
and never leaves your device.

## Running it

Just open `index.html` in a browser.

For full functionality (some browsers restrict `localStorage` on `file://`),
serve the folder over a local web server instead:

```bash
cd femdom-tracker
python3 -m http.server 8000
# then open http://localhost:8000
```

No dependencies need to be installed.

## Features

**Dashboard** — today's femdom-porn hours, gooning hours and orgasm count;
current urge / intrusive-thoughts / identity-attachment / dependency levels
(0–10 gauges); weekly & monthly total hours; longest session this week; a
14-day hours trend; and your auto-calculated progression level — all shown with
charts and progress indicators.

**Daily Log Entry** — date, start/end time, auto-calculated total hours;
session-type checkboxes (femdom porn, gooning, masturbation, orgasm) + orgasm
count; seven 0–10 intensity sliders (urges, intrusive thoughts, craving,
dependency feeling, identity attachment, feeling owned, emotional connection);
seven 0–10 identity sliders; a 9-option emotional-state multi-select; and a
notes area.

**Dependency Tracker** — daily / weekly / monthly hours, average session
duration, longest session ever, consecutive usage days, consecutive gooning
days, plus trend charts.

**Identity Tracker** — current readings for all seven identity statements, with
attachment charted across **weeks, months and years**, and a per-statement
breakdown.

**Progression Levels** — automatically calculates your level (1 Casual Interest
→ 5 Central Identity) from a weighted score over the last 30 days (usage
frequency, daily hours, identity, dependency and emotional attachment), and
shows what drives the score plus the full 5-level ladder.

**Historical Timeline** — first entry, major usage increases, longest sessions,
identity & dependency score milestones, and monthly summaries.

**Analytics** — usage (daily / weekly / monthly hours), identity / dependency /
emotional scores over time, and behaviour (gooning hours, orgasm frequency,
streaks).

**Weekly Review** — computed totals, averages and longest session for the week,
plus four reflection prompts (importance, dependence, centrality, changes
noticed) stored historically and browsable week-by-week.

**Design** — dark mode, mobile-friendly (sidebar on desktop, bottom tabs +
drawer on mobile), calendar view with month heat-map, detailed statistics,
progress charts, weekly/monthly reports **exportable to PDF** (via the browser
print dialog), local data storage, and full-text search over previous logs.

## Data & backup

- Everything is stored under a single `localStorage` key on this device only.
- **Settings → Backup** exports/imports a JSON file so you can move or save your
  data.
- **Settings → Demo & reset** can load ~90 days of sample data to explore the
  app, or erase everything.

## Tech

Plain HTML / CSS / vanilla JavaScript with hand-built SVG charts. No frameworks,
no third-party libraries, no external requests — chosen deliberately so a
private tracker stays fully self-contained and offline.

```
femdom-tracker/
├── index.html
├── css/styles.css
└── js/
    ├── core.js     namespace, constants, date utils, localStorage store
    ├── stats.js    totals, averages, streaks, level, milestones, summaries
    ├── charts.js   dependency-free SVG charts (line, bar, gauge, ring, meter)
    ├── views.js    every screen + the log/review forms
    ├── report.js   printable PDF report builder
    └── app.js      hash router, navigation, bootstrap
```
