/**
 * POST /api/bugreport/send
 * Body: {
 *   title (5..100, required), version, steps, expected, actual, device,
 *   severity ("low"|"normal"|"high"|"critical"), contact, logs (max 20000)
 * }
 *
 * Rate limit: one report per 3 minutes per IP, and per account when the caller
 * is authenticated.
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
  HttpError,
} from "../_lib.js";

export { onRequestOptions } from "../_lib.js";

const SEVERITIES = ["low", "normal", "high", "critical"];
const WINDOW_SECONDS = 180; // 3 minutes

export const onRequestPost = route(async ({ request, env }) => {
  const body = await readJson(request, 256 * 1024);

  // Validate first so a typo does not burn the 3-minute window.
  const title = requireString(body.title, "title", 5, 100);
  const version = optionalString(body.version, "version", 40);
  const steps = optionalString(body.steps, "steps", 5000);
  const expected = optionalString(body.expected, "expected", 2000);
  const actual = optionalString(body.actual, "actual", 2000);
  const device = optionalString(body.device, "device", 200);
  const contact = optionalString(body.contact, "contact", 200);
  const logs = optionalString(body.logs, "logs", 20000);
  const severity = oneOf(body.severity, "severity", SEVERITIES, "normal");

  const ip = getIP(request);

  const ipLimit = await rateLimit(env, `bugreport:ip:${ip}`, WINDOW_SECONDS);
  if (!ipLimit.allowed) {
    throw new HttpError(
      429,
      `Only one bug report every 3 minutes. Try again in ${ipLimit.retryAfter}s.`,
      "rate_limited",
    );
  }

  let account = null;
  try {
    account = await requireUser(request, env);
  } catch (err) {
    if (err instanceof HttpError && err.status >= 500) throw err;
    account = null; // anonymous reports are allowed
  }

  if (account) {
    assertNotMuted(account);
    const userLimit = await rateLimit(
      env,
      `bugreport:user:${account.usernameLower}`,
      WINDOW_SECONDS,
    );
    if (!userLimit.allowed) {
      throw new HttpError(
        429,
        `Only one bug report every 3 minutes. Try again in ${userLimit.retryAfter}s.`,
        "rate_limited",
      );
    }
  }

  const createdAt = nowIso();
  const id = randomId(16);

  const report = {
    id,
    title,
    version,
    steps,
    expected,
    actual,
    device,
    severity,
    contact,
    logs,
    status: "open",
    note: "",
    reporter: account ? account.username : null,
    ip,
    createdAt,
    updatedAt: createdAt,
  };

  await kvPut(env, `bug:${id}`, report);

  return json(201, { ok: true, id, createdAt, status: report.status });
});
