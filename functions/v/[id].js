/**
 * GET /v/[id] — public *viewer* for a published item.
 *
 * `/p/[id]` serves the raw payload (sandboxed HTML, image bytes, audio bytes).
 * This route wraps it in a small page so a phone can jump into the app while a
 * desktop still sees the content. Links produced by the app point here.
 */
import { kvGet, escapeHtml, CORS_HEADERS } from "../api/_lib.js";
import { appLinkBanner, APP_BANNER_CSS } from "../_applink.js";

function shell(title, body) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="robots" content="noindex">
<style>
  :root { color-scheme: dark; --bg:#0b0b12; --card:#14141f; --line:#262638; --txt:#e7e7f0; --dim:#a1a1b5; --accent:#8b7bff; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--txt); padding:14px;
         font:15px/1.55 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
  .wrap { max-width:920px; margin:0 auto; }
  header { margin:0 0 12px; }
  h1 { margin:0 0 6px; font-size:18px; }
  .meta { color:var(--dim); font-size:12.5px; display:flex; flex-wrap:wrap; gap:8px; }
  .pill { border:1px solid var(--line); border-radius:999px; padding:1px 9px; }
  .stage { background:var(--card); border:1px solid var(--line); border-radius:14px; overflow:hidden; }
  iframe { width:100%; height:70vh; border:0; display:block; background:#fff; }
  img, audio { display:block; width:100%; max-height:80vh; object-fit:contain; background:#000; }
  audio { padding:16px; }
  a { color:var(--accent); }
  .note { color:var(--dim); font-size:12px; margin-top:10px; }
  ${APP_BANNER_CSS}
</style></head>
<body><div class="wrap">${body}</div></body></html>`;
}

export async function onRequestGet({ env, params }) {
  const id = params && params.id ? String(params.id) : "";
  const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...CORS_HEADERS };

  if (!/^[A-Za-z0-9]{4,64}$/.test(id)) {
    return new Response(shell("Invalid id · OCMobileX", `<h1>Invalid link</h1><p><a href="/">← OCMobileX</a></p>`), {
      status: 400,
      headers,
    });
  }

  let item = null;
  try {
    item = await kvGet(env, `publish:${id}`);
  } catch (err) {
    console.error("[ocmx] /v/[id] lookup failed:", err);
  }

  if (!item) {
    return new Response(
      shell(
        "Not found · OCMobileX",
        `${appLinkBanner("publish", id)}
         <h1>Nothing here</h1><p>This item was removed or never existed.</p>
         <p class="note"><a href="/">← OCMobileX</a></p>`,
      ),
      { status: 404, headers },
    );
  }

  const raw = `/p/${id}`;
  let stage = "";
  if (item.type === "html") {
    stage = `<iframe src="${raw}" referrerpolicy="no-referrer" sandbox="allow-scripts allow-forms allow-popups allow-modals"></iframe>`;
  } else if (item.type === "image") {
    stage = `<img src="${raw}" alt="${escapeHtml(item.title || "image")}">`;
  } else if (item.type === "music") {
    stage = `<audio controls preload="metadata" src="${raw}"></audio>`;
  } else {
    stage = `<p class="note">Unsupported item type: ${escapeHtml(String(item.type))}</p>`;
  }

  const tags = Array.isArray(item.tags) && item.tags.length
    ? item.tags.map((tag) => `<span class="pill">#${escapeHtml(String(tag))}</span>`).join(" ")
    : "";

  return new Response(
    shell(
      `${item.title || "Published item"} · OCMobileX`,
      `${appLinkBanner("publish", id)}
       <header>
         <h1>${escapeHtml(item.title || "Published item")}</h1>
         <div class="meta">
           <span class="pill">${escapeHtml(String(item.type || "item"))}</span>
           ${item.author ? `<span class="pill">by ${escapeHtml(String(item.author))}</span>` : ""}
           ${tags}
         </div>
       </header>
       <div class="stage">${stage}</div>
       ${item.description ? `<p class="note">${escapeHtml(String(item.description))}</p>` : ""}
       <p class="note"><a href="${raw}">raw</a> · <a href="/">OCMobileX</a></p>`,
    ),
    { status: 200, headers },
  );
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
