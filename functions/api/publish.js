/**
 * POST /api/publish
 * Bearer token. Body:
 * { type: "html"|"image"|"music", title, data, tags: [], description,
 *   encoding?: "text"|"base64", mime? }
 *
 * Size limits: 512 KB for html, 5 MB for image/music (measured on the real
 * payload, i.e. after base64 decoding when applicable).
 *
 * Returns { ok, id, url: "/p/<id>", absoluteUrl }.
 */
import {
  json,
  route,
  readJson,
  requireUser,
  assertNotMuted,
  requireString,
  optionalString,
  oneOf,
  stringArray,
  randomId,
  nowIso,
  kvPut,
  bumpStat,
  base64ByteLength,
  stripDataUrl,
  dataUrlMime,
  looksLikeBase64,
  HttpError,
} from "./_lib.js";

export { onRequestOptions } from "./_lib.js";

export const BASE_URL = "https://ocmobilex.pages.dev";

const TYPES = ["html", "image", "music"];
const LIMITS = {
  html: 512 * 1024,
  image: 5 * 1024 * 1024,
  music: 5 * 1024 * 1024,
};

const DEFAULT_MIME = {
  html: "text/html; charset=utf-8",
  image: "image/png",
  music: "audio/mpeg",
};

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const onRequestPost = route(async ({ request, env }) => {
  const account = await requireUser(request, env);
  assertNotMuted(account);

  const body = await readJson(request, 8 * 1024 * 1024);

  const type = oneOf(body.type, "type", TYPES);
  const title = requireString(body.title, "title", 1, 120);
  const description = optionalString(body.description, "description", 2000);
  const tags = stringArray(body.tags, "tags", 20, 32);

  if (typeof body.data !== "string" || body.data.length === 0) {
    throw new HttpError(400, "data must be a non-empty string");
  }

  const encoding =
    body.encoding === undefined
      ? type === "html"
        ? "text"
        : "base64"
      : oneOf(body.encoding, "encoding", ["text", "base64"]);

  let data = body.data;
  let size = 0;

  if (encoding === "base64") {
    const payload = stripDataUrl(data);
    if (!looksLikeBase64(payload)) {
      throw new HttpError(400, "data is not valid base64");
    }
    size = base64ByteLength(payload);
    data = payload;
  } else {
    size = new TextEncoder().encode(data).length;
  }

  const limit = LIMITS[type];
  if (size > limit) {
    throw new HttpError(
      413,
      `payload is ${humanSize(size)}; the limit for ${type} is ${humanSize(limit)}`,
      "too_large",
    );
  }

  const mime =
    optionalString(body.mime, "mime", 100) ||
    dataUrlMime(body.data) ||
    DEFAULT_MIME[type];

  const createdAt = nowIso();
  const id = randomId(16);

  const item = {
    id,
    type,
    title,
    description,
    tags,
    data,
    encoding,
    mime,
    size,
    owner: account.username,
    ownerLower: account.usernameLower,
    createdAt,
  };

  await kvPut(env, `publish:${id}`, item);
  await bumpStat(env, account.username, "published", 1);

  return json(201, {
    ok: true,
    id,
    url: `/p/${id}`,
    absoluteUrl: `${BASE_URL}/p/${id}`,
    type,
    title,
    size,
    mime,
    createdAt,
  });
});
