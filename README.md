# OCMobileX Backend

Dependency-free JSON backend for the OCMobileX Android client, deployed as
**Cloudflare Pages Functions**.

- Plain ES-module handlers — no `package.json`, no npm packages, no build step.
- Passwords: PBKDF2-SHA256 (WebCrypto, 100 000 iterations, 16-byte salt).
- Sessions: stateless HMAC-SHA256 tokens (`base64url(payload).base64url(sig)`).
- Storage: one KV namespace, binding **`OCMX`**.
- Every API response is JSON with a boolean `ok`. Every handler answers
  `OPTIONS`, and nothing throws out of a handler (errors become JSON 500s).

Target host: `https://ocmobilex.pages.dev`

---

## 1. Deploy

```bash
# 1. install the CLI (one time)
npm i -g wrangler

# 2. log in to Cloudflare
wrangler login

# 3. create the KV namespace — copy the id it prints
wrangler kv namespace create OCMX
#    →  id = "abcdef0123456789abcdef0123456789"

# 4. paste that id into wrangler.toml
#    [[kv_namespaces]]
#    binding = "OCMX"
#    id = "abcdef0123456789abcdef0123456789"
#    (preview_id is optional — create one with: wrangler kv namespace create OCMX --preview)

# 5. create the Pages project (first deploy also creates it)
wrangler pages project create ocmobilex

# 6. deploy the static output + functions
wrangler pages deploy public --project-name ocmobilex

# 7. set the secrets (paste the value when prompted)
wrangler pages secret put OWNER_TOKEN     --project-name ocmobilex
wrangler pages secret put OWNER_PASSWORD  --project-name ocmobilex   # default: NFytxrf8264!!??
wrangler pages secret put SESSION_SECRET  --project-name ocmobilex   # any long random string
wrangler pages secret put AI_TOKEN        --project-name ocmobilex   # optional, for AI reports

# 8. create the owner account
curl -X POST https://ocmobilex.pages.dev/api/seed \
  -H "X-Owner-Token: $OWNER_TOKEN"

# 9. verify
curl https://ocmobilex.pages.dev/api/status
```

Generate strong secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

> **Note on `pages deploy`:** `wrangler pages deploy public --project-name ocmobilex`
> uploads `public/` **and** bundles `functions/` automatically, because the
> functions directory sits next to the output directory.

### Local development

```bash
wrangler pages dev public --kv OCMX --binding SESSION_SECRET=dev-secret-dev-secret \
  --binding OWNER_TOKEN=dev-owner-token --binding OWNER_PASSWORD='NFytxrf8264!!??'
```

### Redeploy after changes

```bash
wrangler pages deploy public --project-name ocmobilex
```

---

## 2. Configuration

| Name | Kind | Purpose |
| --- | --- | --- |
| `OCMX` | KV binding | all storage |
| `OWNER_TOKEN` | secret | `X-Owner-Token` header for owner-only endpoints and `/api/seed` |
| `OWNER_PASSWORD` | secret | password for the seeded `MrWentik` owner (default `NFytxrf8264!!??`) |
| `SESSION_SECRET` | secret | HMAC key for session tokens (min 16 chars) |
| `AI_TOKEN` | secret (optional) | `X-AI-Token` header for automated moderation reports |

`OWNER_TOKEN` and `OWNER_PASSWORD` may be the same value; they are used
differently (`OWNER_TOKEN` authenticates requests, `OWNER_PASSWORD` seeds the
account).

---

## 3. Data model (KV keys)

| Key | Contents |
| --- | --- |
| `user:<username-lowercase>` | account record incl. `salt` + `hash` (never returned) |
| `bug:<id>` | bug report |
| `idea:<id>` | feature idea + vote counter |
| `vote:<ideaId>:<username>` | one vote per account |
| `uvote:<username>` | index of that account's votes (for cleanup) |
| `share:<code>` | shared chat snapshot |
| `moderation:<id>` | moderation report |
| `publish:<id>` | published HTML / image / audio |
| `rl:<bucket>` | rate-limit windows (auto-expiring) |
| `sys:health` | `/api/status` probe |

Roles: `user` → `mod` → `admin` → `owner`.

---

## 4. Endpoint reference + curl

Set these first:

```bash
BASE=https://ocmobilex.pages.dev
OWNER_TOKEN=your-owner-token
TOKEN=            # filled in after login
```

### Health

```bash
curl $BASE/api/status
```

### Seed the owner (X-Owner-Token only)

```bash
curl -X POST $BASE/api/seed -H "X-Owner-Token: $OWNER_TOKEN"
```

### Register

```bash
curl -X POST $BASE/api/account/registernew \
  -H 'Content-Type: application/json' \
  -d '{"username":"MrWentik","password":"NFytxrf8264!!??","confirmPassword":"NFytxrf8264!!??"}'
# → { "ok": true, "token": "...", "user": { ... } }
```

The first account ever created — and the reserved name `MrWentik` — becomes
`owner`.

### Login

```bash
TOKEN=$(curl -s -X POST $BASE/api/account/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"MrWentik","password":"NFytxrf8264!!??"}' \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).token))")

echo $TOKEN
```

### Me

```bash
curl $BASE/api/account/me -H "Authorization: Bearer $TOKEN"
```

### Profile

```bash
curl -X PATCH $BASE/api/account/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"bio":"Building OCMobileX.","color":"#7c3aed","links":{"github":"https://github.com/Wentik","site":"https://ocmobilex.pages.dev"}}'
```

### Delete account (three confirmations)

```bash
curl -X POST $BASE/api/account/delete \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"password":"NFytxrf8264!!??","confirmPassword":"NFytxrf8264!!??","confirmText":"DELETE"}'
```

### Role / ban (owner only)

```bash
curl -X POST $BASE/api/account/role \
  -H "X-Owner-Token: $OWNER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"username":"someuser","role":"mod"}'

curl -X POST $BASE/api/account/role \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"username":"someuser","role":"user","banned":true}'
```

### Public profile

```bash
curl $BASE/api/users/MrWentik
```

### Bug reports

```bash
curl -X POST $BASE/api/bugreport/send \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title":"Chat list flickers on scroll",
    "version":"2.8.0",
    "steps":"Open the drawer, scroll fast",
    "expected":"Smooth list",
    "actual":"Rows jump",
    "device":"Pixel 7 / Android 14",
    "severity":"normal",
    "contact":"@Wentik",
    "logs":"Uncaught TypeError at bundle.js:1"
  }'

curl "$BASE/api/bugreport/getallreports?status=open&limit=20" \
  -H "X-Owner-Token: $OWNER_TOKEN"

curl -X POST $BASE/api/bugreport/updatestatus \
  -H "X-Owner-Token: $OWNER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"id":"REPORT_ID","status":"resolved","note":"Fixed in 2.8.1"}'
```

Statuses: `open`, `triaged`, `in_progress`, `resolved`, `wontfix`, `duplicate`.
Rate limit: one report per 3 minutes per IP and per account.

### Ideas

```bash
curl -X POST $BASE/api/suggestidea/send \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Dark mode for the terminal view","description":"The terminal is bright at night.","category":"design","impact":"high"}'

curl "$BASE/api/suggestidea/getallideas?limit=20&sort=votes"

curl -X POST $BASE/api/suggestidea/vote \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"id":"IDEA_ID","dir":1}'
```

`dir: 1` upvotes, `dir: -1` downvotes; repeating the same direction removes the
vote, the opposite direction switches it.

### Share a chat

```bash
curl -X POST $BASE/api/share/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "title":"Why is my build failing?",
    "sessionId":"ses_abc123",
    "messages":[
      {"role":"user","text":"vite build fails","ts":1767200000000},
      {"role":"assistant","text":"Missing dependency: rollup.","ts":1767200005000}
    ],
    "permissions":{"write":true,"pin":false,"editSession":false,"deleteMessages":false,"invite":false}
  }'
# → { "ok": true, "code": "…32 chars…", "url": "https://ocmobilex.pages.dev/shared/chat/<code>" }
```

```bash
curl $BASE/api/shared/chat/CODE

curl -X POST $BASE/api/shared/chat/CODE \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"text":"Same issue here on 2.8.0"}'
```

The share URL also renders a server-side HTML viewer at
`https://ocmobilex.pages.dev/shared/chat/CODE`.

### Moderation

```bash
# user report
curl -X POST $BASE/api/moderation/report \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"targetUsername":"spammer","reason":"spam","details":"Posts ad links in every share","source":"user"}'

# automated (AI) report — no account needed
curl -X POST $BASE/api/moderation/report \
  -H "X-AI-Token: $AI_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"targetUsername":"spammer","reason":"harassment","details":"Model flagged 4 messages","source":"ai"}'

# queue
curl "$BASE/api/moderation/reports?status=open" -H "Authorization: Bearer $TOKEN"

# decide
curl -X POST $BASE/api/moderation/reports \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"id":"REPORT_ID","action":"mute","note":"24h cool-off","durationHours":24}'
```

Actions: `dismiss`, `warn`, `mute`, `ban`, `delete`.
`delete` accepts optional `contentId` + `contentType` (`share` / `publish` /
`idea`) to remove the offending item.

### Publish

```bash
# HTML (text, 512 KB limit)
curl -X POST $BASE/api/publish \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"type":"html","title":"Demo","description":"A tiny page","tags":["demo"],"data":"<!doctype html><h1>Hi</h1>"}'

# image (base64, 5 MB limit)
curl -X POST $BASE/api/publish \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"type\":\"image\",\"title\":\"Screenshot\",\"mime\":\"image/png\",\"data\":\"$(base64 -w0 shot.png)\"}"

# music (base64, 5 MB limit)
curl -X POST $BASE/api/publish \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"type\":\"music\",\"title\":\"Loop\",\"mime\":\"audio/mpeg\",\"data\":\"$(base64 -w0 loop.mp3)\"}"
```

```bash
curl "$BASE/api/published?type=html&limit=10"
curl $BASE/api/published/ITEM_ID
curl -I $BASE/p/ITEM_ID
```

### Legal

```bash
curl $BASE/api/legal/tos
curl $BASE/api/legal/privacy
```

---

## 5. Error format

```json
{ "ok": false, "error": "title must be at least 5 characters" }
```

| Status | Meaning |
| --- | --- |
| 400 | validation failed |
| 401 | missing / invalid / expired token |
| 403 | wrong role, banned, muted, wrong password |
| 404 | unknown id, code, user or route |
| 409 | conflict (username taken, last owner, message limit) |
| 413 | payload over the size limit |
| 429 | rate limited (`error` says how long to wait) |
| 500 | unexpected server error |

---

## 6. Layout

```
functions/
  _middleware.js                 CORS, OPTIONS, JSON 404/405/500 for /api/*
  p/[id].js                      public renderer for published items
  shared/chat/[code].js          public HTML viewer for shared chats
  api/
    _lib.js                      helpers (json, auth, PBKDF2, HMAC, rate limit)
    _legal.js                    ToS + Privacy markdown
    status.js                    health probe
    seed.js                      create the owner account
    account/                     registernew, login, me, profile, delete, role
    users/[username].js          public profile
    bugreport/                   send, getallreports, updatestatus
    suggestidea/                 send, getallideas, vote
    share/chat.js                create a share
    shared/chat/[code].js        read / append
    moderation/                  report, reports
    publish.js                   create a publication
    published/                   index, [id]
    legal/                       tos, privacy
public/index.html                landing page
wrangler.toml
```

---

## 7. Notes & limits

- Sessions are stateless: deleting the account is what revokes tokens, because
  `requireUser` re-reads the account record on every request.
- Rate limiting is a KV fixed window (minimum window 60 s, KV's `expirationTtl`
  floor). KV is eventually consistent across colos, so limits are best-effort —
  they stop casual abuse, not a distributed attacker.
- Lists are built by scanning KV prefixes (capped at 1000 keys per collection).
  That is fine for community scale; move to D1 if you outgrow it.
- Published HTML is served inside a CSP `sandbox` so it cannot read the app's
  origin storage.
- Update the contact addresses in `functions/api/_legal.js`
  (`legal@` / `abuse@`) if you want different mailboxes.
