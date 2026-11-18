/**
 * POST /api/account/delete
 * Bearer token. Body: { password, confirmPassword, confirmText }
 *
 * Three confirmations are required: the current password must be correct,
 * confirmPassword must repeat it, and confirmText must be exactly "DELETE".
 *
 * Sessions are stateless HMAC tokens, so removing the account record is what
 * revokes every issued token for it (requireUser re-reads the account on each
 * request). The account's votes are cleaned up as well.
 */
import {
  json,
  route,
  readJson,
  requireUser,
  verifyPassword,
  getUser,
  kvDelete,
  kvGet,
  userKey,
  HttpError,
} from "../_lib.js";

export { onRequestOptions } from "../_lib.js";

export const onRequestPost = route(async ({ request, env }) => {
  const account = await requireUser(request, env);
  const body = await readJson(request);
  const { password, confirmPassword, confirmText } = body;

  if (typeof password !== "string" || password.length === 0) {
    throw new HttpError(400, "password is required");
  }
  if (confirmText !== "DELETE") {
    throw new HttpError(400, 'confirmText must be exactly "DELETE"');
  }
  if (typeof confirmPassword !== "string" || confirmPassword !== password) {
    throw new HttpError(400, "password and confirmPassword do not match");
  }

  const fresh = await getUser(env, account.username);
  if (!fresh) throw new HttpError(401, "Account no longer exists");

  const valid = await verifyPassword(password, fresh);
  if (!valid) throw new HttpError(403, "Incorrect password");

  // Best effort: drop this user's votes and the vote index.
  try {
    const indexKey = `uvote:${account.usernameLower}`;
    const voted = await kvGet(env, indexKey);
    if (Array.isArray(voted)) {
      for (const ideaId of voted) {
        await kvDelete(env, `vote:${ideaId}:${account.usernameLower}`);
      }
    }
    await kvDelete(env, indexKey);
  } catch (err) {
    console.error("[ocmx] vote cleanup failed:", err);
  }

  await kvDelete(env, userKey(account.username));

  return json(200, {
    ok: true,
    deleted: true,
    username: account.username,
    message: "Account deleted. All issued session tokens are now invalid.",
  });
});
