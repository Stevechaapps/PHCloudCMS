// src/cms/middleware.ts — Onboarding interceptor & session gatekeeping
// Every request passes through onboardingGuard first.
// If D1 settings.status != 'configured', the user sees the install wizard.

import { Context, Next } from 'hono';
import { CMSRegistry } from './registry.js';
import { getSetting, isConfigured } from './d1.js';

export type Env = {
  DB: D1Database;
  CACHE: KVNamespace;
};

// ── Onboarding guard ──────────────────────────────────────────────

export async function onboardingGuard(c: Context, next: Next): Promise<Response | void> {
  const path = new URL(c.req.url).pathname;

  // Let the install POST and static assets through unhindered
  if (path === '/api/install' || path === '/health' || path.startsWith('/_next') || path.match(/\.(css|js|png|ico|svg)$/)) {
    return next();
  }

  try {
    const configured = await isConfigured(c.env.DB);
    if (!configured) {
      return serveOnboardingUI(c);
    }
  } catch {
    return serveOnboardingUI(c);
  }

  await next();
}

function serveOnboardingUI(c: Context): Response {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Setup · PHCloud CMS</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: system-ui, sans-serif;
          background: #f8fafc;
          color: #1e293b;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }
        .card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 2.5rem;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        }
        h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
        .sub { color: #64748b; font-size: 0.9rem; margin-bottom: 2rem; }
        label { display: block; font-size: 0.85rem; font-weight: 500; margin-bottom: 0.35rem; }
        input[type="text"], input[type="password"] {
          width: 100%; padding: 0.65rem;
          border: 1px solid #cbd5e1; border-radius: 4px;
          font-size: 1rem; margin-bottom: 1rem;
        }
        label.check { display: flex; align-items: center; gap: 0.5rem; font-weight: 400; margin-bottom: 1rem; }
        label.check input { width: auto; margin: 0; }
        button {
          width: 100%; padding: 0.75rem;
          background: #2563eb; color: white;
          border: none; border-radius: 4px;
          font-size: 1rem; cursor: pointer; font-weight: 500;
          margin-top: 0.5rem;
        }
        button:hover { background: #1d4ed8; }
        .err { color: #dc2626; font-size: 0.85rem; margin-top: 0.75rem; display: none; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>📦 PHCloud CMS Setup</h1>
        <p class="sub">Your code is live on Cloudflare Workers. Configure your site and create your admin account.</p>
        <form id="installForm">
          <label for="siteName">Site Name</label>
          <input type="text" id="siteName" name="siteName" placeholder="My Company Website" required />

          <label for="adminUser">Admin Username</label>
          <input type="text" id="adminUser" name="adminUsername" placeholder="admin" required />

          <label for="adminPass">Admin Password</label>
          <input type="password" id="adminPass" name="adminPassword" placeholder="Choose a strong password" required minlength="8" />

          <label class="check">
            <input type="checkbox" name="plugin_seo" checked />
            Activate SEO Engine Plugin
          </label>
          <label class="check">
            <input type="checkbox" name="plugin_sitemap" checked />
            Auto-Generate XML Sitemap
          </label>
          <button type="submit">Initialize Core Systems</button>
          <div class="err" id="err"></div>
        </form>
      </div>
      <script>
        const form = document.getElementById('installForm');
        const errEl = document.getElementById('err');
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          errEl.style.display = 'none';
          const btn = form.querySelector('button');
          btn.disabled = true;
          btn.textContent = 'Installing…';
          const fd = new FormData(form);
          const pw = String(fd.get('adminPassword') ?? '');
          if (!pw || pw.length < 8) {
            errEl.style.display = 'block';
            errEl.textContent = 'Password must be at least 8 characters.';
            return;
          }
          // Submit as form data — the backend reads fields via c.req.parseBody(),
          // matching the rest of the app. (A JSON content-type made parseBody
          // return {} and the admin was created with an empty password.)
          const res = await fetch('/api/install', { method: 'POST', body: fd });
          if (!res.ok) {
            errEl.style.display = 'block';
            const errBody = await res.text().catch(() => '');
            let msg = 'Setup failed. Check your Cloudflare D1 binding.';
            if (errBody) {
              try { const j = JSON.parse(errBody); msg = 'Setup failed: ' + (j.detail || j.error || errBody); } catch { msg = 'Setup failed: ' + errBody; }
            }
            errEl.textContent = msg;
            btn.disabled = false;
            btn.textContent = 'Initialize Core Systems';
          } else {
            window.location.href = '/admin';
          }
        });
      </script>
    </body>
    </html>
  `);
}

// ── Cache helper ──────────────────────────────────────────────────

export async function getCached<T>(c: Context, key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  const cached = await c.env.CACHE.get(key);
  if (cached) {
    try { return JSON.parse(cached) as T; } catch { /* stale entry — revalidate */ }
  }

  const value = await fetcher();
  await c.env.CACHE.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
  return value;
}
