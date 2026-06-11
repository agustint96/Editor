const SUPABASE_URL = "https://iypxmjxmhlkhkiwadann.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5cHhtanhtaGxraGtpd2FkYW5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjk4NTcsImV4cCI6MjA5NjcwNTg1N30.nEahrHZdBETYGRFNtkAKHT8Tig_0crHa5PA9gQ0PVXE";

const input = document.getElementById("hidden-input");
const committedEl = document.getElementById("committed");
const typingBeforeEl = document.getElementById("typing-before");
const typingAfterEl = document.getElementById("typing-after");
const caretEl = document.getElementById("caret");
const statusEl = document.getElementById("status");

// Evitar que el área "committed" sea seleccionable con el ratón
if (committedEl) {
  // Previene que el navegador inicie una selección de texto dentro de #committed
  committedEl.addEventListener("selectstart", (e) => e.preventDefault());

  // mousedown en #committed está cubierto por el handler global en #page
}

// Si el usuario hace doble click en #committed, evitar la selección nativa
// y en su lugar seleccionar la 'palabra actual' en el input (selección clara)
if (committedEl) {
  committedEl.addEventListener("dblclick", (e) => {
    if (e.target && e.target.closest && e.target.closest("a")) return;
    e.preventDefault();
    input.focus();
    // Seleccionar la palabra alrededor del caret actual en el input
    const pos = input.selectionStart ?? input.value.length;
    const before = input.value.slice(0, pos);
    const after = input.value.slice(pos);
    const start = before.lastIndexOf(" ") + 1;
    let end = pos + after.indexOf(" ");
    if (end < pos) end = input.value.length;
    input.selectionStart = start;
    input.selectionEnd = end;
    updateDisplay();
  });

  // Si la selección nativa del documento incluye nodos dentro de #committed,
  // limpiarla para evitar la selección "oscura" que no está ligada al input.
  document.addEventListener("selectionchange", () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (
      committedEl.contains(range.startContainer) ||
      committedEl.contains(range.endContainer)
    ) {
      sel.removeAllRanges();
      // Mantener el foco en el input para que el usuario pueda seleccionar con el área clara
      input.focus();
      updateDisplay();
    }
  });
}

const TAB = "    ";
let cursorOn = true;
let guardadoEstaSesion = false;

const colorAnterior = localStorage.getItem("ultimo_color");
const colorSesion = colorAnterior === "#000" ? "#000" : "#000";

function focusInput(e) {
  // Si el usuario está seleccionando texto, no robar el foco
  const sel = window.getSelection();
  if (sel && sel.toString().length > 0) return;

  // Si el click fue directamente sobre texto comprometido, no robar el foco
  // para permitir selección y copia
  if (e && e.target && e.target.closest("#committed")) return;

  input.focus();
}

function updateHeight() {
  const editor = document.getElementById("page");
  document.body.style.minHeight = editor.offsetHeight + 120 + "px";
}

function scrollToCaret() {
  // Esperar un frame para que el DOM se actualice antes de medir
  requestAnimationFrame(() => {
    const rect = caretEl.getBoundingClientRect();
    const vvh = window.visualViewport
      ? window.visualViewport.height
      : window.innerHeight;
    const margin = 100;
    if (rect.bottom > vvh - margin) {
      const extra = rect.bottom - (vvh - margin);
      window.scrollTo({
        top: window.scrollY + extra,
        behavior: "smooth",
      });
    }
  });
}

function updateDisplay() {
  const value = input.value;
  const start = input.selectionStart ?? value.length;
  const end = input.selectionEnd ?? value.length;
  const haySeleccion = start !== end;

  if (haySeleccion) {
    // Mostrar texto con la selección resaltada
    typingBeforeEl.textContent = value.slice(0, start);

    const selSpan = document.createElement("span");
    selSpan.style.background = "#b4d5fe";
    selSpan.style.color = "#111";
    selSpan.textContent = value.slice(start, end);

    // Limpiar y rearmar typing-before para incluir el span de selección
    typingBeforeEl.innerHTML = "";
    typingBeforeEl.appendChild(document.createTextNode(value.slice(0, start)));
    typingBeforeEl.appendChild(selSpan);

    typingAfterEl.textContent = value.slice(end);
    caretEl.style.opacity = "0";
  } else {
    typingBeforeEl.innerHTML = "";
    typingBeforeEl.appendChild(document.createTextNode(value.slice(0, start)));
    typingAfterEl.textContent = value.slice(start);
    caretEl.style.opacity =
      input === document.activeElement && cursorOn ? "1" : "0";
  }

  updateHeight();
  scrollToCaret();
}

// Cuando el teclado virtual sube/baja en móvil
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", scrollToCaret);
  window.visualViewport.addEventListener("scroll", scrollToCaret);
}

setInterval(() => {
  cursorOn = !cursorOn;
  caretEl.style.opacity =
    input === document.activeElement && cursorOn ? "1" : "0";
}, 500);

function setStatus(msg, color) {
  statusEl.textContent = msg;
  statusEl.style.color = color || "#aaa";
  if (msg && color !== "#aaa")
    setTimeout(() => {
      statusEl.textContent = "";
    }, 3000);
}

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function renderConLinks(container, texto) {
  const partes = texto.split(URL_REGEX);
  partes.forEach((parte) => {
    URL_REGEX.lastIndex = 0;
    if (URL_REGEX.test(parte)) {
      const a = document.createElement("a");
      a.href = parte;
      a.textContent = parte;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      container.appendChild(a);
    } else {
      container.appendChild(document.createTextNode(parte));
    }
  });
}

function agregarSpan(color, mensaje) {
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
    setStatus("✗ sin conexión", "#e53935");
    console.error(e);
  }
}

async function confirmar() {
  const mensaje = input.value;
  if (!mensaje.trim()) return;
  input.value = "";
  updateDisplay();
  await polling();
  guardar(mensaje);
}

input.addEventListener("input", updateDisplay);

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const start = input.selectionStart;
    const end = input.selectionEnd;
    input.value = input.value.slice(0, start) + "\n" + input.value.slice(end);
    input.selectionStart = input.selectionEnd = start + 1;
    updateDisplay();
  } else if (e.key === "Tab") {
    e.preventDefault();
    const start = input.selectionStart;
    const end = input.selectionEnd;
    input.value = input.value.slice(0, start) + TAB + input.value.slice(end);
    input.selectionStart = input.selectionEnd = start + TAB.length;
    updateDisplay();
  } else if (
    (e.key === "Backspace" || e.key === "Delete") &&
    input.selectionStart !== input.selectionEnd
  ) {
    e.preventDefault();
    const start = input.selectionStart;
    const end = input.selectionEnd;
    input.value = input.value.slice(0, start) + input.value.slice(end);
    input.selectionStart = input.selectionEnd = start;
    updateDisplay();
  }
});

input.addEventListener("click", updateDisplay);
input.addEventListener("keyup", updateDisplay);
input.addEventListener("select", updateDisplay);
input.addEventListener("focus", updateDisplay);
input.addEventListener("blur", () => {
  caretEl.style.opacity = "0";
});

// Selección con mouse sobre el área de texto visible
const editorEl = document.getElementById("editor");
let mouseSelStart = null;

function posicionEnTexto(x, y) {
  // Usa caretPositionFromPoint o caretRangeFromPoint para obtener el nodo y offset
  let node, offset;
  if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(x, y);
    if (!pos) return null;
    node = pos.offsetNode;
    offset = pos.offset;
  } else if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(x, y);
    if (!range) return null;
    node = range.startContainer;
    offset = range.startOffset;
  } else {
    return null;
  }

  // Calcular el índice global sumando los nodos de texto anteriores dentro de #editor
  let index = 0;
  const walker = document.createTreeWalker(editorEl, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const current = walker.currentNode;
    if (current === node) {
      index += offset;
      return index;
    }
    index += current.textContent.length;
  }
  return index;
}

const pageEl = document.getElementById("page");

pageEl.addEventListener("mousedown", (e) => {
  if (e.target && e.target.closest && e.target.closest("a")) return;
  e.preventDefault();

  const dentroDeEditor = e.target.closest("#editor");
  if (!dentroDeEditor) {
    mouseSelStart = null;
    input.focus();
    return;
  }

  // posicionEnTexto usa editorEl como raíz, así que el índice ya es local al input.value
  const idx = posicionEnTexto(e.clientX, e.clientY);
  if (idx === null) {
    input.focus();
    return;
  }

  mouseSelStart = idx;
  input.selectionStart = idx;
  input.selectionEnd = idx;
  input.focus();
  updateDisplay();
});

pageEl.addEventListener("mousemove", (e) => {
  if (mouseSelStart === null) return;
  if (!e.target.closest || !e.target.closest("#editor")) return;
  const idx = posicionEnTexto(e.clientX, e.clientY);
  if (idx === null) return;
  const start = Math.min(mouseSelStart, idx);
  const end = Math.max(mouseSelStart, idx);
  input.selectionStart = start;
  input.selectionEnd = end;
  updateDisplay();
});

document.addEventListener("mouseup", () => {
  mouseSelStart = null;
});

input.addEventListener("paste", (e) => {
  e.preventDefault();
  const text = e.clipboardData.getData("text/plain");
  const start = input.selectionStart;
  input.value =
    input.value.slice(0, start) + text + input.value.slice(input.selectionEnd);
  input.selectionStart = input.selectionEnd = start + text.length;
  updateDisplay();
});

// Último id que ya tenemos renderizado
let ultimoId = 0;

function estaAlFinal() {
  return window.scrollY + window.innerHeight >= document.body.scrollHeight - 60;
}

async function cargar() {
  setStatus("cargando...", "#aaa");
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
      committedEl.innerHTML = "";
      ultimoId = 0;
      rows.forEach((r) => {
        agregarSpan(r.color || "#000", r.mensaje);
        if (r.id > ultimoId) ultimoId = r.id;
      });
      setStatus("", "");
      requestAnimationFrame(() => {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: "instant",
        });
        focusInput();
      });
    } else {
      const txt = await res.text();
      setStatus("✗ error al cargar: " + txt, "#e53935");
    }
  } catch (e) {
    setStatus("✗ sin conexión al cargar", "#e53935");
    console.error(e);
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
        // Solo hacer scroll si ya estabas al final
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
    // Silencioso para no interrumpir al usuario
    console.error("polling error:", e);
  }
}

focusInput();
updateDisplay();
cargar().then(() => {
  // Arrancar polling cada 5 segundos una vez que cargó todo
  setInterval(polling, 5000);
});
