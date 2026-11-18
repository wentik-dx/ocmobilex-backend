/**
 * GET /api/legal/tos
 * Returns { ok: true, updated, markdown }.
 */
import { json, route } from "../_lib.js";
import { TERMS_OF_SERVICE, LEGAL_UPDATED } from "../_legal.js";

export { onRequestOptions } from "../_lib.js";

export const onRequestGet = route(async () =>
  json(200, {
    ok: true,
    document: "tos",
    updated: LEGAL_UPDATED,
    markdown: TERMS_OF_SERVICE,
  }),
);
