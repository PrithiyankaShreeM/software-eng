'use strict';

/**
 * View helpers: everything a template needs to render the shared shell.
 * Kept in one place so the branding/navigation stays consistent across all
 * login pages and dashboards.
 */

const config = require('../config');
const {
  ROLE_DEFINITIONS,
  DASHBOARDS,
  DASHBOARD_BY_ROLE,
  LOGIN_CATEGORIES,
  roleHasPermission,
} = require('../config/roles');

/** Navigation items for the authenticated shell, filtered by permission. */
const NAV_ITEMS = [
  { label: 'My Dashboard', href: null, icon: 'grid', dashboard: true },
  {
    label: 'Examination Schedule',
    href: '/student/schedule',
    icon: 'calendar',
    permission: 'schedule:read',
  },
  { label: 'Results', href: '/student/results', icon: 'award', permission: 'results:read' },
  {
    label: 'Revaluation',
    href: '/student/revaluations',
    icon: 'refresh',
    permission: 'revaluation:track',
  },
  {
    label: 'Academic Records',
    href: '/student/records',
    icon: 'folder',
    permission: 'records:read',
  },
  { label: 'Notifications', href: '/notifications', icon: 'bell', permission: 'notifications:read' },
];

function buildNavigation(user) {
  if (!user) return { primary: [], secondary: [] };

  const home = DASHBOARD_BY_ROLE[user.role];

  const primary = [
    {
      label: home?.navLabel || 'Dashboard',
      href: home?.path || '/',
      icon: 'grid',
      active: true,
    },
  ];

  for (const item of NAV_ITEMS) {
    if (item.dashboard) continue;
    if (!item.permission) continue;
    if (!roleHasPermission(user.role, item.permission)) continue;
    primary.push({ label: item.label, href: item.href, icon: item.icon });
  }

  return { primary, secondary: [] };
}

function viewLocals(req, res, next) {
  res.locals.university = config.university;
  res.locals.currentUser = req.user || null;
  res.locals.currentPath = req.path;
  res.locals.flashMessages = req.flashMessages || [];
  res.locals.csrfToken = req.sessionRow?.csrf_token || '';
  res.locals.roleDefinitions = ROLE_DEFINITIONS;
  res.locals.loginCategories = LOGIN_CATEGORIES;
  res.locals.dashboards = DASHBOARDS;
  res.locals.navigation = buildNavigation(req.user);
  res.locals.isDemoSession = Boolean(req.user?.isDemo);
  res.locals.supportedPermissions = (permission) =>
    Boolean(req.user && roleHasPermission(req.user.role, permission));

  // Formatting helpers used across templates.
  res.locals.formatDate = (iso, opts = {}) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      ...opts,
    });
  };
  res.locals.formatDateTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return `${d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  };
  res.locals.timeAgo = (iso) => {
    if (!iso) return '—';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.round(hours / 24);
    return days === 1 ? 'yesterday' : `${days} days ago`;
  };
  res.locals.initials = (name) => {
    if (!name) return '?';
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('');
  };

  next();
}

module.exports = { viewLocals, buildNavigation };

/* ---------------------------------------------------------------------------
 * Layout composition
 * ---------------------------------------------------------------------------
 * EJS has no built-in layout inheritance, and threading `body` through every
 * route handler would be noisy. Instead we wrap `res.render` once:
 *
 *   dashboards/*  ->  layouts/app -> layouts/base
 *   auth/*        ->  layouts/base
 *   errors/*      ->  layouts/base
 *
 * A route therefore only ever renders its own content template, and the
 * header, sidebar, branding and footer are guaranteed to be identical on
 * every page of the platform.
 */
function layoutSupport(req, res, next) {
  const originalRender = res.render.bind(res);

  res.render = function renderWithLayout(view, options = {}, callback) {
    // Allow an explicit opt-out (used when we render a layout directly).
    const skipLayout = options && options.layout === false;

    const finish = (err, html) => {
      if (typeof callback === 'function') return callback(err, html);
      if (err) return next(err);
      return res.send(html);
    };

    if (skipLayout) return originalRender(view, options, finish);

    originalRender(view, options, (err, contentHtml) => {
      if (err) return finish(err);

      const baseLocals = { ...options, body: contentHtml };

      const isAppPage = view.startsWith('dashboards/');
      if (!isAppPage) {
        return originalRender('layouts/base', baseLocals, finish);
      }

      return originalRender('layouts/app', baseLocals, (appErr, appHtml) => {
        if (appErr) return finish(appErr);
        return originalRender(
          'layouts/base',
          { ...options, body: appHtml },
          finish
        );
      });
    });
  };

  next();
}

module.exports.layoutSupport = layoutSupport;
