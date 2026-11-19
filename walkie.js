// Cobranza Fuentes · Walkie-talkie: mantener apretado para hablar, sin establecer una llamada.
// Mientras se mantiene apretado, el audio se graba en pedacitos y se manda enseguida por el canal "intercom";
// del otro lado se escucha casi en vivo (y se puede repetir). Máximo 60 segundos por mensaje.
import { esc, toast } from "./comun.js?v=202611191553";

const MAX_MS = 60000, TROZO_MS = 250;
const TIPOS = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm", "audio/mp4"];
let api = null;          // { enviar, conectados, yo, cfg, tono, audioCtx, nombreDe }
let hablando = null;     // { id, rec, stream, inicio, para, timer, seq }
const recibidos = new Map(); // id -> { de, nombre, mime, trozos:[], sig, ms, sbuf, audio, cola, fin, total }
let burbuja = null, ultimo = null, destino = "todos";

export function iniciarWalkie(a) {
  api = a;
  addEventListener("keydown", (e) => { if (e.key === "F2" && !e.repeat && api.cfg().f2 !== false) { e.preventDefault(); empezar(destino); } });
  addEventListener("keyup", (e) => { if (e.key === "F2") { e.preventDefault(); terminar(); } });
  addEventListener("blur", () => terminar());
}
export const destinoWalkie = () => destino;
export function elegirDestino(v) { destino = v || "todos"; pintarBotones(); }
const textoDestino = (d = destino) => d === "todos" ? "todos" : api.conectados().find((x) => x.sid === d)?.nombre || "todos";

/** Conecta un botón "mantener apretado para hablar". */
export function botonHablar(el, destinoFijo) {
  if (!el || el.dataset.wkListo) return; el.dataset.wkListo = "1";
  const ini = (e) => { if (e.button > 0) return; e.preventDefault(); el.setPointerCapture?.(e.pointerId); empezar(destinoFijo ? el.dataset.wkPara : destino); };
  el.addEventListener("pointerdown", ini);
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) el.addEventListener(ev, () => terminar());
  el.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); empezar(destinoFijo ? el.dataset.wkPara : destino); } });
  el.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); terminar(); } });
  el.addEventListener("contextmenu", (e) => e.preventDefault());
}

/* ---------------- hablar ---------------- */
const b64 = (buf) => { let s = ""; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const deB64 = (s) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };

async function empezar(para) {
  if (hablando) return;
  const otros = api.conectados();
  if (!otros.length) { toast("No hay nadie más del equipo conectado ahora"); return; }
  if (para !== "todos" && !otros.some((x) => x.sid === para)) para = "todos";
  hablando = { id: Math.random().toString(36).slice(2, 10), para, inicio: 0, seq: 0, soltado: false };
  const h = hablando; pintarBotones();
  try {
    const mic = api.cfg().mic;
    h.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, ...(mic ? { deviceId: { ideal: mic } } : {}) } });
  } catch (e) { hablando = null; pintarBotones(); toast(e.name === "NotAllowedError" ? "No hay permiso para usar el micrófono. Tocá el candado de la barra de direcciones y permití el micrófono." : "No se pudo usar el micrófono", "bad"); return; }
  if (h.soltado) { h.stream.getTracks().forEach((t) => t.stop()); hablando = null; pintarBotones(); toast("Mantené apretado mientras hablás"); return; }
  const mime = TIPOS.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || "";
  h.rec = new MediaRecorder(h.stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 24000 });
  const paraLista = para === "todos" ? null : [para];
  api.enviar({ t: "w-ini", wid: h.id, mime: h.rec.mimeType || mime, ...(paraLista ? { para: paraLista } : {}) });
  h.rec.ondataavailable = async (e) => {
    if (!e.data.size) return;
    const seq = h.seq++, datos = b64(await e.data.arrayBuffer());
    api.enviar({ t: "w-trozo", wid: h.id, seq, d: datos, ...(paraLista ? { para: paraLista } : {}) });
  };
  h.rec.onstop = () => { setTimeout(() => api.enviar({ t: "w-fin", wid: h.id, total: h.seq, ...(paraLista ? { para: paraLista } : {}) }), 60); h.stream.getTracks().forEach((t) => t.stop()); };
  api.tono([1200], 0.07, 0.12);
  h.rec.start(TROZO_MS); h.inicio = Date.now();
  h.timer = setInterval(() => { pintarBotones(); if (Date.now() - h.inicio > MAX_MS) { toast("Máximo 60 segundos por mensaje"); terminar(); } }, 250);
  pintarBotones();
}
function terminar() {
  const h = hablando; if (!h) return;
  h.soltado = true;
  if (!h.rec) return; // todavía está pidiendo el micrófono: se corta apenas lo tenga
  clearInterval(h.timer);
  const corto = Date.now() - h.inicio < 350;
  if (h.rec.state !== "inactive") h.rec.stop();
  hablando = null; api.tono([800], 0.06, 0.1); pintarBotones();
  if (corto) toast("Mantené apretado el botón mientras hablás, y soltalo al terminar");
  else toast(`Mensaje enviado a ${textoDestino(h.para)}`);
}

/* ---------------- escuchar ---------------- */
export function recibirWalkie(p) {
  if (p.t === "w-ini") {
    if (api.cfg().walkie === false) return;
    const r = { id: p.wid, de: p.de, nombre: p.nombre, mime: p.mime, trozos: [], sig: 0, cola: [], fin: false, total: null, inicio: Date.now(), todos: !p.para };
    recibidos.set(p.wid, r); prepararAudio(r);
    api.tono([1200, 1500], 0.06, 0.12);
    ultimo = r; pintarBurbuja();
    setTimeout(() => recibidos.delete(p.wid), 5 * 60e3);
    return;
  }
  const r = recibidos.get(p.wid); if (!r) return;
  if (p.t === "w-trozo") { r.trozos[p.seq] = deB64(p.d); alimentar(r); }
  if (p.t === "w-fin") { r.total = p.total; r.fin = true; alimentar(r); setTimeout(() => { if (!r.cerrado) cerrar(r); }, 1500); }
}
function prepararAudio(r) {
  r.audio = new Audio(); r.audio.autoplay = true;
  const out = api.cfg().out; if (out && r.audio.setSinkId) r.audio.setSinkId(out).catch(() => {});
  const tipo = (r.mime || "").split(";")[0] === "audio/webm" ? "audio/webm;codecs=opus" : r.mime;
  if (window.MediaSource && tipo && MediaSource.isTypeSupported(tipo)) {
    r.ms = new MediaSource(); r.audio.src = URL.createObjectURL(r.ms);
    r.ms.addEventListener("sourceopen", () => {
      try { r.sbuf = r.ms.addSourceBuffer(tipo); r.sbuf.mode = "sequence"; r.sbuf.addEventListener("updateend", () => alimentar(r)); alimentar(r); } catch { r.ms = null; }
    });
    r.audio.play().catch(() => { r.bloqueado = true; pintarBurbuja(); });
  }
  r.audio.onended = () => { r.terminoDeSonar = true; pintarBurbuja(); };
}
function alimentar(r) {
  if (r.sbuf && !r.sbuf.updating && r.ms?.readyState === "open") {
    const t = r.trozos[r.sig];
    if (t) { r.sig++; try { r.sbuf.appendBuffer(t); } catch { } return; }
    if (r.fin && r.sig >= (r.total ?? r.sig)) { cerrar(r); }
  } else if (!r.ms && r.fin && !r.cerrado) cerrar(r);
}
function cerrar(r) {
  if (r.cerrado) return; r.cerrado = true;
  const partes = r.trozos.filter(Boolean);
  r.blob = new Blob(partes, { type: (r.mime || "audio/webm").split(";")[0] });
  r.dur = Date.now() - r.inicio;
  if (r.ms) { try { if (r.ms.readyState === "open") r.ms.endOfStream(); } catch {} }
  else { r.audio.src = URL.createObjectURL(r.blob); r.audio.play().catch(() => { r.bloqueado = true; pintarBurbuja(); }); }
  pintarBurbuja();
}
function repetir(r) {
  if (!r?.blob) return;
  const a = new Audio(URL.createObjectURL(r.blob)); const out = api.cfg().out; if (out && a.setSinkId) a.setSinkId(out).catch(() => {});
  a.play().catch(() => {});
}

/* ---------------- pantalla ---------------- */
function pintarBurbuja() {
  const r = ultimo; if (!r) return;
  if (!burbuja) {
    burbuja = document.createElement("div"); burbuja.className = "wk-burbuja"; burbuja.setAttribute("role", "status"); document.documentElement.appendChild(burbuja);
    burbuja.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.wk === "repetir") repetir(ultimo);
      if (b.dataset.wk === "escuchar") { ultimo.bloqueado = false; ultimo.audio.play().catch(() => repetir(ultimo)); pintarBurbuja(); }
      if (b.dataset.wk === "cerrar") { burbuja.remove(); burbuja = null; }
    });
  }
  const enVivo = !r.cerrado || (!r.terminoDeSonar && !r.audio.paused);
  burbuja.classList.toggle("vivo", enVivo);
  burbuja.innerHTML = `<span class="wk-onda" aria-hidden="true"><i></i><i></i><i></i></span>
    <span class="wk-txt"><b>${esc(r.nombre)}</b><small>${enVivo ? (r.todos ? "habla a todos…" : "te habla…") : `dijo algo${r.todos ? " a todos" : ""}`}</small></span>
    ${r.bloqueado ? `<button type="button" class="btn small primary" data-wk="escuchar">Escuchar</button>` : ""}
    ${r.cerrado ? `<button type="button" class="btn small" data-wk="repetir">Repetir</button><button type="button" class="btn small primary wk-resp" data-wk-para="${esc(r.de)}" title="Mantené apretado para responderle">Responder</button>` : ""}
    <button type="button" class="wk-x" data-wk="cerrar" aria-label="Cerrar">×</button>`;
  botonHablar(burbuja.querySelector(".wk-resp"), true);
  clearTimeout(burbuja._t);
  if (!enVivo) burbuja._t = setTimeout(() => { if (burbuja && ultimo === r) { burbuja.remove(); burbuja = null; } }, 20000);
}
export function pintarBotones() {
  const h = hablando, seg = h?.inicio ? Math.floor((Date.now() - h.inicio) / 1000) : 0;
  document.querySelectorAll("[data-wk-boton]").forEach((b) => {
    const mio = h && (b.dataset.wkPara ? b.dataset.wkPara === h.para : true);
    b.classList.toggle("hablando", !!mio);
    const t = b.querySelector(".wk-lbl");
    if (t) t.textContent = mio ? (h.inicio ? `Hablando… 0:${String(seg).padStart(2, "0")}` : "Abriendo micrófono…") : b.dataset.wkPara ? "Mantener" : `Mantener para hablar a ${textoDestino()}`;
  });
}
window.__walkie = () => [...recibidos.values()].map((r) => ({ de: r.nombre, trozos: r.trozos.filter(Boolean).length, cerrado: !!r.cerrado, blob: r.blob?.size || 0, mse: !!r.sbuf, sonando: r.audio && !r.audio.paused, t: +(r.audio?.currentTime || 0).toFixed(2) }));
