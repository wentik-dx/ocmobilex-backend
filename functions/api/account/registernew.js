/**
 * POST /api/account/registernew
 * Body: { username, password, confirmPassword }
 *
 * Creates an account with a PBKDF2-SHA256 password hash and returns a session
 * token. The very first account (and the reserved name "MrWentik") becomes the
 * owner so a fresh deployment is never locked out.
 */
import {
  json,
  route,
  readJson,
  validUsername,
  validPassword,
  getUser,
  putUser,
  countUsers,
  hashPassword,
  signSessionToken,
  publicUser,
  nowIso,
  enforceRate,
  getIP,
  HttpError,
} from "../_lib.js";

export { onRequestOptions } from "../_lib.js";

export const onRequestPost = route(async ({ request, env }) => {
  await enforceRate(
    env,
    [`register:ip:${getIP(request)}`],
    600,
    "Too many registrations from this address. Try again later.",
    5,
  );

  const body = await readJson(request);
  const { username, password, confirmPassword } = body;

  if (!validUsername(username)) {
    throw new HttpError(
      400,
      "username must be 3-24 characters and contain only A-Z, a-z, 0-9 or _",
    );
  }
  if (!validPassword(password)) {
    throw new HttpError(400, "password must be between 8 and 200 characters");
  }
  if (typeof confirmPassword !== "string" || confirmPassword !== password) {
    throw new HttpError(400, "password and confirmPassword do not match");
  }

  const existing = await getUser(env, username);
  if (existing) throw new HttpError(409, "That username is already taken");

  const isFirstAccount = (await countUsers(env)) === 0;
  const isSeedName = username.toLowerCase() === "mrwentik";
  const role = isFirstAccount || isSeedName ? "owner" : "user";

  const credentials = await hashPassword(password);
  const user = {
    username,
    usernameLower: username.toLowerCase(),
    role,
    bio: "",
    color: "",
    links: { github: "", site: "" },
    joinedAt: nowIso(),
    updatedAt: nowIso(),
    banned: false,
    mutedUntil: null,
    reports: 0,
    stats: { sharedChats: 0, published: 0, ideas: 0 },
    ...credentials,
  };

  await putUser(env, user);

  const token = await signSessionToken(env, user.username);

  return json(201, {
    ok: true,
    token,
    user: publicUser(user, { self: true }),
  });
});
