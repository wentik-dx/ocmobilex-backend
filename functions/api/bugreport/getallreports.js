/**
 * GET /api/bugreport/getallreports   (owner only)
 * Query: ?status=open&limit=25&cursor=<opaque>
 * Returns { ok, reports, total, nextCursor }.
 */
import {
  json,
  route,
  requireOwner,
  kvCollection,
  paginate,
  query,
} from "../_lib.js";

export { onRequestOptions } from "../_lib.js";

export const onRequestGet = route(async ({ request, env }) => {
  await requireOwner(request, env);

  const params = query(request);
  const status = (params.get("status") || "").trim().toLowerCase();
  const limit = Number(params.get("limit")) || 25;
  const cursor = params.get("cursor");

  const all = await kvCollection(env, "bug:", { max: 1000 });

  const filtered = status
    ? all.filter((r) => (r.status || "").toLowerCase() === status)
    : all;

  filtered.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  const page = paginate(filtered, limit, cursor);

  return json(200, {
    ok: true,
    reports: page.items,
    total: page.total,
    nextCursor: page.nextCursor,
    filters: { status: status || null, limit: Math.min(100, Math.max(1, limit)) },
  });
});
