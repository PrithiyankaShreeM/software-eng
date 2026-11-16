'use strict';

/**
 * Minimal cookie-aware HTTP client for the integration tests.
 * Node 22 ships fetch, but it deliberately does not keep a cookie jar — this
 * small wrapper adds exactly that so tests can behave like a browser.
 */

class TestClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookies = new Map();
  }

  /** Serialise the cookie jar into a Cookie header. */
  cookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  /** Absorb Set-Cookie headers (supports string and array). */
  absorb(response) {
    const raw = response.headers.getSetCookie
      ? response.headers.getSetCookie()
      : [response.headers.get('set-cookie')].filter(Boolean);

    for (const line of raw) {
      const [pair] = line.split(';');
      const index = pair.indexOf('=');
      if (index === -1) continue;
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (value === '' || /Expires=Thu, 01 Jan 1970/i.test(line)) {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value);
      }
    }
  }

  /** Read a cookie value from the jar. */
  cookie(name) {
    return this.cookies.get(name);
  }

  /** GET with the current cookie jar. `redirect: 'manual'` by default. */
  async get(path, options = {}) {
    const response = await fetch(new URL(path, this.baseUrl), {
      method: 'GET',
      headers: {
        cookie: this.cookieHeader(),
        accept: options.accept || 'text/html',
        ...(options.headers || {}),
      },
      redirect: options.redirect || 'manual',
    });
    this.absorb(response);
    return this.shape(response);
  }

  /** POST a URL-encoded form, echoing the CSRF token automatically. */
  async post(path, fields = {}, options = {}) {
    // A browser always loads a form page first, which is what issues the
    // anonymous CSRF cookie. Mirror that so tests behave realistically.
    if (options.csrf !== false && !this.cookies.get('uniexam.csrf') && !('_csrf' in fields)) {
      await this.get('/login');
    }

    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && value !== null) body.append(key, String(value));
    }

    // Every state-changing request needs the token; supply it unless the
    // caller is deliberately testing CSRF rejection.
    if (!('_csrf' in fields) && options.csrf !== false) {
      const token = this.cookies.get('uniexam.csrf');
      if (token) body.append('_csrf', token);
    }

    const response = await fetch(new URL(path, this.baseUrl), {
      method: 'POST',
      headers: {
        cookie: this.cookieHeader(),
        'content-type': 'application/x-www-form-urlencoded',
        accept: options.accept || 'text/html',
        ...(options.headers || {}),
      },
      body: body.toString(),
      redirect: options.redirect || 'manual',
    });
    this.absorb(response);
    return this.shape(response);
  }

  shape(response) {
    const self = this;
    return {
      status: response.status,
      ok: response.ok,
      location: response.headers.get('location'),
      headers: response.headers,
      text: () => response.text().then((t) => { self.lastBody = t; return t; }),
      json: () => response.json(),
    };
  }

  /**
   * Log in the way a browser would: load the login page first (which issues
   * the anonymous CSRF cookie), then submit the form.
   */
  async login(identifier, password, category = 'student', remember = false) {
    if (!this.cookies.get('uniexam.csrf')) {
      await this.get('/login');
    }
    return this.post('/login', { identifier, password, category, ...(remember ? { remember: '1' } : {}) });
  }
}

module.exports = { TestClient };
