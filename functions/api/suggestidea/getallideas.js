/**
 * GET /api/suggestidea/getallideas
 *
 * Public list. Anonymous callers see title/description/votes/status/createdAt
 * (plus id/category/impact). Owners and moderators additionally see the author
 * and get `canModerate: true` so the client can render status controls.
 *
 * Query: ?status=&limit=&cursor=&sort=votes|new
 */
import {
  json,
  route,
  kvCollection,
  paginate,
  query,
  bearerToken,
  verifySessionToken,
  getUser,
  isStaff,
} from "../_lib.js";

export { onRequestOptions } from "../_lib.js";

async function optionalAccount(request, env) {
  const token = bearerToken(request);
  if (!token) return null;
  const payload = await verifySessionToken(env, token);
  if (!payload) return null;
  return getUser(env, payload.u);
}

function project(idea, staff) {
  const out = {
    id: idea.id,
    title: idea.title,
    description: idea.description || "",
    category: idea.category || "other",
    impact: idea.impact || "normal",
    votes: Number(idea.votes) || 0,
    status: idea.status || "open",
    createdAt: idea.createdAt || null,
  };
  if (staff) {
    out.author = idea.author || null;
    out.updatedAt = idea.updatedAt || null;
  }
  return out;
}

export const onRequestGet = route(async ({ request, env }) => {
  const params = query(request);
  const status = (params.get("status") || "").trim().toLowerCase();
  const limit = Number(params.get("limit")) || 25;
  const cursor = params.get("cursor");
  const sort = (params.get("sort") || "votes").trim().toLowerCase();

  const viewer = await optionalAccount(request, env);
  const staff = isStaff(viewer);

  const all = await kvCollection(env, "idea:", { max: 1000 });
  const filtered = status ? all.filter((i) => (i.status || "").toLowerCase() === status) : all;

  if (sort === "new") {
    filtered.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  } else {
    filtered.sort((a, b) => {
      const diff = (Number(b.votes) || 0) - (Number(a.votes) || 0);
      if (diff !== 0) return diff;
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
  }

  const page = paginate(filtered, limit, cursor);

  return json(200, {
    ok: true,
    ideas: page.items.map((idea) => project(idea, staff)),
    total: page.total,
    nextCursor: page.nextCursor,
    canModerate: staff,
  });
});
