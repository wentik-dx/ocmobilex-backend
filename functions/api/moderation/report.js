/**
 * POST /api/moderation/report
 * Body: { targetUsername, reason, details, evidence, source: "ai"|"user" }
 *
 * A normal user must send a bearer token. Automated reports are accepted with
 * the service header `X-AI-Token: <AI_TOKEN>` (the owner token works too).
 */
import {
  json,
  route,
  readJson,
  requireUser,
  assertNotMuted,
  hasServiceToken,
  getUser,
  kvPut,
  putUser,
  randomId,
  requireString,
  optionalString,
  oneOf,
  nowIso,
  getIP,
  enforceRate,
  HttpError,
} from "../_lib.js";

export { onRequestOptions } from "../_lib.js";

export const onRequestPost = route(async ({ request, env }) => {
  const body = await readJson(request, 64 * 1024);

  const service = hasServiceToken(request, env);
  let account = null;

  if (!service) {
    account = await requireUser(request, env);
    assertNotMuted(account);
    await enforceRate(
      env,
      [`moderation:report:${account.usernameLower}`],
      60,
      "You are reporting too often. Wait a minute.",
      5,
    );
  }

  const source = oneOf(body.source, "source", ["ai", "user"], service ? "ai" : "user");

  const targetUsername = requireString(body.targetUsername, "targetUsername", 1, 24);
  const target = await getUser(env, targetUsername);
  if (!target) throw new HttpError(404, "No such user");

  const reason = requireString(body.reason, "reason", 3, 200);
  const details = optionalString(body.details, "details", 5000);
  const evidence = optionalString(body.evidence, "evidence", 5000);

  const createdAt = nowIso();
  const id = randomId(16);

  const report = {
    id,
    targetUsername: target.username,
    reporter: account ? account.username : source === "ai" ? "ai-service" : null,
    source,
    reason,
    details,
    evidence,
    status: "open",
    action: null,
    note: "",
    handledBy: null,
    ip: service ? null : getIP(request),
    createdAt,
    updatedAt: createdAt,
  };

  await kvPut(env, `moderation:${id}`, report);

  // bump the counter shown to staff on the profile
  target.reports = (Number(target.reports) || 0) + 1;
  await putUser(env, target);

  return json(201, { ok: true, id, createdAt, status: report.status });
});
