/**
 * GET /api/legal/privacy
 * Returns { ok: true, updated, markdown }.
 */
import { json, route } from "../_lib.js";
import { PRIVACY_POLICY, LEGAL_UPDATED } from "../_legal.js";

export { onRequestOptions } from "../_lib.js";

export const onRequestGet = route(async () =>
  json(200, {
    ok: true,
    document: "privacy",
    updated: LEGAL_UPDATED,
    markdown: PRIVACY_POLICY,
  }),
);
