/* ==========================================================================
 * views.js — every screen of the app. Each view renders into `root` and
 * wires its own events. Shared UI helpers live at the top.
 * ======================================================================== */
window.FT = window.FT || {};

FT.views = (function () {
  const U = FT.util, C = FT.constants, S = FT.stats, Ch = FT.charts;
  const esc = U.escapeHtml;

  /* ----------------------------------------------------------- UI helpers */
  function card(title, body, opts) {
    opts = opts || {};
    return `<section class="card ${opts.class || ''}">
      ${title ? `<div class="card-head"><h3 class="card-title">${esc(title)}</h3>${opts.action || ''}</div>` : ''}
      <div class="card-body">${body}</div></section>`;
  }

  function stat(label, value, sub, accent) {
    return `<div class="stat">
      <div class="stat-value" ${accent ? `style="color:${accent}"` : ''}>${value}</div>
      <div class="stat-label">${esc(label)}</div>
      ${sub ? `<div class="stat-sub">${sub}</div>` : ''}</div>`;
  }

  function levelBadge(lvl) {
    if (!lvl || !lvl.n) return '<span class="lvl-pill lvl-0">No data</span>';
    return `<span class="lvl-pill lvl-${lvl.n}">Level ${lvl.n} · ${esc(lvl.name)}</span>`;
  }

  function emptyState(msg, withSeed) {
    return card('', `<div class="empty">
        <div class="empty-emoji">📊</div>
        <p>${esc(msg)}</p>
        <div class="empty-actions">
          <a class="btn btn-primary" href="#/log">Add your first entry</a>
          ${withSeed ? '<button class="btn btn-ghost" data-action="seed">Load demo data</button>' : ''}
        </div>
      </div>`);
  }

  function sectionLead(text) { return `<p class="lead">${esc(text)}</p>`; }

  /* =====================================================================
   * DASHBOARD
   * ===================================================================== */
  function dashboard(root) {
    const snap = S.snapshot();
    if (!snap.hasData) {
      root.innerHTML = `<h2 class="page-title">Dashboard</h2>` + emptyState(
        'No entries yet. Start tracking to see your femdom-porn dashboard, charts and progression.', true);
      wireSeed(root);
      return;
    }
    const lvl = snap.level;
    const t = snap.today, cur = snap.current;

    // 14-day hours series for the dashboard trend.
    const from = U.dateKey(U.addDays(new Date(), -13));
    const daily = S.dailySeries(snap.entries, (e) => e.totalHours || 0, from, U.todayKey());
    const labels = daily.map((d) => U.parseKey(d.key).toLocaleDateString(undefined, { day: 'numeric' }));
    const trend = Ch.line(labels, [{ name: 'Hours', values: daily.map((d) => U.round1(d.value)), color: Ch.PALETTE.accent }],
      { height: 200 });

    const levelCard = `<section class="card level-card lvl-bg-${lvl.n}">
      <div class="level-top">
        <div>
          <div class="level-eyebrow">Progression level</div>
          <div class="level-name">Level ${lvl.n} — ${esc(lvl.name)}</div>
        </div>
        <div class="level-score">${lvl.score}<span>/100</span></div>
      </div>
      <div class="level-bar"><div class="level-bar-fill" style="width:${lvl.n >= 5 ? 100 : lvl.toNext}%"></div></div>
      <div class="level-meta">${lvl.n >= 5 ? 'Highest level reached' : `${lvl.toNext}% toward Level ${lvl.n + 1}`}</div>
      <ul class="level-chars">${lvl.def.chars.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
      <a class="link-more" href="#/progression">View progression detail →</a>
    </section>`;

    const todayRow = `<div class="stat-grid stat-grid-4">
      ${ringStat(t.femdomHours, 8, 'Femdom-porn hrs today', U.fmtHours(t.femdomHours), Ch.PALETTE.accent)}
      ${ringStat(t.gooningHours, 8, 'Gooning hrs today', U.fmtHours(t.gooningHours), Ch.PALETTE.pink)}
      ${stat('Orgasms today', t.orgasmCount, `${t.sessions} session${t.sessions === 1 ? '' : 's'}`, Ch.PALETTE.amber)}
      ${stat('Longest session this week', U.fmtHours(snap.longestSessionThisWeek), 'current week', Ch.PALETTE.teal)}
    </div>`;

    const gauges = card('Current levels', `<div class="gauge-grid">
      ${gaugeStat('Urges', cur.urges)}
      ${gaugeStat('Intrusive thoughts', cur.intrusiveThoughts)}
      ${gaugeStat('Identity attachment', cur.identityAttachment)}
      ${gaugeStat('Dependency', cur.dependency)}
    </div><div class="muted-note">Latest logged values for ${esc(U.fmtDate(U.todayKey(), { month: 'short', day: 'numeric' }))}.</div>`);

    const totals = `<div class="stat-grid stat-grid-3">
      ${stat('Weekly total hours', U.fmtHours(snap.weeklyHours), 'this calendar week')}
      ${stat('Monthly total hours', U.fmtHours(snap.monthlyHours), 'this calendar month')}
      ${stat('Sessions today', t.sessions, '')}
    </div>`;

    root.innerHTML = `
      <div class="page-head">
        <h2 class="page-title">Dashboard</h2>
        <a class="btn btn-primary" href="#/log">+ Log entry</a>
      </div>
      ${levelCard}
      ${card('Today', todayRow)}
      ${gauges}
      ${card('Totals', totals)}
      ${card('Daily hours — last 14 days', trend)}
    `;
  }

  function ringStat(value, max, label, displayLabel, color) {
    return `<div class="stat ring-stat">
      ${Ch.ring(value, max, { size: 96, color, label: displayLabel, stroke: 9 })}
      <div class="stat-label">${esc(label)}</div></div>`;
  }
  function gaugeStat(label, value) {
    return `<div class="gauge-cell">${Ch.gauge(value, { max: 10 })}<div class="gauge-label">${esc(label)}</div></div>`;
  }

  /* =====================================================================
   * DAILY LOG ENTRY
   * ===================================================================== */
  function log(root, params) {
    const editing = params && params.id ? FT.store.getEntry(params.id) : null;
    const presetDate = (params && params.date) || U.todayKey();
    const e = editing || blankEntry(presetDate);

    const sliderRows = (defs, group) => defs.map(([key, label]) => `
      <label class="slider">
        <span class="slider-top"><span>${esc(label)}</span><b class="slider-val" data-for="${group}.${key}">${(e[group] && e[group][key]) || 0}</b></span>
        <input type="range" min="0" max="10" step="1" value="${(e[group] && e[group][key]) || 0}" data-group="${group}" data-key="${key}">
      </label>`).join('');

    const typeChecks = C.SESSION_TYPES.map(([key, label]) => `
      <label class="chk"><input type="checkbox" data-type="${key}" ${e.types && e.types[key] ? 'checked' : ''}><span>${esc(label)}</span></label>`).join('');

    const emotionChips = C.EMOTIONS.map((em) => `
      <button type="button" class="chip ${(e.emotions || []).includes(em) ? 'active' : ''}" data-emotion="${esc(em)}">${esc(em)}</button>`).join('');

    root.innerHTML = `
      <div class="page-head">
        <h2 class="page-title">${editing ? 'Edit entry' : 'Daily log entry'}</h2>
        ${editing ? `<button class="btn btn-danger" data-action="delete">Delete</button>` : ''}
      </div>
      <form id="log-form" class="log-form">
        ${card('Usage', `
          <div class="field-grid">
            <label class="field"><span>Date</span><input type="date" name="date" value="${e.date}" required></label>
            <label class="field"><span>Start time</span><input type="time" name="startTime" value="${e.startTime || ''}"></label>
            <label class="field"><span>End time</span><input type="time" name="endTime" value="${e.endTime || ''}"></label>
            <label class="field"><span>Total hours</span><input type="number" name="totalHours" min="0" step="0.25" value="${e.totalHours || 0}"></label>
          </div>
          <div class="hint">Total hours auto-fills from start/end time, and you can fine-tune it.</div>`)}

        ${card('Session type', `<div class="chk-grid">${typeChecks}</div>
          <label class="field field-inline"><span>Orgasm count</span><input type="number" name="orgasmCount" min="0" step="1" value="${e.orgasmCount || 0}"></label>`)}

        ${card('Intensity (0–10)', `<div class="slider-grid">${sliderRows(C.INTENSITY_SLIDERS, 'intensity')}</div>`)}

        ${card('Identity (0–10)', `<div class="slider-grid">${sliderRows(C.IDENTITY_SLIDERS, 'identity')}</div>`)}

        ${card('Emotional state', `<div class="chip-grid">${emotionChips}</div>`)}

        ${card('Notes', `<textarea name="notes" class="notes" rows="5" placeholder="Daily observations…">${esc(e.notes || '')}</textarea>`)}

        <div class="form-actions">
          <button type="submit" class="btn btn-primary btn-lg">${editing ? 'Save changes' : 'Save entry'}</button>
          <a class="btn btn-ghost" href="#/dashboard">Cancel</a>
        </div>
      </form>`;

    const form = root.querySelector('#log-form');

    // slider live values
    form.addEventListener('input', (ev) => {
      const inp = ev.target;
      if (inp.matches('input[type=range]')) {
        const b = form.querySelector(`.slider-val[data-for="${inp.dataset.group}.${inp.dataset.key}"]`);
        if (b) b.textContent = inp.value;
      }
      if (inp.name === 'startTime' || inp.name === 'endTime') {
        const h = U.hoursBetween(form.startTime.value, form.endTime.value);
        if (h > 0) form.totalHours.value = h;
      }
    });

    // emotion chips
    form.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => chip.classList.toggle('active'));
    });

    // delete
    const delBtn = root.querySelector('[data-action="delete"]');
    if (delBtn) delBtn.addEventListener('click', () => {
      if (confirm('Delete this entry permanently?')) {
        FT.store.deleteEntry(editing.id);
        location.hash = '#/dashboard';
      }
    });

    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const entry = editing ? { ...editing } : {};
      entry.id = editing ? editing.id : undefined;
      entry.date = form.date.value;
      entry.startTime = form.startTime.value;
      entry.endTime = form.endTime.value;
      entry.totalHours = parseFloat(form.totalHours.value) || 0;
      entry.orgasmCount = parseInt(form.orgasmCount.value, 10) || 0;
      entry.types = {};
      form.querySelectorAll('input[data-type]').forEach((c) => { entry.types[c.dataset.type] = c.checked; });
      entry.intensity = {}; entry.identity = {};
      form.querySelectorAll('input[type=range]').forEach((r) => {
        entry[r.dataset.group][r.dataset.key] = parseInt(r.value, 10);
      });
      entry.emotions = [...form.querySelectorAll('.chip.active')].map((c) => c.dataset.emotion);
      entry.notes = form.notes.value.trim();
      FT.store.upsertEntry(entry);
      toast(editing ? 'Entry updated' : 'Entry saved');
      location.hash = '#/dashboard';
    });
  }

  function blankEntry(date) {
    const z = (defs) => Object.fromEntries(defs.map(([k]) => [k, 0]));
    return {
      date, startTime: '', endTime: '', totalHours: 0,
      types: { femdomPorn: true, gooning: false, masturbation: false, orgasm: false },
      orgasmCount: 0,
      intensity: z(C.INTENSITY_SLIDERS),
      identity: z(C.IDENTITY_SLIDERS),
      emotions: [], notes: '',
    };
  }

  /* =====================================================================
   * DEPENDENCY TRACKER
   * ===================================================================== */
  function dependency(root) {
    const entries = FT.store.entries();
    if (!entries.length) { root.innerHTML = `<h2 class="page-title">Dependency Tracker</h2>` + emptyState('Log entries to track dependency trends.', true); wireSeed(root); return; }
    const d = S.dependency();

    const grid = `<div class="stat-grid stat-grid-4">
      ${stat('Daily hours', U.fmtHours(d.dailyHours), 'today')}
      ${stat('Weekly hours', U.fmtHours(d.weeklyHours), 'this week')}
      ${stat('Monthly hours', U.fmtHours(d.monthlyHours), 'this month')}
      ${stat('Average session', U.fmtHours(d.avgSession), 'all time')}
      ${stat('Longest session ever', U.fmtHours(d.longestEver), '', Ch.PALETTE.red)}
      ${stat('Consecutive usage days', d.consecutiveUsage, `longest ${d.longestUsageStreak}`, Ch.PALETTE.accent)}
      ${stat('Consecutive gooning days', d.consecutiveGooning, `longest ${d.longestGooningStreak}`, Ch.PALETTE.pink)}
      ${stat('Average daily hours', U.fmtHours(d.weeklyHours / 7), '7-day')}
    </div>`;

    // daily hours 30d
    const from30 = U.dateKey(U.addDays(new Date(), -29));
    const daily = S.dailySeries(entries, (e) => e.totalHours || 0, from30, U.todayKey());
    const dLabels = daily.map((x) => U.parseKey(x.key).toLocaleDateString(undefined, { day: 'numeric' }));
    const dailyChart = Ch.line(dLabels, [{ name: 'Hours', values: daily.map((x) => U.round1(x.value)) }], { height: 210 });

    // weekly hours 12w
    const weekly = weeklySeries(entries, 12, (e) => e.totalHours || 0);
    const weeklyChart = Ch.bars(weekly.labels, weekly.values, { height: 210, color: Ch.PALETTE.accent2 });

    // dependency score line over 30d (per-day average)
    const depDaily = dailyAvgSeries(entries, S.dependencyScore, from30, U.todayKey());
    const depChart = Ch.line(dLabels, [{ name: 'Dependency', values: depDaily, color: Ch.PALETTE.red }], { height: 210, max: 10 });

    root.innerHTML = `
      <h2 class="page-title">Dependency Tracker</h2>
      ${sectionLead('Hours of usage, session length and streaks — and how they trend over time.')}
      ${card('Overview', grid)}
      ${card('Daily hours — last 30 days', dailyChart)}
      ${card('Weekly hours — last 12 weeks', weeklyChart)}
      ${card('Dependency-feeling score — last 30 days', depChart)}
    `;
  }

  /* =====================================================================
   * IDENTITY TRACKER
   * ===================================================================== */
  function identity(root, params) {
    const entries = FT.store.entries();
    if (!entries.length) { root.innerHTML = `<h2 class="page-title">Identity Tracker</h2>` + emptyState('Log entries to track identity attachment.', true); wireSeed(root); return; }
    const grain = (params && params.grain) || 'weeks';

    // latest identity values (current)
    const latest = entries[entries.length - 1];
    const meters = C.IDENTITY_SLIDERS.map(([k, label]) => `
      <div class="meter-row">
        <div class="meter-row-top"><span>${esc(label)}</span><b>${(latest.identity && latest.identity[k]) || 0}/10</b></div>
        ${Ch.meter((latest.identity && latest.identity[k]) || 0, 10)}
      </div>`).join('');

    // composite identity over chosen grain
    const series = identityGrainSeries(entries, grain);
    const composite = Ch.line(series.labels, [{ name: 'Identity attachment', values: series.values, color: Ch.PALETTE.accent }], { height: 220, max: 10 });

    // per-question averages over the selected period (latest bucket)
    const perQ = identityPerQuestionLatest(entries, grain);
    const perQChart = Ch.bars(perQ.labels, perQ.values, { height: 240, max: 10, color: Ch.PALETTE.accent2 });

    const tabs = ['weeks', 'months', 'years'].map((g) =>
      `<a class="seg ${g === grain ? 'active' : ''}" href="#/identity?grain=${g}">${g[0].toUpperCase() + g.slice(1)}</a>`).join('');

    root.innerHTML = `
      <h2 class="page-title">Identity Tracker</h2>
      ${sectionLead('How much femdom feels like part of who you are — tracked across weeks, months and years.')}
      ${card('Current identity readings', `<div class="meter-list">${meters}</div>`,
        { action: `<a class="link-more" href="#/log">Update →</a>` })}
      ${card('Identity attachment over time', `<div class="segmented">${tabs}</div>${composite}`)}
      ${card(`Latest ${grain.slice(0, -1)} — by statement`, perQChart)}
    `;
  }

  /* =====================================================================
   * PROGRESSION LEVELS
   * ===================================================================== */
  function progression(root) {
    const entries = FT.store.entries();
    const lvl = S.progression(entries);
    if (!entries.length) { root.innerHTML = `<h2 class="page-title">Progression</h2>` + emptyState('Log entries to calculate your progression level.', true); wireSeed(root); return; }

    const f = lvl.factors;
    const factorRows = [
      ['Usage frequency', `${f.usageFrequency}%`, f.usageFrequency, 100],
      ['Avg daily hours', U.fmtHours(f.avgDailyHours), f.avgDailyHours, 4],
      ['Identity attachment', `${f.avgIdentity}/10`, f.avgIdentity, 10],
      ['Dependency', `${f.avgDependency}/10`, f.avgDependency, 10],
      ['Emotional attachment', `${f.avgEmotional}/10`, f.avgEmotional, 10],
    ].map(([label, val, v, mx]) => `
      <div class="factor">
        <div class="factor-top"><span>${esc(label)}</span><b>${val}</b></div>
        ${Ch.meter(v, mx)}
      </div>`).join('');

    const ladder = C.LEVELS.map((L) => `
      <div class="ladder-step ${L.n === lvl.n ? 'current' : ''} ${L.n < lvl.n ? 'passed' : ''}">
        <div class="ladder-badge lvl-${L.n}">${L.n}</div>
        <div class="ladder-body">
          <div class="ladder-name">${esc(L.name)} ${L.n === lvl.n ? '<span class="you">you are here</span>' : ''}</div>
          <ul>${L.chars.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
        </div>
      </div>`).join('');

    root.innerHTML = `
      <h2 class="page-title">Progression Levels</h2>
      ${sectionLead('Your current level is calculated automatically from usage frequency, hours, identity attachment, dependency and emotional connection over the last 30 days.')}
      <section class="card level-card lvl-bg-${lvl.n}">
        <div class="level-top">
          <div><div class="level-eyebrow">Current level</div>
          <div class="level-name">Level ${lvl.n} — ${esc(lvl.name)}</div></div>
          <div class="level-score">${lvl.score}<span>/100</span></div>
        </div>
        <div class="level-bar"><div class="level-bar-fill" style="width:${lvl.n >= 5 ? 100 : lvl.toNext}%"></div></div>
        <div class="level-meta">${lvl.n >= 5 ? 'Highest level reached' : `${lvl.toNext}% toward Level ${lvl.n + 1}`}</div>
      </section>
      ${card('What drives your score', `<div class="factor-list">${factorRows}</div>`)}
      ${card('The five levels', `<div class="ladder">${ladder}</div>`)}
    `;
  }

  /* =====================================================================
   * HISTORICAL TIMELINE
   * ===================================================================== */
  function timeline(root) {
    const events = S.timeline();
    if (!events.length) { root.innerHTML = `<h2 class="page-title">Timeline</h2>` + emptyState('Log entries to build your historical timeline.', true); wireSeed(root); return; }
    const icon = { start: '🚩', longest: '⏱️', usage: '📈', identity: '🧠', dependency: '🔗', month: '🗓️' };
    const items = events.map((ev) => `
      <li class="tl-item tl-${ev.type}">
        <div class="tl-dot">${icon[ev.type] || '•'}</div>
        <div class="tl-content">
          <div class="tl-date">${esc(U.fmtDate(ev.date))}</div>
          <div class="tl-title">${esc(ev.title)}</div>
          <div class="tl-detail">${esc(ev.detail)}</div>
        </div>
      </li>`).join('');
    root.innerHTML = `
      <h2 class="page-title">Historical Timeline</h2>
      ${sectionLead('Milestones in your tracked history — first entry, usage spikes, longest sessions, score milestones and monthly summaries.')}
      ${card('', `<ul class="timeline">${items}</ul>`)}
    `;
  }

  /* =====================================================================
   * ANALYTICS
   * ===================================================================== */
  function analytics(root) {
    const entries = FT.store.entries();
    if (!entries.length) { root.innerHTML = `<h2 class="page-title">Analytics</h2>` + emptyState('Log entries to unlock analytics.', true); wireSeed(root); return; }

    const from30 = U.dateKey(U.addDays(new Date(), -29));
    const today = U.todayKey();
    const dailyHrs = S.dailySeries(entries, (e) => e.totalHours || 0, from30, today);
    const dLabels = dailyHrs.map((x) => U.parseKey(x.key).toLocaleDateString(undefined, { day: 'numeric' }));

    const weekly = weeklySeries(entries, 12, (e) => e.totalHours || 0);
    const monthly = S.monthlySummaries();
    const mLabels = monthly.map((m) => m.label.replace(/ \d+$/, '').slice(0, 3) + " '" + m.key.slice(2, 4));

    // identity / dependency / emotional daily averages 30d
    const idLine = dailyAvgSeries(entries, S.identityScore, from30, today);
    const depLine = dailyAvgSeries(entries, S.dependencyScore, from30, today);
    const emoLine = dailyAvgSeries(entries, S.emotionalScore, from30, today);

    // behaviour
    const goonDaily = S.dailySeries(entries, S.gooningHours, from30, today);
    const orgWeekly = weeklySeries(entries, 12, (e) => e.orgasmCount || 0);
    const dep = S.dependency();

    root.innerHTML = `
      <h2 class="page-title">Analytics</h2>

      <h3 class="group-title">Usage</h3>
      ${card('Daily hours — last 30 days', Ch.line(dLabels, [{ name: 'Hours', values: dailyHrs.map((x) => U.round1(x.value)) }], { height: 200 }))}
      ${card('Weekly hours — last 12 weeks', Ch.bars(weekly.labels, weekly.values, { height: 200, color: Ch.PALETTE.accent2 }))}
      ${card('Monthly hours', Ch.bars(mLabels, monthly.map((m) => m.hours), { height: 200, color: Ch.PALETTE.teal }))}

      <h3 class="group-title">Identity & attachment</h3>
      ${card('Scores — last 30 days', Ch.line(dLabels, [
        { name: 'Identity', values: idLine, color: Ch.PALETTE.accent },
        { name: 'Dependency', values: depLine, color: Ch.PALETTE.red },
        { name: 'Emotional', values: emoLine, color: Ch.PALETTE.teal },
      ], { height: 220, max: 10, area: false }))}

      <h3 class="group-title">Behaviour</h3>
      ${card('Gooning hours — last 30 days', Ch.bars(dLabels, goonDaily.map((x) => U.round1(x.value)), { height: 200, color: Ch.PALETTE.pink }))}
      ${card('Orgasm frequency — per week (12 weeks)', Ch.bars(orgWeekly.labels, orgWeekly.values, { height: 200, color: Ch.PALETTE.amber }))}
      ${card('Streaks', `<div class="stat-grid stat-grid-3">
        ${stat('Consecutive usage days', dep.consecutiveUsage, `longest ${dep.longestUsageStreak}`)}
        ${stat('Consecutive gooning days', dep.consecutiveGooning, `longest ${dep.longestGooningStreak}`)}
        ${stat('Longest session ever', U.fmtHours(dep.longestEver), '')}
      </div>`)}
    `;
  }

  /* =====================================================================
   * WEEKLY REVIEW
   * ===================================================================== */
  function review(root, params) {
    const entries = FT.store.entries();
    const refWeekStart = (params && params.week) || U.dateKey(U.startOfWeek(new Date()));
    const ws = S.weekStats(refWeekStart);
    const existing = FT.store.reviews().find((r) => r.weekStart === refWeekStart);

    const prevWeek = U.dateKey(U.addDays(U.parseKey(refWeekStart), -7));
    const nextWeek = U.dateKey(U.addDays(U.parseKey(refWeekStart), 7));
    const isCurrent = refWeekStart === U.dateKey(U.startOfWeek(new Date()));

    const computed = `<div class="stat-grid stat-grid-3">
      ${stat('Total hours', U.fmtHours(ws.totalHours), `${ws.count} sessions`)}
      ${stat('Avg hours / day', U.fmtHours(ws.avgPerDay), '')}
      ${stat('Longest session', U.fmtHours(ws.longestSession), '')}
      ${stat('Identity attachment avg', `${U.round1(ws.identityAvg)}/10`, '')}
      ${stat('Dependency avg', `${U.round1(ws.dependencyAvg)}/10`, '')}
      ${stat('Emotional attachment avg', `${U.round1(ws.emotionalAvg)}/10`, '')}
    </div>`;

    const qSlider = (key, label, val) => `
      <label class="slider">
        <span class="slider-top"><span>${esc(label)}</span><b class="slider-val" data-for="${key}">${val}</b></span>
        <input type="range" min="0" max="10" step="1" value="${val}" data-q="${key}">
      </label>`;

    const reviewForm = `<form id="review-form">
      <div class="slider-grid">
        ${qSlider('importance', 'How important did femdom feel this week?', existing ? existing.importance : 5)}
        ${qSlider('dependence', 'How dependent did you feel this week?', existing ? existing.dependence : 5)}
        ${qSlider('centrality', 'How central was femdom to your identity this week?', existing ? existing.centrality : 5)}
      </div>
      <label class="field"><span>What changes did you notice?</span>
        <textarea name="changes" class="notes" rows="4" placeholder="Reflections on the week…">${esc(existing ? existing.changes : '')}</textarea></label>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">${existing ? 'Update review' : 'Save review'}</button>
      </div>
    </form>`;

    const history = FT.store.reviews().map((r) => `
      <div class="review-hist">
        <div class="review-hist-top">
          <a href="#/review?week=${r.weekStart}"><strong>Week of ${esc(U.fmtDate(r.weekStart, { month: 'short', day: 'numeric', year: 'numeric' }))}</strong></a>
          <span class="rh-scores">importance ${r.importance} · dependence ${r.dependence} · central ${r.centrality}</span>
        </div>
        ${r.changes ? `<div class="review-hist-notes">${esc(r.changes)}</div>` : ''}
      </div>`).join('') || '<div class="muted-note">No saved reviews yet.</div>';

    root.innerHTML = `
      <div class="page-head">
        <h2 class="page-title">Weekly Review</h2>
        <div class="week-nav">
          <a class="btn btn-ghost btn-sm" href="#/review?week=${prevWeek}">‹ Prev</a>
          <span class="week-label">${esc(U.fmtDate(refWeekStart, { month: 'short', day: 'numeric' }))} – ${esc(U.fmtDate(ws.endKey, { month: 'short', day: 'numeric' }))}</span>
          <a class="btn btn-ghost btn-sm ${isCurrent ? 'disabled' : ''}" href="#/review?week=${nextWeek}">Next ›</a>
        </div>
      </div>
      ${card('This week in numbers', computed)}
      ${card('Reflect', reviewForm)}
      ${card('Past reviews', history)}
    `;

    const form = root.querySelector('#review-form');
    form.addEventListener('input', (ev) => {
      if (ev.target.matches('input[type=range]')) {
        const b = form.querySelector(`.slider-val[data-for="${ev.target.dataset.q}"]`);
        if (b) b.textContent = ev.target.value;
      }
    });
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const r = { weekStart: refWeekStart, changes: form.changes.value.trim() };
      form.querySelectorAll('input[data-q]').forEach((i) => { r[i.dataset.q] = parseInt(i.value, 10); });
      FT.store.upsertReview(r);
      toast('Weekly review saved');
    });
  }

  /* =====================================================================
   * CALENDAR
   * ===================================================================== */
  function calendar(root, params) {
    const entries = FT.store.entries();
    const byDate = S.byDate(entries);
    const ref = params && params.month ? U.parseKey(params.month + '-01') : new Date();
    const y = ref.getFullYear(), m = ref.getMonth();
    const first = new Date(y, m, 1);
    const startPad = (first.getDay() + 6) % 7; // Mon-based
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const monthKey = U.monthKey(first);
    const prevM = U.monthKey(new Date(y, m - 1, 1));
    const nextM = U.monthKey(new Date(y, m + 1, 1));

    // intensity scale for shading
    const maxHrs = Math.max(1, ...Object.values(byDate).map((arr) => U.sum(arr.map((e) => e.totalHours || 0))));

    let cells = '';
    const dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    cells += dow.map((d) => `<div class="cal-dow">${d}</div>`).join('');
    for (let i = 0; i < startPad; i++) cells += '<div class="cal-cell empty"></div>';
    for (let day = 1; day <= daysInMonth; day++) {
      const key = U.dateKey(new Date(y, m, day));
      const dayEntries = byDate[key] || [];
      const hrs = U.sum(dayEntries.map((e) => e.totalHours || 0));
      const goon = dayEntries.some((e) => e.types && e.types.gooning);
      const alpha = hrs ? 0.18 + 0.62 * Math.min(1, hrs / maxHrs) : 0;
      const isToday = key === U.todayKey();
      cells += `<a class="cal-cell ${isToday ? 'today' : ''}" href="#/calendar?month=${monthKey}&day=${key}"
        style="${hrs ? `background:rgba(192,38,211,${alpha})` : ''}">
        <span class="cal-day">${day}</span>
        ${hrs ? `<span class="cal-hrs">${U.fmtHours(hrs)}</span>` : ''}
        ${goon ? '<span class="cal-dot"></span>' : ''}
      </a>`;
    }

    const monthLabel = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const selectedDay = params && params.day;
    let detail = '';
    if (selectedDay) {
      const dayEntries = (byDate[selectedDay] || []);
      detail = card(`${U.fmtDate(selectedDay)}`, dayEntries.length ? `
        <div class="day-entries">${dayEntries.map(entryRow).join('')}</div>
        <a class="btn btn-primary btn-sm" href="#/log?date=${selectedDay}">+ Add entry for this day</a>` : `
        <div class="muted-note">No entries for this day.</div>
        <a class="btn btn-primary btn-sm" href="#/log?date=${selectedDay}">+ Add entry</a>`,
        { action: '' });
    }

    root.innerHTML = `
      <div class="page-head">
        <h2 class="page-title">Calendar</h2>
        <div class="week-nav">
          <a class="btn btn-ghost btn-sm" href="#/calendar?month=${prevM}">‹</a>
          <span class="week-label">${esc(monthLabel)}</span>
          <a class="btn btn-ghost btn-sm" href="#/calendar?month=${nextM}">›</a>
        </div>
      </div>
      ${card('', `<div class="calendar">${cells}</div>
        <div class="cal-legend"><span class="cal-dot"></span> gooning day · shade = hours logged</div>`)}
      ${detail}
    `;
  }

  function entryRow(e) {
    const types = Object.entries(e.types || {}).filter(([, v]) => v).map(([k]) => C.SESSION_TYPES.find((s) => s[0] === k)[1]);
    return `<div class="entry-row">
      <div class="entry-main">
        <div class="entry-time">${e.startTime || '—'}${e.endTime ? '–' + e.endTime : ''} · <b>${U.fmtHours(e.totalHours)}</b></div>
        <div class="entry-types">${types.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}${e.orgasmCount ? `<span class="tag tag-amber">${e.orgasmCount} orgasm${e.orgasmCount > 1 ? 's' : ''}</span>` : ''}</div>
        ${e.emotions && e.emotions.length ? `<div class="entry-emo">${e.emotions.map((x) => esc(x)).join(', ')}</div>` : ''}
        ${e.notes ? `<div class="entry-notes">${esc(e.notes)}</div>` : ''}
      </div>
      <a class="btn btn-ghost btn-sm" href="#/log?id=${e.id}">Edit</a>
    </div>`;
  }

  /* =====================================================================
   * SEARCH
   * ===================================================================== */
  function search(root, params) {
    const q = (params && params.q) || '';
    root.innerHTML = `
      <h2 class="page-title">Search logs</h2>
      ${card('', `<input id="search-box" class="search-box" type="search" placeholder="Search notes, emotions, session types, dates…" value="${esc(q)}">`)}
      <div id="search-results"></div>`;
    const box = root.querySelector('#search-box');
    const results = root.querySelector('#search-results');
    const run = () => {
      const list = S.search(box.value);
      results.innerHTML = card('', list.length
        ? `<div class="day-entries">${list.slice(0, 200).map((e) => `<div class="entry-row-wrap"><div class="entry-date-head">${esc(U.fmtDate(e.date))}</div>${entryRow(e)}</div>`).join('')}</div>`
        : '<div class="muted-note">No matching entries.</div>');
    };
    box.addEventListener('input', run);
    run();
    box.focus();
  }

  /* =====================================================================
   * SETTINGS
   * ===================================================================== */
  function settings(root) {
    const data = FT.store.load();
    const entries = data.entries || [];
    const firstDate = entries.length ? U.fmtDate(FT.store.entries()[0].date) : '—';

    root.innerHTML = `
      <h2 class="page-title">Settings & data</h2>
      ${card('Your data', `<div class="stat-grid stat-grid-3">
        ${stat('Entries', entries.length, '')}
        ${stat('Weekly reviews', (data.reviews || []).length, '')}
        ${stat('First entry', firstDate, '')}
      </div>
      <div class="muted-note">All data is stored locally in this browser only. Nothing is uploaded anywhere.</div>`)}

      ${card('Reports', `<p class="lead">Generate a printable report you can save as PDF (use your browser's “Save as PDF” in the print dialog).</p>
        <div class="btn-row">
          <button class="btn btn-primary" data-action="report-full">Full report → PDF</button>
          <button class="btn btn-ghost" data-action="report-week">This week → PDF</button>
          <button class="btn btn-ghost" data-action="report-month">This month → PDF</button>
        </div>`)}

      ${card('Backup', `<p class="lead">Export a JSON backup, or import one to restore.</p>
        <div class="btn-row">
          <button class="btn btn-primary" data-action="export">Export JSON</button>
          <label class="btn btn-ghost">Import JSON<input id="import-file" type="file" accept="application/json" hidden></label>
        </div>`)}

      ${card('Demo & reset', `<div class="btn-row">
          <button class="btn btn-ghost" data-action="seed">Load demo data</button>
          <button class="btn btn-danger" data-action="clear">Erase all data</button>
        </div>`)}
    `;

    root.querySelector('[data-action="export"]').addEventListener('click', () => {
      const blob = new Blob([FT.store.exportJSON()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `femdom-tracker-backup-${U.todayKey()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
    root.querySelector('#import-file').addEventListener('change', (ev) => {
      const file = ev.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try { FT.store.importJSON(reader.result); toast('Backup imported'); FT.router.render(); }
        catch (e) { alert('Import failed: ' + e.message); }
      };
      reader.readAsText(file);
    });
    root.querySelector('[data-action="clear"]').addEventListener('click', () => {
      if (confirm('Erase ALL entries and reviews? This cannot be undone.')) { FT.store.clearAll(); toast('All data erased'); FT.router.render(); }
    });
    root.querySelector('[data-action="report-full"]').addEventListener('click', () => FT.report.open('full'));
    root.querySelector('[data-action="report-week"]').addEventListener('click', () => FT.report.open('week'));
    root.querySelector('[data-action="report-month"]').addEventListener('click', () => FT.report.open('month'));
    wireSeed(root);
  }

  /* ----------------------------------------------------------- shared bits */
  function wireSeed(root) {
    const b = root.querySelector('[data-action="seed"]');
    if (b) b.addEventListener('click', () => {
      if (confirm('Load ~90 days of demo data? This replaces current data.')) { FT.store.seedDemo(); toast('Demo data loaded'); FT.router.render(); }
    });
  }

  /* ---- weekly aggregation helper ---- */
  function weeklySeries(entries, weeks, selector) {
    const labels = [], values = [];
    const thisWeekStart = U.startOfWeek(new Date());
    for (let i = weeks - 1; i >= 0; i--) {
      const ws = U.addDays(thisWeekStart, -7 * i);
      const we = U.addDays(ws, 6);
      const wsk = U.dateKey(ws), wek = U.dateKey(we);
      const inWk = entries.filter((e) => e.date >= wsk && e.date <= wek);
      labels.push(ws.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
      values.push(U.round1(U.sum(inWk.map(selector))));
    }
    return { labels, values };
  }

  function dailyAvgSeries(entries, scoreFn, fromKey, toKey) {
    const map = S.byDate(entries);
    const out = [];
    for (let d = U.parseKey(fromKey); U.dateKey(d) <= toKey; d = U.addDays(d, 1)) {
      const day = map[U.dateKey(d)] || [];
      out.push(day.length ? U.round1(U.avg(day.map(scoreFn))) : null);
    }
    return out;
  }

  /* ---- identity grain series (weeks/months/years) ---- */
  function identityGrainSeries(entries, grain) {
    if (grain === 'years') {
      const map = {};
      entries.forEach((e) => { const k = e.date.slice(0, 4); (map[k] = map[k] || []).push(S.identityScore(e)); });
      const keys = Object.keys(map).sort();
      return { labels: keys, values: keys.map((k) => U.round1(U.avg(map[k]))) };
    }
    if (grain === 'months') {
      const map = {};
      entries.forEach((e) => { const k = e.date.slice(0, 7); (map[k] = map[k] || []).push(S.identityScore(e)); });
      const keys = Object.keys(map).sort();
      return {
        labels: keys.map((k) => U.parseKey(k + '-01').toLocaleDateString(undefined, { month: 'short', year: '2-digit' })),
        values: keys.map((k) => U.round1(U.avg(map[k]))),
      };
    }
    // weeks (last 12)
    const labels = [], values = [];
    const thisWeekStart = U.startOfWeek(new Date());
    for (let i = 11; i >= 0; i--) {
      const ws = U.addDays(thisWeekStart, -7 * i), we = U.addDays(ws, 6);
      const inWk = entries.filter((e) => e.date >= U.dateKey(ws) && e.date <= U.dateKey(we));
      labels.push(ws.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
      values.push(inWk.length ? U.round1(U.avg(inWk.map(S.identityScore))) : null);
    }
    return { labels, values };
  }

  function identityPerQuestionLatest(entries, grain) {
    let pool;
    if (grain === 'years') {
      const yr = entries[entries.length - 1].date.slice(0, 4);
      pool = entries.filter((e) => e.date.slice(0, 4) === yr);
    } else if (grain === 'months') {
      const mo = entries[entries.length - 1].date.slice(0, 7);
      pool = entries.filter((e) => e.date.slice(0, 7) === mo);
    } else {
      const ws = U.dateKey(U.startOfWeek(new Date()));
      pool = entries.filter((e) => e.date >= ws);
      if (!pool.length) pool = entries.slice(-7);
    }
    return {
      labels: C.IDENTITY_SLIDERS.map(([, l]) => shortLabel(l)),
      values: C.IDENTITY_SLIDERS.map(([k]) => U.round1(U.avg(pool.map((e) => (e.identity && e.identity[k]) || 0)))),
    };
  }
  function shortLabel(l) {
    return l.replace('Femdom feels like ', '').replace('Femdom feels ', '').replace('Femdom is ', '')
      .replace('I ', '').replace(' through femdom', '').slice(0, 14);
  }

  /* ---- toast ---- */
  let toastTimer;
  function toast(msg) {
    let t = document.getElementById('toast');
    if (!t) { t = U.el('div', { id: 'toast', class: 'toast' }); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  return {
    dashboard, log, dependency, identity, progression, timeline,
    analytics, review, calendar, search, settings,
    // exported for report.js
    _helpers: { weeklySeries, dailyAvgSeries, identityGrainSeries },
  };
})();
