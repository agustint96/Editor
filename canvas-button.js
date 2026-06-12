// ========================
// CANVAS BUTTON
// ========================
// Sistema de imágenes random del botón circular y su dibujo en canvas.

import { btnCanvas } from "./dom.js";

export const ctx = btnCanvas.getContext("2d");

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
  "img/francellayfatiga.png",
];

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

export async function setCanvasImage(forceNew) {
  // Cancelar animación Munari si estaba activa
  if (btnCanvas._munariAnimId) {
    cancelAnimationFrame(btnCanvas._munariAnimId);
    btnCanvas._munariAnimId = null;
  }
  if (btnCanvas._munariCleanup) {
    btnCanvas._munariCleanup();
    btnCanvas._munariCleanup = null;
  }
  const newIdx = forceNew
    ? pickRandomImageIndex(currentCanvasImageIndex)
    : pickRandomImageIndex(_savedIdx);
  currentCanvasImageIndex = newIdx;
  localStorage.setItem(CANVAS_IMAGE_KEY, String(newIdx));
  const src = CANVAS_IMAGES[newIdx];
  const img = await loadCanvasImage(src);
  drawCanvasImage(img);
}
