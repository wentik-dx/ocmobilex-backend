/**
 * Legal documents shared by /api/legal/tos and /api/legal/privacy.
 * Plain markdown, returned verbatim inside { ok: true, markdown }.
 *
 * Update LEGAL_UPDATED whenever the text changes — clients cache on it.
 */

export const LEGAL_UPDATED = "2026-01-01";
export const LEGAL_CONTACT = "legal@ocmobilex.pages.dev";
export const LEGAL_ABUSE = "abuse@ocmobilex.pages.dev";
export const SERVICE_NAME = "OCMobileX";
export const SERVICE_URL = "https://ocmobilex.pages.dev";

export const TERMS_OF_SERVICE = `# ${SERVICE_NAME} — Terms of Service

**Effective date:** ${LEGAL_UPDATED}
**Service:** ${SERVICE_URL}

These Terms of Service ("Terms") are a binding agreement between you ("you",
"your") and the ${SERVICE_NAME} project ("we", "us", "our") covering your use of
the ${SERVICE_NAME} API, the shared-chat viewer, the publishing endpoints, the
bug tracker and the idea board (together, the "Service").

By creating an account, calling an endpoint, publishing content or otherwise
using the Service you confirm that you have read, understood and accepted these
Terms. If you do not accept them, do not use the Service.

## 1. Eligibility

1.1. You must be at least 13 years old to create an account. If the digital
consent age in your country is higher, you must meet that age instead.

1.2. If you are under the age of majority where you live, you may only use the
Service with the involvement of a parent or legal guardian who agrees to these
Terms on your behalf.

1.3. You must not use the Service if you have previously been removed for a
violation of these Terms, unless we have given you written permission to return.

## 2. Your account

2.1. You are responsible for the accuracy of the information you provide and for
keeping your password confidential. You are responsible for all activity that
happens under your session token.

2.2. One person, one account. Do not create accounts to evade a ban, a mute, a
rate limit or a moderation decision, and do not share, sell or transfer accounts.

2.3. Usernames are allocated on a first-come basis. We may reclaim a username
that impersonates another person, a brand, or staff, or that is otherwise
deceptive.

2.4. Notify us immediately at ${LEGAL_ABUSE} if you believe your account has been
compromised.

## 3. Acceptable use

You agree **not** to use the Service to create, upload, publish, share or
distribute content that:

- is illegal, or that promotes or facilitates illegal activity, including
  malware, phishing, fraud, credential theft, or the evasion of technical
  protection measures;
- harasses, bullies, threatens, defames, doxxes or incites violence against any
  person or group, or targets someone for abuse;
- is sexual content involving minors, or that sexualises minors in any way.
  This is a hard limit: such content is removed immediately, the account is
  terminated permanently, and where required we report it to the competent
  authorities;
- is non-consensual intimate imagery, or intimate imagery of a person who has not
  consented to its publication;
- promotes hate or discrimination based on race, ethnicity, nationality,
  religion, disability, sex, gender identity or sexual orientation;
- infringes copyright, trademark, database or other intellectual property
  rights, or reveals trade secrets you have no right to disclose;
- contains another person's private data (addresses, phone numbers, identity
  documents, financial data, health data) without their permission;
- is deliberately deceptive: impersonation, fabricated endorsements, "deepfake"
  media presented as authentic, or content designed to manipulate a person into
  a harmful decision;
- is spam, mass-produced low-quality output, SEO bait, or an attempt to overload,
  probe or reverse-engineer the Service;
- attempts to break authentication, escalate privileges, access another user's
  data, or interfere with rate limits, quotas or metering.

Additional technical rules:

- Do not exceed published rate limits or use multiple accounts, proxies or
  automated retries to work around them.
- Do not use the Service as a general-purpose file host, a CDN, a backup target
  or a proxy for other traffic.
- Do not publish content whose primary purpose is to attack or defraud the
  Service or its users.

## 4. Your content and AI-generated content

4.1. **You keep ownership of what you submit.** You retain all rights you hold in
  the titles, descriptions, messages, ideas, bug reports, images, audio and HTML
  you upload ("Your Content"). We do not claim ownership of Your Content.

4.2. **Licence to operate the Service.** To store, render, transmit and display
  Your Content you grant us a worldwide, non-exclusive, royalty-free licence to
  host, reproduce, cache and publicly display Your Content strictly as needed to
  operate the Service — for example rendering a shared chat at its public URL.
  This licence ends when the content is deleted, except for copies kept in
  backups for a short period or where retention is legally required.

4.3. **AI-generated content.** Output produced by an AI model and submitted to
  the Service is treated as Your Content. You are responsible for it exactly as
  if you had written it yourself. Ownership of AI output is determined by the
  terms of the model provider you used and by applicable law; we make no claim
  to it and give no warranty that AI output is copyrightable, accurate or
  non-infringing.

4.4. **No confidentiality.** Shared chats, published items, ideas and public
  profiles are public by design. Do not submit secrets, API keys, passwords,
  private conversations or personal data of third parties.

4.5. **Removal.** We may remove or restrict access to any content that violates
  these Terms, that we are legally required to remove, or that creates risk for
  the Service or for other people. Where practical we will tell you why.

## 5. Sharing and visibility

5.1. A chat becomes public only when you explicitly create a share link. Anyone
  with the link can read it; share links are unlisted but not secret.

5.2. The owner of a shared chat chooses whether other people may write to it,
  pin messages, edit the session, delete messages or invite others. Enabling
  writing means visitors can append messages under their own username.

5.3. Published items (HTML, images, audio) are public and indexed by id. Do not
  publish anything you would not want a stranger to open.

5.4. You can stop sharing at any time by deleting the content. Caches and
  third-party copies may persist briefly.

## 6. Moderation and enforcement

6.1. Reports can be filed by users and by automated safety tooling. Reports are
  reviewed by the owner and moderators; review is not instantaneous and is not
  guaranteed for every report.

6.2. Depending on severity we may: take no action, issue a warning, mute an
  account temporarily, remove content, suspend or permanently ban an account, or
  restrict access by IP or token.

6.3. Severe violations — especially sexual content involving minors, credible
  threats of violence, or coordinated abuse — result in immediate permanent
  termination without prior warning.

6.4. If you believe a moderation decision was wrong, reply to the notification
  or write to ${LEGAL_ABUSE} within 30 days. We will look at it once; the decision
  after review is final.

## 7. Termination

7.1. You may delete your account at any time from the account settings. Deletion
  requires your password and an explicit confirmation; once completed, the
  account record and all issued session tokens are invalidated.

7.2. We may suspend or terminate your access, with or without notice, if you
  breach these Terms, if we are required to by law, or if your use creates a
  security or legal risk.

7.3. On termination we may keep the minimum records needed for legal compliance,
  fraud prevention and dispute resolution (see the Privacy Policy).

7.4. Content you published may remain visible after account deletion if it was
  published under a share link, unless you delete it first or ask us to remove it.

## 8. Availability, changes and warranty

8.1. The Service is provided **"as is" and "as available"**, without warranties of
  any kind, express or implied, including merchantability, fitness for a
  particular purpose, non-infringement, accuracy and uninterrupted availability.

8.2. This is a free community project. We may change, limit or discontinue any
  part of it at any time, including endpoints, quotas and storage limits.

8.3. We do not guarantee that data will be preserved. Keep your own copy of
  anything you cannot afford to lose.

## 9. Limitation of liability

To the maximum extent permitted by law, we are not liable for indirect,
incidental, special, consequential or punitive damages, nor for lost data, lost
profits, loss of goodwill, or damages arising from content posted by other
users. Where liability cannot be excluded, our total liability is limited to the
amount you paid us in the twelve months before the claim — which, for a free
Service, is zero.

## 10. Indemnity

You agree to indemnify and hold harmless the ${SERVICE_NAME} project, its owner
and moderators from any claim, demand, loss or expense (including reasonable
legal fees) arising from Your Content or from your breach of these Terms.

## 11. Reporting abuse and copyright

- Abuse, harassment or illegal content: **${LEGAL_ABUSE}**
- Copyright or trademark complaints: **${LEGAL_CONTACT}** — include the URL, a
  description of the work, proof of your rights and a statement that the use is
  unauthorised.

We aim to answer reports within 7 days.

## 12. Changes to these Terms

We may update these Terms. Material changes will be announced in the Service and
the effective date above will change. Continuing to use the Service after an
update means you accept the new Terms.

## 13. Governing law and contact

These Terms are governed by the laws applicable at the operator's place of
residence, without regard to conflict-of-law rules, and without limiting any
mandatory consumer protection you enjoy where you live.

Questions about these Terms: **${LEGAL_CONTACT}**
`;

export const PRIVACY_POLICY = `# ${SERVICE_NAME} — Privacy Policy

**Effective date:** ${LEGAL_UPDATED}
**Service:** ${SERVICE_URL}

This policy explains what the ${SERVICE_NAME} backend stores, why, for how long,
and what control you have over it. It describes the API at ${SERVICE_URL} only.

## 1. Short version

- We store the minimum needed to run accounts, shares, publications and
  moderation.
- We do **not** run advertising, analytics or cross-site tracking.
- We do not sell or rent personal data. Ever.
- Passwords are stored as PBKDF2-SHA256 hashes, never in plain text.
- Content you publish is public. Assume anything you publish can be read,
  copied and archived by anyone.

## 2. What we store

### 2.1 Account data

| Field | Purpose | Notes |
| --- | --- | --- |
| username | identity, login, attribution | public |
| password hash + salt (PBKDF2-SHA256, 100 000 iterations) | authentication | never returned by the API |
| role (user / mod / admin / owner) | permissions | public |
| bio, accent colour, links | profile page | public |
| joined date | account age | public |
| counters (shared chats, published items, ideas) | profile statistics | public |
| muted-until / banned flags | moderation | visible to staff |
| warning and report counters | moderation | staff only |

### 2.2 Content data

- **Shared chats** — the title, the message snapshot you send, the permission
  flags, your username as owner and the creation time. Public at
  \`/shared/chat/<code>\` for anyone holding the code.
- **Published items** — the payload (HTML text, base64 image or audio), title,
  description, tags, size, MIME type and your username. Public at \`/p/<id>\`.
- **Ideas** — title, description, category, impact, vote count and your username
  if you were signed in. Public.
- **Bug reports** — the report fields you fill in, an optional contact, optional
  logs, your username if signed in, and the IP address the report came from
  (staff only, used to detect spam).
- **Moderation reports** — target username, reason, details, evidence, source
  (user or automated), and the IP address for user-submitted reports.

### 2.3 Technical data

- **IP address** — read from the \`CF-Connecting-IP\` header for rate limiting and
  abuse handling. IP addresses are kept in a rate-limit key that expires
  automatically (60 s – 10 min) and, for bug and moderation reports, alongside
  the report so staff can spot coordinated spam.
- **Session tokens** — signed with HMAC-SHA256 and held by your client. They are
  not stored in a database; the API validates the signature and re-reads your
  account record on each request. A token is valid for 30 days or until the
  account is deleted.
- **Cloudflare logs** — Cloudflare, our hosting and CDN provider, processes
  requests and may keep short-lived operational logs (IP, user agent, path,
  status) for security and reliability. See Cloudflare's own privacy policy.

We do **not** collect: email addresses, phone numbers, precise location,
contacts, advertising identifiers, or behavioural analytics.

## 3. Why we process it (legal bases)

- **Contract** — creating your account, authenticating you, storing and serving
  the content you ask us to store and serve.
- **Legitimate interests** — keeping the Service online and abuse-free: rate
  limiting, spam detection, moderation, debugging and security.
- **Legal obligation** — retaining records needed to answer lawful requests, or
  to report content that is illegal in the jurisdiction where we operate.
- **Consent** — where we ever ask for something optional, we ask first and you
  can withdraw at any time.

## 4. What is public

Public by design: your username, role, bio, colour, links, join date, counters,
ideas you posted while signed in, published items, and shared chats for anyone
with the link.

Not public: your password hash, salt, muted/banned state (staff only), warning
and report counters (staff only), IP addresses (staff only), bug report contents
(staff only), moderation report contents (staff only).

## 5. Sharing

We do not sell personal data. We share it only with:

1. **Cloudflare** — hosting, CDN, Workers KV storage and DDoS protection. Data is
   processed in Cloudflare's global network.
2. **The people you share with** — when you create a share link or publish an
   item, you are publishing it. That is your decision and your responsibility.
3. **Authorities** — when we receive a valid legal request, or when disclosure is
   necessary to prevent serious harm, especially harm to a child.

We do not use third-party advertising or analytics SDKs.

## 6. Retention

- Rate-limit keys: 60 seconds to 10 minutes, then deleted automatically.
- Session tokens: expire after 30 days; deleting your account invalidates every
  token immediately.
- Account record: kept until you delete it.
- Shared chats and published items: kept until the owner deletes them or
  moderation removes them.
- Bug reports and moderation reports: kept up to 24 months so repeat abuse can be
  recognised, then deleted.
- Backups: short-lived, overwritten on a rolling basis.

## 7. Your rights

Depending on where you live (for example under the GDPR or CCPA) you may have the
right to access, correct, export, delete or restrict processing of your personal
data, to object to processing based on legitimate interests, and to lodge a
complaint with your local data-protection authority.

In practice:

- **Access / export** — \`GET /api/account/me\` returns your profile; your public
  content is readable through its public URLs.
- **Correct** — \`PATCH /api/account/profile\` for bio, colour and links.
- **Delete** — \`POST /api/account/delete\` with your password and the
  confirmation string \`DELETE\`.
- **Anything else** — write to ${LEGAL_CONTACT} and we will respond within 30 days.

We do not discriminate against you for exercising these rights.

## 8. Security

- Passwords: PBKDF2-SHA256 with a random 16-byte salt and 100 000 iterations.
- Sessions: HMAC-SHA256 signed tokens with an expiry; the signing secret is a
  server-side secret and never leaves the backend.
- Transport: HTTPS only (Cloudflare edge, TLS 1.2+).
- Access: owner-only endpoints require a separate owner token or the owner role;
  moderation endpoints require staff roles.
- No system is perfectly secure. If you discover a vulnerability, report it
  privately to ${LEGAL_ABUSE} instead of publishing it.

## 9. Children

The Service is not directed at children under 13, and we do not knowingly collect
personal data from them. If you believe a child under 13 has created an account,
contact ${LEGAL_ABUSE} and we will remove it. Content that sexualises minors is
removed immediately and reported where the law requires it.

## 10. International transfers

The Service runs on Cloudflare's global network, so your data may be processed in
a country other than your own. Where required, transfers rely on the European
Commission's Standard Contractual Clauses or an equivalent safeguard offered by
our provider.

## 11. Cookies and local storage

The API itself sets no cookies. The web client may store your session token and
your UI preferences in browser local storage; that data stays on your device and
is removed when you clear site data. No tracking cookies are used.

## 12. Changes

We will update this policy when our practices change and will change the
effective date above. Significant changes will be announced in the Service.

## 13. Contact

Privacy questions, data requests, abuse reports: **${LEGAL_CONTACT}**
Abuse and illegal content: **${LEGAL_ABUSE}**
`;
