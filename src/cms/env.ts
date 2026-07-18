// src/cms/env.ts — shared runtime types and constants.
// Single source of truth for the Worker bindings + values used across routes.

import type { Context, Hono } from "hono";

export type Env = {
  DB: D1Database;
  CACHE: KVNamespace;
  // Optional secret for the emergency wipe endpoint (POST /api/admin/wipe).
  // Lets a locked-out admin reset the site without a valid session, so a
  // corrupted/stale session (the /admin <-> /admin/login loop) can't lock
  // you out of recovery. Set as a Cloudflare Worker secret, not in source.
  WIPE_TOKEN?: string;
};

// Shared app type — every route module's register() takes this, so the
// handler wiring in index.ts stays one-liners without repeating the
// Hono<{ Bindings: Env }> dance in each file.
export type App = Hono<{ Bindings: Env }>;

// ── Session ────────────────────────────────────────────────────────
export const SESSION_COOKIE = "phcloudcms_session";
export const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days, in seconds

// ── Validation ─────────────────────────────────────────────────────
// Slugs: lowercase letters, numbers, and hyphens only.
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ── Request helpers ─────────────────────────────────────────────────
// Parse a JSON request body; return null on any failure so callers can
// respond with a 400 rather than crashing the handler.
export async function parseJsonBody(
  c: Context,
): Promise<Record<string, unknown> | null> {
  try {
    return (await c.req.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}
