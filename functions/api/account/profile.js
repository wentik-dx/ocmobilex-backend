/**
 * PATCH /api/account/profile
 * Bearer token. Body: { bio?, color?, links?: { github?, site? } }
 *
 * Only the fields present in the body are changed. Returns the updated public
 * profile.
 */
import {
  json,
  route,
  readJson,
  requireUser,
  putUser,
  publicUser,
  optionalString,
  nowIso,
  HttpError,
} from "../_lib.js";

export { onRequestOptions } from "../_lib.js";

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const NAMED_COLOR = /^[a-zA-Z]{3,20}$/;

function cleanColor(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") throw new HttpError(400, "color must be a string");
  const color = value.trim();
  if (!HEX_COLOR.test(color) && !NAMED_COLOR.test(color)) {
    throw new HttpError(400, "color must be a hex value like #7c3aed or a CSS color name");
  }
  return color;
}

function cleanLink(value, field) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") throw new HttpError(400, `${field} must be a string`);
  const link = value.trim();
  if (link.length > 200) throw new HttpError(400, `${field} must be at most 200 characters`);
  let url;
  try {
    url = new URL(link);
  } catch {
    throw new HttpError(400, `${field} must be a valid http(s) URL`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new HttpError(400, `${field} must be a valid http(s) URL`);
  }
  return url.toString();
}

export const onRequestPatch = route(async ({ request, env }) => {
  const account = await requireUser(request, env);
  const body = await readJson(request, 32 * 1024);

  if (body.bio !== undefined) {
    account.bio = optionalString(body.bio, "bio", 280);
  }
  if (body.color !== undefined) {
    account.color = cleanColor(body.color);
  }
  if (body.links !== undefined) {
    if (body.links === null) {
      account.links = { github: "", site: "" };
    } else if (typeof body.links !== "object" || Array.isArray(body.links)) {
      throw new HttpError(400, "links must be an object");
    } else {
      const links = account.links || { github: "", site: "" };
      if (body.links.github !== undefined) {
        links.github = cleanLink(body.links.github, "links.github");
      }
      if (body.links.site !== undefined) {
        links.site = cleanLink(body.links.site, "links.site");
      }
      account.links = links;
    }
  }

  account.updatedAt = nowIso();
  await putUser(env, account);

  return json(200, { ok: true, user: publicUser(account, { self: true }) });
});
