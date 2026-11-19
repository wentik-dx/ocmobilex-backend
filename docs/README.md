# OCMX backend — contributor guide

This is the developer-facing companion to the public docs:

- `/docs/` — product overview, accounts, the Three Pillars, quick start, deep links
- `/docs/api` — complete HTTP API reference
- `/docs/markdown` — the OpenCode Mobile markdown vocabulary

Live site: <https://ocmobilex.pages.dev> · source repo: `wentik-dx/ocmobilex-backend` on GitHub.

---

## 1. What this repository is

A **dependency-free JSON backend** for the OCMobileX Android client, deployed as **Cloudflare Pages Functions**.

- Plain ES modules in `functions/` — no `package.json`, no npm packages, no build step.
- One Cloudflare KV namespace bound as `OCMX` holds every record.
- Passwords: PBKDF2-SHA256 (WebCrypto, 100 000 iterations, 16-byte salt, 32-byte hash).
- Sessions: stateless HMAC-SHA256 tokens `base64url({u,exp}).base64url(sig)`, 30-day TTL.
- Every handler answers `OPTIONS`, and `route()` makes sure nothing throws out of a handler (errors become JSON).

Target host: `https://ocmobilex.pages.dev`. Static files live in `public/`; route handlers live in `functions/`. `wrangler.toml` declares `pages_build_output_dir = "./public"`.

---

## 2. File map

```
ocmobilex-backend/
├── README.md                     user-facing deploy/config reference
├── docs/
│   └── README.md                 this contributor guide
├── wrangler.toml                 project, compatibility date, KV binding, [vars]
├── functions/
│   ├── _middleware.js            global CORS, OPTIONS, JSON 404/405/500 for /api/*
│   ├── _applink.js               shared “open in app” banner + CSS for SSR pages
│   ├── p/[id].js                 /p/<id> raw published payload (CSP sandbox for HTML)
│   ├── v/[id].js                 /v/<id> publication wrapper + app link
│   ├── shared/chat/[code].js     /shared/chat/<code> transcript viewer
│   └── api/
│       ├── _lib.js               json/fail/route, parsing, crypto, KV, auth, rate limit, paginate
│       ├── _legal.js             ToS + Privacy markdown strings, LEGAL_UPDATED
│       ├── status.js             GET /api/status (health probe)
│       ├── seed.js               POST /api/seed (create owner)
│       ├── account/
│       │   ├── registernew.js    POST register
│       │   ├── login.js          POST login
│       │   ├── me.js             GET current account
│       │   ├── profile.js        PATCH bio / color / avatar / links
│       │   ├── delete.js         POST triple-confirm deletion
│       │   └── role.js           POST role / ban (owner only)
│       ├── users/[username].js   GET public profile
│       ├── bugreport/
│       │   ├── send.js           POST new report
│       │   ├── getallreports.js  GET filtered/paginated list (owner)
│       │   └── updatestatus.js   POST status change + history (owner)
│       ├── suggestidea/
│       │   ├── send.js           POST new idea
│       │   ├── getallideas.js    GET idea board
│       │   └── vote.js           POST toggle/switch vote
│       ├── share/chat.js         POST create a shared chat snapshot
│       ├── shared/chat/[code].js GET read / POST append a message
│       ├── moderation/
│       │   ├── report.js         POST user or AI report
│       │   └── reports.js        GET queue / POST decision (staff)
│       ├── publish.js            POST html / image / music
│       ├── published/
│       │   ├── index.js          GET gallery metadata
│       │   └── [id].js           GET single item incl. payload
│       └── legal/
│           ├── tos.js            GET Terms markdown
│           └── privacy.js        GET Privacy markdown
└── public/
    ├── index.html                landing page + health widget + app links
    ├── .well-known/assetlinks.json  Android App Link verification
    └── docs/
        ├── index.html            documentation landing page
        ├── api.html              endpoint reference
        └── markdown.html         markdown vocabulary
```

### Request lifecycle

1. `functions/_middleware.js` runs first: it answers `OPTIONS` with `204 + CORS`, calls `next()`, wraps every response in CORS, and converts `/api/*` 404/405/non-JSON errors into `{ok:false,error,…}`.
2. The matching handler exports `onRequestGet` / `onRequestPost` / `onRequestPatch`, each wrapped in `route()` from `_lib.js`.
3. `readJson()` parses and size-checks the body; validators (`requireString`, `optionalString`, `oneOf`, `stringArray`, `optionalBool`) normalise fields and throw `HttpError(status, message, code?)`.
4. Auth guards resolve the caller: `requireUser` (Bearer), `requireOwner` (owner secret **or** owner session), `requireOwnerToken` (strict `X-Owner-Token`), `requireStaff` (mod/admin/owner), `hasServiceToken` (`X-AI-Token` or owner token).
5. `json(status, body)` always adds `ok` (derived from status), `Content-Type: application/json; charset=utf-8`, `Cache-Control: no-store` and CORS headers.

---

## 3. KV key scheme

All keys are strings; all values are JSON. Access them through `kvGet` / `kvPut` / `kvDelete` / `kvCollection` in `_lib.js` — never call the raw KV API from a handler unless you need list cursors.

| Key pattern | Value | Written by |
| --- | --- | --- |
| `user:<username-lowercase>` | Account record with `salt` + `hash` (never returned by `publicUser`) | register, seed, profile, role, moderation |
| `bug:<id>` | Bug report with `status`, `note`, `history[]`, reporter, IP | bugreport send / updatestatus |
| `idea:<id>` | Idea with `votes`, `score`, `status`, author | suggestidea send / vote |
| `vote:<ideaId>:<usernameLower>` | One vote `{dir, at, user}` | suggestidea vote |
| `uvote:<usernameLower>` | Array of idea ids the account voted on (cleanup index) | suggestidea vote, account delete |
| `share:<code>` | Shared chat snapshot, permissions, message array, views counter | share/chat, shared/chat append, GET views |
| `moderation:<id>` | Report with `source`, `status`, `action`, `handledBy` | moderation report / reports |
| `publish:<id>` | Published item with `data`, `encoding`, `mime`, `size`, owner | publish |
| `rl:<bucket>` | Rate-limit window `{count, start}` with `expirationTtl` | `rateLimit()` |
| `sys:health` | `{stamp}` probe written and read by `/api/status` | status |

Notes:

- Keys are scanned by prefix via `kvListAll()` / `kvCollection()`, capped at **1000 keys per collection**. Fine at community scale; move to D1 if you outgrow it.
- Rate-limit windows have a **60-second minimum** because of KV's `expirationTtl` floor.
- List responses use opaque base64url cursors from `paginate()`; page size is clamped to 1–100 (default 20–25 depending on the route).
- Deleting the account record is the token revocation mechanism — tokens are stateless and re-checked against KV on every request.

---

## 4. How to add an endpoint

1. **Create the handler** under `functions/api/<group>/<name>.js` (dynamic segments use `[param].js`, e.g. `users/[username].js`).
2. **Re-export the preflight handler**: `export { onRequestOptions } from "../_lib.js";` (adjust relative depth).
3. **Wrap the method handler** in `route()`:

   ```js
   import { json, route, readJson, requireUser, requireString } from "../_lib.js";

   export { onRequestOptions } from "../_lib.js";

   export const onRequestPost = route(async ({ request, env, params, waitUntil }) => {
     const account = await requireUser(request, env);
     const body = await readJson(request, 64 * 1024);       // explicit size cap
     const value = requireString(body.value, "value", 1, 200);
     // ...kvGet / kvPut / enforceRate...
     return json(201, { ok: true, value });
   });
   ```

4. **Validate before side effects** (especially before consuming rate-limit slots), and use the right guard: `requireUser`, `requireStaff`, `requireOwner`, `requireOwnerToken`, or `hasServiceToken`.
5. **Add the route string** to the `endpoints[]` array in `functions/api/status.js`.
6. **Update the public docs**: endpoint table/example in `public/docs/api.html`, and — if relevant — `public/docs/index.html` or `public/docs/markdown.html`.
7. **Smoke-test locally** (below), then push. If the route needs a new secret or KV binding, configure it in Cloudflare **before** deploying.

Conventions to keep:

- Never return `salt`, `hash`, tokens of other users, or raw IPs in public responses.
- Use `publicUser(user, {self, staff})` for account projections.
- Use `escapeHtml()` for SSR pages; published HTML is served with a CSP `sandbox`.
- Use `waitUntil` for best-effort side effects (the shared-chat view counter does this).
- `json()` sets `ok` automatically, but success bodies in this codebase spell it out.

---

## 5. Configuration: env vars & secrets

| Name | Kind | Purpose |
| --- | --- | --- |
| `OCMX` | KV binding | All storage. Set the namespace id in `wrangler.toml` (or the Pages dashboard binding). |
| `OWNER_TOKEN` | secret | Authenticates `X-Owner-Token` on owner routes and `/api/seed`. |
| `OWNER_PASSWORD` | secret | Password used by `/api/seed` for the `MrWentik` owner account. |
| `SESSION_SECRET` | secret | HMAC key for session tokens — **minimum 16 characters**. |
| `AI_TOKEN` | secret (optional) | Authenticates `X-AI-Token` automated moderation reports. |
| `ENVIRONMENT` | var | Non-secret, currently `production` in `wrangler.toml`. |
| `preview_id` | optional KV | Separate namespace for `wrangler pages dev`; commented out in `wrangler.toml`. |

`OWNER_TOKEN` and `OWNER_PASSWORD` may hold the same value, but they are used differently: one authenticates requests, the other seeds an account.

Generate strong values with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

---

## 6. Deployment

### GitHub → Cloudflare Pages (primary path)

1. Push to `main` of `https://github.com/wentik-dx/ocmobilex-backend.git`.
2. In Cloudflare Dashboard → **Workers & Pages → ocmobilex → Settings → Builds & deployment**:
   - Build command: **none** (empty).
   - Build output directory: **`public`**.
   - Root directory: `/` (so `functions/` sits next to `public/` and is bundled automatically).
   - Compatibility date: `2026-01-01`.
3. **Settings → Functions → KV namespace bindings**: bind the `OCMX` namespace to the variable name `OCMX` (both Production and, optionally, Preview).
4. **Settings → Environment variables**: add `OWNER_TOKEN`, `OWNER_PASSWORD`, `SESSION_SECRET`, and optionally `AI_TOKEN` as *secrets*. `ENVIRONMENT=production` is a plain variable.
5. Trigger a deploy (push to `main` or “Retry deployment”). Every push creates a preview deployment; `main` deploys to `ocmobilex.pages.dev`.
6. First-time bootstrap: call `POST /api/seed` with `X-Owner-Token: <OWNER_TOKEN>`, then `GET /api/status`.

> Static docs are just files under `public/docs/`, so they ship with every deploy — no build step, no redirects needed. `/docs/` resolves to `public/docs/index.html`.

### Wrangler CLI (manual / emergency path)

```bash
npm i -g wrangler
wrangler login
wrangler pages deploy public --project-name ocmobilex
wrangler pages secret put OWNER_TOKEN     --project-name ocmobilex
wrangler pages secret put OWNER_PASSWORD  --project-name ocmobilex
wrangler pages secret put SESSION_SECRET  --project-name ocmobilex
wrangler pages secret put AI_TOKEN        --project-name ocmobilex   # optional
```

`wrangler pages deploy` uploads `public/` **and** bundles the adjacent `functions/` directory.

---

## 7. Local development

```bash
wrangler pages dev public --kv OCMX \
  --binding SESSION_SECRET=dev-secret-dev-secret \
  --binding OWNER_TOKEN=dev-owner-token \
  --binding OWNER_PASSWORD='<a-local-test-password>'
```

Then:

```bash
curl http://localhost:8788/api/status
curl -X POST http://localhost:8788/api/seed -H "X-Owner-Token: dev-owner-token"
```

Add `--binding AI_TOKEN=dev-ai-token` when testing service reports. Use a separate preview KV namespace (`preview_id`) so local tests never touch production data.

Syntax-check every handler before pushing:

```bash
find functions -name '*.js' -print0 | xargs -0 -n1 node --check
```

---

## 8. Testing

There is no test framework by design. Use a curl smoke suite against a dev deployment:

```bash
BASE=http://localhost:8788
OWNER=dev-owner-token

# 1. health + KV probe
curl -s $BASE/api/status | jq .

# 2. bootstrap + login
curl -s -X POST $BASE/api/seed -H "X-Owner-Token: $OWNER" | jq .
TOKEN=$(curl -s -X POST $BASE/api/account/login -H 'Content-Type: application/json' \
  -d '{"username":"MrWentik","password":"<OWNER_PASSWORD>"}' | jq -r .token)
AUTH="Authorization: Bearer $TOKEN"

# 3. account
curl -s $BASE/api/account/me -H "$AUTH" | jq .
curl -s -X PATCH $BASE/api/account/profile -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"bio":"smoke test","color":"#8b7bff"}' | jq .
curl -s $BASE/api/users/MrWentik | jq .

# 4. feedback
curl -s -X POST $BASE/api/bugreport/send -H 'Content-Type: application/json' \
  -d '{"title":"Smoke test report","severity":"low"}' | jq .
curl -s "$BASE/api/bugreport/getallreports?limit=5" -H "X-Owner-Token: $OWNER" | jq .
curl -s -X POST $BASE/api/suggestidea/send -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"title":"Smoke test idea","category":"feature"}' | jq .
curl -s $BASE/api/suggestidea/getallideas | jq .

# 5. sharing + publishing
curl -s -X POST $BASE/api/share/chat -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"title":"Smoke","messages":[{"role":"user","text":"hi"}],"permissions":{"write":true}}' | jq .
curl -s -X POST $BASE/api/publish -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"type":"html","title":"Smoke","data":"<h1>ok</h1>"}' | jq .
curl -s "$BASE/api/published?limit=5" | jq .

# 6. moderation + legal
curl -s $BASE/api/legal/tos | jq .document
curl -s $BASE/api/moderation/reports -H "$AUTH" | jq .
```

What to assert:

- Every response parses as JSON and contains a boolean `ok`.
- `OPTIONS /api/anything` → `204` with `Access-Control-Allow-Origin: *`.
- Unknown `/api/*` path → JSON `404` with `path` and `hint`, never HTML.
- Wrong/missing auth → `401`/`403` with a human-readable `error`.
- Oversized bodies → `413`; repeated submissions → `429` with a wait message.
- Public pages (`/shared/chat/<code>`, `/p/<id>`, `/v/<id>`) render HTML and carry CORS + `nosniff`.
- Docs pages (`/docs/`, `/docs/api`, `/docs/markdown`) load, have balanced tags, and stay under 200 KB each.

---

## 9. Notes & limits

- Sessions are stateless; account deletion invalidates all tokens because `requireUser` re-reads the account record on every request.
- KV is eventually consistent across colos, so rate limits are best-effort and scans can briefly miss recent writes.
- Lists scan at most 1000 keys per prefix collection. Paginate; do not assume completeness at large scale.
- Published HTML runs under `Content-Security-Policy: sandbox allow-scripts allow-forms allow-popups allow-modals allow-downloads allow-popups-to-escape-sandbox` at `/p/<id>`.
- `/.well-known/assetlinks.json` holds the signing fingerprint that verifies `https://ocmobilex.pages.dev` App Links for `com.opencode.mobile`. Update it when the signing key changes.
- Legal contact addresses and document text live in `functions/api/_legal.js`.
- Public content is governed by the ToS/Privacy policy: no illegal, hateful, harassing, infringing or explicit material, and never publish secrets.
