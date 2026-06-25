/* ==========================================================================
 * charts.js — dependency-free SVG charts & indicators.
 * Each function returns an SVG/HTML string so views can compose freely.
 * Charts use viewBox + width:100% so they scale on mobile.
 * ======================================================================== */
window.FT = window.FT || {};

FT.charts = (function () {
  const U = FT.util;
  const NS = 'http://www.w3.org/2000/svg';

  const PALETTE = {
    accent: '#c026d3',   // fuchsia
    accent2: '#7c3aed',  // violet
    pink: '#ec4899',
    teal: '#14b8a6',
    amber: '#f59e0b',
    red: '#ef4444',
    grid: 'rgba(255,255,255,0.07)',
    axis: 'rgba(255,255,255,0.35)',
    track: 'rgba(255,255,255,0.10)',
  };

  function esc(s) { return U.escapeHtml(s); }

  /* ---- line chart (one or more series) ----
   * series: [{ name, color, points:[{x,y}] }] where x are labels.
   * data is normalised against a shared category axis (labels). */
  function line(labels, series, opts) {
    opts = opts || {};
    const W = 640, H = opts.height || 220;
    const pad = { l: 38, r: 12, t: 14, b: 26 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const allVals = series.flatMap((s) => s.values).filter((v) => v != null);
    let max = opts.max != null ? opts.max : Math.max(1, ...allVals);
    const min = opts.min != null ? opts.min : 0;
    max = max === min ? min + 1 : max;
    const n = labels.length;
    const xAt = (i) => pad.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
    const yAt = (v) => pad.t + ih - ((v - min) / (max - min)) * ih;

    let svg = `<svg viewBox="0 0 ${W} ${H}" class="chart" preserveAspectRatio="none" role="img">`;
    // horizontal gridlines + y labels
    const ticks = 4;
    for (let t = 0; t <= ticks; t++) {
      const v = min + (t / ticks) * (max - min);
      const y = yAt(v);
      svg += `<line x1="${pad.l}" y1="${y}" x2="${W - pad.r}" y2="${y}" stroke="${PALETTE.grid}"/>`;
      svg += `<text x="${pad.l - 6}" y="${y + 3}" text-anchor="end" class="c-axis">${fmtTick(v)}</text>`;
    }
    // x labels (thinned)
    const step = Math.ceil(n / 8);
    labels.forEach((lb, i) => {
      if (i % step !== 0 && i !== n - 1) return;
      svg += `<text x="${xAt(i)}" y="${H - 8}" text-anchor="middle" class="c-axis">${esc(lb)}</text>`;
    });
    // series paths + area for the first
    series.forEach((s, si) => {
      const color = s.color || [PALETTE.accent, PALETTE.teal, PALETTE.amber][si % 3];
      let d = '';
      s.values.forEach((v, i) => {
        if (v == null) return;
        d += (d ? ' L' : 'M') + xAt(i) + ' ' + yAt(v);
      });
      if (!d) return;
      if (si === 0 && opts.area !== false) {
        const area = d + ` L${xAt(n - 1)} ${yAt(min)} L${xAt(0)} ${yAt(min)} Z`;
        svg += `<path d="${area}" fill="${color}" opacity="0.12"/>`;
      }
      svg += `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
      if (n <= 31) {
        s.values.forEach((v, i) => {
          if (v == null) return;
          svg += `<circle cx="${xAt(i)}" cy="${yAt(v)}" r="2.6" fill="${color}"/>`;
        });
      }
    });
    svg += '</svg>';
    return wrapLegend(svg, series);
  }

  function fmtTick(v) {
    if (Math.abs(v) >= 100) return Math.round(v);
    return Math.round(v * 10) / 10;
  }

  function wrapLegend(svg, series) {
    if (series.length < 2) return svg;
    const items = series.map((s, i) => {
      const color = s.color || [PALETTE.accent, PALETTE.teal, PALETTE.amber][i % 3];
      return `<span class="legend-item"><i style="background:${color}"></i>${esc(s.name)}</span>`;
    }).join('');
    return `${svg}<div class="legend">${items}</div>`;
  }

  /* ---- bar chart ---- */
  function bars(labels, values, opts) {
    opts = opts || {};
    const W = 640, H = opts.height || 220;
    const pad = { l: 38, r: 12, t: 14, b: 26 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const max = opts.max != null ? opts.max : Math.max(1, ...values);
    const n = labels.length || 1;
    const bw = (iw / n) * 0.62;
    const gap = (iw / n);
    const color = opts.color || PALETTE.accent;

    let svg = `<svg viewBox="0 0 ${W} ${H}" class="chart" preserveAspectRatio="none" role="img">`;
    const ticks = 4;
    for (let t = 0; t <= ticks; t++) {
      const v = (t / ticks) * max;
      const y = pad.t + ih - (v / max) * ih;
      svg += `<line x1="${pad.l}" y1="${y}" x2="${W - pad.r}" y2="${y}" stroke="${PALETTE.grid}"/>`;
      svg += `<text x="${pad.l - 6}" y="${y + 3}" text-anchor="end" class="c-axis">${fmtTick(v)}</text>`;
    }
    const step = Math.ceil(n / 12);
    values.forEach((v, i) => {
      const x = pad.l + gap * i + (gap - bw) / 2;
      const h = max === 0 ? 0 : (v / max) * ih;
      const y = pad.t + ih - h;
      svg += `<rect x="${x}" y="${y}" width="${bw}" height="${Math.max(0, h)}" rx="3" fill="${color}" opacity="0.85"/>`;
      if (i % step === 0 || i === n - 1) {
        svg += `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" class="c-axis">${esc(labels[i])}</text>`;
      }
    });
    svg += '</svg>';
    return svg;
  }

  /* ---- semicircular gauge for a 0..max level (default 10) ---- */
  function gauge(value, opts) {
    opts = opts || {};
    const max = opts.max || 10;
    const v = U.clamp(value, 0, max);
    const W = 160, H = 96, cx = W / 2, cy = 86, r = 64;
    const frac = v / max;
    const a0 = Math.PI, a1 = Math.PI * (1 - frac); // left→right
    const p0 = polar(cx, cy, r, a0), p1 = polar(cx, cy, r, a1);
    const large = frac > 0.5 ? 1 : 0;
    const color = opts.color || levelColor(frac);
    const track = describeArc(cx, cy, r, Math.PI, 0);
    return `<svg viewBox="0 0 ${W} ${H}" class="gauge" role="img">
      <path d="${track}" fill="none" stroke="${PALETTE.track}" stroke-width="12" stroke-linecap="round"/>
      <path d="M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}"
            fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round"/>
      <text x="${cx}" y="${cy - 14}" text-anchor="middle" class="gauge-val">${U.round1(v)}</text>
      <text x="${cx}" y="${cy + 2}" text-anchor="middle" class="gauge-max">/ ${max}</text>
    </svg>`;
  }

  function polar(cx, cy, r, a) { return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) }; }
  function describeArc(cx, cy, r, a0, a1) {
    const p0 = polar(cx, cy, r, a0), p1 = polar(cx, cy, r, a1);
    return `M ${p0.x} ${p0.y} A ${r} ${r} 0 1 1 ${p1.x} ${p1.y}`;
  }
  function levelColor(frac) {
    if (frac >= 0.8) return PALETTE.red;
    if (frac >= 0.6) return PALETTE.accent;
    if (frac >= 0.4) return PALETTE.accent2;
    if (frac >= 0.2) return PALETTE.teal;
    return PALETTE.teal;
  }

  /* ---- circular progress ring (for hours / scores) ---- */
  function ring(value, max, opts) {
    opts = opts || {};
    const size = opts.size || 120, sw = opts.stroke || 11;
    const r = (size - sw) / 2, c = 2 * Math.PI * r;
    const frac = max ? U.clamp(value / max, 0, 1) : 0;
    const color = opts.color || PALETTE.accent;
    const center = size / 2;
    return `<svg viewBox="0 0 ${size} ${size}" class="ring" role="img" style="width:${size}px;height:${size}px">
      <circle cx="${center}" cy="${center}" r="${r}" fill="none" stroke="${PALETTE.track}" stroke-width="${sw}"/>
      <circle cx="${center}" cy="${center}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}"
        stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - frac)}"
        transform="rotate(-90 ${center} ${center})"/>
      <text x="${center}" y="${center - 2}" text-anchor="middle" class="ring-val">${esc(opts.label != null ? opts.label : U.round1(value))}</text>
      ${opts.sub ? `<text x="${center}" y="${center + 16}" text-anchor="middle" class="ring-sub">${esc(opts.sub)}</text>` : ''}
    </svg>`;
  }

  /* ---- horizontal 0..10 meter ---- */
  function meter(value, max) {
    max = max || 10;
    const frac = U.clamp(value / max, 0, 1);
    const color = levelColor(frac);
    return `<div class="meter"><div class="meter-fill" style="width:${frac * 100}%;background:${color}"></div></div>`;
  }

  /* ---- sparkline ---- */
  function sparkline(values, opts) {
    opts = opts || {};
    const W = 120, H = 32;
    const max = Math.max(1, ...values), min = Math.min(0, ...values);
    const n = values.length;
    if (!n) return `<svg viewBox="0 0 ${W} ${H}" class="spark"></svg>`;
    const xAt = (i) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
    const yAt = (v) => H - 3 - ((v - min) / (max - min || 1)) * (H - 6);
    let d = '';
    values.forEach((v, i) => { d += (d ? ' L' : 'M') + xAt(i).toFixed(1) + ' ' + yAt(v).toFixed(1); });
    const color = opts.color || PALETTE.accent;
    return `<svg viewBox="0 0 ${W} ${H}" class="spark" preserveAspectRatio="none">
      <path d="${d}" fill="none" stroke="${color}" stroke-width="2"/></svg>`;
  }

  return { PALETTE, line, bars, gauge, ring, meter, sparkline, levelColor };
})();
