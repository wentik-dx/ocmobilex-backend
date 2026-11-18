/**
 * GET /api/status
 * Lightweight health probe: confirms the function runtime and the KV binding.
 */
import { json, route, kvPut, kvGet, nowIso } from "./_lib.js";

export { onRequestOptions } from "./_lib.js";

const PROBE_KEY = "sys:health";

export const onRequestGet = route(async ({ env }) => {
  let kv = "unknown";
  let kvError = null;

  try {
    const stamp = nowIso();
    await kvPut(env, PROBE_KEY, { stamp });
    const readBack = await kvGet(env, PROBE_KEY);
    kv = readBack && readBack.stamp === stamp ? "ok" : "degraded";
  } catch (err) {
    kv = "error";
    kvError = err && err.message ? err.message : String(err);
  }

  return json(200, {
    ok: kv === "ok",
    service: "ocmobilex-api",
    version: "1.0.0",
    time: nowIso(),
    storage: { binding: "OCMX", status: kv, error: kvError },
    secrets: {
      OWNER_TOKEN: !!env.OWNER_TOKEN,
      OWNER_PASSWORD: !!env.OWNER_PASSWORD,
      SESSION_SECRET: !!env.SESSION_SECRET,
      AI_TOKEN: !!env.AI_TOKEN,
    },
    endpoints: [
      "POST /api/account/registernew",
      "POST /api/account/login",
      "GET  /api/account/me",
      "PATCH /api/account/profile",
      "POST /api/account/delete",
      "POST /api/account/role",
      "GET  /api/users/[username]",
      "POST /api/bugreport/send",
      "GET  /api/bugreport/getallreports",
      "POST /api/bugreport/updatestatus",
      "POST /api/suggestidea/send",
      "GET  /api/suggestidea/getallideas",
      "POST /api/suggestidea/vote",
      "POST /api/share/chat",
      "GET  /api/shared/chat/[code]",
      "POST /api/shared/chat/[code]",
      "POST /api/moderation/report",
      "GET  /api/moderation/reports",
      "POST /api/moderation/reports",
      "POST /api/publish",
      "GET  /api/published",
      "GET  /api/published/[id]",
      "GET  /api/legal/tos",
      "GET  /api/legal/privacy",
      "POST /api/seed",
    ],
  });
});
