/**
 * GET /api/account/me
 * Bearer token -> the current account (never includes hash or salt).
 */
import { json, route, requireUser, publicUser, isStaff } from "../_lib.js";

export { onRequestOptions } from "../_lib.js";

export const onRequestGet = route(async ({ request, env }) => {
  const account = await requireUser(request, env);
  return json(200, {
    ok: true,
    user: publicUser(account, { self: true, staff: isStaff(account) }),
  });
});
