/**
 * Global middleware for the OCMobileX Pages project.
 *
 *  - answers every OPTIONS preflight (204 + CORS)
 *  - adds CORS headers to every response, static assets included
 *  - converts 404 / 405 under /api/* into JSON ({ ok:false })
 *  - turns a thrown error into a JSON 500 instead of an HTML error page
 */
import { CORS_HEADERS, json } from "./api/_lib.js";

function withCors(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(CORS_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const isApi = url.pathname === "/api" || url.pathname.startsWith("/api/");

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...CORS_HEADERS } });
  }

  let response;
  try {
    response = await next();
  } catch (err) {
    console.error("[ocmx] middleware caught:", (err && err.stack) || err);
    if (isApi) {
      return json(500, { ok: false, error: "Internal server error" });
    }
    return withCors(
      new Response("Internal server error", {
        status: 500,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      }),
    );
  }

  if (isApi) {
    if (response.status === 404) {
      return json(404, {
        ok: false,
        error: "Not found",
        path: url.pathname,
        hint: "GET /api/status lists every endpoint",
      });
    }
    if (response.status === 405) {
      return json(405, {
        ok: false,
        error: "Method not allowed",
        method: request.method,
        path: url.pathname,
      });
    }
    const contentType = response.headers.get("content-type") || "";
    if (response.status >= 400 && !contentType.includes("application/json")) {
      return json(response.status, {
        ok: false,
        error: response.statusText || "Request failed",
        path: url.pathname,
      });
    }
  }

  return withCors(response);
}
