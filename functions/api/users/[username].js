/**
 * GET /api/users/[username]
 * Public profile. Staff additionally receive moderation flags.
 */
import {
  json,
  route,
  getUser,
  publicUser,
  bearerToken,
  verifySessionToken,
  isStaff,
  HttpError,
} from "../_lib.js";

export { onRequestOptions } from "../_lib.js";

/** Resolve the caller without failing the request when anonymous. */
async function optionalAccount(request, env) {
  const token = bearerToken(request);
  if (!token) return null;
  const payload = await verifySessionToken(env, token);
  if (!payload) return null;
  return getUser(env, payload.u);
}

export const onRequestGet = route(async ({ request, env, params }) => {
  const raw = params && params.username ? String(params.username) : "";
  let username = raw;
  try {
    username = decodeURIComponent(raw);
  } catch {
    username = raw;
  }
  username = username.replace(/^@/, "").trim();

  if (!username) throw new HttpError(400, "username is required");

  const user = await getUser(env, username);
  if (!user) throw new HttpError(404, "No such user");

  const viewer = await optionalAccount(request, env);
  const staff = isStaff(viewer);

  return json(200, {
    ok: true,
    user: publicUser(user, { staff }),
    staffView: staff,
  });
});
