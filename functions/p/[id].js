/**
 * GET /p/[id] — public renderer for published items.
 *
 *  - html   : served as text/html inside a CSP sandbox (scripts run, but the
 *             page gets a unique origin so it cannot touch app storage)
 *  - image  : served as the raw binary with its MIME type
 *  - music  : served as the raw binary with its MIME type
 *
 * Unknown ids fall back to a small 404 page.
 */
import { kvGet, b64decode, escapeHtml, CORS_HEADERS } from "../api/_lib.js";

const HTML_CSP =
  "sandbox allow-scripts allow-forms allow-popups allow-modals allow-downloads allow-popups-to-escape-sandbox";

function page(title, body) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; min-height:100vh; display:grid; place-items:center;
         font:16px/1.6 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
         background:#0b0b12; color:#e7e7f0; padding:24px; }
  .card { max-width:520px; width:100%; background:#14141f; border:1px solid #262638;
          border-radius:16px; padding:24px; }
  h1 { font-size:18px; margin:0 0 8px; }
  p { margin:0; color:#a1a1b5; }
  a { color:#8b7bff; }
</style></head>
<body><div class="card">${body}</div></body></html>`;
}

function notFound(message) {
  return new Response(
    page(
      "Not found · OCMobileX",
      `<h1>Nothing here</h1><p>${escapeHtml(message)}</p>
       <p style="margin-top:12px"><a href="/">← Back to OCMobileX</a></p>`,
    ),
    { status: 404, headers: { "Content-Type": "text/html; charset=utf-8", ...CORS_HEADERS } },
  );
}

export async function onRequestGet({ env, params }) {
  try {
    const id = params && params.id ? String(params.id) : "";
    if (!/^[A-Za-z0-9]{4,64}$/.test(id)) return notFound("Invalid id.");

    const item = await kvGet(env, `publish:${id}`);
    if (!item) return notFound("This item does not exist or was removed.");

    const encoding = item.encoding || (item.type === "html" ? "text" : "base64");

    if (item.type === "html") {
      const html = encoding === "base64" ? new TextDecoder().decode(b64decode(item.data)) : item.data;
      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy": HTML_CSP,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "public, max-age=60",
          ...CORS_HEADERS,
        },
      });
    }

    if (item.type === "image" || item.type === "music") {
      const bytes = encoding === "base64" ? b64decode(item.data) : new TextEncoder().encode(item.data);
      return new Response(bytes, {
        status: 200,
        headers: {
          "Content-Type": item.mime || (item.type === "image" ? "image/png" : "audio/mpeg"),
          "Content-Disposition": `inline; filename="${item.id}"`,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "public, max-age=300",
          ...CORS_HEADERS,
        },
      });
    }

    return notFound("Unsupported item type.");
  } catch (err) {
    console.error("[ocmx] /p/[id] failed:", err);
    return new Response(
      page("Error · OCMobileX", `<h1>Something broke</h1><p>The item could not be rendered.</p>`),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
