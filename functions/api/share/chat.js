/**
 * POST /api/share/chat
 * Bearer token. Body:
 * {
 *   title,
 *   sessionId,
 *   messages: [{ role, text, ts }],
 *   permissions: { write, pin, editSession, deleteMessages, invite }
 * }
 *
 * Stores the snapshot under share:<code> and returns the public URL.
 * Codes are 32 alphanumeric characters.
 */
import {
  json,
  route,
  readJson,
  requireUser,
  assertNotMuted,
  requireString,
  optionalString,
  optionalBool,
  randomId,
  nowIso,
  kvPut,
  bumpStat,
  HttpError,
} from "../_lib.js";

export { onRequestOptions } from "../_lib.js";

export const BASE_URL = "https://ocmobilex.pages.dev";

const MESSAGE_ROLES = ["user", "assistant", "system", "tool"];
const MAX_MESSAGES = 2000;
const MAX_TEXT = 20000;

function cleanMessages(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new HttpError(400, "messages must be an array");
  if (value.length > MAX_MESSAGES) {
    throw new HttpError(400, `messages must contain at most ${MAX_MESSAGES} items`);
  }

  return value.map((message, index) => {
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      throw new HttpError(400, `messages[${index}] must be an object`);
    }
    const role = typeof message.role === "string" ? message.role.trim().toLowerCase() : "user";
    if (!MESSAGE_ROLES.includes(role)) {
      throw new HttpError(
        400,
        `messages[${index}].role must be one of: ${MESSAGE_ROLES.join(", ")}`,
      );
    }
    if (typeof message.text !== "string") {
      throw new HttpError(400, `messages[${index}].text must be a string`);
    }
    if (message.text.length > MAX_TEXT) {
      throw new HttpError(400, `messages[${index}].text must be at most ${MAX_TEXT} characters`);
    }
    const ts = Number(message.ts);
    return {
      role,
      text: message.text,
      ts: Number.isFinite(ts) ? ts : Date.now(),
    };
  });
}

function cleanPermissions(value) {
  const defaults = {
    write: false,
    pin: false,
    editSession: false,
    deleteMessages: false,
    invite: false,
  };
  if (value === undefined || value === null) return defaults;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "permissions must be an object");
  }
  const out = { ...defaults };
  for (const key of Object.keys(defaults)) {
    if (value[key] !== undefined) out[key] = optionalBool(value[key], `permissions.${key}`, false);
  }
  return out;
}

export const onRequestPost = route(async ({ request, env }) => {
  const account = await requireUser(request, env);
  assertNotMuted(account);

  const body = await readJson(request, 6 * 1024 * 1024);

  const title = requireString(body.title, "title", 1, 120);
  const sessionId = optionalString(body.sessionId, "sessionId", 120);
  const messages = cleanMessages(body.messages);
  const permissions = cleanPermissions(body.permissions);

  const code = randomId(32);
  const createdAt = nowIso();

  const share = {
    code,
    title,
    sessionId,
    messages,
    permissions,
    owner: account.username,
    ownerLower: account.usernameLower,
    createdAt,
    updatedAt: createdAt,
    messageCount: messages.length,
  };

  await kvPut(env, `share:${code}`, share);
  await bumpStat(env, account.username, "sharedChats", 1);

  return json(201, {
    ok: true,
    code,
    url: `${BASE_URL}/shared/chat/${code}`,
    share: {
      code,
      title,
      sessionId,
      permissions,
      owner: account.username,
      createdAt,
      messageCount: messages.length,
    },
  });
});
