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

document.addEventListener("pointerdown", (e) => {
  const target = e.target;

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
    editor.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    return;
  }

  // Tap en zona vacía de la página
  e.preventDefault();
  editor.focus();
});

function getEditorText() {
  return editor.innerText.replace(/\u00A0/g, " ");
}

function setEditorText(text) {
  editor.innerText = text;
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
  await polling();
  guardar(mensaje);
}

editor.addEventListener("input", () => {
  updateHeight();
  scrollToCaret();
});

editor.addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    insertTextAtCursor(TAB);
  }
});

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
      saveLocalMessages(rows);
      setStatus("", "");
      requestAnimationFrame(() => {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: "instant",
        });
        editor.focus();
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
cargar().then(() => {
  setInterval(polling, 5000);
});
