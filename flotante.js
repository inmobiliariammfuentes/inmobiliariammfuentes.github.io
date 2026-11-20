// Cobranza Fuentes · Web flotante: una ventanita que queda arriba del sistema (YouTube, Spotify, otras páginas)
// YouTube y Spotify se muestran con su reproductor para insertar (link de un video, lista, tema o álbum).
// Disney+, Netflix y similares no permiten verse dentro de otra página: se abren en una ventanita aparte.
import { esc, toast } from "./comun.js?v=202611201458";
import { perso, actualizarPerso } from "./personalizar.js?v=202611201458";

const ATAJOS = [
  { k: "youtube", n: "YouTube", c: "#ff0000", url: "https://www.youtube.com/", ayuda: "Buscá el video o la lista en YouTube, copiá el link y pegalo acá arriba." },
  { k: "spotify", n: "Spotify", c: "#1db954", url: "https://open.spotify.com/", ayuda: "Copiá el link de una lista, álbum, tema o podcast de Spotify (Compartir → Copiar enlace) y pegalo acá arriba. Si tenés la sesión de Spotify abierta en este navegador, se escucha completo." },
  { k: "disney", n: "Disney+", c: "#113ccf", url: "https://www.disneyplus.com/", aparte: true },
  { k: "netflix", n: "Netflix", c: "#e50914", url: "https://www.netflix.com/", aparte: true },
  { k: "prime", n: "Prime Video", c: "#00a8e1", url: "https://www.primevideo.com/", aparte: true },
];
// páginas que no dejan mostrarse dentro de otra (se abren aparte)
const SOLO_APARTE = /(^|\.)(disneyplus|netflix|primevideo|amazon|max|hbomax|paramountplus|starplus|flow|google|whatsapp|instagram|facebook|x|twitter|tiktok|mercadopago|mercadolibre)\.com(\.ar)?$|(^|\.)tv\.apple\.com$/i;

/** Convierte un link en uno que se pueda ver adentro. Devuelve {src} o {aparte:true} o {falta:"youtube"|"spotify"}. */
export function convertirLink(txt) {
  let u; try { u = new URL(/^https?:\/\//i.test(txt.trim()) ? txt.trim() : "https://" + txt.trim()); } catch { return { error: true }; }
  const h = u.hostname.replace(/^(www|m|music)\./, "");
  if (h === "youtu.be") { const id = u.pathname.slice(1).split("/")[0]; return id ? { src: `https://www.youtube.com/embed/${id}?autoplay=1`, tipo: "youtube" } : { falta: "youtube" }; }
  if (h === "youtube.com" || h === "youtube-nocookie.com") {
    const v = u.searchParams.get("v"), list = u.searchParams.get("list"), t = parseInt(u.searchParams.get("t") || "0", 10) || 0;
    const m = u.pathname.match(/^\/(shorts|live|embed)\/([\w-]+)/);
    const id = v || (m && m[2] !== "videoseries" ? m[2] : null);
    if (id) return { src: `https://www.youtube.com/embed/${id}?autoplay=1${list ? "&list=" + encodeURIComponent(list) : ""}${t ? "&start=" + t : ""}`, tipo: "youtube" };
    if (list) return { src: `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(list)}&autoplay=1`, tipo: "youtube" };
    return { falta: "youtube" };
  }
  if (h === "open.spotify.com" || h === "spotify.com") {
    const m = u.pathname.match(/^\/(?:intl-[\w-]+\/)?(?:embed\/)?(track|album|playlist|artist|episode|show)\/([\w]+)/);
    return m ? { src: `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator`, tipo: "spotify" } : { falta: "spotify" };
  }
  if (SOLO_APARTE.test(u.hostname)) return { aparte: true, url: u.href };
  return { src: u.href, tipo: "web" };
}

const LS = "flotante-v2";
let st = { abierto: false, min: false, src: "", url: "", titulo: "", x: null, y: null, w: 440, h: 300 };
try { st = { ...st, ...JSON.parse(localStorage.getItem(LS) || "{}") }; } catch {}
const guardar = () => { try { localStorage.setItem(LS, JSON.stringify(st)); } catch {} };
let caja = null, pip = null;

export function abrirAparte(url) {
  const w = Math.min(1000, screen.availWidth - 40), h = Math.min(600, screen.availHeight - 80);
  const win = window.open(url, "mmf-web", `popup,width=${w},height=${h},left=${screen.availWidth - w - 20},top=${screen.availHeight - h - 60}`);
  if (!win) toast("El navegador bloqueó la ventana. Permití las ventanas emergentes para este sitio.", "bad");
}

function inicio(msg) {
  const favs = perso().favs || [];
  return `<div class="fl-ini">
    <form class="fl-link"><input name="u" placeholder="Pegá un link de YouTube, Spotify u otra página" autocomplete="off" value=""><button class="btn small primary" type="submit">Abrir</button></form>
    ${msg ? `<div class="fl-msg">${msg}</div>` : ""}
    <div class="fl-atajos">${ATAJOS.map((a) => `<button type="button" class="fl-at" data-fat="${a.k}" style="--c:${a.c}"><span></span>${a.n}${a.aparte ? ' <small>↗</small>' : ""}</button>`).join("")}</div>
    ${favs.length ? `<div class="fl-favs"><b>Mis favoritos</b>${favs.map((f, i) => `<span class="fl-fav"><button type="button" class="link" data-ffav="${i}">${esc(f.n)}</button><button type="button" class="fl-x" data-fborrar="${i}" aria-label="Quitar ${esc(f.n)} de favoritos">×</button></span>`).join("")}</div>` : ""}
    <div class="muted fl-nota">Disney+, Netflix y otras plataformas no permiten verse dentro de otra página: se abren en una ventanita aparte (↗).</div>
  </div>`;
}
function pintar(msg) {
  if (!caja) {
    caja = document.createElement("div"); caja.className = "flotante"; caja.setAttribute("role", "dialog"); caja.setAttribute("aria-label", "Web flotante");
    document.documentElement.appendChild(caja); eventos(); // fuera del body: así el tamaño de letra elegido no corre su posición
  }
  caja.classList.toggle("min", !!st.min);
  const x = st.x ?? Math.max(16, innerWidth - st.w - 24), y = st.y ?? Math.max(16, innerHeight - st.h - 90);
  st.w = Math.min(st.w, innerWidth - 16); st.h = Math.min(st.h, innerHeight - 16);
  Object.assign(caja.style, { left: Math.max(0, Math.min(x, innerWidth - st.w - 8)) + "px", top: Math.max(0, Math.min(y, innerHeight - (st.min ? 44 : st.h) - 8)) + "px", width: st.w + "px", height: st.min ? "" : st.h + "px" });
  const enPip = !!pip;
  caja.innerHTML = `<div class="fl-bar"><span class="fl-tit">${esc(st.src ? st.titulo || "Web" : "Web flotante")}</span>
    ${st.src ? `<button type="button" data-fl="fav" title="Guardar en favoritos" aria-label="Guardar en favoritos">☆</button><button type="button" data-fl="cambiar" title="Abrir otra" aria-label="Abrir otra página">⌂</button>` : ""}
    ${st.src && "documentPictureInPicture" in window ? `<button type="button" data-fl="pip" title="Sacar afuera: queda visible aunque cambies de programa" aria-label="Sacar afuera">⧉</button>` : ""}
    ${st.url ? `<button type="button" data-fl="aparte" title="Abrir en ventana aparte" aria-label="Abrir en ventana aparte">↗</button>` : ""}
    <button type="button" data-fl="min" title="${st.min ? "Agrandar" : "Achicar"}" aria-label="${st.min ? "Agrandar" : "Achicar"}">${st.min ? "▢" : "–"}</button><button type="button" data-fl="cerrar" title="Cerrar" aria-label="Cerrar">×</button></div>
    <div class="fl-cuerpo">${enPip ? `<div class="fl-msg">Se está viendo en la ventanita de afuera. <button type="button" class="link" data-fl="volver">Traerla de vuelta</button></div>`
      : st.src ? `<iframe src="${esc(st.src)}" title="${esc(st.titulo || "Web")}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
        ${st.tipo === "web" ? `<div class="fl-pie">¿No se ve? Esa página no deja mostrarse adentro. <button type="button" class="link" data-fl="aparte">Abrirla aparte ↗</button></div>` : ""}` : inicio(msg)}</div>`;
  if (!st.src && !st.min) setTimeout(() => caja.querySelector(".fl-link input")?.focus(), 0);
}
function abrirLink(txt, titulo) {
  const r = convertirLink(txt);
  if (r.error) return pintar("Ese link no es válido.");
  if (r.aparte) { abrirAparte(r.url); return pintar("Esa página no se puede ver adentro: la abrí en una ventanita aparte."); }
  if (r.falta) { const a = ATAJOS.find((x) => x.k === r.falta); return pintar(esc(a.ayuda) + ` <button type="button" class="link" data-fbuscar="${a.k}">Buscar en ${a.n} ↗</button>`); }
  let u; try { u = new URL(/^https?:\/\//i.test(txt.trim()) ? txt.trim() : "https://" + txt.trim()); } catch {}
  Object.assign(st, { src: r.src, tipo: r.tipo, url: u?.href || r.src, titulo: titulo || (r.tipo === "youtube" ? "YouTube" : r.tipo === "spotify" ? "Spotify" : u?.hostname.replace(/^www\./, "")) });
  if (r.tipo === "spotify" && st.h < 360) st.h = 380;
  guardar(); pintar();
}
function eventos() {
  caja.addEventListener("submit", (e) => { e.preventDefault(); const v = e.target.u?.value || ""; if (v.trim()) abrirLink(v); });
  caja.addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b) return; const d = b.dataset;
    if (d.fat) { const a = ATAJOS.find((x) => x.k === d.fat); if (a.aparte) abrirAparte(a.url); else pintar(esc(a.ayuda) + ` <button type="button" class="link" data-fbuscar="${a.k}">Buscar en ${a.n} ↗</button>`); return; }
    if (d.fbuscar) { abrirAparte(ATAJOS.find((x) => x.k === d.fbuscar).url); return; }
    if (d.ffav !== undefined) { const f = (perso().favs || [])[+d.ffav]; if (f) abrirLink(f.u, f.n); return; }
    if (d.fborrar !== undefined) { const fv = [...(perso().favs || [])]; fv.splice(+d.fborrar, 1); actualizarPerso({ favs: fv }); pintar(); return; }
    const a = d.fl; if (!a) return;
    if (a === "cerrar") { cerrarPip(); st.abierto = false; st.src = ""; st.url = ""; guardar(); caja.remove(); caja = null; return; }
    if (a === "min") { st.min = !st.min; guardar(); pintar(); return; }
    if (a === "cambiar") { cerrarPip(); st.src = ""; st.url = ""; guardar(); pintar(); return; }
    if (a === "aparte") { abrirAparte(st.url || st.src); return; }
    if (a === "fav") {
      const n = prompt("Nombre para este favorito:", st.titulo || ""); if (!n) return;
      actualizarPerso({ favs: [...(perso().favs || []).filter((f) => f.u !== st.url), { n: n.trim().slice(0, 40), u: st.url }].slice(-12) }); toast("Guardado en tus favoritos"); return;
    }
    if (a === "pip") { await sacarAfuera(); return; }
    if (a === "volver") { cerrarPip(); pintar(); return; }
  });
  // mover arrastrando la barra
  caja.addEventListener("pointerdown", (e) => {
    if (!e.target.closest(".fl-bar") || e.target.closest("button")) return;
    e.preventDefault(); const r = caja.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    caja.classList.add("moviendo");
    const mover = (ev) => { st.x = Math.min(Math.max(0, ev.clientX - dx), innerWidth - 120); st.y = Math.min(Math.max(0, ev.clientY - dy), innerHeight - 40); caja.style.left = st.x + "px"; caja.style.top = st.y + "px"; };
    const soltar = () => { caja.classList.remove("moviendo"); removeEventListener("pointermove", mover); removeEventListener("pointerup", soltar); guardar(); };
    addEventListener("pointermove", mover); addEventListener("pointerup", soltar);
  });
  // recordar el tamaño cuando se agranda desde la esquina
  new ResizeObserver(() => { if (!caja || st.min) return; const r = caja.getBoundingClientRect(); if (r.width > 200 && r.height > 120) { st.w = Math.round(r.width); st.h = Math.round(r.height); guardar(); } }).observe(caja);
}
async function sacarAfuera() {
  try {
    pip = await documentPictureInPicture.requestWindow({ width: st.w, height: Math.max(200, st.h - 36) });
    pip.document.body.style.cssText = "margin:0;background:#000;height:100vh;overflow:hidden";
    pip.document.title = st.titulo || "Web";
    const f = pip.document.createElement("iframe");
    f.src = st.src; f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write"; f.referrerPolicy = "strict-origin-when-cross-origin";
    f.style.cssText = "border:0;width:100%;height:100%;display:block"; pip.document.body.appendChild(f);
    pip.addEventListener("pagehide", () => { pip = null; if (caja) pintar(); });
    pintar();
  } catch (e) { pip = null; toast("No se pudo sacar afuera: " + e.message, "bad"); }
}
function cerrarPip() { if (pip) { const w = pip; pip = null; try { w.close(); } catch {} } }

/** Botón del menú lateral: abre o trae al frente la ventanita. */
export function alternarFlotante() {
  if (caja) { if (st.min) { st.min = false; guardar(); pintar(); } else caja.querySelector("input,iframe")?.focus(); caja.classList.add("destello"); setTimeout(() => caja?.classList.remove("destello"), 600); return; }
  st.abierto = true; guardar(); pintar();
}
/** Al entrar al sistema: si estaba abierta, vuelve a aparecer como estaba. */
export function iniciarFlotante() { if (st.abierto) pintar(); }
