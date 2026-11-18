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
  // Bare hosts ("wentik.dev", "github.com/wentik") get an https prefix.
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(link) ? link : `https://${link}`;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new HttpError(400, `${field} must be a valid http(s) URL`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new HttpError(400, `${field} must be a valid http(s) URL`);
  }
  return url.toString();
}

/** Telegram accepts a bare `@handle` as well as a full URL. */
function cleanTelegram(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") throw new HttpError(400, "links.telegram must be a string");
  const text = value.trim();
  if (!text) return "";
  if (text.startsWith("@")) return `https://t.me/${text.slice(1)}`;
  return cleanLink(text, "links.telegram");
}

/**
 * Avatars are either a plain https URL or an inline data URI. Inline images are
 * capped so a profile record stays small enough for KV and for list responses.
 */
const AVATAR_MAX = 180 * 1024; // ~135 KB of image bytes
const DATA_URI = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/i;

function cleanAvatar(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") throw new HttpError(400, "avatar must be a string");
  const avatar = value.trim();
  if (!avatar) return "";
  if (avatar.length > AVATAR_MAX) {
    throw new HttpError(413, "avatar is too large (max ~180 KB as base64)");
  }
  if (DATA_URI.test(avatar)) return avatar;
  let url;
  try {
    url = new URL(avatar);
  } catch {
    throw new HttpError(400, "avatar must be an https URL or an image data URI");
  }
  if (url.protocol !== "https:") {
    throw new HttpError(400, "avatar URLs must use https");
  }
  return url.toString();
}

export const onRequestPatch = route(async ({ request, env }) => {
  const account = await requireUser(request, env);
  const body = await readJson(request, 256 * 1024);

  if (body.bio !== undefined) {
    account.bio = optionalString(body.bio, "bio", 280);
  }
  if (body.color !== undefined) {
    account.color = cleanColor(body.color);
  }
  if (body.avatar !== undefined) {
    account.avatar = cleanAvatar(body.avatar);
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
      if (body.links.website !== undefined) {
        links.site = cleanLink(body.links.website, "links.website");
      }
      if (body.links.telegram !== undefined) {
        links.telegram = cleanTelegram(body.links.telegram);
      }
      account.links = links;
    }
  }

  account.updatedAt = nowIso();
  await putUser(env, account);

  return json(200, { ok: true, user: publicUser(account, { self: true }) });
});
