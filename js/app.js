/* ==========================================================================
 * app.js — hash router, navigation rendering and bootstrap.
 * ======================================================================== */
window.FT = window.FT || {};

FT.router = (function () {
  const ROUTES = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', view: 'dashboard' },
    { id: 'log', label: 'Log entry', icon: '📝', view: 'log' },
    { id: 'calendar', label: 'Calendar', icon: '🗓️', view: 'calendar' },
    { id: 'dependency', label: 'Dependency', icon: '🔗', view: 'dependency' },
    { id: 'identity', label: 'Identity', icon: '🧠', view: 'identity' },
    { id: 'progression', label: 'Progression', icon: '🪜', view: 'progression' },
    { id: 'analytics', label: 'Analytics', icon: '📈', view: 'analytics' },
    { id: 'timeline', label: 'Timeline', icon: '🕰️', view: 'timeline' },
    { id: 'review', label: 'Weekly review', icon: '🔁', view: 'review' },
    { id: 'search', label: 'Search', icon: '🔍', view: 'search' },
    { id: 'settings', label: 'Settings', icon: '⚙️', view: 'settings' },
  ];

  function parseHash() {
    const raw = (location.hash || '#/dashboard').replace(/^#\/?/, '');
    const [path, query] = raw.split('?');
    const params = {};
    if (query) query.split('&').forEach((kv) => {
      const [k, v] = kv.split('=');
      params[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
    return { id: path || 'dashboard', params };
  }

  function render() {
    const { id, params } = parseHash();
    const route = ROUTES.find((r) => r.id === id) || ROUTES[0];
    const root = document.getElementById('view');
    root.scrollTop = 0;
    window.scrollTo(0, 0);
    try {
      FT.views[route.view](root, params);
    } catch (e) {
      console.error(e);
      root.innerHTML = `<div class="card"><div class="card-body">Something went wrong rendering this view.<br><code>${FT.util.escapeHtml(e.message)}</code></div></div>`;
    }
    highlightNav(route.id);
    closeDrawer();
  }

  function buildNav() {
    const nav = document.getElementById('nav-links');
    nav.innerHTML = ROUTES.map((r) =>
      `<a class="nav-link" data-route="${r.id}" href="#/${r.id}"><span class="nav-ico">${r.icon}</span><span>${r.label}</span></a>`).join('');
    // bottom tab bar = the most-used five
    const tabs = document.getElementById('tabbar');
    const primary = ['dashboard', 'calendar', 'log', 'analytics', 'settings'];
    tabs.innerHTML = primary.map((id) => {
      const r = ROUTES.find((x) => x.id === id);
      return `<a class="tab" data-route="${r.id}" href="#/${r.id}"><span class="tab-ico">${r.icon}</span><span>${r.label}</span></a>`;
    }).join('');
  }

  function highlightNav(id) {
    document.querySelectorAll('[data-route]').forEach((a) =>
      a.classList.toggle('active', a.dataset.route === id ||
        (id === 'log' && a.dataset.route === 'log')));
  }

  function openDrawer() { document.body.classList.add('drawer-open'); }
  function closeDrawer() { document.body.classList.remove('drawer-open'); }

  function init() {
    buildNav();
    document.getElementById('menu-btn').addEventListener('click', openDrawer);
    document.getElementById('scrim').addEventListener('click', closeDrawer);
    window.addEventListener('hashchange', render);
    document.addEventListener('ft:datachanged', () => {
      // Re-render data-driven views live; avoid clobbering forms mid-edit.
      const { id } = parseHash();
      if (!['log', 'review', 'search'].includes(id)) render();
    });
    if (!location.hash) location.hash = '#/dashboard';
    render();
  }

  return { init, render };
})();

document.addEventListener('DOMContentLoaded', FT.router.init);
