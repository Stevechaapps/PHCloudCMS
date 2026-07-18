// src/index.ts — Worker entrypoint. Stays thin: app + global middleware +
// route registration order. Logic lives in routes/*.ts and cms/*.ts.
//
// Register order matters only for the catch-all: registerPublicRoutes
// must run LAST so /:slug? doesn't shadow /search, /feed.xml, /img/:id,
// /tag/:slug, /sitemap.xml, the /admin/* and /api/* routes, etc.

import { Hono } from "hono";
import { onboardingGuard } from "./cms/middleware.js";
import { Env } from "./cms/env.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerPostRoutes } from "./routes/posts.js";
import { registerPageRoutes } from "./routes/pages.js";
import { registerTagRoutes } from "./routes/tags.js";
import { registerNavRoutes } from "./routes/nav.js";
import { registerSettingsRoutes } from "./routes/settings.js";
import { registerImageRoutes } from "./routes/images.js";
import { registerPluginRoutes } from "./routes/plugins.js";
import { registerInstallRoute } from "./routes/install.js";
import { registerWipeRoute } from "./routes/wipe.js";
import { registerPublicRoutes } from "./routes/public.js";

const app = new Hono<{ Bindings: Env }>();

// ── Global middleware ───────────────────────────────────────────────
app.use("*", onboardingGuard);
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  c.header("Content-Security-Policy", [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join("; "));
});

// ── Routes (catch-all registered last) ──────────────────────────────
registerAuthRoutes(app);
registerPostRoutes(app);
registerPageRoutes(app);
registerTagRoutes(app);
registerNavRoutes(app);
registerSettingsRoutes(app);
registerImageRoutes(app);
registerPluginRoutes(app);
registerInstallRoute(app);
registerWipeRoute(app);
registerPublicRoutes(app);

export default app;
