const SUPABASE_URL = "https://iypxmjxmhlkhkiwadann.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5cHhtanhtaGxraGtpd2FkYW5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjk4NTcsImV4cCI6MjA5NjcwNTg1N30.nEahrHZdBETYGRFNtkAKHT8Tig_0crHa5PA9gQ0PVXE";

const input = document.getElementById("hidden-input");
const committedEl = document.getElementById("committed");
const typingBeforeEl = document.getElementById("typing-before");
const typingAfterEl = document.getElementById("typing-after");
const caretEl = document.getElementById("caret");
const statusEl = document.getElementById("status");

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
  const pos = input.selectionStart ?? value.length;
  typingBeforeEl.textContent = value.slice(0, pos);
  typingAfterEl.textContent = value.slice(pos);
  caretEl.style.opacity =
    input === document.activeElement && cursorOn ? "1" : "0";
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
    input.value = input.value.slice(0, start) + "\n" + input.value.slice(start);
    input.selectionStart = input.selectionEnd = start + 1;
    updateDisplay();
  } else if (e.key === "Tab") {
    e.preventDefault();
    const start = input.selectionStart;
    input.value = input.value.slice(0, start) + TAB + input.value.slice(start);
    input.selectionStart = input.selectionEnd = start + TAB.length;
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
