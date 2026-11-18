/**
 * POST /api/suggestidea/send
 * Body: { title (5..100), description, category: feature|design|performance|other,
 *         impact: low|normal|high }
 *
 * Anonymous submissions are allowed; when a bearer token is present the idea is
 * attributed to that account. Rate limit: 3 minutes per IP / per account.
 */
import {
  json,
  route,
  readJson,
  requireString,
  optionalString,
  oneOf,
  randomId,
  nowIso,
  getIP,
  rateLimit,
  requireUser,
  assertNotMuted,
  kvPut,
  bumpStat,
  HttpError,
} from "../_lib.js";

export { onRequestOptions } from "../_lib.js";

const CATEGORIES = ["feature", "design", "performance", "other"];
const IMPACTS = ["low", "normal", "high"];
const WINDOW_SECONDS = 180;

export const onRequestPost = route(async ({ request, env }) => {
  const body = await readJson(request, 64 * 1024);

  // Validate first so a typo does not burn the 3-minute window.
  const title = requireString(body.title, "title", 5, 100);
  const description = optionalString(body.description, "description", 5000);
  const category = oneOf(body.category, "category", CATEGORIES, "feature");
  const impact = oneOf(body.impact, "impact", IMPACTS, "normal");

  const ip = getIP(request);

  const ipLimit = await rateLimit(env, `idea:ip:${ip}`, WINDOW_SECONDS);
  if (!ipLimit.allowed) {
    throw new HttpError(
      429,
      `Only one idea every 3 minutes. Try again in ${ipLimit.retryAfter}s.`,
      "rate_limited",
    );
  }

  let account = null;
  try {
    account = await requireUser(request, env);
  } catch (err) {
    if (err instanceof HttpError && err.status >= 500) throw err;
    account = null;
  }

  if (account) {
    assertNotMuted(account);
    const userLimit = await rateLimit(env, `idea:user:${account.usernameLower}`, WINDOW_SECONDS);
    if (!userLimit.allowed) {
      throw new HttpError(
        429,
        `Only one idea every 3 minutes. Try again in ${userLimit.retryAfter}s.`,
        "rate_limited",
      );
    }
  }

  const createdAt = nowIso();
  const id = randomId(16);

  const idea = {
    id,
    title,
    description,
    category,
    impact,
    votes: 0,
    score: 0,
    status: "open",
    author: account ? account.username : null,
    createdAt,
    updatedAt: createdAt,
  };

  await kvPut(env, `idea:${id}`, idea);
  if (account) await bumpStat(env, account.username, "ideas", 1);

  return json(201, { ok: true, id, createdAt, idea });
});
