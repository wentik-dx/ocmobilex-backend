/**
 * POST /api/suggestidea/vote
 * Bearer token. Body: { id, dir: 1 | -1 }
 *
 * One vote per account per idea. Sending the same direction again removes the
 * vote (toggle); sending the opposite direction switches it.
 */
import {
  json,
  route,
  readJson,
  requireUser,
  assertNotMuted,
  kvGet,
  kvPut,
  kvDelete,
  nowIso,
  HttpError,
} from "../_lib.js";

export { onRequestOptions } from "../_lib.js";

async function updateIndex(env, usernameLower, ideaId, add) {
  const key = `uvote:${usernameLower}`;
  const index = (await kvGet(env, key)) || [];
  const list = Array.isArray(index) ? index : [];
  const has = list.includes(ideaId);

  if (add && !has) list.push(ideaId);
  if (!add && has) {
    const at = list.indexOf(ideaId);
    list.splice(at, 1);
  }
  await kvPut(env, key, list);
}

export const onRequestPost = route(async ({ request, env }) => {
  const account = await requireUser(request, env);
  assertNotMuted(account);

  const body = await readJson(request, 8 * 1024);

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) throw new HttpError(400, "id is required");

  const dir = Number(body.dir);
  if (dir !== 1 && dir !== -1) throw new HttpError(400, "dir must be 1 or -1");

  const idea = await kvGet(env, `idea:${id}`);
  if (!idea) throw new HttpError(404, "No such idea");

  const voteKey = `vote:${id}:${account.usernameLower}`;
  const existing = await kvGet(env, voteKey);

  let votes = Number(idea.votes) || 0;
  let myVote = dir;

  if (existing && Number(existing.dir) === dir) {
    // toggle the vote off
    await kvDelete(env, voteKey);
    await updateIndex(env, account.usernameLower, id, false);
    votes -= dir;
    myVote = 0;
  } else if (existing) {
    // switch direction: remove the old contribution, add the new one
    votes += dir * 2;
    await kvPut(env, voteKey, { dir, at: nowIso(), user: account.username });
    await updateIndex(env, account.usernameLower, id, true);
    myVote = dir;
  } else {
    votes += dir;
    await kvPut(env, voteKey, { dir, at: nowIso(), user: account.username });
    await updateIndex(env, account.usernameLower, id, true);
    myVote = dir;
  }

  votes = Math.max(0, votes);
  idea.votes = votes;
  idea.score = votes;
  idea.updatedAt = nowIso();
  await kvPut(env, `idea:${id}`, idea);

  return json(200, { ok: true, id, votes, myVote });
});
