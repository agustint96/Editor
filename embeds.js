// ========================
// EMBEDS (links → reproductores)
// ========================
// Detección de links embebibles (YouTube, Vimeo, Spotify, SoundCloud,
// Twitter/X, Instagram) y panel flotante para mostrarlos.

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

export function getEmbedInfo(url) {
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

export function openEmbed(embedInfo, url) {
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
