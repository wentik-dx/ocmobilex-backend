/**
 * POST /api/account/role   (owner only)
 * Body: { username, role: "user"|"mod"|"admin"|"owner", banned?: boolean }
 *
 * Guards:
 *   - only an owner may call this endpoint;
 *   - an admin can never assign or touch the owner role;
 *   - the last remaining owner cannot be demoted or banned;
 *   - nobody can ban themselves.
 */
import {
  json,
  route,
  readJson,
  requireOwner,
  getUser,
  putUser,
  publicUser,
  oneOf,
  optionalBool,
  kvCollection,
  nowIso,
  HttpError,
} from "../_lib.js";

export { onRequestOptions } from "../_lib.js";

const ROLE_VALUES = ["user", "mod", "admin", "owner"];

async function ownerCount(env) {
  const users = await kvCollection(env, "user:", { max: 1000 });
  return users.filter((u) => u && u.role === "owner").length;
}

export const onRequestPost = route(async ({ request, env }) => {
  const { account: actor } = await requireOwner(request, env);

  const body = await readJson(request, 16 * 1024);
  const { username } = body;
  if (typeof username !== "string" || !username.trim()) {
    throw new HttpError(400, "username is required");
  }

  const target = await getUser(env, username.trim());
  if (!target) throw new HttpError(404, "No such user");

  const role = oneOf(body.role, "role", ROLE_VALUES);
  const banned =
    body.banned === undefined ? !!target.banned : optionalBool(body.banned, "banned", false);

  // An admin (or mod) must never be able to touch the owner role. The endpoint
  // is owner-only already; this keeps the rule explicit and future-proof.
  const actorRole = actor ? actor.role : "owner";
  if (actorRole !== "owner" && (target.role === "owner" || role === "owner")) {
    throw new HttpError(403, "Admins cannot assign or modify the owner role");
  }

  if (actor && actor.usernameLower === target.usernameLower) {
    if (banned) throw new HttpError(400, "You cannot ban your own account");
    if (role !== "owner" && (await ownerCount(env)) <= 1) {
      throw new HttpError(409, "You are the last owner; promote someone else first");
    }
  } else if ((target.role === "owner" && (role !== "owner" || banned))) {
    if ((await ownerCount(env)) <= 1) {
      throw new HttpError(409, "Cannot demote or ban the last owner");
    }
  }

  target.role = role;
  target.banned = banned;
  if (banned) target.bannedAt = nowIso();
  else delete target.bannedAt;
  target.updatedAt = nowIso();

  await putUser(env, target);

  return json(200, {
    ok: true,
    user: publicUser(target, { staff: true }),
  });
});
