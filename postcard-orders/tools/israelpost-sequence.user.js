// ==UserScript==
// @name         דואר בקליק — הדבקה לפי סדר
// @name:en      Israel Post — sequential paste
// @namespace    studio1.postcard-orders
// @version      1.0.0
// @description  Copy an order once in הזמנות גלויות, then fill the דואר בקליק form with plain Ctrl+V — each paste inserts the next field.
// @author       Studio 1
// @match        *://*.israelpost.co.il/*
// @match        *://israelpost.co.il/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

/*
 * How this works, and why there is no cross-origin storage anywhere in it:
 *
 * The order panel copies all seven fields as ONE seven-line block. That block
 * rides along on every paste event, so this script never has to be told
 * anything by the other origin — it reads the whole list out of the clipboard
 * each time and only has to remember how far down it has got. Which means the
 * script runs on this domain only, and copying a different order resets the
 * counter by itself, because the payload changed.
 *
 * The wire format is positional and fixed-length: seven lines, one per field,
 * "—" for a value the order doesn't have. FIELDS and EMPTY below must match
 * `src/lib/shipSequence.ts` in the הזמנות גלויות app.
 *
 * NOT RUNNING ON THE FORM? The badge only appears once you paste, so silence
 * proves nothing on its own. Open DevTools (⌥⌘I) on the form page and look for
 * the "[studio1] sequential paste ready" line below. If it isn't there the
 * script didn't load on that URL — add the URL's host as another @match above.
 * Israel Post moves this form between hosts, and a form inside an iframe from
 * a different domain needs that domain matched, not the page's.
 */

(function () {
  "use strict";

  var FIELDS = ["שם פרטי", "שם משפחה", "עיר", "רחוב", "מספר בית", "אימייל", "טלפון"];
  var EMPTY = "—";
  var STORE_KEY = "studio1.seq";

  /* ── State ─────────────────────────────────────────────────────────────
     sessionStorage, so the counter survives the form reloading a step, and
     dies with the tab. */

  function load() {
    try {
      var raw = sessionStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      return typeof s.payload === "string" && typeof s.i === "number" ? s : null;
    } catch (err) {
      return null;
    }
  }

  function save(state) {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (err) {
      /* private mode, quota — the in-page badge still works, it just won't
         survive a reload. Not worth failing the paste over. */
    }
  }

  /* ── The payload ───────────────────────────────────────────────────────── */

  /** Seven lines → seven values, or null if this isn't one of our blocks and
   *  the paste should be left completely alone. */
  function parsePayload(text) {
    var norm = text.replace(/\r\n?/g, "\n").replace(/\n$/, "");
    var lines = norm.split("\n");
    if (lines.length !== FIELDS.length) return null;
    return {
      key: norm,
      values: lines.map(function (l) {
        var v = l.trim();
        return v === EMPTY ? "" : v;
      }),
    };
  }

  /** First slot at or after `from` that actually has a value. Returns
   *  values.length when there is nothing left — that is the "done" signal. */
  function nextFilled(values, from) {
    var i = Math.max(0, from);
    while (i < values.length && !values[i]) i++;
    return i;
  }

  /** Last slot before `from` that has a value, or the first filled one. */
  function prevFilled(values, from) {
    var i = Math.min(values.length, from) - 1;
    while (i >= 0 && !values[i]) i--;
    return i < 0 ? nextFilled(values, 0) : i;
  }

  /* ── Writing into the form ─────────────────────────────────────────────── */

  var NON_TEXT = /^(checkbox|radio|button|submit|reset|file|range|color|image)$/;

  function editableTarget(e) {
    var el = e.target;
    if (!(el instanceof HTMLElement)) el = document.activeElement;
    if (!(el instanceof HTMLElement)) return null;
    if (el instanceof HTMLTextAreaElement) return el;
    if (el instanceof HTMLInputElement) return NON_TEXT.test(el.type) ? null : el;
    return el.isContentEditable ? el : null;
  }

  function insert(el, text) {
    el.focus(); // execCommand writes into whatever has focus, not into `el`
    // insertText fires the same events a real keystroke does, so React,
    // Angular and the site's own validation all see the change — and it
    // replaces the selection, so re-pasting over a wrong value works.
    try {
      if (document.execCommand("insertText", false, text)) return true;
    } catch (err) {
      /* fall through */
    }
    // Frameworks track the value on their own and ignore a plain `.value =`.
    // Going through the prototype setter is what makes them notice.
    try {
      var proto =
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      var setter = Object.getOwnPropertyDescriptor(proto, "value").set;
      setter.call(el, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    } catch (err) {
      return false;
    }
  }

  /* ── Badge ─────────────────────────────────────────────────────────────
     In a shadow root so the host page's CSS can't reach it, and vice versa. */

  var host = null;
  var root = null;
  var pendingRender = null;

  var CSS = [
    ":host { all: initial; }",
    ".b {",
    // Physical left/bottom on purpose: the host page's direction must not
    // decide which corner this lands in.
    "  position: fixed; bottom: 16px; left: 16px; z-index: 2147483647;",
    "  direction: rtl; font: 13px/1.35 -apple-system, 'Segoe UI', system-ui, sans-serif;",
    "  display: flex; align-items: center; gap: 10px;",
    "  background: #ffffff; color: #1b1b1a; border: 1px solid #cfcfc7;",
    "  border-radius: 10px; padding: 8px 10px;",
    "  box-shadow: 0 1px 2px rgba(0,0,0,.06), 0 8px 26px rgba(0,0,0,.14);",
    "  max-width: min(340px, calc(100vw - 32px));",
    "}",
    ".b.done { border-color: #15803d; background: #e9f6ec; color: #14532d; }",
    ".step {",
    "  flex: none; font-weight: 700; font-variant-numeric: tabular-nums;",
    "  background: #f0f0ec; border-radius: 6px; padding: 3px 7px; font-size: 12px;",
    "}",
    ".b.done .step { display: none; }",
    ".txt { flex: 1; min-width: 0; }",
    ".lbl { font-size: 11px; color: #6f6f6a; letter-spacing: .03em; }",
    ".b.done .lbl { color: #15803d; }",
    ".val { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    ".btns { flex: none; display: flex; gap: 3px; }",
    ".btns button {",
    "  font: inherit; font-size: 13px; line-height: 1; cursor: pointer;",
    "  width: 24px; height: 24px; border-radius: 6px;",
    "  border: 1px solid #e4e4de; background: #fafaf8; color: #6f6f6a;",
    "}",
    ".btns button:hover { background: #f0f0ec; color: #1b1b1a; }",
    ".hint { font-size: 11px; color: #9a9a94; margin-top: 2px; }",
    "@media (prefers-color-scheme: dark) {",
    "  .b { background: #1e1e23; color: #ededf0; border-color: #43434d; }",
    "  .b.done { background: #143024; border-color: #6ee79b; color: #d3f6df; }",
    "  .step { background: #2a2a31; }",
    "  .lbl, .hint { color: #a0a0a8; }",
    "  .b.done .lbl { color: #6ee79b; }",
    "  .btns button { background: #232329; border-color: #303038; color: #a0a0a8; }",
    "  .btns button:hover { background: #2a2a31; color: #ededf0; }",
    "}",
  ].join("\n");

  function mount() {
    if (root) return true;
    if (!document.body) return false;
    host = document.createElement("div");
    host.id = "studio1-seq-badge";
    root = host.attachShadow({ mode: "open" });
    var style = document.createElement("style");
    style.textContent = CSS;
    root.appendChild(style);
    document.body.appendChild(host);
    return true;
  }

  function render(state) {
    if (!mount()) {
      // document-start: nothing to attach to yet. Keep the latest state and
      // draw it the moment the body exists.
      pendingRender = state;
      return;
    }
    var old = root.querySelector(".b");
    if (old) old.remove();
    if (!state) return;

    var parsed = parsePayload(state.payload);
    if (!parsed) return;
    var values = parsed.values;
    var i = nextFilled(values, state.i);
    var done = i >= values.length;

    var b = document.createElement("div");
    b.className = "b" + (done ? " done" : "");

    var step = document.createElement("div");
    step.className = "step";
    step.textContent = done ? "✓" : i + 1 + "/" + FIELDS.length;

    var txt = document.createElement("div");
    txt.className = "txt";
    var lbl = document.createElement("div");
    lbl.className = "lbl";
    var val = document.createElement("div");
    val.className = "val";

    if (done) {
      lbl.textContent = "סיימנו";
      val.textContent = "כל השדות הודבקו";
    } else {
      lbl.textContent = "הבא בתור · " + FIELDS[i];
      val.textContent = values[i];
      val.setAttribute("dir", "auto");
      val.title = values[i];
    }
    txt.appendChild(lbl);
    txt.appendChild(val);

    if (!done && state.i === 0) {
      var hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = "כל הדבקה — השדה הבא";
      txt.appendChild(hint);
    }

    var btns = document.createElement("div");
    btns.className = "btns";
    if (!done) {
      btns.appendChild(
        button("↑", "חזרה לשדה הקודם", function () {
          step_to(prevFilled(values, i));
        })
      );
      btns.appendChild(
        button("↓", "דלג על השדה הזה", function () {
          step_to(nextFilled(values, i + 1));
        })
      );
    }
    btns.appendChild(
      button("↺", "התחל מהשדה הראשון (Alt+Shift+R)", function () {
        step_to(0);
      })
    );

    b.appendChild(step);
    b.appendChild(txt);
    b.appendChild(btns);
    root.appendChild(b);
  }

  function button(label, title, onClick) {
    var el = document.createElement("button");
    el.type = "button";
    el.textContent = label;
    el.title = title;
    el.addEventListener("click", onClick);
    return el;
  }

  /** Move the cursor without pasting anything. */
  function step_to(i) {
    var state = load();
    if (!state) return;
    state.i = Math.max(0, i);
    save(state);
    render(state);
  }

  /* ── The paste itself ──────────────────────────────────────────────────── */

  function onPaste(e) {
    if (!e.clipboardData) return;
    var text = e.clipboardData.getData("text/plain");
    if (!text) return;

    var parsed = parsePayload(text);
    if (!parsed) return; // an ordinary clipboard — leave the paste untouched

    var el = editableTarget(e);
    if (!el) return; // nothing to type into; don't burn a step

    var state = load();
    // A different order was copied, so this is a new sequence from the top.
    if (!state || state.payload !== parsed.key) state = { payload: parsed.key, i: 0 };

    var i = nextFilled(parsed.values, state.i);

    e.preventDefault();
    e.stopPropagation();

    if (i >= parsed.values.length) {
      // Past the last field. Swallowing the paste is the point: letting it
      // through would dump all seven lines into whatever field this is.
      state.i = parsed.values.length;
      save(state);
      render(state);
      return;
    }

    if (!insert(el, parsed.values[i])) return;
    state.i = i + 1;
    save(state);
    render(state);
  }

  document.addEventListener("paste", onPaste, true);

  document.addEventListener(
    "keydown",
    function (e) {
      if (e.altKey && e.shiftKey && (e.key === "R" || e.key === "r")) {
        e.preventDefault();
        step_to(0);
      }
    },
    true
  );

  /* ── Boot ──────────────────────────────────────────────────────────────── */

  function boot() {
    render(pendingRender !== null ? pendingRender : load());
    pendingRender = null;
    // The only proof the script reached this page — the badge stays hidden
    // until the first paste, so without this there is nothing to check.
    console.log("[studio1] sequential paste ready ·", location.host);
  }

  if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot, { once: true });
})();
