/**
 * POST /api/seed   (X-Owner-Token only)
 *
 * Creates the "MrWentik" owner account with OWNER_PASSWORD if it does not
 * already exist. Idempotent: safe to call repeatedly, never resets an existing
 * password.
 */
import {
  json,
  route,
  requireOwnerToken,
  getUser,
  putUser,
  hashPassword,
  publicUser,
  nowIso,
  countUsers,
  HttpError,
} from "./_lib.js";

export { onRequestOptions } from "./_lib.js";

export const SEED_USERNAME = "MrWentik";

export const onRequestPost = route(async ({ request, env }) => {
  requireOwnerToken(request, env);

  const password = env.OWNER_PASSWORD || "NFytxrf8264!!??";
  if (typeof password !== "string" || password.length < 8) {
    throw new HttpError(500, "OWNER_PASSWORD is missing or too short");
  }

  const existing = await getUser(env, SEED_USERNAME);
  if (existing) {
    if (existing.role !== "owner") {
      existing.role = "owner";
      existing.updatedAt = nowIso();
      await putUser(env, existing);
    }
    return json(200, {
      ok: true,
      created: false,
      message: "Owner account already exists",
      user: publicUser(existing, { self: true, staff: true }),
    });
  }

  const usersBefore = await countUsers(env);
  const credentials = await hashPassword(password);
  const user = {
    username: SEED_USERNAME,
    usernameLower: SEED_USERNAME.toLowerCase(),
    role: "owner",
    bio: "Owner of OCMobileX.",
    color: "#7c3aed",
    links: { github: "", site: "" },
    joinedAt: nowIso(),
    updatedAt: nowIso(),
    banned: false,
    mutedUntil: null,
    reports: 0,
    warnings: 0,
    seeded: true,
    stats: { sharedChats: 0, published: 0, ideas: 0 },
    ...credentials,
  };

  await putUser(env, user);

  return json(201, {
    ok: true,
    created: true,
    usersBefore,
    user: publicUser(user, { self: true, staff: true }),
    message: "Owner account created. Log in with OWNER_PASSWORD.",
  });
});
