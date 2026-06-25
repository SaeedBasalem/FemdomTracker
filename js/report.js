/* ==========================================================================
 * report.js — builds a clean, self-contained printable report in a new
 * window and triggers the print dialog (→ "Save as PDF").
 * kind: 'full' | 'week' | 'month'
 * ======================================================================== */
window.FT = window.FT || {};

FT.report = (function () {
  const U = FT.util, C = FT.constants, S = FT.stats, Ch = FT.charts;
  const esc = U.escapeHtml;

  function open(kind) {
    const entries = FT.store.entries();
    if (!entries.length) { alert('No data to report yet.'); return; }

    const win = window.open('', '_blank');
    if (!win) { alert('Please allow pop-ups to generate the report.'); return; }
    win.document.write(buildHTML(kind, entries));
    win.document.close();
    win.focus();
    // give the new document a tick to lay out before printing
    win.onload = () => setTimeout(() => win.print(), 250);
  }

  function buildHTML(kind, entries) {
    const lvl = S.progression(entries);
    const title = kind === 'week' ? 'Weekly Report' : kind === 'month' ? 'Monthly Report' : 'Full Report';
    const generated = new Date().toLocaleString();

    let scope, scopeLabel;
    if (kind === 'week') {
      const r = S.weekRange(); scope = r; scopeLabel = `${U.fmtDate(r.startKey)} – ${U.fmtDate(r.endKey)}`;
    } else if (kind === 'month') {
      const r = S.monthRange(); scope = r; scopeLabel = U.parseKey(r.startKey).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    } else {
      scope = { startKey: entries[0].date, endKey: U.todayKey() };
      scopeLabel = `${U.fmtDate(entries[0].date)} – ${U.fmtDate(U.todayKey())}`;
    }
    const scoped = entries.filter((e) => e.date >= scope.startKey && e.date <= scope.endKey);

    const totalHours = U.sum(scoped.map((e) => e.totalHours || 0));
    const sessions = scoped.length;
    const days = new Set(scoped.map((e) => e.date)).size;
    const longest = scoped.reduce((m, e) => Math.max(m, e.totalHours || 0), 0);
    const orgasms = U.sum(scoped.map((e) => e.orgasmCount || 0));
    const goon = U.sum(scoped.map(S.gooningHours));
    const idAvg = scoped.length ? U.avg(scoped.map(S.identityScore)) : 0;
    const depAvg = scoped.length ? U.avg(scoped.map(S.dependencyScore)) : 0;
    const emoAvg = scoped.length ? U.avg(scoped.map(S.emotionalScore)) : 0;
    const avgDen = kind === 'full' ? Math.max(1, days) : daysInScope(scope);

    const statCard = (label, value) => `<div class="r-stat"><div class="r-stat-v">${value}</div><div class="r-stat-l">${esc(label)}</div></div>`;

    // hours chart over scope (daily)
    const daily = S.dailySeries(scoped.length ? scoped : entries, (e) => e.totalHours || 0, scope.startKey, scope.endKey);
    const labels = daily.map((d) => U.parseKey(d.key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    const hoursChart = Ch.bars(labels, daily.map((d) => U.round1(d.value)), { height: 200, color: '#c026d3' });

    // identity/dependency/emotional line
    const idLine = avgSeries(scoped, S.identityScore, scope);
    const depLine = avgSeries(scoped, S.dependencyScore, scope);
    const emoLine = avgSeries(scoped, S.emotionalScore, scope);
    const scoreChart = Ch.line(labels, [
      { name: 'Identity', values: idLine, color: '#c026d3' },
      { name: 'Dependency', values: depLine, color: '#ef4444' },
      { name: 'Emotional', values: emoLine, color: '#14b8a6' },
    ], { height: 200, max: 10, area: false });

    const monthly = S.monthlySummaries();
    const monthlyTable = kind === 'full' ? `
      <h2>Monthly summaries</h2>
      <table class="r-table">
        <thead><tr><th>Month</th><th>Hours</th><th>Sessions</th><th>Orgasms</th><th>Identity</th><th>Dependency</th><th>Emotional</th></tr></thead>
        <tbody>${monthly.map((m) => `<tr><td>${esc(m.label)}</td><td>${m.hours}</td><td>${m.sessions}</td><td>${m.orgasms}</td><td>${m.identityAvg}</td><td>${m.dependencyAvg}</td><td>${m.emotionalAvg}</td></tr>`).join('')}</tbody>
      </table>` : '';

    // weekly reviews (full only)
    const reviews = FT.store.reviews();
    const reviewTable = kind === 'full' && reviews.length ? `
      <h2>Weekly reviews</h2>
      <table class="r-table">
        <thead><tr><th>Week of</th><th>Importance</th><th>Dependence</th><th>Centrality</th><th>Notes</th></tr></thead>
        <tbody>${reviews.map((r) => `<tr><td>${esc(U.fmtDate(r.weekStart, { month: 'short', day: 'numeric', year: 'numeric' }))}</td><td>${r.importance}</td><td>${r.dependence}</td><td>${r.centrality}</td><td>${esc(r.changes || '')}</td></tr>`).join('')}</tbody>
      </table>` : '';

    const entriesTable = `
      <h2>Entries (${scoped.length})</h2>
      <table class="r-table">
        <thead><tr><th>Date</th><th>Time</th><th>Hours</th><th>Types</th><th>Orgasms</th><th>Identity</th><th>Dependency</th></tr></thead>
        <tbody>${scoped.slice().reverse().map((e) => `<tr>
          <td>${esc(U.fmtDate(e.date, { month: 'short', day: 'numeric' }))}</td>
          <td>${esc(e.startTime || '')}${e.endTime ? '–' + esc(e.endTime) : ''}</td>
          <td>${U.round1(e.totalHours || 0)}</td>
          <td>${Object.entries(e.types || {}).filter(([, v]) => v).map(([k]) => (C.SESSION_TYPES.find((s) => s[0] === k) || [, k])[1]).join(', ')}</td>
          <td>${e.orgasmCount || 0}</td>
          <td>${U.round1(S.identityScore(e))}</td>
          <td>${U.round1(S.dependencyScore(e))}</td></tr>`).join('')}</tbody>
      </table>`;

    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)} — Femdom Porn Progress Tracker</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a1426;margin:0;padding:28px;background:#fff}
      h1{font-size:22px;margin:0 0 2px}
      .sub{color:#6b7280;font-size:13px;margin-bottom:18px}
      h2{font-size:15px;margin:24px 0 10px;border-bottom:2px solid #ede9fe;padding-bottom:5px;color:#7c3aed}
      .r-level{display:flex;justify-content:space-between;align-items:center;background:#faf5ff;border:1px solid #ede9fe;border-radius:12px;padding:14px 18px;margin-bottom:16px}
      .r-level .big{font-size:18px;font-weight:700;color:#86198f}
      .r-level .score{font-size:26px;font-weight:800;color:#c026d3}
      .r-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:8px}
      .r-stat{border:1px solid #eee;border-radius:10px;padding:10px 12px;background:#fafafa}
      .r-stat-v{font-size:20px;font-weight:700}
      .r-stat-l{font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em}
      .chart{width:100%;height:auto;background:#fff;border:1px solid #f0f0f0;border-radius:10px;margin-top:6px}
      .chart .c-axis{fill:#9ca3af;font-size:9px}
      .legend{display:flex;gap:14px;font-size:11px;color:#555;margin-top:6px}
      .legend-item{display:inline-flex;align-items:center;gap:5px}
      .legend-item i{width:10px;height:10px;border-radius:3px;display:inline-block}
      .r-table{width:100%;border-collapse:collapse;font-size:11px;margin-top:4px}
      .r-table th,.r-table td{border:1px solid #eee;padding:5px 7px;text-align:left;vertical-align:top}
      .r-table th{background:#f7f5fb;color:#4b3a63;font-weight:600}
      @media print{body{padding:0}h2{break-after:avoid}.r-table{break-inside:auto}tr{break-inside:avoid}}
    </style></head><body>
      <h1>${esc(title)} — Femdom Porn Progress Tracker</h1>
      <div class="sub">${esc(scopeLabel)} · generated ${esc(generated)}</div>

      <div class="r-level">
        <div><div style="font-size:11px;color:#7c3aed;text-transform:uppercase;letter-spacing:.05em">Progression level</div>
        <div class="big">Level ${lvl.n} — ${esc(lvl.name)}</div></div>
        <div class="score">${lvl.score}<span style="font-size:14px;color:#9ca3af">/100</span></div>
      </div>

      <h2>Summary</h2>
      <div class="r-grid">
        ${statCard('Total hours', U.round1(totalHours))}
        ${statCard('Sessions', sessions)}
        ${statCard('Active days', days)}
        ${statCard('Avg / day', U.round1(totalHours / avgDen))}
        ${statCard('Longest session', U.round1(longest) + 'h')}
        ${statCard('Gooning hours', U.round1(goon))}
        ${statCard('Orgasms', orgasms)}
        ${statCard('Identity avg', U.round1(idAvg) + '/10')}
        ${statCard('Dependency avg', U.round1(depAvg) + '/10')}
        ${statCard('Emotional avg', U.round1(emoAvg) + '/10')}
      </div>

      <h2>Hours logged</h2>
      ${hoursChart}
      <h2>Identity · dependency · emotional</h2>
      ${scoreChart}
      ${monthlyTable}
      ${reviewTable}
      ${entriesTable}
    </body></html>`;
  }

  function daysInScope(scope) { return Math.max(1, U.diffDays(scope.endKey, scope.startKey) + 1); }

  function avgSeries(scoped, scoreFn, scope) {
    const map = S.byDate(scoped);
    const out = [];
    for (let d = U.parseKey(scope.startKey); U.dateKey(d) <= scope.endKey; d = U.addDays(d, 1)) {
      const day = map[U.dateKey(d)] || [];
      out.push(day.length ? U.round1(U.avg(day.map(scoreFn))) : null);
    }
    return out;
  }

  return { open };
})();
