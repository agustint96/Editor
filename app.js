import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { committedEl, editor, statusEl, btnCanvas } from "./dom.js";
import { setCanvasImage } from "./canvas-button.js";
import { renderConLinks } from "./embeds.js";
import { COMANDOS, ejecutarComando, mostrarHint } from "./commands.js";

const SUPABASE_URL = "https://iypxmjxmhlkhkiwadann.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5cHhtanhtaGxraGtpd2FkYW5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjk4NTcsImV4cCI6MjA5NjcwNTg1N30.nEahrHZdBETYGRFNtkAKHT8Tig_0crHa5PA9gQ0PVXE";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TAB = "    ";
const colorSesion = "#000";

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
let lastTapTime = 0;
let lastTapTarget = null;
const DOUBLE_TAP_MS = 350; // ventana de tiempo para doble tap

document.addEventListener("pointerdown", (e) => {
  const target = e.target;

  if (e.pointerType === "touch") {
    touchMoved = false;
    touchStartX = e.clientX;
    touchStartY = e.clientY;
  }

  // Ignorar canvas y links siempre
  if (target.closest("#btn-canvas") || target.closest("a")) return;

  // Si toca el editor directamente: el browser ya maneja el cursor
  if (target === editor || target.closest("#editor")) return;

  // Sobre committed: permitir scroll y lectura libre
  if (target.closest("#committed")) return;

  // Zona vacía en desktop: enfocar de inmediato
  if (e.pointerType !== "touch") {
    e.preventDefault();
    focusEditorAtEnd();
  }
  // En touch: esperar pointerup para detectar doble tap
});

document.addEventListener("pointermove", (e) => {
  if (e.pointerType !== "touch") return;
  const dx = Math.abs(e.clientX - touchStartX);
  const dy = Math.abs(e.clientY - touchStartY);
  if (dx > 8 || dy > 8) touchMoved = true;
});

document.addEventListener("pointerup", (e) => {
  if (e.pointerType !== "touch") return;
  if (touchMoved) {
    // Fue scroll: resetear estado de doble tap
    lastTapTime = 0;
    lastTapTarget = null;
    return;
  }

  const target = e.target;
  if (target.closest("#btn-canvas") || target.closest("a")) return;
  if (target === editor || target.closest("#editor")) return;
  if (target.closest("#committed")) return;

  // Si el usuario está al final de la página: tap simple alcanza
  if (estaAlFinal()) {
    lastTapTime = 0;
    lastTapTarget = null;
    setTimeout(() => focusEditorAtEnd(), 50);
    return;
  }

  // Scrolleó para arriba: requiere doble tap para no interrumpir la lectura
  const now = Date.now();
  const sinceLastTap = now - lastTapTime;
  if (sinceLastTap < DOUBLE_TAP_MS && lastTapTarget) {
    // Doble tap → bajar al editor
    lastTapTime = 0;
    lastTapTarget = null;
    setTimeout(() => focusEditorAtEnd(), 50);
  } else {
    // Primer tap → registrar y esperar
    lastTapTime = now;
    lastTapTarget = target;
  }
});

function getEditorText() {
  // Estrategia: clonar el editor, normalizar todos los DIV/P a saltos de línea,
  // luego leer el texto plano. Esto cubre todos los casos que genera el browser:
  // - DIV vacíos al final (caret holder de Chrome/Safari)
  // - P generados por algunos browsers
  // - BR sueltos
  // - Texto directo
  const clone = editor.cloneNode(true);

  // Convertir cada DIV y P en un salto de línea + su contenido
  // Hacerlo de adentro hacia afuera (hijos primero)
  const blocks = clone.querySelectorAll("div, p");
  blocks.forEach((block) => {
    const br = document.createTextNode("\n");
    block.parentNode.insertBefore(br, block);
    while (block.firstChild) {
      block.parentNode.insertBefore(block.firstChild, block);
    }
    block.remove();
  });

  // Convertir BR en saltos de línea de texto
  clone.querySelectorAll("br").forEach((br) => {
    br.parentNode.replaceChild(document.createTextNode("\n"), br);
  });

  let text = clone.textContent || "";
  // Limpiar caracteres especiales que el browser inserta
  text = text.replace(/\u00A0/g, " ").replace(/\u200B/g, "");
  // El browser siempre agrega un \n final como caret holder — quitarlo
  text = text.replace(/\n$/, "");
  return text;
}

function setEditorText(text) {
  // Limpiar el editor y reconstruir con nodos de texto + BR
  // En vez de usar innerText (que puede generar estructura inesperada al re-setear)
  editor.innerHTML = "";
  if (!text) return;
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    if (line) editor.appendChild(document.createTextNode(line));
    if (i < lines.length - 1) editor.appendChild(document.createElement("br"));
  });
}

// Forzar que el browser use BR en vez de DIV/P al presionar Enter
try {
  document.execCommand("defaultParagraphSeparator", false, "br");
} catch (e) {}

function focusEditorAtEnd() {
  editor.focus({ preventScroll: true });
  const sel = window.getSelection();
  if (!sel) return;
  // Si el editor está vacío, asegurarse de que tiene al menos un nodo de texto
  if (!editor.firstChild) {
    editor.appendChild(document.createTextNode(""));
  }
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false); // colapsar al final
  sel.removeAllRanges();
  sel.addRange(range);
  requestAnimationFrame(() => {
    scrollToCaret();
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
    if (rect.width === 0 && rect.height === 0) return; // rango colapsado sin posición real
    const vvh = window.visualViewport
      ? window.visualViewport.height
      : window.innerHeight;
    const marginBottom = 120;
    const marginTop = 60;
    if (rect.bottom > vvh - marginBottom) {
      const extra = rect.bottom - (vvh - marginBottom);
      window.scrollBy({ top: extra, behavior: "smooth" });
    } else if (rect.top < marginTop) {
      const extra = rect.top - marginTop;
      window.scrollBy({ top: extra, behavior: "smooth" });
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

const renderedMessageIds = new Set();

function agregarSpan(color, mensaje, id) {
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
        // <br> después de cada \n — incluso el último si el mensaje termina en \n
        // (eso hace que el editor continúe en la línea correcta)
        if (idx < lineas.length - 1) {
          container.appendChild(document.createElement("br"));
        } else if (idx === lineas.length - 1 && linea === "") {
          // El mensaje termina en \n: agregar <br> final para que el editor
          // empiece en la línea siguiente
          container.appendChild(document.createElement("br"));
        }
      });
    }
  });
}

function agregarSpan(color, mensaje, id, tipo) {
  if (id && renderedMessageIds.has(id)) return;
  if (id) renderedMessageIds.add(id);

  mensaje = mensaje.replace(/\u00A0/g, " ").replace(/\u200B/g, "");
  // No stripear \n finales: el usuario puede querer líneas en blanco al final del mensaje
  if (mensaje.trim() === "") return;
  const span = document.createElement("span");
  span.className = "msg";
  span.style.color = color;
  if (id) span.dataset.id = id;
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
      body: JSON.stringify({
        mensaje,
        fecha,
        hora,
        color: colorSesion,
      }),
    });
    if (res.ok) {
      const rows = await res.json();
      const id = rows?.[0]?.id;
      agregarSpan(colorSesion, mensaje, id);
      const localRows = loadLocalMessages();
      if (id && !localRows.some((item) => item.id === id)) {
        localRows.push({ id, mensaje, color: colorSesion });
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
        o.type = "sawtooth";
        o.frequency.setValueAtTime(1320, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
        g.gain.setValueAtTime(0.18, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        o.start(ctx.currentTime);
        o.stop(ctx.currentTime + 0.35);
      } catch (e) {}
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

// Init canvas with random image on load
setCanvasImage(false).then(() => {
  mostrarHint();
});

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
  // getEditorText ya elimina el \n del caret holder del browser
  if (!mensaje.trim()) return;

  // Verificar si es un comando
  const mensajeLimpio = mensaje.trim().toLowerCase();

  if (ejecutarComando(mensajeLimpio)) {
    setEditorText("");
    editor.style.color = TEXTO_COLOR;
    updateHeight();
    focusEditorAtEnd();
    return;
  }

  guardando = true; // set synchronously before any await to block re-entry
  setEditorText("");
  editor.innerHTML = ""; // doble limpieza para asegurar que no queden nodos residuales
  updateHeight();
  requestAnimationFrame(() => focusEditorAtEnd());
  guardar(mensaje).finally(() => {
    guardando = false;
  });
}

const COMANDO_COLOR = "#7b1fa2";
const TEXTO_COLOR = "rgba(0, 0, 0, 0.65)";

function actualizarColorEditor() {
  const texto = getEditorText().trim().toLowerCase();
  const esComandoOPrefijo =
    texto.startsWith("/") &&
    Object.keys(COMANDOS).some((cmd) => cmd.startsWith(texto));
  editor.style.color = esComandoOPrefijo ? COMANDO_COLOR : TEXTO_COLOR;
}

editor.addEventListener("input", () => {
  updateHeight();
  scrollToCaret();
  actualizarColorEditor();
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
  // Interceptar Enter para garantizar que el browser inserte <br> y nunca <div>/<p>
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    // Insertar BR manualmente en la posición del cursor
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const br = document.createElement("br");
      range.insertNode(br);

      // Para que el cursor quede visualmente en la nueva línea, el browser
      // necesita un nodo de texto con contenido real *o* un segundo BR cuando
      // el BR insertado es el último nodo del editor. Un TextNode("") no ocupa
      // espacio y el caret no tiene dónde anclarse, por eso el primer Enter
      // parecía no funcionar.
      //
      // Solución: posicionar el cursor usando el índice de offset dentro del
      // nodo padre en lugar de setStartAfter(br), y agregar un BR fantasma
      // solo si el br es el último hijo (así el browser siempre tiene "algo"
      // después del caret).
      const parent = br.parentNode;
      const brIndex = Array.prototype.indexOf.call(parent.childNodes, br);

      if (!br.nextSibling) {
        // BR al final del editor: agregar un BR centinela para que el caret
        // tenga una posición real en la línea siguiente.
        const sentinel = document.createElement("br");
        parent.appendChild(sentinel);
      }

      // Posicionar el cursor justo después del BR recién insertado
      const newRange = document.createRange();
      newRange.setStart(parent, brIndex + 1);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
    updateHeight();
    scrollToCaret();
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

function estaAlFinal() {
  return window.scrollY + window.innerHeight >= document.body.scrollHeight - 60;
}

async function cargar() {
  setStatus("cargando...", "#aaa");
  const localRows = loadLocalMessages();
  if (localRows.length) {
    committedEl.innerHTML = "";
    localRows.forEach((r) => {
      agregarSpan(r.color || "#000", r.mensaje, r.id);
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
      // Limpiar siempre antes de renderizar la respuesta definitiva del server
      committedEl.innerHTML = "";
      renderedMessageIds.clear();
      ultimoId = 0;
      rows.forEach((r) => {
        agregarSpan(r.color || "#000", r.mensaje, r.id);
      });
      saveLocalMessages(rows);
      setStatus("", "");
      requestAnimationFrame(() => {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: "instant",
        });
        // Esperar un frame más para que el scroll se aplique antes del focus
        requestAnimationFrame(() => {
          focusEditorAtEnd();
        });
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
      localRows.forEach((r) => {
        agregarSpan(r.color || "#000", r.mensaje, r.id);
      });
      setStatus("Offline. Mostrando caché local.", "#e53935");
      requestAnimationFrame(() => {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: "instant",
        });
        requestAnimationFrame(() => focusEditorAtEnd());
      });
    } else {
      setStatus("✗ sin conexión. No hay datos locales.", "#e53935");
    }
    updateHeight();
  }
}

// Suscripción en tiempo real: Supabase empuja por websocket cada fila nueva
// insertada en "notas" (de cualquier usuario, incluido uno mismo) apenas se
// confirma en la base, sin necesidad de re-consultar periódicamente.
function iniciarRealtime() {
  supabase
    .channel("notas-realtime")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notas" },
      (payload) => {
        const r = payload.new;
        const alFinal = estaAlFinal();
        agregarSpan(r.color || "#000", r.mensaje, r.id);
        if (alFinal) {
          requestAnimationFrame(() => {
            window.scrollTo({
              top: document.body.scrollHeight,
              behavior: "smooth",
            });
          });
        }
      },
    )
    .subscribe();
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
