/* client-deck shell: unlock, then home + nav bar + one page frame. Generic: everything client specific is in the payload. */
(function () {
  "use strict";
  const $ = (s, r) => (r || document).querySelector(s);
  const B = document.body;
  const SLUG = B.dataset.slug, ITER = +B.dataset.iter;
  const SALT = Uint8Array.from(atob(B.dataset.salt), (c) => c.charCodeAt(0));
  const KEY_STORE = "client-deck-key-" + SLUG;
  const ROOT = new URL("./", location.href).href;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  let payloadBuf = null;
  async function getPayload() {
    if (!payloadBuf) {
      const r = await fetch("payload.bin", { cache: "no-cache" });
      if (!r.ok) throw new Error("payload " + r.status);
      payloadBuf = await r.arrayBuffer();
    }
    return payloadBuf;
  }
  async function deriveKey(pw) {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt: SALT, iterations: ITER, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, true, ["decrypt"]);
  }
  async function decrypt(key) {
    const buf = await getPayload();
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(buf, 0, 12) }, key, new Uint8Array(buf, 12));
    return JSON.parse(new TextDecoder().decode(plain));
  }
  const b64 = (u8) => btoa(String.fromCharCode.apply(null, u8));

  async function boot() {
    const saved = store.get(KEY_STORE);
    if (saved) {
      try {
        const raw = Uint8Array.from(atob(saved), (c) => c.charCodeAt(0));
        const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
        return start(await decrypt(key));
      } catch (e) { if (!payloadBuf) return offlineFail(e); store.del(KEY_STORE); }
    }
    showLock();
  }
  function offlineFail() { $("#boot").innerHTML = '<p class="boot-msg">אין חיבור. פתחו את הדף פעם אחת עם אינטרנט.</p>'; }

  function showLock() {
    $("#boot").hidden = true;
    $("#lock").hidden = false;
    setTimeout(() => $("#pw").focus(), 50);
    $("#lockForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $("#unlockBtn");
      btn.disabled = true; btn.textContent = "פותח...";
      $("#lockErr").hidden = true;
      try {
        const key = await deriveKey($("#pw").value);
        const data = await decrypt(key);
        if ($("#remember").checked) store.set(KEY_STORE, b64(new Uint8Array(await crypto.subtle.exportKey("raw", key))));
        $("#lock").classList.add("out");
        setTimeout(() => { $("#lock").hidden = true; start(data); }, 250);
      } catch (err) {
        $("#lockErr").hidden = false;
        $("#lockForm").classList.remove("shake"); void $("#lockForm").offsetWidth; $("#lockForm").classList.add("shake");
        btn.disabled = false; btn.textContent = "כניסה";
      }
    });
  }

  // ---------- the deck
  const ICONS = {
    map: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
    offer: '<path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h5"/>',
    costs: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.6-1-1.7-1.5-3-1.5-1.7 0-3 .9-3 2s1.3 1.7 3 2 3 .9 3 2-1.3 2-3 2c-1.3 0-2.4-.5-3-1.5M12 6v12"/>',
    questions: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01"/>',
    arch: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="8.5" y="14" width="7" height="7" rx="1"/><path d="M6.5 10v2h11v-2M12 12v2"/>',
    data: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    hld: '<path d="M3 20h18M6 20V10M12 20V4M18 20v-7"/>',
    book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>',
    home: '<path d="M3 11l9-8 9 8M5 9.5V21h5v-6h4v6h5V9.5"/>',
    back: '<path d="M9 5l7 7-7 7"/>',
    prev: '<path d="M9 5l7 7-7 7"/>',
    next: '<path d="M15 5l-7 7 7 7"/>',
    full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    exit: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
    docs: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  };
  const svg = (n, cls) => '<svg class="' + (cls || "ic") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[n] || ICONS.offer) + "</svg>";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  let C, LOGO, DOCS, ORDER, blobs = {}, frame = null, current = null;

  function start(data) {
    C = data.config;
    LOGO = data.logo || "";
    DOCS = Object.fromEntries(C.documents.map((d) => [d.id, d]));
    ORDER = C.documents.map((d) => d.id);
    document.title = C.pageTitle;
    $("#boot").hidden = true;
    const app = $("#app");
    app.hidden = false;
    app.innerHTML =
      '<nav class="bar" aria-label="ניווט">' +
        '<div class="bar-group">' +
          '<button class="nb" data-act="back" aria-label="חזרה">' + svg("back") + '<span>חזרה</span></button>' +
          '<a class="nb" href="#/" data-nav="home" aria-label="בית">' + svg("home") + '<span>בית</span></a>' +
          '<a class="bar-wm wm" href="#/" aria-label="' + esc(C.brand) + '">' + esc(C.brand) + "</a>" +
        "</div>" +
        '<div class="bar-group bar-main">' +
          C.nav.map((n) => '<a class="nb pill" href="' + (n.page === "docs" ? "#/docs" : "#/p/" + n.page) + '" data-nav="' + n.page + '">' + svg(n.page === "docs" ? "docs" : (DOCS[n.page] || {}).icon) + "<span>" + esc(n.label) + "</span></a>").join("") +
        "</div>" +
        '<div class="bar-group bar-end">' +
          '<button class="nb sq" data-act="prev" aria-label="הקודם">' + svg("prev") + "</button>" +
          '<button class="nb sq" data-act="next" aria-label="הבא">' + svg("next") + "</button>" +
          '<button class="nb sq" data-act="full" aria-label="מסך מלא">' + svg("full") + "</button>" +
        "</div>" +
      "</nav>" +
      '<main id="stage" class="stage"><section id="home" class="home"></section></main>';

    app.addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      const act = b.dataset.act;
      if (act === "back") { if (history.length > 1 && location.hash && location.hash !== "#/") history.back(); else go("#/"); }
      if (act === "full") toggleFull();
      if (act === "prev" || act === "next") step(act === "next" ? 1 : -1);
    });
    window.addEventListener("message", (e) => {
      if (e.origin !== location.origin && e.origin !== "null") return;
      const id = e.data && e.data.deck;
      if (id && (DOCS[id] || id === "docs" || id === "home")) go(id === "home" ? "#/" : id === "docs" ? "#/docs" : "#/p/" + id);
    });
    document.addEventListener("keydown", (e) => {
      if (e.target.closest && e.target.closest("input,textarea")) return;
      if (e.key === "ArrowLeft") step(1);
      if (e.key === "ArrowRight") step(-1);
    });
    const fs = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
    const standalone = matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches || navigator.standalone;
    if (!fs || standalone) $('[data-act="full"]').hidden = true;
    document.addEventListener("fullscreenchange", syncFull);
    document.addEventListener("webkitfullscreenchange", syncFull);
    renderHome(false);
    window.addEventListener("hashchange", route);
    route();
  }

  function go(h) { if (location.hash === h) route(); else location.hash = h; }
  function step(d) {
    const i = current ? ORDER.indexOf(current) : -1;
    const n = i + d;
    if (n < 0) return go("#/");
    if (n >= ORDER.length) return;
    go("#/p/" + ORDER[n]);
  }
  function isFull() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function toggleFull() {
    const el = document.documentElement;
    if (isFull()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
  }
  function syncFull() { const b = $('[data-act="full"]'); if (b) b.innerHTML = svg(isFull() ? "exit" : "full"); }

  function card(id, i) {
    const d = DOCS[id];
    return '<a class="card' + (d.accent ? " card-accent" : "") + '" href="#/p/' + id + '" style="--i:' + i + '">' +
      '<span class="card-ic">' + svg(d.icon, "ic-lg") + "</span>" +
      '<span class="card-tx"><b>' + esc(d.title) + "</b><small>" + esc(d.desc) + "</small></span>" +
      '<span class="card-go">' + svg("next") + "</span></a>";
  }
  function renderHome(docsOnly) {
    const h = $("#home");
    let i = 0;
    const secs = C.sections.filter((s) => !docsOnly || s.id === "docs");
    h.innerHTML =
      '<header class="hero">' +
        '<div class="hero-brand"><span class="hero-mark">' + LOGO + '</span><span class="wm hero-wm">' + esc(C.brand) + "</span></div>" +
        "<h1>" + esc(docsOnly ? secs[0].title : C.title) + "</h1><p>" + esc(docsOnly ? "המסמכים המלאים, לקריאה ולעיון" : C.subtitle) + "</p>" +
      "</header>" +
      secs.map((s) => '<section class="sec"><h2>' + esc(s.title) + '</h2><div class="grid">' + s.pages.map((p) => card(p, i++)).join("") + "</div></section>").join("");
    h.dataset.mode = docsOnly ? "docs" : "home";
  }

  function blobFor(id) {
    if (!blobs[id]) {
      const html = window.__deckPages[id].split("__ROOT__").join(ROOT);
      blobs[id] = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    }
    return blobs[id];
  }

  function setActive(key) {
    document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("on", a.dataset.nav === key));
    const i = current ? ORDER.indexOf(current) : -1;
    $('[data-act="prev"]').disabled = i < 0;
    $('[data-act="next"]').disabled = i >= ORDER.length - 1;
  }

  function route() {
    const h = location.hash || "#/";
    const m = h.match(/^#\/p\/([\w-]+)/);
    const home = $("#home");
    if (m && DOCS[m[1]]) {
      current = m[1];
      document.title = DOCS[current].title + " | " + C.name;
      home.classList.add("away");
      const f = document.createElement("iframe");
      f.className = "frame";
      f.title = DOCS[current].title;
      f.src = blobFor(current);
      const old = frame;
      frame = f;
      f.addEventListener("load", () => {
        f.classList.add("in");
        if (old) { old.classList.remove("in"); setTimeout(() => old.remove(), 260); }
        try { f.contentWindow.focus(); } catch (e) {}
      }, { once: true });
      $("#stage").appendChild(f);
      setActive(current);
    } else {
      current = null;
      document.title = C.pageTitle;
      const docsOnly = h.startsWith("#/docs");
      renderHome(docsOnly);
      home.classList.remove("away");
      home.scrollTop = 0;
      if (frame) { const old = frame; frame = null; old.classList.remove("in"); setTimeout(() => old.remove(), 260); }
      setActive(docsOnly ? "docs" : "home");
    }
  }

  const _start = start;
  start = function (data) { window.__deckPages = data.pages; delete data.pages; _start(data); };

  boot().catch(offlineFail);
})();
