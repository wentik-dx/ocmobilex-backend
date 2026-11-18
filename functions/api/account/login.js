/**
 * POST /api/account/login
 * Body: { username, password }
 * Returns { ok, token, user }.
 *
 * Rate limited to 10 attempts per minute per IP (plus a per-username bucket so
 * a single IP cannot grind one account forever).
 */
import {
  json,
  route,
  readJson,
  getUser,
  verifyPassword,
  signSessionToken,
  publicUser,
  enforceRate,
  getIP,
  validUsername,
  HttpError,
} from "../_lib.js";

export { onRequestOptions } from "../_lib.js";

export const onRequestPost = route(async ({ request, env }) => {
  const body = await readJson(request);
  const { username, password } = body;

  if (typeof username !== "string" || typeof password !== "string") {
    throw new HttpError(400, "username and password must be strings");
  }
  if (!username.trim() || !password) {
    throw new HttpError(400, "username and password are required");
  }

  const ip = getIP(request);
  await enforceRate(
    env,
    [`login:ip:${ip}`],
    60,
    "Too many login attempts. Try again in a minute.",
    10,
  );
  await enforceRate(
    env,
    [`login:name:${username.trim().toLowerCase()}`],
    60,
    "Too many login attempts for this account. Try again in a minute.",
    10,
  );

  if (!validUsername(username.trim())) {
    throw new HttpError(401, "Invalid username or password");
  }

  const user = await getUser(env, username.trim());
  if (!user) throw new HttpError(401, "Invalid username or password");

  const valid = await verifyPassword(password, user);
  if (!valid) throw new HttpError(401, "Invalid username or password");

  if (user.banned) throw new HttpError(403, "This account has been banned");

  const token = await signSessionToken(env, user.username);
  return json(200, { ok: true, token, user: publicUser(user, { self: true }) });
});
