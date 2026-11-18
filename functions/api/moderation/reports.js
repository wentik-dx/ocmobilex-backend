/**
 * GET  /api/moderation/reports        (owner / mod / admin)
 *      Query: ?status=open&limit=25&cursor=
 * POST /api/moderation/reports        (owner / mod / admin)
 *      Body: { id, action: dismiss|warn|mute|ban|delete, note,
 *              contentId?, contentType?: "share"|"publish"|"idea",
 *              durationHours? }
 */
import {
  json,
  route,
  readJson,
  requireStaff,
  kvGet,
  kvPut,
  kvDelete,
  kvCollection,
  paginate,
  query,
  getUser,
  oneOf,
  optionalString,
  nowIso,
  HttpError,
} from "../_lib.js";

export { onRequestOptions } from "../_lib.js";

const ACTIONS = ["dismiss", "warn", "mute", "ban", "delete"];
const CONTENT_TYPES = ["share", "publish", "idea"];

export const onRequestGet = route(async ({ request, env }) => {
  await requireStaff(request, env);

  const params = query(request);
  const status = (params.get("status") || "").trim().toLowerCase();
  const limit = Number(params.get("limit")) || 25;
  const cursor = params.get("cursor");

  const all = await kvCollection(env, "moderation:", { max: 1000 });
  const filtered = status ? all.filter((r) => (r.status || "").toLowerCase() === status) : all;
  filtered.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  const page = paginate(filtered, limit, cursor);

  return json(200, {
    ok: true,
    reports: page.items,
    total: page.total,
    nextCursor: page.nextCursor,
  });
});

export const onRequestPost = route(async ({ request, env }) => {
  const actor = await requireStaff(request, env);

  const body = await readJson(request, 32 * 1024);

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) throw new HttpError(400, "id is required");

  const action = oneOf(body.action, "action", ACTIONS);
  const note = optionalString(body.note, "note", 2000);

  const report = await kvGet(env, `moderation:${id}`);
  if (!report) throw new HttpError(404, "No such moderation report");

  if (report.status !== "open" && action !== "dismiss") {
    // re-applying an action on an already handled report is allowed but noted
    report.reopenedAt = nowIso();
  }

  const target = await getUser(env, report.targetUsername);
  let applied = null;
  let deletedContent = null;

  if (action === "warn") {
    if (target) {
      target.warnings = (Number(target.warnings) || 0) + 1;
      target.lastWarnedAt = nowIso();
      target.updatedAt = nowIso();
      await kvPut(env, `user:${target.usernameLower}`, target);
    }
    applied = "warning recorded";
  }

  if (action === "mute") {
    if (!target) throw new HttpError(404, "Reported account no longer exists");
    const hours = Math.min(720, Math.max(1, Number(body.durationHours) || 24));
    target.mutedUntil = Date.now() + hours * 60 * 60 * 1000;
    target.updatedAt = nowIso();
    await kvPut(env, `user:${target.usernameLower}`, target);
    applied = `muted for ${hours}h`;
  }

  if (action === "ban") {
    if (!target) throw new HttpError(404, "Reported account no longer exists");
    if (target.role === "owner") {
      throw new HttpError(409, "The owner account cannot be banned from here");
    }
    target.banned = true;
    target.bannedAt = nowIso();
    target.updatedAt = nowIso();
    await kvPut(env, `user:${target.usernameLower}`, target);
    applied = "account banned";
  }

  if (action === "delete") {
    const contentId = typeof body.contentId === "string" ? body.contentId.trim() : "";
    const contentType =
      body.contentType === undefined
        ? null
        : oneOf(body.contentType, "contentType", CONTENT_TYPES);

    if (contentId && contentType) {
      const prefix = contentType === "share" ? "share" : contentType === "publish" ? "publish" : "idea";
      const existing = await kvGet(env, `${prefix}:${contentId}`);
      if (!existing) throw new HttpError(404, "No such content");
      await kvDelete(env, `${prefix}:${contentId}`);
      deletedContent = { contentType, contentId };
      applied = `deleted ${contentType} ${contentId}`;
    } else {
      applied = "content removal recorded";
    }
  }

  if (action === "dismiss") applied = "report dismissed";

  report.status = action === "dismiss" ? "dismissed" : "resolved";
  report.action = action;
  report.note = note || report.note || "";
  report.handledBy = actor.username;
  report.handledAt = nowIso();
  report.updatedAt = nowIso();
  report.applied = applied;

  await kvPut(env, `moderation:${id}`, report);

  return json(200, {
    ok: true,
    report,
    applied,
    deletedContent,
  });
});
