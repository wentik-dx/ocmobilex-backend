/**
 * POST /api/bugreport/updatestatus   (owner only)
 * Body: { id, status, note }
 */
import {
  json,
  route,
  readJson,
  requireOwner,
  kvGet,
  kvPut,
  oneOf,
  optionalString,
  nowIso,
  HttpError,
} from "../_lib.js";

export { onRequestOptions } from "../_lib.js";

const STATUSES = ["open", "triaged", "in_progress", "resolved", "wontfix", "duplicate"];

export const onRequestPost = route(async ({ request, env }) => {
  const { account } = await requireOwner(request, env);

  const body = await readJson(request, 32 * 1024);
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) throw new HttpError(400, "id is required");

  const status = oneOf(body.status, "status", STATUSES);
  const note = optionalString(body.note, "note", 2000);

  const report = await kvGet(env, `bug:${id}`);
  if (!report) throw new HttpError(404, "No such report");

  const previous = report.status;
  report.status = status;
  if (note) report.note = note;
  report.updatedAt = nowIso();
  report.history = Array.isArray(report.history) ? report.history : [];
  report.history.push({
    from: previous,
    to: status,
    note,
    by: account ? account.username : "owner-token",
    at: report.updatedAt,
  });

  await kvPut(env, `bug:${id}`, report);

  return json(200, { ok: true, report });
});
