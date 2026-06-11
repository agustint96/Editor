const SUPABASE_URL = "https://iypxmjxmhlkhkiwadann.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5cHhtanhtaGxraGtpd2FkYW5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjk4NTcsImV4cCI6MjA5NjcwNTg1N30.nEahrHZdBETYGRFNtkAKHT8Tig_0crHa5PA9gQ0PVXE";

const committedEl = document.getElementById("committed");
const editor = document.getElementById("editor");
const statusEl = document.getElementById("status");

const TAB = "    ";
let guardadoEstaSesion = false;

const colorAnterior = localStorage.getItem("ultimo_color");
const colorSesion = colorAnterior === "#000" ? "#000" : "#000";

const LOCAL_MESSAGES_KEY = "naim_editor_messages";

function saveLocalMessages(rows) {
  try {
    localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(rows));
  } catch (error) {
    console.warn("No se pudo guardar cache local:", error);
  }
}

function loadLocalMessages() {
  try {
    const raw = localStorage.getItem(LOCAL_MESSAGES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (error) {
    console.warn("No se pudo leer cache local:", error);
    return [];
  }
}

let touchStartX = 0;
let touchStartY = 0;
let touchMoved = false;
let touchPendingFocus = false;

document.addEventListener("pointerdown", (e) => {
  const target = e.target;

  if (e.pointerType === "touch") {
    touchMoved = false;
    touchPendingFocus = false;
    touchStartX = e.clientX;
    touchStartY = e.clientY;
  }

  // Ignorar botones y links
  if (
    target.closest("#btn-desktop") ||
    target.closest("#btn-mobile") ||
    target.closest("a")
  )
    return;

  // Si toca directo sobre el editor, dejar que el browser maneje el cursor
  if (target === editor) return;

  // Si toca sobre committed: mover cursor al final sin flickear el teclado
  if (target.closest("#committed")) {
    e.preventDefault();
    focusEditorAtEnd();
    return;
  }

  if (e.pointerType === "touch") {
    touchPendingFocus = true;
    return;
  }

  // Tap en zona vacía de la página en desktop: enfocar editor
  e.preventDefault();
  focusEditorAtEnd();
});

document.addEventListener("pointermove", (e) => {
  if (e.pointerType !== "touch" || !touchPendingFocus) return;
  const dx = Math.abs(e.clientX - touchStartX);
  const dy = Math.abs(e.clientY - touchStartY);
  if (dx > 10 || dy > 10) {
    touchMoved = true;
    touchPendingFocus = false;
  }
});

document.addEventListener("pointerup", (e) => {
  if (e.pointerType !== "touch" || !touchPendingFocus) return;
  if (!touchMoved) {
    e.preventDefault();
    setTimeout(() => {
      focusEditorAtEnd();
    }, 60);
  }
  touchPendingFocus = false;
});

function getEditorText() {
  return editor.innerText
    .replace(/\u00A0/g, " ")
    .replace(/\u200B/g, "");
}

function setEditorText(text) {
  editor.innerText = text;
}

function focusEditorAtEnd() {
  editor.focus();
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
  requestAnimationFrame(() => {
    if (editor.scrollIntoView) {
      editor.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    }
  });
}

function updateHeight() {
  const editorPage = document.getElementById("page");
  document.body.style.minHeight = editorPage.offsetHeight + 120 + "px";
}

function scrollToCaret() {
  requestAnimationFrame(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const vvh = window.visualViewport
      ? window.visualViewport.height
      : window.innerHeight;
    const margin = 100;
    if (rect.bottom > vvh - margin) {
      const extra = rect.bottom - (vvh - margin);
      window.scrollTo({ top: window.scrollY + extra, behavior: "smooth" });
    }
  });
}

function setStatus(msg, color) {
  statusEl.textContent = msg;
  statusEl.style.color = color || "#aaa";
  if (msg && color !== "#aaa")
    setTimeout(() => {
      statusEl.textContent = "";
    }, 3000);
}

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function getEmbedInfo(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace("www.", "");

    // YouTube
    const ytMatch = url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    );
    if (ytMatch)
      return {
        type: "iframe",
        src: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0&playsinline=1&enablejsapi=1`,
        w: 560,
        h: 315,
      };

    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch)
      return {
        type: "iframe",
        src: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`,
        w: 560,
        h: 315,
      };

    // Spotify
    if (host === "open.spotify.com") {
      const path = u.pathname;
      const src = `https://open.spotify.com/embed${path}`;
      const isTrack = path.startsWith("/track") || path.startsWith("/episode");
      return { type: "iframe", src, w: 400, h: isTrack ? 152 : 380 };
    }

    // SoundCloud
    if (host === "soundcloud.com") {
      const src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=true&visual=true`;
      return { type: "iframe", src, w: 400, h: 166 };
    }

    // Twitter/X
    if (host === "twitter.com" || host === "x.com") {
      return { type: "twitter", url, w: 400, h: 320 };
    }

    // Instagram
    if (host === "instagram.com" && u.pathname.includes("/p/")) {
      const src = `${url.split("?")[0]}embed/`;
      return { type: "iframe", src, w: 400, h: 480 };
    }
  } catch (e) {}
  return null;
}

let activePlayer = null;
const renderedMessageIds = new Set();

function openEmbed(embedInfo, url) {
  const isMobile = "ontouchstart" in window || window.innerWidth < 768;

  if (activePlayer) activePlayer.remove();

  const panel = document.createElement("div");
  panel.id = "embed-player";
  if (isMobile) panel.classList.add("embed-mobile");

  const toolbar = document.createElement("div");
  toolbar.id = "embed-toolbar";

  const titleEl = document.createElement("span");
  titleEl.id = "embed-title";
  try {
    titleEl.textContent = new URL(url).hostname.replace("www.", "");
  } catch (e) {}

  const btnExt = document.createElement("a");
  btnExt.href = url;
  btnExt.target = "_blank";
  btnExt.rel = "noopener noreferrer";
  btnExt.id = "embed-ext";
  btnExt.textContent = "↗";
  btnExt.title = "Abrir en nueva pestaña";

  const btnClose = document.createElement("button");
  btnClose.id = "embed-close";
  btnClose.textContent = "✕";
  btnClose.onclick = () => {
    panel.remove();
    activePlayer = null;
  };

  toolbar.appendChild(titleEl);
  toolbar.appendChild(btnExt);
  toolbar.appendChild(btnClose);
  panel.appendChild(toolbar);

  if (isMobile) {
    const handle = document.createElement("div");
    handle.id = "embed-handle";
    panel.appendChild(handle);
  }

  const content = document.createElement("div");
  content.id = "embed-content";

  if (embedInfo.type === "twitter") {
    const tweetContainer = document.createElement("div");
    tweetContainer.style.cssText = "overflow:auto;height:100%;padding:8px;";
    const blockquote = document.createElement("blockquote");
    blockquote.className = "twitter-tweet";
    const a = document.createElement("a");
    a.href = embedInfo.url;
    blockquote.appendChild(a);
    tweetContainer.appendChild(blockquote);
    content.appendChild(tweetContainer);
    if (!document.getElementById("twitter-widgets-js")) {
      const script = document.createElement("script");
      script.id = "twitter-widgets-js";
      script.src = "https://platform.twitter.com/widgets.js";
      script.async = true;
      document.body.appendChild(script);
    } else if (window.twttr) {
      window.twttr.widgets.load(tweetContainer);
    }
  } else {
    const iframe = document.createElement("iframe");
    iframe.src = embedInfo.src;
    iframe.width = "100%";
    iframe.height = "100%";
    iframe.frameBorder = "0";
    iframe.allow =
      "autoplay; encrypted-media; fullscreen; clipboard-write; picture-in-picture";
    iframe.allowFullscreen = true;
    content.appendChild(iframe);
  }

  panel.appendChild(content);
  document.body.appendChild(panel);
  activePlayer = panel;

  const vw = window.innerWidth;
  const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  const toolbarH = 40;
  const handleH = isMobile ? 12 : 0;
  const maxPanelWidth = isMobile ? Math.min(vw - 32, 420) : Math.min(embedInfo.w, 560, vw - 24);
  let contentH = Math.round((embedInfo.h * maxPanelWidth) / embedInfo.w);
  if (isMobile) {
    contentH = Math.min(contentH, Math.round(vh * 0.48), 340);
  }
  const panelHeight = toolbarH + handleH + contentH;

  panel.style.width = maxPanelWidth + "px";
  panel.style.height = panelHeight + "px";
  panel.style.top = "12px";
  panel.style.left = "50%";
  panel.style.transform = "translateX(-50%)";
  panel.style.bottom = "auto";

  if (isMobile) {
    panel.style.right = "auto";
  }

  if (isMobile) {
    let startY = 0;
    let startTop = 0;
    panel.addEventListener(
      "touchstart",
      (e) => {
        if (!e.target.closest("#embed-handle") && !e.target.closest("#embed-toolbar")) return;
        startY = e.touches[0].clientY;
        startTop = panel.getBoundingClientRect().top;
        panel.style.transition = "none";
      },
      { passive: true },
    );
    panel.addEventListener(
      "touchmove",
      (e) => {
        if (!e.target.closest("#embed-handle") && !e.target.closest("#embed-toolbar")) return;
        const dy = e.touches[0].clientY - startY;
        if (dy > 0) {
          panel.style.bottom = "auto";
          panel.style.top = startTop + dy + "px";
        }
      },
      { passive: true },
    );
    panel.addEventListener(
      "touchend",
      (e) => {
        const dy = e.changedTouches[0].clientY - startY;
        if (dy > 80) {
          panel.remove();
          activePlayer = null;
        } else {
          panel.style.transition = "top 0.2s ease";
          panel.style.top = "auto";
          panel.style.bottom = "12px";
        }
      },
      { passive: true },
    );
  } else {
    let dragOffX = 0,
      dragOffY = 0,
      dragging = false;
    toolbar.addEventListener("mousedown", (e) => {
      dragging = true;
      dragOffX = e.clientX - panel.getBoundingClientRect().left;
      dragOffY = e.clientY - panel.getBoundingClientRect().top;
      panel.style.transition = "none";
      e.preventDefault();
    });
    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      panel.style.left = e.clientX - dragOffX + "px";
      panel.style.top = e.clientY - dragOffY + "px";
    });
    document.addEventListener("mouseup", () => {
      dragging = false;
    });
  }
}

function renderConLinks(container, texto) {
  const partes = texto.split(URL_REGEX);
  partes.forEach((parte) => {
    URL_REGEX.lastIndex = 0;
    if (URL_REGEX.test(parte)) {
      const embedInfo = getEmbedInfo(parte);
      const a = document.createElement("a");
      a.href = parte;
      a.textContent = parte;
      a.rel = "noopener noreferrer";
      if (embedInfo) {
        a.onclick = (e) => {
          e.preventDefault();
          openEmbed(embedInfo, parte);
        };
      } else {
        a.target = "_blank";
      }
      container.appendChild(a);
    } else {
      container.appendChild(document.createTextNode(parte));
    }
  });
}

function agregarSpan(color, mensaje, id) {
  mensaje = mensaje.replace(/\u00A0/g, " ").replace(/\u200B/g, "");
  if (mensaje === "") return;
  if (id && renderedMessageIds.has(id)) return;
  if (id) renderedMessageIds.add(id);
  const span = document.createElement("span");
  span.className = "msg";
  span.style.color = color;
  renderConLinks(span, mensaje);
  committedEl.appendChild(span);
}

async function guardar(mensaje) {
  const now = new Date();
  const fecha = now.toISOString().slice(0, 10);
  const hora = now.toTimeString().slice(0, 8);
  try {
    const res = await fetch(SUPABASE_URL + "/rest/v1/notas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + SUPABASE_KEY,
        Prefer: "return=representation",
      },
      body: JSON.stringify({ mensaje, fecha, hora, color: colorSesion }),
    });
    if (res.ok) {
      const rows = await res.json();
      const id = rows?.[0]?.id;
      if (id && id > ultimoId) ultimoId = id;
      agregarSpan(colorSesion, mensaje);
      const localRows = loadLocalMessages();
      if (id && !localRows.some((item) => item.id === id)) {
        localRows.push({ id, mensaje, color: colorSesion });
        saveLocalMessages(localRows);
      }
      setStatus("✓ guardado", "#4caf50");
      if (!guardadoEstaSesion) {
        guardadoEstaSesion = true;
        localStorage.setItem("ultimo_color", colorSesion);
      }
    } else {
      const txt = await res.text();
      setStatus("✗ error: " + txt, "#e53935");
      console.error(txt);
    }
  } catch (e) {
    setStatus("✗ sin conexión. El mensaje se guarda localmente.", "#e53935");
    const localRows = loadLocalMessages();
    localRows.push({ id: Date.now(), mensaje, color: colorSesion });
    saveLocalMessages(localRows);
    agregarSpan(colorSesion, mensaje);
    console.error(e);
  }
}

function insertTextAtCursor(text) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
  updateHeight();
  scrollToCaret();
}

async function confirmar() {
  const mensaje = getEditorText();
  if (!mensaje.trim()) return;
  setEditorText("");
  updateHeight();
  focusEditorAtEnd();
  await polling();
  guardar(mensaje);
}

editor.addEventListener("input", () => {
  updateHeight();
  scrollToCaret();
});

editor.addEventListener("focus", () => {
  setTimeout(() => {
    updateHeight();
    scrollToCaret();
    if (editor.scrollIntoView) {
      editor.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    }
  }, 200);
});

editor.addEventListener("touchend", () => {
  if (document.activeElement === editor) {
    setTimeout(() => {
      updateHeight();
      scrollToCaret();
      if (editor.scrollIntoView) {
        editor.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
      }
    }, 150);
  }
});

editor.addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    insertTextAtCursor(TAB);
  }
  if (e.key === "Enter" && e.shiftKey && !("ontouchstart" in window)) {
    e.preventDefault();
    confirmar();
  }
});

let ultimoId = 0;

function estaAlFinal() {
  return window.scrollY + window.innerHeight >= document.body.scrollHeight - 60;
}

async function cargar() {
  setStatus("cargando...", "#aaa");
  const localRows = loadLocalMessages();
  if (localRows.length) {
    committedEl.innerHTML = "";
    ultimoId = 0;
    localRows.forEach((r) => {
      agregarSpan(r.color || "#000", r.mensaje, r.id);
      if (r.id > ultimoId) ultimoId = r.id;
    });
    setStatus("cargando desde caché...", "#888");
  }

  try {
    const res = await fetch(
      SUPABASE_URL + "/rest/v1/notas?select=id,mensaje,color&order=id.asc",
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: "Bearer " + SUPABASE_KEY,
        },
      },
    );
    if (res.ok) {
      const rows = await res.json();
      if (!localRows.length) {
        committedEl.innerHTML = "";
      }
      rows.forEach((r) => {
        agregarSpan(r.color || "#000", r.mensaje, r.id);
        if (r.id > ultimoId) ultimoId = r.id;
      });
      saveLocalMessages(rows);
      setStatus("", "");
      requestAnimationFrame(() => {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: "instant",
        });
        focusEditorAtEnd();
      });
    } else {
      const txt = await res.text();
      setStatus("✗ error al cargar: " + txt, "#e53935");
    }
  } catch (e) {
    console.error(e);
    const localRows = loadLocalMessages();
    if (localRows.length > 0) {
      committedEl.innerHTML = "";
      ultimoId = 0;
      localRows.forEach((r) => {
        agregarSpan(r.color || "#000", r.mensaje);
        if (r.id && r.id > ultimoId) ultimoId = r.id;
      });
      setStatus("Offline. Mostrando caché local.", "#e53935");
    } else {
      setStatus("✗ sin conexión. No hay datos locales.", "#e53935");
    }
    editor.focus();
    updateHeight();
  }
}

async function polling() {
  try {
    const res = await fetch(
      SUPABASE_URL +
        `/rest/v1/notas?select=id,mensaje,color&id=gt.${ultimoId}&order=id.asc`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: "Bearer " + SUPABASE_KEY,
        },
      },
    );
    if (res.ok) {
      const rows = await res.json();
      if (rows.length > 0) {
        const alFinal = estaAlFinal();
        rows.forEach((r) => {
          agregarSpan(r.color || "#000", r.mensaje);
          if (r.id > ultimoId) ultimoId = r.id;
        });
        if (alFinal) {
          requestAnimationFrame(() => {
            window.scrollTo({
              top: document.body.scrollHeight,
              behavior: "smooth",
            });
          });
        }
      }
    }
  } catch (e) {
    console.error("polling error:", e);
  }
}

updateHeight();
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", () => {
    updateHeight();
    if (document.activeElement === editor) {
      setTimeout(scrollToCaret, 100);
    }
  });
}
cargar().then(() => {
  setInterval(polling, 5000);
});
