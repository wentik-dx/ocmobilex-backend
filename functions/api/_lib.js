/**
 * OCMX API — shared helpers.
 *
 * Everything here is dependency-free: WebCrypto only, no npm packages.
 * Runtime: Cloudflare Pages Functions (Workers runtime, ES modules).
 *
 * Conventions used by every handler in functions/api:
 *   - all responses are JSON with a boolean `ok`
 *   - every handler answers OPTIONS with 204 + CORS headers
 *   - nothing throws out of a handler (route() converts errors to JSON)
 */

const encoder = new TextEncoder();

/* ------------------------------------------------------------------ */
/* CORS                                                                */
/* ------------------------------------------------------------------ */

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Owner-Token, X-AI-Token",
  "Access-Control-Max-Age": "86400",
};

/** Global preflight answer. Re-exported by every handler. */
export function onRequestOptions() {
  return new Response(null, { status: 204, headers: { ...CORS_HEADERS } });
}

/* ------------------------------------------------------------------ */
/* Responses                                                           */
/* ------------------------------------------------------------------ */

/**
 * Build a JSON response. `ok` is always present: it is derived from the
 * status code unless the body already declares it.
 */
export function json(status, body = {}, extraHeaders = {}) {
  let payload = body;

  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    payload = { ok: status < 400, data: payload };
  } else if (typeof payload.ok !== "boolean") {
    payload = { ...payload, ok: status < 400 };
  }

  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

/** Any HTTP error we raise on purpose. */
export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    if (code) this.code = code;
  }
}

/** Convert anything thrown into a JSON error response. */
export function fail(err) {
  if (err instanceof HttpError) {
    const body = { ok: false, error: err.message };
    if (err.code) body.code = err.code;
    return json(err.status, body);
  }
  console.error("[ocmx] unhandled error:", (err && err.stack) || err);
  return json(500, { ok: false, error: "Internal server error" });
}

/** Wrap a handler so no exception ever escapes. */
export function route(handler) {
  return async function wrapped(context) {
    try {
      return await handler(context);
    } catch (err) {
      return fail(err);
    }
  };
}

/* ------------------------------------------------------------------ */
/* Request parsing / validation                                        */
/* ------------------------------------------------------------------ */

const DEFAULT_MAX_BODY = 8 * 1024 * 1024; // 8 MiB of JSON text

/** Read a JSON object body, rejecting oversized / malformed payloads. */
export async function readJson(request, maxBytes = DEFAULT_MAX_BODY) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared && declared > maxBytes) {
    throw new HttpError(413, `Request body too large (max ${maxBytes} bytes)`);
  }

  let text;
  try {
    text = await request.text();
  } catch {
    throw new HttpError(400, "Unable to read request body");
  }

  if (text.length > maxBytes) {
    throw new HttpError(413, `Request body too large (max ${maxBytes} bytes)`);
  }
  if (!text.trim()) return {};

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new HttpError(400, "Body must be a JSON object");
  }
  return data;
}

/** Required trimmed string with length bounds. */
export function requireString(value, field, min = 1, max = 1000) {
  if (typeof value !== "string") {
    throw new HttpError(400, `${field} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length < min) {
    throw new HttpError(400, `${field} must be at least ${min} characters`);
  }
  if (trimmed.length > max) {
    throw new HttpError(400, `${field} must be at most ${max} characters`);
  }
  return trimmed;
}

/** Optional trimmed string; missing / null / "" becomes "". */
export function optionalString(value, field, max = 2000) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") {
    throw new HttpError(400, `${field} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw new HttpError(400, `${field} must be at most ${max} characters`);
  }
  return trimmed;
}

/** String restricted to a fixed set of values. */
export function oneOf(value, field, allowed, fallback) {
  if (value === undefined || value === null || value === "") {
    if (fallback !== undefined) return fallback;
    throw new HttpError(400, `${field} is required (${allowed.join(", ")})`);
  }
  if (typeof value !== "string") {
    throw new HttpError(400, `${field} must be a string`);
  }
  const normalized = value.trim().toLowerCase();
  if (!allowed.includes(normalized)) {
    throw new HttpError(400, `${field} must be one of: ${allowed.join(", ")}`);
  }
  return normalized;
}

/** Optional boolean. */
export function optionalBool(value, field, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  throw new HttpError(400, `${field} must be a boolean`);
}

/** Optional string array (trimmed, de-duplicated, bounded). */
export function stringArray(value, field, maxItems = 20, maxLen = 32) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new HttpError(400, `${field} must be an array`);
  if (value.length > maxItems) {
    throw new HttpError(400, `${field} must contain at most ${maxItems} items`);
  }
  const out = [];
  for (const item of value) {
    if (typeof item !== "string") {
      throw new HttpError(400, `${field} must only contain strings`);
    }
    const t = item.trim().slice(0, maxLen);
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Encoding helpers                                                    */
/* ------------------------------------------------------------------ */

function toBinaryString(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) out += String.fromCharCode(bytes[i]);
  return out;
}

/** standard base64 (with padding) */
export function b64encode(input) {
  const bytes = typeof input === "string" ? encoder.encode(input) : input;
  return btoa(toBinaryString(bytes));
}

/** standard base64 -> Uint8Array (accepts url-safe and unpadded input) */
export function b64decode(input) {
  if (typeof input !== "string") return new Uint8Array(0);
  let normalized = input.trim().replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4;
  if (pad === 2) normalized += "==";
  else if (pad === 3) normalized += "=";
  else if (pad === 1) return new Uint8Array(0);
  const bin = atob(normalized);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export function b64encodeUrl(input) {
  return b64encode(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64decodeUrl(input) {
  return b64decode(input);
}

export function b64decodeToString(input) {
  try {
    return new TextDecoder().decode(b64decode(input));
  } catch {
    return "";
  }
}

/** True if the string looks like base64 (optionally a data: URL). */
export function looksLikeBase64(value) {
  if (typeof value !== "string") return false;
  const payload = value.startsWith("data:") ? value.slice(value.indexOf(",") + 1) : value;
  return payload.length > 0 && /^[A-Za-z0-9+/=\s_-]+$/.test(payload);
}

/** Strip a data: URL prefix if present. */
export function stripDataUrl(value) {
  if (typeof value === "string" && value.startsWith("data:")) {
    const comma = value.indexOf(",");
    if (comma !== -1) return value.slice(comma + 1);
  }
  return value;
}

/** MIME type of a data: URL, or null. */
export function dataUrlMime(value) {
  if (typeof value !== "string" || !value.startsWith("data:")) return null;
  const end = value.indexOf(";");
  const comma = value.indexOf(",");
  const stop = end !== -1 && end < comma ? end : comma;
  if (stop === -1) return null;
  return value.slice(5, stop) || null;
}

/** Byte length of base64 payload without decoding it. */
export function base64ByteLength(value) {
  const payload = stripDataUrl(value).replace(/\s+/g, "");
  if (!payload) return 0;
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.floor((payload.length * 3) / 4) - padding;
}

/* ------------------------------------------------------------------ */
/* Random / ids                                                        */
/* ------------------------------------------------------------------ */

const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const ALNUM_MAX = 256 - (256 % ALNUM.length); // 248, avoids modulo bias

/** Cryptographically random alphanumeric id (default 32 chars). */
export function randomId(len = 32) {
  const target = Math.max(1, Math.min(512, Number(len) || 32));
  let out = "";
  while (out.length < target) {
    const buf = crypto.getRandomValues(new Uint8Array(target * 2));
    for (let i = 0; i < buf.length && out.length < target; i += 1) {
      if (buf[i] < ALNUM_MAX) out += ALNUM[buf[i] % ALNUM.length];
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Password hashing (PBKDF2-SHA256 via WebCrypto)                      */
/* ------------------------------------------------------------------ */

export const PBKDF2_ITERATIONS = 100000; // Workers cap for PBKDF2
export const PBKDF2_ALGO = "PBKDF2-SHA256";

async function deriveBits(password, salt, iterations, byteLength) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    byteLength * 8,
  );
}

/**
 * Hash a password. Returns a storable record:
 * { algo, iterations, salt, hash } — salt and hash are standard base64.
 */
export async function hashPassword(password, iterations = PBKDF2_ITERATIONS) {
  if (typeof password !== "string" || password.length === 0) {
    throw new HttpError(400, "password must be a non-empty string");
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = new Uint8Array(await deriveBits(password, salt, iterations, 32));
  return {
    algo: PBKDF2_ALGO,
    iterations,
    salt: b64encode(salt),
    hash: b64encode(bits),
  };
}

/** Constant-time byte comparison. */
export function timingSafeEqualBytes(a, b) {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array)) return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Constant-time string comparison (UTF-8 bytes). */
export function timingSafeEqualString(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  return timingSafeEqualBytes(encoder.encode(a), encoder.encode(b));
}

/** Verify a password against a stored hash record. */
export async function verifyPassword(password, record) {
  if (typeof password !== "string" || !record) return false;
  if (typeof record.hash !== "string" || typeof record.salt !== "string") return false;

  const expected = b64decode(record.hash);
  if (!expected.length) return false;

  const iterations = Number(record.iterations) || PBKDF2_ITERATIONS;
  try {
    const actual = new Uint8Array(
      await deriveBits(password, b64decode(record.salt), iterations, expected.length),
    );
    return timingSafeEqualBytes(actual, expected);
  } catch (err) {
    console.error("[ocmx] verifyPassword failed:", err);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Session tokens (HMAC-SHA256, stateless)                             */
/* ------------------------------------------------------------------ */

export const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days

function sessionSecret(env) {
  const secret = env && env.SESSION_SECRET;
  if (typeof secret !== "string" || secret.length < 16) {
    throw new HttpError(500, "Server is missing SESSION_SECRET");
  }
  return secret;
}

async function hmacB64Url(data, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return b64encodeUrl(new Uint8Array(sig));
}

/** Sign a session token: base64url(payload).base64url(hmac). */
export async function signSessionToken(env, username, ttlSeconds = SESSION_TTL) {
  const payload = {
    u: String(username),
    exp: Math.floor(Date.now() / 1000) + Math.max(60, Number(ttlSeconds) || SESSION_TTL),
  };
  const body = b64encodeUrl(JSON.stringify(payload));
  const sig = await hmacB64Url(body, sessionSecret(env));
  return `${body}.${sig}`;
}

/** Verify a session token; returns the payload or null. */
export async function verifySessionToken(env, token) {
  if (typeof token !== "string" || token.length < 8 || token.length > 4096) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [body, sig] = parts;
  let expected;
  try {
    expected = await hmacB64Url(body, sessionSecret(env));
  } catch {
    return null;
  }
  if (!timingSafeEqualString(sig, expected)) return null;

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64decodeUrl(body)));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  if (typeof payload.u !== "string" || !payload.u) return null;
  if (typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) return null;
  return payload;
}

export function bearerToken(request) {
  const header = request.headers.get("Authorization") || "";
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

/* ------------------------------------------------------------------ */
/* KV helpers                                                          */
/* ------------------------------------------------------------------ */

function store(env) {
  if (!env || !env.OCMX) {
    throw new HttpError(500, "KV binding OCMX is not configured");
  }
  return env.OCMX;
}

export async function kvGet(env, key) {
  const raw = await store(env).get(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function kvPut(env, key, value, options) {
  await store(env).put(key, JSON.stringify(value), options);
}

export async function kvDelete(env, key) {
  await store(env).delete(key);
}

/** List every key under a prefix (capped). */
export async function kvListAll(env, prefix, max = 1000) {
  const kv = store(env);
  const names = [];
  let cursor;
  do {
    const page = await kv.list({ prefix, cursor, limit: 1000 });
    for (const key of page.keys) names.push(key.name);
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor && names.length < max);
  return names.slice(0, max);
}

/** Fetch many JSON values, in bounded parallel batches. */
export async function kvGetMany(env, keys, batch = 20) {
  const out = [];
  for (let i = 0; i < keys.length; i += batch) {
    const slice = keys.slice(i, i + batch);
    const values = await Promise.all(slice.map((key) => kvGet(env, key)));
    for (const value of values) if (value) out.push(value);
  }
  return out;
}

/** Read + sort + filter + paginate a whole KV collection. */
export async function kvCollection(env, prefix, { max = 1000 } = {}) {
  const keys = await kvListAll(env, prefix, max);
  return kvGetMany(env, keys);
}

/* ------------------------------------------------------------------ */
/* Accounts                                                            */
/* ------------------------------------------------------------------ */

export const ROLES = ["user", "mod", "admin", "owner"];
export const ROLE_RANK = { user: 1, mod: 2, admin: 3, owner: 4 };

export function validUsername(value) {
  return typeof value === "string" && /^[A-Za-z0-9_]{3,24}$/.test(value);
}

export function validPassword(value) {
  return typeof value === "string" && value.length >= 8 && value.length <= 200;
}

export function userKey(username) {
  return `user:${String(username).toLowerCase()}`;
}

export async function getUser(env, username) {
  if (typeof username !== "string" || !username) return null;
  return kvGet(env, userKey(username));
}

export async function putUser(env, user) {
  await kvPut(env, userKey(user.username), user);
}

export async function countUsers(env) {
  const page = await store(env).list({ prefix: "user:", limit: 1 });
  return page.keys.length;
}

export function isStaff(account) {
  return !!account && (account.role === "owner" || account.role === "admin" || account.role === "mod");
}

export function canModerate(account) {
  return isStaff(account);
}

/** Public projection of an account — never includes hash / salt. */
export function publicUser(user, options = {}) {
  if (!user) return null;
  const { self = false, staff = false } = options;
  const stats = user.stats || {};
  const out = {
    username: user.username,
    role: user.role || "user",
    bio: user.bio || "",
    color: user.color || "",
    links: {
      github: (user.links && user.links.github) || "",
      site: (user.links && user.links.site) || "",
    },
    joinedAt: user.joinedAt || null,
    stats: {
      sharedChats: Number(stats.sharedChats) || 0,
      published: Number(stats.published) || 0,
      ideas: Number(stats.ideas) || 0,
    },
  };
  if (self) {
    out.mutedUntil = user.mutedUntil || null;
    out.banned = !!user.banned;
  }
  if (staff) {
    out.flags = { banned: !!user.banned, reports: Number(user.reports) || 0 };
    out.mutedUntil = user.mutedUntil || null;
  }
  return out;
}

/** Bump one of the public counters on a user record. */
export async function bumpStat(env, username, field, delta = 1) {
  if (!username) return;
  const user = await getUser(env, username);
  if (!user) return;
  user.stats = user.stats || {};
  user.stats[field] = Math.max(0, (Number(user.stats[field]) || 0) + delta);
  await putUser(env, user);
}

/** Block content creation for muted accounts. */
export function assertNotMuted(account) {
  if (!account) return;
  if (account.banned) throw new HttpError(403, "Account is banned");
  if (account.mutedUntil && Date.now() < Number(account.mutedUntil)) {
    throw new HttpError(
      403,
      `You are muted until ${new Date(Number(account.mutedUntil)).toISOString()}`,
      "muted",
    );
  }
}

/* ------------------------------------------------------------------ */
/* Auth guards                                                         */
/* ------------------------------------------------------------------ */

/** Bearer token -> account record. Throws 401/403. */
export async function requireUser(request, env) {
  const token = bearerToken(request);
  if (!token) throw new HttpError(401, "Missing Authorization: Bearer <token>");

  const payload = await verifySessionToken(env, token);
  if (!payload) throw new HttpError(401, "Invalid or expired token");

  const account = await getUser(env, payload.u);
  if (!account) throw new HttpError(401, "Account no longer exists");
  if (account.banned) throw new HttpError(403, "Account is banned");
  return account;
}

/** Owner via X-Owner-Token or an owner-role bearer token. */
export async function requireOwner(request, env) {
  const token = request.headers.get("X-Owner-Token");
  if (token && env.OWNER_TOKEN && timingSafeEqualString(token, env.OWNER_TOKEN)) {
    return { account: null, viaToken: true };
  }
  let account = null;
  try {
    account = await requireUser(request, env);
  } catch {
    account = null;
  }
  if (!account) throw new HttpError(403, "Owner access required");
  if (account.role !== "owner") throw new HttpError(403, "Owner role required");
  return { account, viaToken: false };
}

/** Strictly the X-Owner-Token header (used by /api/seed). */
export function requireOwnerToken(request, env) {
  const token = request.headers.get("X-Owner-Token");
  if (!token || !env.OWNER_TOKEN || !timingSafeEqualString(token, env.OWNER_TOKEN)) {
    throw new HttpError(403, "A valid X-Owner-Token header is required");
  }
  return true;
}

/** Owner / admin / mod. */
export async function requireStaff(request, env) {
  const account = await requireUser(request, env);
  if (!isStaff(account)) throw new HttpError(403, "Moderator access required");
  return account;
}

/** True when the request carries a valid service (AI) or owner token. */
export function hasServiceToken(request, env) {
  const ai = request.headers.get("X-AI-Token");
  if (ai && env.AI_TOKEN && timingSafeEqualString(ai, env.AI_TOKEN)) return true;
  const owner = request.headers.get("X-Owner-Token");
  if (owner && env.OWNER_TOKEN && timingSafeEqualString(owner, env.OWNER_TOKEN)) return true;
  return false;
}

/* ------------------------------------------------------------------ */
/* Rate limiting (KV)                                                  */
/* ------------------------------------------------------------------ */

export function getIP(request) {
  const cf = request.headers.get("CF-Connecting-IP");
  if (cf) return cf.trim();
  const forwarded = request.headers.get("X-Forwarded-For");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

/**
 * Fixed-window rate limit backed by KV.
 * `max` is how many events the window allows (default 1).
 * Returns { allowed, retryAfter, remaining } and consumes one slot when allowed.
 *
 * KV has no atomic increment, so the counter is a read-modify-write. That is
 * best-effort by design: it stops casual abuse, not a distributed attacker.
 */
export async function rateLimit(env, key, seconds, max = 1) {
  const ttl = Math.max(60, Math.floor(Number(seconds) || 60)); // KV minimum is 60s
  const limit = Math.max(1, Math.floor(Number(max) || 1));
  const kvKey = `rl:${key}`;

  const raw = await store(env).get(kvKey);

  let count = 0;
  let started = Date.now();

  if (raw !== null) {
    try {
      const parsed = JSON.parse(raw);
      count = Number(parsed.count) || 0;
      started = Number(parsed.start) || Date.now();
    } catch {
      count = Number(raw) || 1; // tolerate the legacy "timestamp only" value
      started = count > 1e12 ? count : Date.now();
    }
  }

  const elapsed = Math.floor((Date.now() - started) / 1000);
  if (raw !== null && elapsed >= ttl) {
    count = 0;
    started = Date.now();
  }

  if (count >= limit) {
    return { allowed: false, retryAfter: Math.max(1, ttl - elapsed), remaining: 0 };
  }

  const next = count + 1;
  await store(env).put(kvKey, JSON.stringify({ count: next, start: started }), {
    expirationTtl: ttl,
  });

  return { allowed: true, retryAfter: 0, remaining: Math.max(0, limit - next) };
}

/** Apply several rate-limit keys; throws 429 on the first blocked key. */
export async function enforceRate(env, keys, seconds, message, max = 1) {
  const list = Array.isArray(keys) ? keys.filter(Boolean) : [keys].filter(Boolean);
  for (const key of list) {
    const result = await rateLimit(env, key, seconds, max);
    if (!result.allowed) {
      throw new HttpError(
        429,
        message || `Rate limit exceeded. Try again in ${result.retryAfter}s.`,
        "rate_limited",
      );
    }
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

/** Cursor pagination over an in-memory array. */
export function paginate(items, limit, cursor) {
  const list = Array.isArray(items) ? items : [];
  const total = list.length;
  const perPage = Math.min(100, Math.max(1, Number(limit) || 20));

  let start = 0;
  if (cursor) {
    const decoded = Number(b64decodeToString(String(cursor)));
    if (Number.isFinite(decoded) && decoded > 0) start = Math.floor(decoded);
  }
  if (start > total) start = total;

  const page = list.slice(start, start + perPage);
  const nextStart = start + page.length;
  return {
    items: page,
    total,
    nextCursor: nextStart < total ? b64encodeUrl(String(nextStart)) : null,
  };
}

/** Query params with sane defaults. */
export function query(request) {
  try {
    return new URL(request.url).searchParams;
  } catch {
    return new URLSearchParams();
  }
}

/** URL-safe slug. */
export function slug(value) {
  return String(value == null ? "" : value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "item";
}

/** Escape text for HTML interpolation (used by the SSR pages). */
export function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** ISO timestamp helper. */
export function nowIso() {
  return new Date().toISOString();
}
