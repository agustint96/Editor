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

// ========================
// SEPARADOR DE FECHA
// ========================
// La columna "fecha" ya viene en formato "YYYY-MM-DD" hora Argentina.

function formatearFechaSeparador(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const fecha = new Date(y, m - 1, d);
  const txt = fecha.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

function insertarSeparadorFecha(isoDate) {
  const div = document.createElement("div");
  div.className = "date-separator";
  div.textContent = formatearFechaSeparador(isoDate);
  committedEl.appendChild(div);
}

// Rastrea el último día renderizado para saber cuándo insertar un separador
let ultimaFechaRenderizada = null;

// Renderiza un mensaje, insertando separador de día si corresponde
function agregarMensaje(color, mensaje, id, fecha) {
  if (id && renderedMessageIds.has(id)) return;
  if (id) renderedMessageIds.add(id);

  mensaje = mensaje.replace(/\u00A0/g, " ").replace(/\u200B/g, "");
  mensaje = mensaje.replace(/\n+$/, "");
  if (mensaje.trim() === "") return;

  // Insertar separador si cambió el día
  if (fecha) {
    const fechaDia = fecha.slice(0, 10); // "YYYY-MM-DD"
    if (fechaDia !== ultimaFechaRenderizada) {
      insertarSeparadorFecha(fechaDia);
      ultimaFechaRenderizada = fechaDia;
    }
  }

  const span = document.createElement("span");
  span.className = "msg";
  span.style.color = color;
  if (id) span.dataset.id = id;
  renderConLinks(span, mensaje);
  committedEl.appendChild(span);
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
  function extractText(node, isRoot) {
    let text = "";
    const children = Array.from(node.childNodes);
    children.forEach((child, i) => {
      const isLast = i === children.length - 1;
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.nodeValue;
      } else if (child.nodeName === "BR") {
        if (isRoot && isLast) return;
        text += "\n";
      } else if (child.nodeName === "DIV" || child.nodeName === "P") {
        const inner = extractText(child, false);
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

const renderedMessageIds = new Set();

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
      const fecha = rows?.[0]?.fecha;
      agregarMensaje(colorSesion, mensaje, id, fecha);
      const localRows = loadLocalMessages();
      if (id && !localRows.some((item) => item.id === id)) {
        localRows.push({ id, mensaje, color: colorSesion, fecha: fecha });
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
    agregarMensaje(colorSesion, mensaje);
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
btnCanvas.addEventListener(
  "touchend",
  (e) => {
    e.preventDefault();
    confirmar();
  },
  { passive: false },
);

btnCanvas.addEventListener("click", (e) => {
  if (e.pointerType === "touch") return;
  confirmar();
});

let guardando = false;

async function confirmar() {
  if (guardando) return;

  let mensaje = getEditorText();
  const hayTexto = !!mensaje.trim();

  if (!hayTexto) {
    if (!estaAlFinal()) {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }
    return;
  }

  const rect = editor.getBoundingClientRect();
  const vh = window.visualViewport
    ? window.visualViewport.height
    : window.innerHeight;
  const editorVisible = rect.bottom > 0 && rect.top < vh;

  if (!editorVisible) {
    editor.scrollIntoView({ block: "center", behavior: "smooth" });
    setTimeout(() => focusEditorAtEnd(), 300);
    return;
  }

  mensaje = mensaje.replace(/\n+$/, "");
  if (!mensaje.trim()) return;

  const mensajeLimpio = mensaje.trim().toLowerCase();

  if (ejecutarComando(mensajeLimpio)) {
    setEditorText("");
    editor.style.color = TEXTO_COLOR;
    updateHeight();
    focusEditorAtEnd();
    return;
  }

  guardando = true;
  setEditorText("");
  editor.style.color = TEXTO_COLOR;
  updateHeight();
  focusEditorAtEnd();
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
    ultimaFechaRenderizada = null;
    localRows.forEach((r) => {
      agregarMensaje(r.color || "#000", r.mensaje, r.id, r.fecha);
    });
    setStatus("cargando desde caché...", "#888");
  }

  try {
    const res = await fetch(
      SUPABASE_URL +
        "/rest/v1/notas?select=id,mensaje,color,fecha&order=id.asc",
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
        ultimaFechaRenderizada = null;
      }
      rows.forEach((r) => {
        agregarMensaje(r.color || "#000", r.mensaje, r.id, r.fecha);
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
      ultimaFechaRenderizada = null;
      localRows.forEach((r) => {
        agregarMensaje(r.color || "#000", r.mensaje, r.id, r.fecha);
      });
      setStatus("Offline. Mostrando caché local.", "#e53935");
    } else {
      setStatus("✗ sin conexión. No hay datos locales.", "#e53935");
    }
    editor.focus();
    updateHeight();
  }
}

function iniciarRealtime() {
  supabase
    .channel("notas-realtime")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notas" },
      (payload) => {
        const r = payload.new;
        const alFinal = estaAlFinal();
        agregarMensaje(r.color || "#000", r.mensaje, r.id, r.fecha);
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
  iniciarRealtime();
});
