/**
 * GET /shared/chat/[code] — server-rendered public viewer for a shared chat.
 * The JSON API lives at /api/shared/chat/[code]; this page is what the share
 * URL actually points at.
 */
import { kvGet, escapeHtml, CORS_HEADERS } from "../../api/_lib.js";

const ROLE_LABEL = {
  user: "user",
  assistant: "assistant",
  system: "system",
  tool: "tool",
};

function shell(title, inner) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="robots" content="noindex">
<style>
  :root { color-scheme: dark; --bg:#0b0b12; --card:#14141f; --line:#262638; --txt:#e7e7f0; --dim:#a1a1b5; --accent:#8b7bff; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--txt); padding:16px;
         font:15px/1.55 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
  .wrap { max-width:820px; margin:0 auto; }
  header { padding:16px 18px; background:var(--card); border:1px solid var(--line); border-radius:14px; }
  h1 { margin:0 0 6px; font-size:17px; }
  .meta { color:var(--dim); font-size:12.5px; display:flex; flex-wrap:wrap; gap:10px; }
  .pill { border:1px solid var(--line); border-radius:999px; padding:1px 9px; }
  .msgs { margin:14px 0; display:flex; flex-direction:column; gap:10px; }
  .msg { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:10px 13px; }
  .msg.user { border-color:#3b3560; }
  .msg.assistant { border-color:#22374a; }
  .role { font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--accent); margin-bottom:4px; }
  .msg.assistant .role { color:#4fb3ff; }
  .msg.system .role, .msg.tool .role { color:var(--dim); }
  .text { white-space:pre-wrap; word-wrap:break-word; }
  .author { color:var(--dim); font-size:11.5px; margin-top:6px; }
  .empty { color:var(--dim); text-align:center; padding:28px 0; }
  form { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:14px; margin-top:8px; }
  textarea, input { width:100%; background:#0e0e17; color:var(--txt); border:1px solid var(--line);
                    border-radius:10px; padding:9px 11px; font:inherit; resize:vertical; }
  label { display:block; font-size:12px; color:var(--dim); margin:8px 0 4px; }
  button { margin-top:10px; background:var(--accent); color:#0b0b12; border:0; border-radius:10px;
           padding:10px 16px; font-weight:700; font-size:14px; cursor:pointer; }
  button:disabled { opacity:.55; cursor:default; }
  .note { color:var(--dim); font-size:12px; margin-top:8px; }
  a { color:var(--accent); }
</style></head>
<body><div class="wrap">${inner}</div></body></html>`;
}

function renderMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return `<div class="empty">This chat has no messages.</div>`;
  }
  return messages
    .map((message) => {
      const role = ROLE_LABEL[String(message.role)] || "user";
      const text = escapeHtml(message.text || "");
      const author = message.author
        ? `<div class="author">by ${escapeHtml(message.author)}</div>`
        : "";
      return `<div class="msg ${role}">
        <div class="role">${escapeHtml(role)}</div>
        <div class="text">${text}</div>${author}
      </div>`;
    })
    .join("\n");
}

export async function onRequestGet({ env, params }) {
  const raw = params && params.code ? String(params.code) : "";
  if (!/^[A-Za-z0-9]{8,64}$/.test(raw)) {
    return new Response(
      shell("Invalid link · OCMobileX", `<header><h1>Invalid share link</h1>
        <div class="meta">The code in this URL is not valid.</div></header>
        <p><a href="/">← OCMobileX</a></p>`),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8", ...CORS_HEADERS } },
    );
  }

  let share = null;
  try {
    share = await kvGet(env, `share:${raw}`);
  } catch (err) {
    console.error("[ocmx] share page lookup failed:", err);
  }

  if (!share) {
    return new Response(
      shell("Not found · OCMobileX", `<header><h1>Shared chat not found</h1>
        <div class="meta">This link was deleted or never existed.</div></header>
        <p><a href="/">← OCMobileX</a></p>`),
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8", ...CORS_HEADERS } },
    );
  }

  const permissions = share.permissions || {};
  const canWrite = !!permissions.write;
  const created = share.createdAt ? new Date(share.createdAt).toUTCString() : "";
  const count = Array.isArray(share.messages) ? share.messages.length : 0;

  const form = canWrite
    ? `<form id="reply">
         <label for="token">Your session token (Bearer)</label>
         <input id="token" autocomplete="off" placeholder="paste token to post">
         <label for="text">Message</label>
         <textarea id="text" rows="3" maxlength="20000" placeholder="Write a reply…"></textarea>
         <button id="send" type="submit">Post message</button>
         <div class="note" id="status">Writing is enabled for this chat.</div>
       </form>
       <script>
         const form = document.getElementById('reply');
         const status = document.getElementById('status');
         form.addEventListener('submit', async (event) => {
           event.preventDefault();
           const token = document.getElementById('token').value.trim();
           const text = document.getElementById('text').value;
           if (!token) { status.textContent = 'A session token is required.'; return; }
           const button = document.getElementById('send');
           button.disabled = true;
           status.textContent = 'Posting…';
           try {
             const response = await fetch('/api/shared/chat/${raw}', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
               body: JSON.stringify({ text }),
             });
             const data = await response.json();
             if (data.ok) { location.reload(); return; }
             status.textContent = data.error || 'Could not post.';
           } catch (error) {
             status.textContent = 'Network error.';
           }
           button.disabled = false;
         });
       </script>`
    : `<div class="note">This shared chat is read-only.</div>`;

  const html = shell(
    `${share.title || "Shared chat"} · OCMobileX`,
    `<header>
       <h1>${escapeHtml(share.title || "Shared chat")}</h1>
       <div class="meta">
         <span class="pill">owner: ${escapeHtml(share.owner || "unknown")}</span>
         <span class="pill">${count} message${count === 1 ? "" : "s"}</span>
         <span class="pill">${canWrite ? "write enabled" : "read only"}</span>
         ${created ? `<span class="pill">${escapeHtml(created)}</span>` : ""}
       </div>
     </header>
     <div class="msgs">${renderMessages(share.messages)}</div>
     ${form}
     <p class="note"><a href="/">OCMobileX</a> · public share · JSON at
       <code>/api/shared/chat/${raw}</code></p>`,
  );

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
    },
  });
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
