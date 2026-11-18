/**
 * GET  /api/shared/chat/[code]   public read of a shared chat snapshot
 * POST /api/shared/chat/[code]   append a message (needs permissions.write)
 *      Body: { text }
 */
import {
  json,
  route,
  readJson,
  requireUser,
  assertNotMuted,
  kvGet,
  kvPut,
  nowIso,
  enforceRate,
  HttpError,
} from "../../_lib.js";

export { onRequestOptions } from "../../_lib.js";

const CODE_RE = /^[A-Za-z0-9]{8,64}$/;
const MAX_TEXT = 20000;
const MAX_MESSAGES = 2000;

function codeFrom(params) {
  const raw = params && params.code ? String(params.code) : "";
  if (!CODE_RE.test(raw)) throw new HttpError(400, "Invalid share code");
  return raw;
}

function present(share) {
  return {
    code: share.code,
    title: share.title,
    sessionId: share.sessionId || "",
    messages: Array.isArray(share.messages) ? share.messages : [],
    permissions: share.permissions || {},
    owner: share.owner,
    createdAt: share.createdAt,
    updatedAt: share.updatedAt,
    messageCount: Array.isArray(share.messages) ? share.messages.length : 0,
  };
}

export const onRequestGet = route(async ({ env, params, waitUntil }) => {
  const code = codeFrom(params);
  const share = await kvGet(env, `share:${code}`);
  if (!share) throw new HttpError(404, "Shared chat not found");

  // Views counter is best-effort and never blocks the response.
  try {
    const bumped = { ...share, views: (Number(share.views) || 0) + 1 };
    const task = kvPut(env, `share:${code}`, bumped);
    if (typeof waitUntil === "function") waitUntil(task);
    else await task;
  } catch (err) {
    console.error("[ocmx] view counter failed:", err);
  }

  return json(200, {
    ok: true,
    chat: present(share),
    canWrite: !!share.permissions?.write,
  });
});

export const onRequestPost = route(async ({ request, env, params }) => {
  const code = codeFrom(params);
  const account = await requireUser(request, env);
  assertNotMuted(account);

  const share = await kvGet(env, `share:${code}`);
  if (!share) throw new HttpError(404, "Shared chat not found");
  if (!share.permissions || !share.permissions.write) {
    throw new HttpError(403, "This shared chat is read-only");
  }

  await enforceRate(
    env,
    [`sharedchat:post:${account.usernameLower}`],
    60,
    "You are posting too fast. Wait a moment.",
    20,
  );

  const body = await readJson(request, 64 * 1024);
  if (typeof body.text !== "string") throw new HttpError(400, "text must be a string");

  const text = body.text.trim();
  if (!text) throw new HttpError(400, "text must not be empty");
  if (text.length > MAX_TEXT) {
    throw new HttpError(400, `text must be at most ${MAX_TEXT} characters`);
  }

  const messages = Array.isArray(share.messages) ? share.messages : [];
  if (messages.length >= MAX_MESSAGES) {
    throw new HttpError(409, "This shared chat has reached its message limit");
  }

  const message = {
    role: "user",
    text,
    ts: Date.now(),
    author: account.username,
  };

  messages.push(message);
  share.messages = messages;
  share.updatedAt = nowIso();
  share.messageCount = messages.length;

  await kvPut(env, `share:${code}`, share);

  return json(201, { ok: true, message, messageCount: messages.length });
});
