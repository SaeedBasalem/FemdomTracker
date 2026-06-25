/* ==========================================================================
 * stats.js — all derived metrics: totals, averages, streaks, identity &
 * dependency scores, progression level, timeline milestones, summaries.
 * ======================================================================== */
window.FT = window.FT || {};

FT.stats = (function () {
  const U = FT.util;
  const C = FT.constants;

  /* ----- per-entry helpers ----- */
  const isUsage = (e) => true; // every logged entry counts as usage
  const isGooning = (e) => !!(e.types && e.types.gooning);
  const femdomHours = (e) => (e.types && e.types.femdomPorn ? (e.totalHours || 0) : 0);
  const gooningHours = (e) => (e.types && e.types.gooning ? (e.totalHours || 0) : 0);

  function identityScore(e) {
    const vals = C.IDENTITY_SLIDERS.map(([k]) => (e.identity && e.identity[k]) || 0);
    return U.avg(vals);
  }
  function dependencyScore(e) {
    const i = e.intensity || {};
    return U.avg([i.dependencyFeeling || 0, i.craving || 0]);
  }
  function emotionalScore(e) {
    const i = e.intensity || {};
    return U.avg([i.emotionalConnection || 0, i.feelingOwned || 0]);
  }

  /* ----- grouping ----- */
  function byDate(entries) {
    const map = {};
    entries.forEach((e) => { (map[e.date] = map[e.date] || []).push(e); });
    return map;
  }

  /** Aggregate hours per calendar day for a given selector. */
  function dailySeries(entries, selector, fromDate, toDate) {
    const map = byDate(entries);
    const out = [];
    const start = U.parseKey(fromDate), end = U.parseKey(toDate);
    for (let d = new Date(start); d <= end; d = U.addDays(d, 1)) {
      const key = U.dateKey(d);
      const dayEntries = map[key] || [];
      out.push({ key, date: d, value: U.sum(dayEntries.map(selector)) });
    }
    return out;
  }

  /* ----- ranges ----- */
  function inRange(entries, fromKey, toKey) {
    return entries.filter((e) => e.date >= fromKey && e.date <= toKey);
  }

  function weekRange(ref) {
    const start = U.startOfWeek(ref || new Date());
    return { startKey: U.dateKey(start), endKey: U.dateKey(U.addDays(start, 6)) };
  }
  function monthRange(ref) {
    const d = ref || new Date();
    const start = U.startOfMonth(d);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { startKey: U.dateKey(start), endKey: U.dateKey(end) };
  }

  /* ----- streaks ----- */
  function consecutiveDays(entries, predicate) {
    const days = new Set(entries.filter(predicate).map((e) => e.date));
    if (!days.size) return 0;
    // Anchor at today if active, otherwise at the most recent qualifying day.
    let anchor = U.todayKey();
    if (!days.has(anchor)) {
      const sorted = [...days].sort();
      anchor = sorted[sorted.length - 1];
      // Streak only "current" if last qualifying day was today or yesterday.
      if (U.diffDays(U.todayKey(), anchor) > 1) return 0;
    }
    let count = 0;
    let cursor = U.parseKey(anchor);
    while (days.has(U.dateKey(cursor))) {
      count++;
      cursor = U.addDays(cursor, -1);
    }
    return count;
  }

  function longestStreak(entries, predicate) {
    const days = [...new Set(entries.filter(predicate).map((e) => e.date))].sort();
    let best = 0, run = 0, prev = null;
    days.forEach((k) => {
      if (prev && U.diffDays(k, prev) === 1) run++;
      else run = 1;
      best = Math.max(best, run);
      prev = k;
    });
    return best;
  }

  /* ----- the master dashboard snapshot ----- */
  function snapshot() {
    const entries = FT.store.entries();
    const today = U.todayKey();
    const todays = entries.filter((e) => e.date === today);

    const wk = weekRange();
    const mo = monthRange();
    const weekEntries = inRange(entries, wk.startKey, wk.endKey);
    const monthEntries = inRange(entries, mo.startKey, mo.endKey);

    // "Current" slider levels = latest entry today, else latest overall.
    const latest = todays.length ? todays[todays.length - 1] : entries[entries.length - 1];
    const li = (latest && latest.intensity) || {};

    return {
      entries,
      hasData: entries.length > 0,
      today: {
        femdomHours: U.sum(todays.map(femdomHours)),
        gooningHours: U.sum(todays.map(gooningHours)),
        orgasmCount: U.sum(todays.map((e) => e.orgasmCount || 0)),
        sessions: todays.length,
      },
      current: {
        urges: li.urges || 0,
        intrusiveThoughts: li.intrusiveThoughts || 0,
        identityAttachment: li.identityAttachment || 0,
        dependency: li.dependencyFeeling || 0,
      },
      weeklyHours: U.sum(weekEntries.map((e) => e.totalHours || 0)),
      monthlyHours: U.sum(monthEntries.map((e) => e.totalHours || 0)),
      longestSessionThisWeek: weekEntries.reduce((m, e) => Math.max(m, e.totalHours || 0), 0),
      level: progression(entries),
    };
  }

  /* ----- dependency section ----- */
  function dependency() {
    const entries = FT.store.entries();
    const wk = weekRange(), mo = monthRange();
    const today = U.todayKey();
    const totals = entries.map((e) => e.totalHours || 0);
    return {
      dailyHours: U.sum(entries.filter((e) => e.date === today).map((e) => e.totalHours || 0)),
      weeklyHours: U.sum(inRange(entries, wk.startKey, wk.endKey).map((e) => e.totalHours || 0)),
      monthlyHours: U.sum(inRange(entries, mo.startKey, mo.endKey).map((e) => e.totalHours || 0)),
      avgSession: entries.length ? U.avg(totals) : 0,
      longestEver: entries.reduce((m, e) => Math.max(m, e.totalHours || 0), 0),
      consecutiveUsage: consecutiveDays(entries, isUsage),
      consecutiveGooning: consecutiveDays(entries, isGooning),
      longestUsageStreak: longestStreak(entries, isUsage),
      longestGooningStreak: longestStreak(entries, isGooning),
    };
  }

  /* ----- progression level ----- */
  function progression(entries) {
    entries = entries || FT.store.entries();
    if (!entries.length) {
      return { n: 0, name: 'No data yet', score: 0, toNext: 0, factors: {}, def: null };
    }
    const today = new Date();
    const windowDays = 30;
    const fromKey = U.dateKey(U.addDays(today, -(windowDays - 1)));
    const recent = entries.filter((e) => e.date >= fromKey);
    const pool = recent.length ? recent : entries;

    const usageDays = new Set(pool.map((e) => e.date)).size;
    const span = recent.length ? windowDays
      : Math.max(1, U.diffDays(U.todayKey(), pool[0].date) + 1);

    const freq = U.clamp(usageDays / span, 0, 1);                 // 0..1
    const avgDailyHours = U.sum(pool.map((e) => e.totalHours || 0)) / span;
    const avgIdentity = U.avg(pool.map(identityScore));            // 0..10
    const avgDependency = U.avg(pool.map(dependencyScore));        // 0..10
    const avgEmotional = U.avg(pool.map(emotionalScore));          // 0..10

    const freqScore = freq * 100;
    const hoursScore = U.clamp((avgDailyHours / 4) * 100, 0, 100); // 4h/day caps
    const identityPct = avgIdentity * 10;
    const dependencyPct = avgDependency * 10;
    const emotionalPct = avgEmotional * 10;

    const score = U.clamp(
      0.20 * freqScore + 0.15 * hoursScore + 0.25 * identityPct +
      0.25 * dependencyPct + 0.15 * emotionalPct, 0, 100);

    const n = score >= 80 ? 5 : score >= 60 ? 4 : score >= 40 ? 3 : score >= 20 ? 2 : 1;
    const def = C.LEVELS[n - 1];
    const bounds = [0, 20, 40, 60, 80, 100];
    const lo = bounds[n - 1], hi = bounds[n];
    const toNext = n >= 5 ? 100 : Math.round(((score - lo) / (hi - lo)) * 100);

    return {
      n, name: def.name, def, score: U.round1(score), toNext,
      factors: {
        usageFrequency: Math.round(freq * 100),
        avgDailyHours: U.round1(avgDailyHours),
        avgIdentity: U.round1(avgIdentity),
        avgDependency: U.round1(avgDependency),
        avgEmotional: U.round1(avgEmotional),
      },
    };
  }

  /* ----- weekly review computed values ----- */
  function weekStats(weekStartKey) {
    const entries = FT.store.entries();
    const startKey = weekStartKey;
    const endKey = U.dateKey(U.addDays(U.parseKey(weekStartKey), 6));
    const wk = inRange(entries, startKey, endKey);
    const totals = wk.map((e) => e.totalHours || 0);
    return {
      startKey, endKey, count: wk.length,
      totalHours: U.sum(totals),
      avgPerDay: U.sum(totals) / 7,
      longestSession: wk.reduce((m, e) => Math.max(m, e.totalHours || 0), 0),
      identityAvg: wk.length ? U.avg(wk.map(identityScore)) : 0,
      dependencyAvg: wk.length ? U.avg(wk.map(dependencyScore)) : 0,
      emotionalAvg: wk.length ? U.avg(wk.map(emotionalScore)) : 0,
    };
  }

  /* ----- monthly summaries ----- */
  function monthlySummaries() {
    const entries = FT.store.entries();
    const map = {};
    entries.forEach((e) => {
      const mk = e.date.slice(0, 7);
      const m = map[mk] || (map[mk] = { key: mk, hours: 0, sessions: 0, orgasms: 0, id: [], dep: [], emo: [], goon: 0 });
      m.hours += e.totalHours || 0;
      m.sessions += 1;
      m.orgasms += e.orgasmCount || 0;
      m.goon += gooningHours(e);
      m.id.push(identityScore(e));
      m.dep.push(dependencyScore(e));
      m.emo.push(emotionalScore(e));
    });
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key)).map((m) => ({
      key: m.key,
      label: U.parseKey(m.key + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      hours: U.round1(m.hours),
      sessions: m.sessions,
      orgasms: m.orgasms,
      gooningHours: U.round1(m.goon),
      identityAvg: U.round1(U.avg(m.id)),
      dependencyAvg: U.round1(U.avg(m.dep)),
      emotionalAvg: U.round1(U.avg(m.emo)),
    }));
  }

  /* ----- historical timeline ----- */
  function timeline() {
    const entries = FT.store.entries();
    if (!entries.length) return [];
    const events = [];

    events.push({ date: entries[0].date, type: 'start', title: 'First recorded entry',
      detail: 'Tracking began.' });

    // Longest sessions (top 3 distinct).
    const bySession = entries.slice().sort((a, b) => (b.totalHours || 0) - (a.totalHours || 0));
    bySession.slice(0, 3).forEach((e, i) => {
      if ((e.totalHours || 0) > 0) {
        events.push({ date: e.date, type: 'longest',
          title: `${i === 0 ? 'Longest' : 'Long'} session — ${U.fmtHours(e.totalHours)}`,
          detail: 'A notably long single session.' });
      }
    });

    // Major increases in daily usage (day total jumps vs trailing average).
    const daily = dailySeries(entries, (e) => e.totalHours || 0,
      entries[0].date, U.todayKey());
    for (let i = 7; i < daily.length; i++) {
      const recentAvg = U.avg(daily.slice(i - 7, i).map((d) => d.value));
      if (daily[i].value >= 3 && daily[i].value >= recentAvg * 2 && recentAvg > 0) {
        events.push({ date: daily[i].key, type: 'usage',
          title: `Major usage increase — ${U.fmtHours(daily[i].value)} in a day`,
          detail: `Roughly ${Math.round(daily[i].value / Math.max(recentAvg, 0.1))}× the prior week's daily average.` });
      }
    }

    // Identity & dependency milestones (first time crossing 5, 7, 9).
    crossMilestones(entries, identityScore, 'identity', 'Identity', events);
    crossMilestones(entries, dependencyScore, 'dependency', 'Dependency', events);

    // Monthly summaries.
    monthlySummaries().forEach((m) => {
      events.push({ date: m.key + '-28', type: 'month',
        title: `${m.label} summary`,
        detail: `${m.hours}h over ${m.sessions} sessions · identity ${m.identityAvg}/10 · dependency ${m.dependencyAvg}/10.` });
    });

    // De-dup longest entries that landed on same day, then sort newest first.
    return events.sort((a, b) => b.date.localeCompare(a.date) ||
      a.title.localeCompare(b.title));
  }

  function crossMilestones(entries, scoreFn, type, label, events) {
    const thresholds = [5, 7, 9];
    const hit = {};
    entries.forEach((e) => {
      const v = scoreFn(e);
      thresholds.forEach((t) => {
        if (!hit[t] && v >= t) {
          hit[t] = true;
          events.push({ date: e.date, type,
            title: `${label} score reached ${t}/10`,
            detail: `First time ${label.toLowerCase()} attachment crossed ${t}.` });
        }
      });
    });
  }

  /* ----- search ----- */
  function search(query) {
    const q = query.trim().toLowerCase();
    const entries = FT.store.entries().slice().reverse();
    if (!q) return entries;
    return entries.filter((e) => {
      const hay = [
        e.date, e.notes || '',
        (e.emotions || []).join(' '),
        Object.entries(e.types || {}).filter(([, v]) => v).map(([k]) => k).join(' '),
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }

  return {
    isUsage, isGooning, femdomHours, gooningHours,
    identityScore, dependencyScore, emotionalScore,
    byDate, dailySeries, inRange, weekRange, monthRange,
    consecutiveDays, longestStreak,
    snapshot, dependency, progression, weekStats, monthlySummaries,
    timeline, search,
  };
})();
