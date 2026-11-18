/**
 * Deep-link banner shared by the server-rendered public pages.
 *
 * Opening a share / publication link on a phone should land in the app, not in
 * a browser tab. Each page renders `appLinkBanner(kind, id)` which:
 *
 *   - tries `ocmx://…` (custom scheme) through an Android `intent://` URL,
 *   - auto-attempts once per browser session (skipped after "stay on web"),
 *   - keeps a visible button so the user can retry,
 *   - falls back to the current page when the app is not installed.
 *
 * The app registers matching intent filters (see android/AndroidManifest.xml)
 * and `/.well-known/assetlinks.json` makes the https links verifiable.
 */

const APP_PACKAGE = "com.opencode.mobile";

/** Path segment for a deep link kind → `ocmx://<segment>/<id>`. */
const SEGMENT = {
  share: "shared/chat",
  publish: "publish",
  account: "account",
};

function safeId(id) {
  return String(id || "").replace(/[^A-Za-z0-9_-]/g, "");
}

/**
 * @param {"share"|"publish"|"account"} kind
 * @param {string} [id]
 * @returns {string} HTML (banner + inline script)
 */
export function appLinkBanner(kind, id = "") {
  const segment = SEGMENT[kind] || kind;
  const clean = safeId(id);
  const path = clean ? `${segment}/${clean}` : segment;
  const schemeUrl = `ocmx://${path}`;
  const intentUrl =
    `intent://${path}#Intent;scheme=ocmx;package=${APP_PACKAGE};` +
    `S.browser_fallback_url=${encodeURIComponent("/")};end`;

  return `<div class="appbar" id="appbar">
  <div class="appbar-txt">
    <strong>Открыть в приложении</strong>
    <span>OCMobileX · ${escapeAttr(schemeUrl)}</span>
  </div>
  <div class="appbar-actions">
    <a class="appbar-btn" id="applink" href="${escapeAttr(schemeUrl)}">Открыть</a>
    <button class="appbar-stay" id="appstay" type="button">Остаться</button>
  </div>
</div>
<script>
(function () {
  var scheme = ${JSON.stringify(schemeUrl)};
  var intent = ${JSON.stringify(intentUrl)};
  var key = "ocmx.stay:" + ${JSON.stringify(path)};
  var bar = document.getElementById("appbar");
  var stay = document.getElementById("appstay");
  var open = document.getElementById("applink");

  function rememberStay() {
    try { sessionStorage.setItem(key, "1"); } catch (e) {}
    if (bar) bar.classList.add("appbar-hidden");
  }
  function openApp() {
    try {
      var now = Date.now();
      location.href = intent;
      // If the app is missing the page keeps running; drop the banner then.
      setTimeout(function () {
        if (document.visibilityState === "visible" && Date.now() - now < 2500) {
          if (bar) bar.classList.add("appbar-failed");
        }
      }, 1600);
    } catch (e) {
      location.href = scheme;
    }
  }

  if (stay) stay.addEventListener("click", function (event) {
    event.preventDefault();
    rememberStay();
  });
  if (open) open.addEventListener("click", function (event) {
    event.preventDefault();
    openApp();
  });

  var stayed = false;
  try { stayed = sessionStorage.getItem(key) === "1"; } catch (e) {}
  if (!stayed) setTimeout(openApp, 700);
})();
</script>`;
}

/** Minimal attribute escaper (the banner only ever carries sanitised ids). */
function escapeAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** CSS for the banner, injected by the pages that use it. */
export const APP_BANNER_CSS = `
  .appbar { display:flex; align-items:center; gap:12px; justify-content:space-between;
            flex-wrap:wrap; background:linear-gradient(135deg,#241f45,#1a2233);
            border:1px solid #3b3560; border-radius:14px; padding:12px 14px; margin-bottom:14px; }
  .appbar-txt { display:flex; flex-direction:column; gap:2px; min-width:0; }
  .appbar-txt strong { font-size:14px; }
  .appbar-txt span { font-size:11.5px; color:#a1a1b5; word-break:break-all; }
  .appbar-actions { display:flex; gap:8px; align-items:center; }
  .appbar-btn { background:#8b7bff; color:#0b0b12; border:0; border-radius:10px;
                padding:9px 16px; font-weight:700; font-size:13.5px; text-decoration:none; }
  .appbar-stay { background:transparent; color:#a1a1b5; border:1px solid #3b3560;
                 border-radius:10px; padding:9px 12px; font-size:13px; cursor:pointer; }
  .appbar-hidden { display:none; }
  .appbar-failed { border-color:#7a4a2a; }
  .appbar-failed .appbar-txt span::after { content:" · приложение не найдено"; color:#f0a868; }
`;
