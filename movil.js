// Cobranza Fuentes · Versión para el celular del sistema del equipo
// En el teléfono el sistema se abre en una versión básica: buscar un contrato, ver y mandar recibos,
// cobrar (generar el recibo) y liquidar. Se puede instalar como app y siempre se puede pasar a la versión completa.
import { esc, toast, LOGO_URL } from "./comun.js?v=202611191546";

const UA = navigator.userAgent;
export const esCelularReal = () => /Android|iPhone|iPod|Mobile/i.test(UA) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1 && innerWidth < 900);
export function modoMovil() {
  let pref = null; try { pref = localStorage.getItem("gestion-version"); } catch {}
  if (pref === "completa") return false;
  if (pref === "movil") return true;
  return esCelularReal() && Math.min(innerWidth, screen.width) < 820;
}
export function elegirVersion(v) { try { localStorage.setItem("gestion-version", v); } catch {} location.reload(); }

export const VISTAS_MOVIL = new Set(["m-buscar", "cobrar", "planilla", "liqprop"]);

/** Barra inferior con las 3 secciones. */
export function barraMovil(actual, nPend) {
  const b = (v, l, ic, n) => `<button data-vista="${v}" ${actual === v ? 'aria-current="page"' : ""}>${ic}<span>${l}</span>${n ? `<i class="mt-n">${n}</i>` : ""}</button>`;
  const ICON = {
    buscar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    cobrar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></svg>',
    liquidar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>',
  };
  return b("m-buscar", "Buscar", ICON.buscar) + b("cobrar", "Cobrar", ICON.cobrar);
}

/** Pantalla principal en el celular: buscador de contratos con accesos directos. */
export function vistaBuscar(ctx) {
  const { S, q, contratos, inq, prop, deuda, money, periodo, fecha, pad5, ultimosRecibos } = ctx;
  const t = q.trim().toLowerCase();
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const lista = t ? contratos.filter((c) => [c.direccion, inq(c), prop(c), c.carpeta, (S.personas.get(c.inquilino_id) || {}).dni, (S.personas.get(c.propietario_id) || {}).dni].some((x) => norm(x).includes(norm(t)))).slice(0, 30) : [];
  const tarjeta = (c) => {
    const d = deuda(c), saldo = d.reduce((s, x) => s + x.saldo, 0), venc = d.some((x) => x.vencido && !x.enTolerancia);
    return `<article class="m-card"><div class="m-card-h"><div><b>${esc(c.direccion)}</b><span>${esc(inq(c))}</span></div>${c.carpeta ? `<span class="m-carp">${c.carpeta}</span>` : ""}</div>
      <div class="m-card-d"><span class="muted">Propietario</span> ${esc(prop(c))}</div>
      <div class="m-card-d">${saldo ? `<span class="chip ${venc ? "bad" : "warn"}">Debe ${money(saldo, c)}</span> <span class="muted">${d.map((x) => periodo(x.p)).slice(0, 2).join(", ")}${d.length > 2 ? "…" : ""}</span>` : `<span class="chip ok">Al día</span>`}</div>
      <div class="m-acc"><button class="btn primary" data-cobrar="${c.id}">Cobrar</button><button class="btn" data-mrecibos="${c.id}">Recibos</button><button class="btn" data-liqprop="${c.propietario_id}">Liquidar</button><button class="btn" data-ficha="${c.id}">Contrato</button></div></article>`;
  };
  const ult = ultimosRecibos(8);
  return `<div class="m-buscar"><h1>Buscar contrato</h1>
    <input type="search" id="q" class="m-q" placeholder="Dirección, inquilino, propietario, DNI o carpeta" value="${esc(q)}" autocomplete="off" enterkeyhint="search">
    ${t ? (lista.map(tarjeta).join("") || `<div class="panel empty">No encontramos contratos con "${esc(q)}".</div>`)
      : `<h2 class="m-sub">Últimos recibos</h2>${ult.map(({ p, c }) => `<button class="m-rec" data-recibo="${p.id}"><span><b>N° ${pad5(p.recibo_nro)}</b> · ${esc(c?.direccion || "")}</span><span class="muted">${fecha(p.fecha)} · ${esc(c ? inq(c) : "")}</span><b class="m-rec-m">${money(p.total, c)}</b></button>`).join("") || `<p class="muted">Todavía no hay recibos.</p>`}`}
  </div>`;
}

/** Lista de recibos de un contrato (para ver, mandar por WhatsApp o descargar). */
export function htmlRecibos(c, pagos, { money, fecha, periodo, pad5 }) {
  return `<div class="mh"><div><h2>Recibos</h2><div class="muted">${esc(c.direccion)}</div></div><button class="x" data-cerrar aria-label="Cerrar">×</button></div>
    ${pagos.length ? `<div class="m-recs">${pagos.slice(0, 24).map((p) => `<button class="m-rec" data-recibo="${p.id}"><span><b>N° ${pad5(p.recibo_nro)}</b>${p.anulado ? ' <span class="chip bad">Anulado</span>' : ""}</span><span class="muted">${fecha(p.fecha)} · ${periodo(p.periodo)}</span><b class="m-rec-m">${money(p.total, c)}</b></button>`).join("")}</div>`
      : `<p class="muted">Este contrato todavía no tiene recibos.</p>`}
    <div class="row"><button class="btn primary" data-cobrar="${c.id}">Cobrar y generar recibo</button></div>`;
}

/* ---------- instalar como app ---------- */
let pedido = null;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); pedido = e; document.getElementById("instalar")?.remove(); mostrarInstalarGestion(); });
addEventListener("appinstalled", () => { document.getElementById("instalar")?.remove(); toast("¡Listo! El sistema ya está en tu celular"); });
const esApp = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const esIOS = () => /iphone|ipad|ipod/i.test(UA) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export function mostrarInstalarGestion(esperado) {
  if (esApp() || !esCelularReal() || document.getElementById("instalar") || !document.body.classList.contains("movil")) return;
  try { if (+localStorage.getItem("instalar-gestion-despues") > Date.now()) return; } catch {}
  if (!esIOS() && !pedido && !esperado) { setTimeout(() => mostrarInstalarGestion(true), 3500); return; }
  const d = document.createElement("div"); d.id = "instalar"; d.className = "instalar"; d.setAttribute("role", "dialog");
  const icono = `<img src="${new URL("icono-gestion-192.png", LOGO_URL).href}" alt="" width="48" height="48">`;
  d.innerHTML = pedido
    ? `${icono}<div class="ins-txt"><b>Instalá el sistema en tu celular</b><span>Un ícono para entrar con un toque: buscar contratos, cobrar, mandar recibos y liquidar.</span></div><div class="ins-acc"><button class="btn primary" data-ins="si">Instalar</button><button class="btn ghost" data-ins="no">Ahora no</button></div>`
    : esIOS()
      ? `${icono}<div class="ins-txt"><b>Instalá el sistema en tu celular</b><span>Tocá <b>Compartir</b> <svg class="ins-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg> abajo y después <b>Agregar a inicio</b>.</span></div><div class="ins-acc"><button class="btn ghost" data-ins="no">Entendido</button></div>`
      : `${icono}<div class="ins-txt"><b>Instalá el sistema en tu celular</b><span>Tocá el menú <b>⋮</b> del navegador y después <b>Instalar app</b> o <b>Agregar a pantalla principal</b>.</span></div><div class="ins-acc"><button class="btn ghost" data-ins="no">Entendido</button></div>`;
  document.body.appendChild(d);
  d.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-ins]"); if (!b) return;
    if (b.dataset.ins === "si" && pedido) { pedido.prompt(); const r = await pedido.userChoice.catch(() => null); pedido = null; if (r?.outcome === "accepted") { d.remove(); return; } }
    try { localStorage.setItem("instalar-gestion-despues", String(Date.now() + 7 * 864e5)); } catch {}
    d.remove();
  });
}
