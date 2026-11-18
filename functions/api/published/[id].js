/**
 * GET /api/published/[id]
 * Public single item, including its payload.
 */
import { json, route, kvGet, HttpError } from "../_lib.js";

export { onRequestOptions } from "../_lib.js";

export const onRequestGet = route(async ({ env, params }) => {
  const id = params && params.id ? String(params.id) : "";
  if (!/^[A-Za-z0-9]{4,64}$/.test(id)) throw new HttpError(400, "Invalid id");

  const item = await kvGet(env, `publish:${id}`);
  if (!item) throw new HttpError(404, "Published item not found");

  return json(200, {
    ok: true,
    item: {
      id: item.id,
      type: item.type,
      title: item.title,
      description: item.description || "",
      tags: Array.isArray(item.tags) ? item.tags : [],
      author: item.owner || null,
      data: item.data,
      encoding: item.encoding || (item.type === "html" ? "text" : "base64"),
      mime: item.mime || "",
      size: Number(item.size) || 0,
      createdAt: item.createdAt || null,
      url: `/p/${item.id}`,
    },
  });
});
