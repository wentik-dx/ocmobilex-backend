/**
 * GET /api/published
 * Public list of published items (metadata only, never the payload).
 * Query: ?type=html|image|music&limit=25&cursor=&author=
 */
import { json, route, kvCollection, paginate, query } from "../_lib.js";

export { onRequestOptions } from "../_lib.js";

const TYPES = ["html", "image", "music"];

function project(item) {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    description: item.description || "",
    tags: Array.isArray(item.tags) ? item.tags : [],
    author: item.owner || null,
    size: Number(item.size) || 0,
    mime: item.mime || "",
    createdAt: item.createdAt || null,
    url: `/p/${item.id}`,
  };
}

export const onRequestGet = route(async ({ request, env }) => {
  const params = query(request);
  const type = (params.get("type") || "").trim().toLowerCase();
  const author = (params.get("author") || "").trim().toLowerCase();
  const limit = Number(params.get("limit")) || 25;
  const cursor = params.get("cursor");

  let all = await kvCollection(env, "publish:", { max: 1000 });

  if (TYPES.includes(type)) all = all.filter((item) => item.type === type);
  if (author) all = all.filter((item) => String(item.owner || "").toLowerCase() === author);

  all.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  const page = paginate(all, limit, cursor);

  return json(200, {
    ok: true,
    items: page.items.map(project),
    total: page.total,
    nextCursor: page.nextCursor,
    filters: { type: TYPES.includes(type) ? type : null, author: author || null },
  });
});
