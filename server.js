'use strict';

/**
 * ============================================================================
 *  UniExam — Centralized Authentication & Role-Based Access Platform
 * ============================================================================
 *
 *  Entry point. Boot order matters:
 *    1. open + migrate the database
 *    2. seed demonstration data (only when the database is empty)
 *    3. build the Express app
 *    4. start listening / or export the app for the test harness
 *
 *  Run:  npm start
 *  Dev:  npm run dev
 *  Test: npm test
 */

const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const config = require('./src/config');
const db = require('./src/db');
const { seed } = require('./src/db/seed');
const sessionService = require('./src/services/session');

const { context, consumeFlash } = require('./src/middleware/context');
const { loadUser } = require('./src/middleware/auth');
const { csrf, issueAnonymousCsrf } = require('./src/middleware/csrf');
const { viewLocals, layoutSupport } = require('./src/middleware/view');

const { icon } = require('./src/views/partials/icons');

/**
 * Build the Express application. Exported so tests can mount it directly.
 */
function createApp() {
  const app = express();

  // Behind the preview proxy we must trust exactly one hop so
  // X-Forwarded-For resolves to the real client IP — without this,
  // express-rate-limit refuses to run and every user shares one bucket.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // ---------------------------- View engine ----------------------------
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'src', 'views'));

  // ------------------------------ Security -----------------------------
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'self'", 'https://*.e2b.app', 'https://*.arena.ai'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
        },
      },
      // The app is embedded in a preview iframe from a different origin, so
      // frame protection is expressed through CSP `frame-ancestors` (the
      // modern, allow-list based control) rather than X-Frame-Options, whose
      // SAMEORIGIN value would block the preview outright.
      xFrameOptions: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'same-origin' },
      hsts: config.isProduction
        ? { maxAge: 15552000, includeSubDomains: true }
        : false,
    })
  );

  // --------------------------- Body parsing ----------------------------
  app.use(express.urlencoded({ extended: false, limit: '128kb' }));
  app.use(express.json({ limit: '128kb' }));
  app.use(cookieParser(config.cookieSecret));

  // --------------------------- Static assets ---------------------------
  app.use(
    '/static',
    express.static(path.join(__dirname, 'src', 'public'), {
      maxAge: config.isProduction ? '7d' : 0,
      etag: true,
      index: false,
    })
  );

  // ------------------------ Global rate limiting -----------------------
  // A generous ceiling that still blunts automated scraping.
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 300,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      skip: (req) => req.path.startsWith('/static'),
    })
  );

  // ------------------------- Request context ---------------------------
  app.use(context);
  app.use(consumeFlash);
  app.use(loadUser);

  // ----------------------------- CSRF ----------------------------------
  // Issue an anonymous token for public forms (login / password reset) on
  // safe requests, so that the token exists before the template is rendered.
  app.use((req, res, next) => {
    if (['GET', 'HEAD'].includes(req.method)) return issueAnonymousCsrf(req, res, next);
    return next();
  });

  // ---------------------------- View locals ----------------------------
  // Registered *before* CSRF validation so that a rejected request can
  // still render the branded 403 page with full layout context.
  app.locals.icon = icon;
  app.use(viewLocals);
  app.use(layoutSupport);

  // Validate every state-changing request.
  app.use(csrf);

  // ------------------------------ Routes -------------------------------
  app.use(require('./src/routes/auth'));
  app.use(require('./src/routes/shared'));
  app.use(require('./src/routes/student'));
  app.use(require('./src/routes/examiner'));
  app.use(require('./src/routes/moderator'));
  app.use(require('./src/routes/controller'));
  app.use(require('./src/routes/department'));
  app.use(require('./src/routes/admin'));
  app.use(require('./src/routes/verifier'));

  // --------------------------- Health check ----------------------------
  app.get('/healthz', (req, res) => {
    res.json({ status: 'ok', uptime: Math.round(process.uptime()), env: config.env });
  });

  // ------------------------------ 404 ----------------------------------
  app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'not_found', path: req.path });
    }
    return res.status(404).render('errors/404', {
      pageTitle: 'Page not found',
      statusCode: 404,
      bodyClass: 'app-page',
    });
  });

  // --------------------------- Error handler ---------------------------
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const errorId = `ERR-${Date.now().toString(36).toUpperCase()}`;
    console.error(`[${errorId}] ${req.method} ${req.originalUrl}`, err);

    if (res.headersSent) return;

    if (req.path.startsWith('/api/')) {
      return res.status(500).json({
        error: 'internal_error',
        errorId,
        message: config.isProduction ? 'An unexpected error occurred.' : err.message,
      });
    }

    return res.status(500).render('errors/500', {
      pageTitle: 'Something went wrong',
      statusCode: 500,
      errorId,
      bodyClass: 'app-page',
    });
  });

  return app;
}

/**
 * Boot the database, seed demo data, and start the server.
 */
async function start() {
  db.init();
  const seeded = await seed();
  if (!seeded.skipped) {
    console.log(
      `[db] Demo dataset created — ${seeded.users} users, ${seeded.exams} exams, ${seeded.credentials} credentials.`
    );
  }

  // Housekeeping: drop sessions that have expired.
  const pruned = sessionService.pruneExpired();
  if (pruned > 0) console.log(`[db] Pruned ${pruned} expired session(s).`);

  const app = createApp();

  const server = app.listen(config.port, config.host, () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════════════════════════════╗');
    console.log('  ║  UniExam — Centralized Authentication & RBAC                 ║');
    console.log('  ╚══════════════════════════════════════════════════════════════╝');
    console.log(`  Environment : ${config.env}`);
    console.log(`  Listening   : http://${config.host}:${config.port}`);
    console.log(`  Database    : ${config.dbPath}`);
    console.log('  Demo logins : admin / exm1001 / mod2001 / ctl3001 / hod4001 /');
    console.log('                stu2024001 / ver5001   (password: Demo@2024)');
    console.log('');
  });

  const shutdown = (signal) => {
    console.log(`\n[server] ${signal} received — shutting down.`);
    server.close(() => {
      db.close();
      process.exit(0);
    });
    // Force-exit if connections refuse to drain.
    setTimeout(() => process.exit(1), 8000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}

if (require.main === module) {
  start().catch((err) => {
    console.error('[server] Fatal startup error:', err);
    process.exit(1);
  });
}

module.exports = { createApp, start };
