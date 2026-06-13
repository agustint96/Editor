// ========================
// EMBEDS (links → reproductores)
// ========================

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

export function getEmbedInfo(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace("www.", "");

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

    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch)
      return {
        type: "iframe",
        src: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`,
        w: 560,
        h: 315,
      };

    if (host === "open.spotify.com") {
      const path = u.pathname;
      const isTrack = path.startsWith("/track") || path.startsWith("/episode");
      return {
        type: "iframe",
        src: `https://open.spotify.com/embed${path}`,
        w: 400,
        h: isTrack ? 152 : 380,
      };
    }

    if (host === "soundcloud.com") {
      return {
        type: "iframe",
        src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=true&visual=true`,
        w: 400,
        h: 166,
      };
    }

    if (host === "twitter.com" || host === "x.com") {
      return { type: "twitter", url, w: 400, h: 320 };
    }

    if (host === "instagram.com" && u.pathname.includes("/p/")) {
      return {
        type: "iframe",
        src: `${url.split("?")[0]}embed/`,
        w: 400,
        h: 480,
      };
    }
  } catch (e) {}
  return null;
}

let activePlayer = null;

export function openEmbed(embedInfo, url) {
  const isMobile = "ontouchstart" in window || window.innerWidth < 768;

  if (activePlayer) activePlayer.remove();

  const panel = document.createElement("div");
  panel.id = "embed-player";
  if (isMobile) panel.classList.add("embed-mobile");

  // ── Toolbar (solo desktop) ──
  let toolbar = null;
  if (!isMobile) {
    toolbar = document.createElement("div");
    toolbar.id = "embed-toolbar";

    const dragIcon = document.createElement("div");
    dragIcon.id = "embed-drag-icon";
    dragIcon.innerHTML = `<span><i></i><i></i><i></i></span><span><i></i><i></i><i></i></span>`;

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

    const btnClose = document.createElement("button");
    btnClose.id = "embed-close";
    btnClose.textContent = "✕";
    btnClose.onclick = () => {
      panel.remove();
      activePlayer = null;
    };

    toolbar.appendChild(dragIcon);
    toolbar.appendChild(titleEl);
    toolbar.appendChild(btnExt);
    toolbar.appendChild(btnClose);
    panel.appendChild(toolbar);
  }

  // ── Contenido ──
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

  // ── Resize handle (solo desktop) ──
  if (!isMobile) {
    const resizeHandle = document.createElement("div");
    resizeHandle.id = "embed-resize-handle";
    resizeHandle.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="10" cy="10" r="1.5" fill="#333"/><circle cx="6" cy="10" r="1.5" fill="#333"/><circle cx="10" cy="6" r="1.5" fill="#333"/><circle cx="2" cy="10" r="1.5" fill="#333"/><circle cx="6" cy="6" r="1.5" fill="#333"/><circle cx="10" cy="2" r="1.5" fill="#333"/></svg>`;
    content.appendChild(resizeHandle);

    let resizing = false,
      rsX = 0,
      rsY = 0,
      rsW = 0,
      rsH = 0;
    resizeHandle.addEventListener("mousedown", (e) => {
      resizing = true;
      rsX = e.clientX;
      rsY = e.clientY;
      rsW = panel.offsetWidth;
      rsH = panel.offsetHeight;
      panel.style.transition = "none";
      e.preventDefault();
      e.stopPropagation();
    });
    document.addEventListener("mousemove", (e) => {
      if (!resizing) return;
      panel.style.width = Math.max(280, rsW + e.clientX - rsX) + "px";
      panel.style.height = Math.max(120, rsH + e.clientY - rsY) + "px";
    });
    document.addEventListener("mouseup", () => {
      resizing = false;
    });
  }

  // ── Botón cerrar + handles mobile ──
  if (isMobile) {
    const btnClose = document.createElement("button");
    btnClose.id = "embed-close-mobile";
    btnClose.textContent = "✕";
    btnClose.addEventListener("click", (e) => {
      e.stopPropagation();
      panel.remove();
      activePlayer = null;
    });
    panel.appendChild(btnClose);

    // Handle de arrastre: barra visible en la parte inferior, z-index sobre el iframe
    const dragHandle = document.createElement("div");
    dragHandle.id = "embed-handle";
    panel.appendChild(dragHandle);

    // Handle de resize: esquina inferior derecha, siempre visible en mobile
    const resizeHandleMobile = document.createElement("div");
    resizeHandleMobile.id = "embed-resize-mobile";
    resizeHandleMobile.innerHTML = `<svg width="14" height="14" viewBox="0 0 12 12" fill="none"><circle cx="10" cy="10" r="1.5" fill="#fff"/><circle cx="6" cy="10" r="1.5" fill="#fff"/><circle cx="10" cy="6" r="1.5" fill="#fff"/></svg>`;
    panel.appendChild(resizeHandleMobile);
  }

  document.body.appendChild(panel);
  activePlayer = panel;

  // ── Tamaño y posición inicial (via JS para que el drag funcione) ──
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Calcular el margen según breakpoint (igual que el CSS)
  function getMargin() {
    const w = window.innerWidth;
    if (w >= 1920) return 35; // 2.2rem
    if (w >= 1440) return 32; // 2rem
    if (w >= 1024) return 29; // 1.8rem
    if (w >= 768) return 26; // 1.6rem
    return 22; // 1.4rem
  }

  const margin = getMargin();

  if (isMobile) {
    const size = Math.min(120, vw - 8); // nunca más ancho que la pantalla
    panel.style.width = size + "px";
    panel.style.height = size + "px";
    // Posición fija inicial: esquina superior derecha, clampeada para no salirse
    panel.style.position = "fixed";
    panel.style.top = margin + "px";
    panel.style.left = Math.max(0, vw - size - margin) + "px";
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  } else {
    const toolbarH = 44;
    const maxW = Math.min(embedInfo.w, 280, vw - 24);
    const panelH = toolbarH + Math.round((embedInfo.h / embedInfo.w) * maxW);
    panel.style.width = maxW + "px";
    panel.style.height = panelH + "px";
    // Posición fija inicial: esquina superior derecha
    panel.style.position = "fixed";
    panel.style.top = margin + "px";
    panel.style.left = vw - maxW - margin + "px";
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  }

  // ── Drag + Resize mobile ──
  if (isMobile) {
    const SIZE_MIN = Math.min(80, vw - 8);
    const SIZE_MAX = Math.min(vw - 8, Math.round(vw * 0.92));

    const dragHandle = panel.querySelector("#embed-handle");
    const resizeHandleMobile = panel.querySelector("#embed-resize-mobile");

    // Overlay PERMANENTE sobre el iframe en mobile para que los touch events
    // no queden capturados por el iframe de YouTube (problema en MIUI/HyperOS).
    // Solo se desactiva mientras el usuario toca directamente el iframe (un dedo,
    // sin tocar ningún handle), para permitir la interacción normal con el video.
    const gestureOverlay = document.createElement("div");
    gestureOverlay.id = "embed-gesture-overlay";
    gestureOverlay.style.cssText =
      "position:absolute;inset:0;z-index:4;touch-action:none;";
    panel.appendChild(gestureOverlay);

    // ── Drag desde el handle inferior ──
    let startX = 0,
      startY = 0,
      startLeft = 0,
      startTop = 0,
      draggingTouch = false;

    dragHandle.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length !== 1) return;
        draggingTouch = true;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        startLeft = panel.offsetLeft;
        startTop = panel.offsetTop;
        e.stopPropagation();
      },
      { passive: true },
    );

    dragHandle.addEventListener(
      "touchmove",
      (e) => {
        if (!draggingTouch || e.touches.length !== 1) return;
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;
        panel.style.left =
          Math.max(0, Math.min(startLeft + dx, vw - panel.offsetWidth)) + "px";
        panel.style.top = Math.max(0, startTop + dy) + "px";
        e.preventDefault();
      },
      { passive: false },
    );

    dragHandle.addEventListener(
      "touchend",
      () => {
        draggingTouch = false;
      },
      { passive: true },
    );

    // ── Resize desde el handle de esquina (esquina inferior derecha) ──
    // Este handle está encima del overlay, así que siempre recibe los eventos.
    let resizing = false,
      rsStartX = 0,
      rsStartY = 0,
      rsStartW = 0,
      rsStartH = 0;

    resizeHandleMobile.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length !== 1) return;
        resizing = true;
        rsStartX = e.touches[0].clientX;
        rsStartY = e.touches[0].clientY;
        rsStartW = panel.offsetWidth;
        rsStartH = panel.offsetHeight;
        e.stopPropagation();
        e.preventDefault();
      },
      { passive: false },
    );

    resizeHandleMobile.addEventListener(
      "touchmove",
      (e) => {
        if (!resizing || e.touches.length !== 1) return;
        const dx = e.touches[0].clientX - rsStartX;
        const dy = e.touches[0].clientY - rsStartY;
        const newW = Math.max(SIZE_MIN, Math.min(SIZE_MAX, rsStartW + dx));
        const newH = Math.max(
          SIZE_MIN,
          Math.min(window.innerHeight - panel.offsetTop - 8, rsStartH + dy),
        );
        panel.style.width = newW + "px";
        panel.style.height = newH + "px";
        e.preventDefault();
      },
      { passive: false },
    );

    resizeHandleMobile.addEventListener(
      "touchend",
      () => {
        resizing = false;
      },
      { passive: true },
    );

    // ── Tap en el overlay: pasa el tap al iframe subyacente para play/pause ──
    // (un tap corto sin movimiento activa el video)
    let tapStartX = 0,
      tapStartY = 0,
      tapStartTime = 0;
    gestureOverlay.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length !== 1) return;
        tapStartX = e.touches[0].clientX;
        tapStartY = e.touches[0].clientY;
        tapStartTime = Date.now();
      },
      { passive: true },
    );

    gestureOverlay.addEventListener(
      "touchend",
      (e) => {
        if (e.changedTouches.length !== 1) return;
        const dx = Math.abs(e.changedTouches[0].clientX - tapStartX);
        const dy = Math.abs(e.changedTouches[0].clientY - tapStartY);
        const dt = Date.now() - tapStartTime;
        // Tap corto y sin movimiento → ocultar overlay momentáneamente para dejar pasar el click
        if (dx < 10 && dy < 10 && dt < 300) {
          gestureOverlay.style.display = "none";
          setTimeout(() => {
            gestureOverlay.style.display = "";
          }, 400);
        }
      },
      { passive: true },
    );

    // ── Fade al scrollear hacia arriba (solo mobile) ──
    let lastScrollY = window.scrollY;
    let scrollFadeTimeout = null;
    const FADE_OPACITY = "0.8";
    const FULL_OPACITY = "1";
    const FADE_DELAY = 200; // ms sin movimiento para volver a opacidad completa

    function onScrollFade() {
      const currentY = window.scrollY;
      const scrollingUp = currentY < lastScrollY;
      lastScrollY = currentY;

      if (scrollingUp) {
        panel.style.opacity = FADE_OPACITY;
        panel.style.transition = "opacity 0.2s ease";
        clearTimeout(scrollFadeTimeout);
        scrollFadeTimeout = setTimeout(() => {
          panel.style.opacity = FULL_OPACITY;
        }, FADE_DELAY);
      }
    }

    window.addEventListener("scroll", onScrollFade, { passive: true });

    // Limpiar el listener cuando se cierra el panel
    const _origRemoveMobile = panel.remove.bind(panel);
    panel.remove = function () {
      window.removeEventListener("scroll", onScrollFade);
      clearTimeout(scrollFadeTimeout);
      _origRemoveMobile();
    };

    // ── Drag desktop (mouse) ──
  } else {
    let dragOffX = 0,
      dragOffY = 0,
      dragging = false;

    toolbar.addEventListener("mousedown", (e) => {
      if (e.target.closest("#embed-close") || e.target.closest("#embed-ext"))
        return;
      dragging = true;
      // Resolver posición: pasar de right/top a left/top absolutos
      const rect = panel.getBoundingClientRect();
      panel.style.left = rect.left + "px";
      panel.style.top = rect.top + "px";
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      panel.style.transform = "none";
      panel.style.transition = "none";
      dragOffX = e.clientX - rect.left;
      dragOffY = e.clientY - rect.top;
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      panel.style.left =
        Math.max(
          0,
          Math.min(e.clientX - dragOffX, window.innerWidth - panel.offsetWidth),
        ) + "px";
      panel.style.top =
        Math.max(
          0,
          Math.min(
            e.clientY - dragOffY,
            window.innerHeight - panel.offsetHeight,
          ),
        ) + "px";
    });

    document.addEventListener("mouseup", () => {
      dragging = false;
    });
  }
}

// Parsea marcas de formato inline: **negrita**, *cursiva*, __subrayado__
// Devuelve un array de nodos DOM
function parsearFormato(texto) {
  // Orden importa: ** antes de * para no confundirlos
  const TOKEN_RE = /(\*\*[\s\S]+?\*\*|\*[\s\S]+?\*|__[\s\S]+?__)/g;
  const partes = texto.split(TOKEN_RE);
  const nodos = [];
  for (const parte of partes) {
    if (parte.startsWith("**") && parte.endsWith("**") && parte.length > 4) {
      const el = document.createElement("strong");
      el.textContent = parte.slice(2, -2);
      nodos.push(el);
    } else if (
      parte.startsWith("__") &&
      parte.endsWith("__") &&
      parte.length > 4
    ) {
      const el = document.createElement("u");
      el.textContent = parte.slice(2, -2);
      nodos.push(el);
    } else if (
      parte.startsWith("*") &&
      parte.endsWith("*") &&
      parte.length > 2
    ) {
      const el = document.createElement("em");
      el.textContent = parte.slice(1, -1);
      nodos.push(el);
    } else {
      nodos.push(document.createTextNode(parte));
    }
  }
  return nodos;
}

export function renderConLinks(container, texto) {
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
      // Partir por líneas primero, luego parsear formato en cada una
      const lineas = parte.split("\n");
      lineas.forEach((linea, idx) => {
        if (linea) {
          const nodos = parsearFormato(linea);
          nodos.forEach((n) => container.appendChild(n));
        }
        if (idx < lineas.length - 1)
          container.appendChild(document.createElement("br"));
      });
    }
  });
}
