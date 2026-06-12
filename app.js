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
const MUNARI_ANCHOR_KEY = "munari_anchor_id";

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

  // Ignorar botones, canvas y links
  if (target.closest("#btn-canvas") || target.closest("a")) return;

  // Si toca directo sobre el editor, dejar que el browser maneje el cursor
  if (target === editor) return;

  // Si toca sobre committed: dejar que el browser maneje libremente (scroll, selección, lectura)
  if (target.closest("#committed")) {
    return;
  }

  if (e.pointerType === "touch") {
    // Solo pendiente de focus si ya está al final
    if (estaAlFinal()) touchPendingFocus = true;
    return;
  }

  // Click en zona vacía en desktop: solo enfocar si ya está al final
  if (!estaAlFinal()) return;
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
  // Recorrer el DOM del editor para extraer texto preservando saltos de línea
  // correctamente, sin depender de innerText que puede romper con divs generados
  // por el browser al presionar Enter después de un link.
  // isRoot indica que estamos en el nodo raíz del editor, donde el browser
  // siempre agrega un BR o DIV vacío final como "caret holder" (no es texto real).
  function extractText(node, isRoot) {
    let text = "";
    const children = Array.from(node.childNodes);
    children.forEach((child, i) => {
      const isLast = i === children.length - 1;
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.nodeValue;
      } else if (child.nodeName === "BR") {
        // Ignorar el BR final del nodo raíz: es el caret holder del browser.
        if (isRoot && isLast) return;
        text += "\n";
      } else if (child.nodeName === "DIV" || child.nodeName === "P") {
        const inner = extractText(child, false);
        // Ignorar DIV/P vacío al final del raíz (solo tenía el BR de caret holder).
        if (isRoot && isLast && inner === "") return;
        text += "\n" + inner;
      } else {
        text += extractText(child, false);
      }
    });
    return text;
  }
  return extractText(editor, true)
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
      editor.scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: "smooth",
      });
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
  const vh = window.visualViewport
    ? window.visualViewport.height
    : window.innerHeight;
  const toolbarH = 40;
  const handleH = isMobile ? 12 : 0;
  const maxPanelWidth = isMobile
    ? Math.min(vw - 32, 420)
    : Math.min(embedInfo.w, 560, vw - 24);
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
        if (
          !e.target.closest("#embed-handle") &&
          !e.target.closest("#embed-toolbar")
        )
          return;
        startY = e.touches[0].clientY;
        startTop = panel.getBoundingClientRect().top;
        panel.style.transition = "none";
      },
      { passive: true },
    );
    panel.addEventListener(
      "touchmove",
      (e) => {
        if (
          !e.target.closest("#embed-handle") &&
          !e.target.closest("#embed-toolbar")
        )
          return;
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
      // Dividir por saltos de línea para preservarlos como <br>
      const lineas = parte.split("\n");
      lineas.forEach((linea, idx) => {
        if (linea) {
          container.appendChild(document.createTextNode(linea));
        }
        // Agregar <br> después de cada línea excepto la última
        if (idx < lineas.length - 1) {
          container.appendChild(document.createElement("br"));
        }
      });
    }
  });
}

function agregarSpan(color, mensaje, id, tipo) {
  if (id && renderedMessageIds.has(id)) return;
  if (id) renderedMessageIds.add(id);

  if (tipo === "munari") {
    mostrarBrunoMunariAnclado(id);
    return;
  }

  mensaje = mensaje.replace(/\u00A0/g, " ").replace(/\u200B/g, "");
  mensaje = mensaje.replace(/\n+$/, "");
  if (mensaje.trim() === "") return;
  const span = document.createElement("span");
  span.className = "msg";
  span.style.color = color;
  if (id) span.dataset.id = id;
  renderConLinks(span, mensaje);
  committedEl.appendChild(span);
}

// Flag para bloquear polling mientras se está guardando
let pollingBloqueado = false;

async function guardar(mensaje, tipo) {
  const now = new Date();
  const fecha = now.toISOString().slice(0, 10);
  const hora = now.toTimeString().slice(0, 8);

  pollingBloqueado = true;
  try {
    const res = await fetch(SUPABASE_URL + "/rest/v1/notas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + SUPABASE_KEY,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        mensaje,
        fecha,
        hora,
        color: colorSesion,
        ...(tipo ? { tipo } : {}),
      }),
    });
    if (res.ok) {
      const rows = await res.json();
      const id = rows?.[0]?.id;
      if (id && id > ultimoId) ultimoId = id;
      agregarSpan(colorSesion, mensaje, id, tipo);
      const localRows = loadLocalMessages();
      if (id && !localRows.some((item) => item.id === id)) {
        localRows.push({ id, mensaje, color: colorSesion, tipo });
        saveLocalMessages(localRows);
      }
      setCanvasImage(true);
      // Sonido de confirmación
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.type = "sine";
        o.frequency.setValueAtTime(880, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
        g.gain.setValueAtTime(0.18, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        o.start(ctx.currentTime);
        o.stop(ctx.currentTime + 0.35);
      } catch (e) {}
      if (!guardadoEstaSesion) {
        guardadoEstaSesion = true;
        localStorage.setItem("ultimo_color", colorSesion);
      }
      return id || null;
    } else {
      const txt = await res.text();
      setStatus("✗ error: " + txt, "#e53935");
      console.error(txt);
      return null;
    }
  } catch (e) {
    setStatus("✗ sin conexión. El mensaje se guarda localmente.", "#e53935");
    const localRows = loadLocalMessages();
    localRows.push({ id: Date.now(), mensaje, color: colorSesion });
    saveLocalMessages(localRows);
    agregarSpan(colorSesion, mensaje);
    console.error(e);
    return null;
  } finally {
    pollingBloqueado = false;
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

// ========================
// CANVAS BUTTON
// ========================

const CANVAS_IMAGES = [
  "img/008000.PNG",
  "img/Qualquer_Coisa.jpg",
  "img/YMOCOVER.jpeg",
  "img/allplastic.PNG",
  "img/baldio.png",
  "img/bart.PNG",
  "img/bart2.PNG",
  "img/boca.jpg",
  "img/cafe.jpg",
  "img/capusotto.PNG",
  "img/chispas.png",
  "img/chispi.PNG",
  "img/chocolino.png",
  "img/compu.jpg",
  "img/cosa.PNG",
  "img/delavega.png",
  "img/dragon.PNG",
  "img/duendes.jpg",
  "img/enano.PNG",
  "img/enano2.PNG",
  "img/existenz.jpg",
  "img/felipe.jpg",
  "img/flor.jpg",
  "img/flores.jpg",
  "img/gato.PNG",
  "img/gatoabeja.JPG",
  "img/gatoblanco.png",
  "img/gatopc.jpg",
  "img/girasol.png",
  "img/godzilla.jpg",
  "img/guaso.jpg",
  "img/icon.jpg",
  "img/jirafa.png",
  "img/kufi.png",
  "img/leon.PNG",
  "img/maiz.png",
  "img/minion.JPG",
  "img/okapi.jpg",
  "img/osito.png",
  "img/pantera.jpg",
  "img/pikacho.png",
  "img/rinoceronte.PNG",
  "img/santaolalla.png",
  "img/sapos.png",
  "img/sms_of_death.jpg",
  "img/vaca.PNG",
  "img/ventana.png",
  "img/vibra.JPG",
  "img/wachin.jpg",
  "img/zorritos.jpg",
];

const btnCanvas = document.getElementById("btn-canvas");
const ctx = btnCanvas.getContext("2d");
const CANVAS_IMAGE_KEY = "naim_canvas_image_index";
const _savedIdx = parseInt(localStorage.getItem(CANVAS_IMAGE_KEY) ?? "-1", 10);
let currentCanvasImageIndex = -1;
let canvasImagesLoaded = {};

function loadCanvasImage(src) {
  if (canvasImagesLoaded[src]) return Promise.resolve(canvasImagesLoaded[src]);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      canvasImagesLoaded[src] = img;
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawCanvasImage(img) {
  const w = btnCanvas.width;
  const h = btnCanvas.height;
  ctx.clearRect(0, 0, w, h);
  if (img) {
    ctx.drawImage(img, 0, 0, w, h);
  } else {
    // Fallback: draw a simple arrow icon
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#888";
    ctx.font = `bold ${Math.round(w * 0.38)}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("↓", w / 2, h / 2);
  }
}

function pickRandomImageIndex(exclude) {
  if (CANVAS_IMAGES.length === 1) return 0;
  let idx;
  do {
    idx = Math.floor(Math.random() * CANVAS_IMAGES.length);
  } while (idx === exclude);
  return idx;
}

async function setCanvasImage(forceNew) {
  const newIdx = forceNew
    ? pickRandomImageIndex(currentCanvasImageIndex)
    : pickRandomImageIndex(_savedIdx);
  currentCanvasImageIndex = newIdx;
  localStorage.setItem(CANVAS_IMAGE_KEY, String(newIdx));
  const src = CANVAS_IMAGES[newIdx];
  const img = await loadCanvasImage(src);
  drawCanvasImage(img);
}

// Init canvas with random image on load
setCanvasImage(false).then(() => {
  mostrarHint();
});

// ========================
// BRUNO MUNARI
// ========================

// Tamaño responsivo del canvas Munari según breakpoints
function munariSize() {
  const w = window.innerWidth;
  if (w >= 1920) return 130;
  if (w >= 1440) return 140;
  if (w >= 1024) return 150;
  if (w >= 768) return 160;
  return 120;
}

function mostrarBrunoMunari() {
  // Si ya hay uno, lo quitamos
  const existing = document.getElementById("munari-panel");
  if (existing) existing.remove();

  const panel = document.createElement("div");
  panel.id = "munari-panel";

  const S = munariSize();
  const cv = document.createElement("canvas");
  cv.width = S;
  cv.height = S;
  panel.appendChild(cv);
  document.body.appendChild(panel);

  const ctx2d = cv.getContext("2d");
  const sc = S / 500;
  let mouseRelY = S / 2;
  let mouseAbsX = window.innerWidth / 2;
  let animId;

  function onMouseMove(e) {
    const rect = cv.getBoundingClientRect();
    mouseRelY = e.clientY - rect.top;
    mouseAbsX = e.clientX;
  }
  document.addEventListener("mousemove", onMouseMove);

  function draw() {
    ctx2d.clearRect(0, 0, S, S);
    ctx2d.fillStyle = "#dcdcdc";
    ctx2d.fillRect(0, 0, S, S);
    ctx2d.strokeStyle = "#000";
    ctx2d.lineWidth = 5 * sc;
    ctx2d.lineCap = "round";

    function line(x1, y1, x2, y2) {
      ctx2d.beginPath();
      ctx2d.moveTo(x1 * sc, y1 * sc);
      ctx2d.lineTo(x2 * sc, y2 * sc);
      ctx2d.stroke();
    }

    [50, 150, 250, 350, 450].forEach((x) => line(x, 50, x, 450));
    [50, 150, 250, 350, 450].forEach((y) => line(50, y, 450, y));
    line(50, 150, 150, 50);
    line(150, 50, 250, 150);
    line(250, 150, 350, 50);
    line(350, 50, 450, 150);
    line(150, 250, 250, 350);
    line(250, 350, 350, 250);
    line(150, 400, 350, 400);

    // El mouse Y controla la posición vertical (mapeado a y=70..250 en espacio 500)
    const mouseY500 = 70 + (mouseRelY / S) * (250 - 70);
    const clampedY = Math.max(70, Math.min(250, mouseY500));

    // El mouse X determina dirección horizontal (relativo al centro de pantalla)
    const rect = cv.getBoundingClientRect();
    const panelCenterX = rect.left + rect.width / 2;
    const rawX = (mouseAbsX - panelCenterX) / (rect.width * 4);
    const clampedX = Math.max(-1, Math.min(1, rawX));
    const DEAD_ZONE = 0.15;

    // Posición de cada ojo: SIEMPRE sobre una línea de la grilla.
    // Fase A (y < 150): baja recto por su columna.
    // Fase B (y >= 150):
    //   - mouse centrado (|x| < DEAD_ZONE): sigue bajando por la columna hasta y=250
    //   - mouse a los lados: se queda FIJO en y=150 y se mueve en X sobre esa línea
    function eyePos(colX) {
      if (clampedY < 150) {
        // Fase A: carril vertical
        return { x: colX * sc, y: clampedY * sc };
      }
      // Fase B
      if (Math.abs(clampedX) < DEAD_ZONE) {
        // Sigue recto por la columna
        return { x: colX * sc, y: clampedY * sc };
      }
      // Dobla en y=150 y rueda horizontalmente
      const tX = Math.min(
        1,
        (Math.abs(clampedX) - DEAD_ZONE) / (1 - DEAD_ZONE),
      );
      const goingLeft = clampedX < 0;
      const xMin = colX === 150 ? 70 : 260;
      const xMax = colX === 150 ? 240 : 430;
      const xTarget = goingLeft ? xMin : xMax;
      const ex = colX + tX * (xTarget - colX);
      return { x: ex * sc, y: 150 * sc }; // y fijo en 150, siempre sobre la línea
    }

    const leftEye = eyePos(150);
    const rightEye = eyePos(350);

    ctx2d.fillStyle = "#000";
    ctx2d.beginPath();
    ctx2d.arc(leftEye.x, leftEye.y, 15 * sc, 0, Math.PI * 2);
    ctx2d.fill();
    ctx2d.beginPath();
    ctx2d.arc(rightEye.x, rightEye.y, 15 * sc, 0, Math.PI * 2);
    ctx2d.fill();

    animId = requestAnimationFrame(draw);
  }

  draw();

  setTimeout(() => {
    panel.remove();
    cancelAnimationFrame(animId);
    document.removeEventListener("mousemove", onMouseMove);
  }, 10000);
}

function mostrarBrunoMunariAnclado(anchorId) {
  const existing = document.getElementById("munari-panel-anclado");
  if (existing) {
    existing._cleanup && existing._cleanup();
    existing.remove();
  }

  const panel = document.createElement("div");
  panel.id = "munari-panel-anclado";
  if (anchorId) panel.dataset.id = anchorId;

  const S = munariSize();
  const cv = document.createElement("canvas");
  cv.width = S;
  cv.height = S;
  panel.appendChild(cv);

  committedEl.appendChild(panel);

  const ctx2d = cv.getContext("2d");
  const sc = S / 500;
  let mouseRelY = S / 2;
  let mouseAbsX = window.innerWidth / 2;
  let animId;

  function onMouseMove(e) {
    mouseRelY = e.clientY - cv.getBoundingClientRect().top;
    mouseAbsX = e.clientX;
  }
  document.addEventListener("mousemove", onMouseMove);

  function draw() {
    ctx2d.clearRect(0, 0, S, S);
    ctx2d.fillStyle = "#dcdcdc";
    ctx2d.fillRect(0, 0, S, S);
    ctx2d.strokeStyle = "#000";
    ctx2d.lineWidth = 5 * sc;
    ctx2d.lineCap = "round";

    function line(x1, y1, x2, y2) {
      ctx2d.beginPath();
      ctx2d.moveTo(x1 * sc, y1 * sc);
      ctx2d.lineTo(x2 * sc, y2 * sc);
      ctx2d.stroke();
    }

    [50, 150, 250, 350, 450].forEach((x) => line(x, 50, x, 450));
    [50, 150, 250, 350, 450].forEach((y) => line(50, y, 450, y));
    line(50, 150, 150, 50);
    line(150, 50, 250, 150);
    line(250, 150, 350, 50);
    line(350, 50, 450, 150);
    line(150, 250, 250, 350);
    line(250, 350, 350, 250);
    line(150, 400, 350, 400);

    const mouseY500 = 70 + (mouseRelY / S) * (250 - 70);
    const clampedY = Math.max(70, Math.min(250, mouseY500));

    const rect = cv.getBoundingClientRect();
    const panelCenterX = rect.left + rect.width / 2;
    const rawX = (mouseAbsX - panelCenterX) / (rect.width * 4);
    const clampedX = Math.max(-1, Math.min(1, rawX));
    const DEAD_ZONE = 0.15;

    function eyePos(colX) {
      if (clampedY < 150) return { x: colX * sc, y: clampedY * sc };
      if (Math.abs(clampedX) < DEAD_ZONE)
        return { x: colX * sc, y: clampedY * sc };
      const tX = Math.min(
        1,
        (Math.abs(clampedX) - DEAD_ZONE) / (1 - DEAD_ZONE),
      );
      const goingLeft = clampedX < 0;
      const xMin = colX === 150 ? 70 : 260;
      const xMax = colX === 150 ? 240 : 430;
      const ex = colX + tX * ((goingLeft ? xMin : xMax) - colX);
      return { x: ex * sc, y: 150 * sc };
    }

    const leftEye = eyePos(150);
    const rightEye = eyePos(350);
    ctx2d.fillStyle = "#000";
    ctx2d.beginPath();
    ctx2d.arc(leftEye.x, leftEye.y, 15 * sc, 0, Math.PI * 2);
    ctx2d.fill();
    ctx2d.beginPath();
    ctx2d.arc(rightEye.x, rightEye.y, 15 * sc, 0, Math.PI * 2);
    ctx2d.fill();

    animId = requestAnimationFrame(draw);
  }

  draw();

  panel._cleanup = () => {
    cancelAnimationFrame(animId);
    document.removeEventListener("mousemove", onMouseMove);
  };
}

const COMANDOS = {
  "/creadores":
    "Creado por <a href='https://agustint96.github.io' target='_blank'>Agustín Tardella</a> y <a href='https://interjuegos.neocities.org/' target='_blank'>Naim Goldraij</a>",
  "/girar": null,
  "/brunomunari": null,
  "/brunomunariporsiempre": null,
};

function girarTexto() {
  // Inyectar keyframe si no existe
  if (!document.getElementById("spin-keyframe")) {
    const style = document.createElement("style");
    style.id = "spin-keyframe";
    style.textContent = `
      @keyframes spinLetter {
        0%   { display: inline-block; transform: rotate(0deg); }
        100% { display: inline-block; transform: rotate(2880deg); }
      }
      .spin-letter {
        display: inline-block;
        animation: spinLetter 4s ease-in-out forwards;
      }
    `;
    document.head.appendChild(style);
  }

  // Envolver cada caracter visible en un span animado
  function envolverTexto(nodo) {
    if (nodo.nodeType === Node.TEXT_NODE) {
      const texto = nodo.nodeValue;
      if (!texto) return;
      const frag = document.createDocumentFragment();
      for (const char of texto) {
        if (char === "\n") {
          frag.appendChild(document.createTextNode("\n"));
        } else {
          const span = document.createElement("span");
          span.className = "spin-letter";
          span.style.animationDelay = (Math.random() * 0.6).toFixed(3) + "s";
          span.textContent = char;
          frag.appendChild(span);
        }
      }
      nodo.parentNode.replaceChild(frag, nodo);
    } else if (
      nodo.nodeType === Node.ELEMENT_NODE &&
      nodo.nodeName !== "SCRIPT" &&
      nodo.nodeName !== "STYLE"
    ) {
      Array.from(nodo.childNodes).forEach(envolverTexto);
    }
  }

  envolverTexto(committedEl);
  envolverTexto(editor);

  // 4000ms duración + 600ms delay máximo + 200ms margen
  setTimeout(
    () => {
      document.querySelectorAll(".spin-letter").forEach((span) => {
        const txt = document.createTextNode(span.textContent);
        span.parentNode.replaceChild(txt, span);
      });
      committedEl.normalize();
      editor.normalize();
    },
    4000 + 600 + 200,
  );
}

function mostrarHintPersonalizado(texto) {
  const hintEl = document.getElementById("btn-hint");
  const hintText = document.getElementById("btn-hint-text");

  hintEl.style.display = "";
  hintEl.style.pointerEvents = "auto";
  hintEl.classList.remove("hint-visible", "hint-hiding");

  setTimeout(() => {
    hintText.innerHTML = texto;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        hintEl.classList.add("hint-visible");
      });
    });

    setTimeout(() => {
      hintEl.classList.add("hint-hiding");
      hintEl.classList.remove("hint-visible");
      setTimeout(() => {
        hintEl.classList.remove("hint-hiding");
        hintEl.style.pointerEvents = "";
      }, 400);
    }, 4000);
  }, 50);
}

// ========================
// HINT DE PRIMER USO
// ========================

function mostrarHint() {
  const hintEl = document.getElementById("btn-hint");
  const hintText = document.getElementById("btn-hint-text");
  const esMobile = "ontouchstart" in window || window.innerWidth < 768;

  const textoFinal = esMobile
    ? "Para guardar tu mensaje presioná la imagen&nbsp;→"
    : 'Para guardar tu mensaje presioná <span class="hint-keys"><kbd>Shift</kbd><span class="hint-plus">+</span><kbd>Enter</kbd></span> o la imagen&nbsp;→';

  const secuencia = [
    "En este sitio podés compartir lo que quieras.",
    "Solo se registran fecha y contenido del mensaje.",
    "Todos los mensajes quedan guardados y no se pueden borrar.",
    textoFinal,
  ];

  let paso = 0;

  function mostrarPaso() {
    // Fade out si ya hay algo visible
    if (paso > 0) {
      hintEl.classList.add("hint-hiding");
      hintEl.classList.remove("hint-visible");
    }

    const delay = paso === 0 ? 0 : 400; // esperar fade-out antes de cambiar texto
    setTimeout(() => {
      hintText.innerHTML = secuencia[paso];
      hintEl.classList.remove("hint-hiding");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          hintEl.classList.add("hint-visible");
        });
      });

      paso++;

      if (paso < secuencia.length) {
        // 2 segundos visible, luego siguiente
        setTimeout(mostrarPaso, 4000);
      } else {
        // Último mensaje (hint del botón): ocultar a los 10 segundos
        setTimeout(() => {
          hintEl.classList.add("hint-hiding");
          hintEl.classList.remove("hint-visible");
          setTimeout(() => {
            hintEl.style.display = "none";
          }, 400);
        }, 10000);
      }
    }, delay);
  }

  mostrarPaso();
}

// Handle canvas click: unificado con confirmar()
// En mobile el browser dispara touchend + click — usamos touchend y cancelamos el click
btnCanvas.addEventListener(
  "touchend",
  (e) => {
    e.preventDefault(); // evita el click fantasma posterior
    confirmar();
  },
  { passive: false },
);

btnCanvas.addEventListener("click", (e) => {
  // En desktop no hay touchend, así que click es el único evento
  if (e.pointerType === "touch") return; // ya lo manejó touchend
  confirmar();
});

let guardando = false;

async function confirmar() {
  if (guardando) return;

  let mensaje = getEditorText();
  const hayTexto = !!mensaje.trim();

  // Sin texto: solo scrollear al final
  if (!hayTexto) {
    if (!estaAlFinal()) {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }
    return;
  }

  // Hay texto: verificar si el editor es visible
  const rect = editor.getBoundingClientRect();
  const vh = window.visualViewport
    ? window.visualViewport.height
    : window.innerHeight;
  const editorVisible = rect.bottom > 0 && rect.top < vh;

  if (!editorVisible) {
    // Editor fuera de pantalla → scrollear hacia él
    editor.scrollIntoView({ block: "center", behavior: "smooth" });
    setTimeout(() => focusEditorAtEnd(), 300);
    return;
  }

  // Editor visible con texto → guardar
  // Trim trailing newlines (browser caret holder artifact)
  mensaje = mensaje.replace(/\n+$/, "");
  if (!mensaje.trim()) return;

  // Verificar si es un comando
  const mensajeLimpio = mensaje.trim().toLowerCase();

  // Caso especial: /brunomunariporsiempre — guarda el mensaje sin el comando
  if (mensajeLimpio.startsWith("/brunomunariporsiempre")) {
    const mensajeSinComando = mensaje
      .trim()
      .slice("/brunomunariporsiempre".length)
      .trim();
    setEditorText("");
    updateHeight();
    focusEditorAtEnd();
    guardando = true;
    guardar(mensajeSinComando || " ", "munari").finally(() => {
      guardando = false;
    });
    return;
  }

  if (mensajeLimpio in COMANDOS) {
    setEditorText("");
    updateHeight();
    focusEditorAtEnd();
    if (mensajeLimpio === "/girar") {
      girarTexto();
    } else if (mensajeLimpio === "/brunomunari") {
      mostrarBrunoMunari();
    } else if (COMANDOS[mensajeLimpio]) {
      mostrarHintPersonalizado(COMANDOS[mensajeLimpio]);
    }
    return;
  }

  guardando = true; // set synchronously before any await to block re-entry
  setEditorText("");
  updateHeight();
  focusEditorAtEnd();
  guardar(mensaje).finally(() => {
    guardando = false;
  });
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
      editor.scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: "smooth",
      });
    }
  }, 200);
});

editor.addEventListener("touchend", () => {
  if (document.activeElement === editor) {
    setTimeout(() => {
      updateHeight();
      scrollToCaret();
      if (editor.scrollIntoView) {
        editor.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: "smooth",
        });
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
    animarYConfirmar();
  }
});

function animarYConfirmar() {
  btnCanvas.classList.add("canvas-pressed");
  setTimeout(() => {
    btnCanvas.classList.remove("canvas-pressed");
  }, 180);
  confirmar();
}

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
      agregarSpan(r.color || "#000", r.mensaje, r.id, r.tipo);
      if (r.id > ultimoId) ultimoId = r.id;
    });
    setStatus("cargando desde caché...", "#888");
  }

  try {
    const res = await fetch(
      SUPABASE_URL + "/rest/v1/notas?select=id,mensaje,color,tipo&order=id.asc",
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
        agregarSpan(r.color || "#000", r.mensaje, r.id, r.tipo);
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
        agregarSpan(r.color || "#000", r.mensaje, r.id);
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
  if (pollingBloqueado) return;
  try {
    const res = await fetch(
      SUPABASE_URL +
        `/rest/v1/notas?select=id,mensaje,color,tipo&id=gt.${ultimoId}&order=id.asc`,
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
          agregarSpan(r.color || "#000", r.mensaje, r.id, r.tipo);
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
