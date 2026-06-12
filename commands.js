// ========================
// COMANDOS
// ========================
// Comandos especiales que se pueden escribir en el editor (ej: "/girar")
// y los hints (mensajes flotantes junto al botón).

import { committedEl, editor, btnCanvas } from "./dom.js";
import { ctx } from "./canvas-button.js";

export const COMANDOS = {
  "/creadores":
    "Creado por <a href='https://agustint96.github.io' target='_blank'>Agustín Tardella</a> y <a href='https://interjuegos.neocities.org/' target='_blank'>Naim Goldraij</a>",
  "/girar": null,
  "/brunomunari": null,
  "/pajarosvolando": null,
};

// ========================
// /girar
// ========================

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

// ========================
// /brunomunari
// ========================

function mostrarBrunoMunari() {
  // Dibuja el Munari directamente en el btnCanvas del botón
  const S = btnCanvas.width;
  const ctx2d = ctx; // reusar el contexto del botón
  const sc = S / 500;

  // Cancelar animación Munari previa si existe
  if (btnCanvas._munariAnimId) {
    cancelAnimationFrame(btnCanvas._munariAnimId);
    btnCanvas._munariAnimId = null;
  }
  if (btnCanvas._munariCleanup) {
    btnCanvas._munariCleanup();
    btnCanvas._munariCleanup = null;
  }

  const isMobileDevice = "ontouchstart" in window || window.innerWidth < 768;
  let mouseRelY = S / 2;
  let mouseAbsX = window.innerWidth / 2;

  if (!isMobileDevice) {
    function onMouseMove(e) {
      const rect = btnCanvas.getBoundingClientRect();
      const relY = e.clientY - rect.top;
      mouseRelY = Math.max(0, Math.min(S, relY));
      mouseAbsX = e.clientX;
    }
    document.addEventListener("mousemove", onMouseMove);
    btnCanvas._munariCleanup = () =>
      document.removeEventListener("mousemove", onMouseMove);
  } else {
    let initialScrollY = window.scrollY;
    const maxScrollRange = 300;
    function updateFromScroll() {
      const delta = window.scrollY - initialScrollY;
      const clamped = Math.max(
        -maxScrollRange,
        Math.min(maxScrollRange, delta),
      );
      mouseRelY = ((clamped + maxScrollRange) / (2 * maxScrollRange)) * S;
      mouseAbsX = window.innerWidth / 2;
    }
    window.addEventListener("scroll", updateFromScroll);
    btnCanvas._munariCleanup = () =>
      window.removeEventListener("scroll", updateFromScroll);
  }

  function drawMunari() {
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

    const t = mouseRelY / S;
    const clampedY = 70 + t * (250 - 70);

    const rect = btnCanvas.getBoundingClientRect();
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

    btnCanvas._munariAnimId = requestAnimationFrame(drawMunari);
  }

  drawMunari();
  // La animación queda activa hasta que el usuario toque el botón.
  // setCanvasImage() la cancela automáticamente cuando eso ocurre.
}

// ========================
// /pajarosvolando
// ========================

function pajarosVolando() {
  const vSpans = [];

  function envolverVs(nodo) {
    if (nodo.nodeType === Node.TEXT_NODE) {
      const texto = nodo.nodeValue;
      if (!texto || !/[vV]/.test(texto)) return;
      const frag = document.createDocumentFragment();
      for (const char of texto) {
        if (char === "v" || char === "V") {
          const span = document.createElement("span");
          span.className = "pajaro-v";
          span.textContent = char;
          frag.appendChild(span);
          vSpans.push(span);
        } else {
          frag.appendChild(document.createTextNode(char));
        }
      }
      nodo.parentNode.replaceChild(frag, nodo);
    } else if (
      nodo.nodeType === Node.ELEMENT_NODE &&
      nodo.nodeName !== "SCRIPT" &&
      nodo.nodeName !== "STYLE"
    ) {
      Array.from(nodo.childNodes).forEach(envolverVs);
    }
  }

  envolverVs(committedEl);

  if (!vSpans.length) return;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Ocultar todas desde el principio
  vSpans.forEach((span) => {
    span.style.visibility = "hidden";
  });

  // Canvas fijo cubriendo el viewport
  const cvs = document.createElement("canvas");
  cvs.style.cssText =
    "position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:9999;";
  cvs.width = vw;
  cvs.height = vh;
  document.body.appendChild(cvs);
  const cx = cvs.getContext("2d");

  const DURATION = 10000;
  const startTs = performance.now();

  // Pool de pájaros activos
  const birds = [];
  const launched = new Set();

  // Punto de reunión: centro-derecha del viewport actual, se recalcula por grupo
  function getGatherPoint() {
    return {
      gx: vw * 0.62 + (Math.random() - 0.5) * vw * 0.12,
      gy: vh * 0.3 + (Math.random() - 0.5) * vh * 0.1,
    };
  }

  function makeBird(span, gx, gy, groupDelay) {
    const rect = span.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      vx: 0,
      vy: 0,
      gx: gx + (Math.random() - 0.5) * 60, // dispersión dentro del punto
      gy: gy + (Math.random() - 0.5) * 30,
      flapOffset: Math.random() * Math.PI * 2,
      flapSpeed: 170 + Math.random() * 60,
      size: 11 + Math.random() * 5,
      t: 0,
      delay: groupDelay + Math.random() * 80, // pequeño escalonado dentro del grupo
      phase: "gather", // gather → flock → done
    };
  }

  // Lanzar un grupo de spans que acaban de entrar al viewport
  function launchGroup(spans) {
    const { gx, gy } = getGatherPoint();
    spans.forEach((span, i) => {
      launched.add(span);
      observer.unobserve(span);
      birds.push(makeBird(span, gx, gy, i * 30));
    });
  }

  // IntersectionObserver con rootMargin 0 — solo dispara cuando realmente entra
  let pendingGroup = [];
  let groupTimer = null;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !launched.has(entry.target)) {
          pendingGroup.push(entry.target);
        }
      });
      // Agrupar entradas que llegan juntas en el mismo tick del observer
      if (pendingGroup.length > 0) {
        clearTimeout(groupTimer);
        groupTimer = setTimeout(() => {
          if (pendingGroup.length > 0) {
            launchGroup(pendingGroup);
            pendingGroup = [];
          }
        }, 80);
      }
    },
    { threshold: 0.1, rootMargin: "0px" },
  );

  vSpans.forEach((span) => observer.observe(span));

  function cleanup() {
    observer.disconnect();
    clearTimeout(groupTimer);
    cancelAnimationFrame(animId);
    cvs.remove();
    vSpans.forEach((span) => {
      span.style.visibility = "";
      const txt = document.createTextNode(span.textContent);
      if (span.parentNode) span.parentNode.replaceChild(txt, span);
    });
    committedEl.normalize();
  }

  let lastTs = null;
  let animId;

  function loop(ts) {
    if (!lastTs) lastTs = ts;
    const dt = Math.min(ts - lastTs, 50);
    lastTs = ts;
    const elapsed = ts - startTs;

    cx.clearRect(0, 0, cvs.width, cvs.height);

    birds.forEach((b) => {
      if (b.phase === "done") return;
      if (elapsed < b.delay) return;

      b.t += dt;

      if (b.phase === "gather") {
        // Volar hacia el punto de reunión
        const dx = b.gx - b.x;
        const dy = b.gy - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 6) {
          b.phase = "flock";
        } else {
          const accel = Math.min(1, b.t / 350);
          b.vx += (dx / dist) * 0.4 * accel;
          b.vy += (dy / dist) * 0.4 * accel;
          const spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
          const maxSpd = 3.8;
          if (spd > maxSpd) {
            b.vx = (b.vx / spd) * maxSpd;
            b.vy = (b.vy / spd) * maxSpd;
          }
          b.x += b.vx;
          b.y += b.vy;
        }
      } else if (b.phase === "flock") {
        // Volar hacia arriba-derecha saliendo del viewport
        const angle = -Math.PI / 4 + (Math.random() - 0.5) * 0.01;
        const targetVx = Math.cos(angle) * 4;
        const targetVy = Math.sin(angle) * 4;
        b.vx += (targetVx - b.vx) * 0.06;
        b.vy += (targetVy - b.vy) * 0.06;
        b.x += b.vx;
        b.y += b.vy;
        if (b.x > cvs.width + 60 || b.y < -60) b.phase = "done";
      }

      if (b.phase === "done") return;

      // Dibujar alas
      const flap = Math.sin(b.t / b.flapSpeed + b.flapOffset);
      const flapR = Math.sin(b.t / b.flapSpeed + b.flapOffset + 0.3);
      const ws = b.size;
      cx.save();
      cx.strokeStyle = "rgb(20,18,12)";
      cx.lineWidth = 1.5;
      cx.lineCap = "round";
      cx.beginPath();
      cx.moveTo(b.x - ws * 0.5, b.y - ws * 0.38 * (0.5 + 0.5 * flap));
      cx.quadraticCurveTo(b.x - ws * 0.12, b.y - 1, b.x, b.y);
      cx.quadraticCurveTo(
        b.x + ws * 0.12,
        b.y - 1,
        b.x + ws * 0.5,
        b.y - ws * 0.38 * (0.5 + 0.5 * flapR),
      );
      cx.stroke();
      cx.restore();
    });

    if (elapsed >= DURATION) {
      cleanup();
      return;
    }

    animId = requestAnimationFrame(loop);
  }

  animId = requestAnimationFrame(loop);
}

// ========================
// HINTS
// ========================

export function mostrarHintPersonalizado(texto) {
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

// Hint de primer uso (secuencia de onboarding mostrada al cargar)
export function mostrarHint() {
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

// ========================
// DESPACHO DE COMANDOS
// ========================

// Ejecuta el comando correspondiente a `mensajeLimpio` (ej: "/girar").
// Devuelve true si era un comando válido y ya fue manejado.
export function ejecutarComando(mensajeLimpio) {
  if (!(mensajeLimpio in COMANDOS)) return false;

  if (mensajeLimpio === "/girar") {
    girarTexto();
  } else if (mensajeLimpio === "/brunomunari") {
    mostrarBrunoMunari();
  } else if (mensajeLimpio === "/pajarosvolando") {
    pajarosVolando();
  } else if (COMANDOS[mensajeLimpio]) {
    mostrarHintPersonalizado(COMANDOS[mensajeLimpio]);
  }

  return true;
}
