// Cobranza Fuentes · Personalización por usuario del sistema del equipo
// Cada persona del equipo elige su color, modo claro/oscuro, tamaño de letra, qué ve en el menú lateral y en qué orden.
// Se guarda en la base (tabla preferencias_staff, una fila por usuario) y una copia en el navegador para que
// al abrir el sistema se vea enseguida con su personalización.
import { esc, toast, abrirModal } from "./comun.js?v=202611171827";

export const COLORES = [
  ["#7a1f2e", "Bordó (original)"], ["#a3355f", "Frambuesa"], ["#a14a1f", "Terracota"], ["#8a6a12", "Mostaza"],
  ["#2f6b3a", "Verde"], ["#0f5e66", "Petróleo"], ["#1f4e8c", "Azul"], ["#5b3a8c", "Violeta"], ["#3a3f47", "Grafito"],
];
const ORIGINAL = "#7a1f2e";
const TAMANOS = [["0.92", "Chica"], ["1", "Normal"], ["1.08", "Grande"], ["1.16", "Muy grande"]];
export const PERSO_BASE = { color: ORIGINAL, modo: "auto", zoom: "1", compacto: false, quieto: false, dolar: true, calc: true, web: true, intercom: true, favs: [], inicio: "contratos", orden: [], ocultos: [] };

let P = { ...PERSO_BASE }, ctx = null, tGuardar = null;
export const perso = () => P;

const mezcla = (c, pct, con) => `color-mix(in srgb,${c} ${pct}%,${con})`;
function cssColor(c) {
  if (!/^#[0-9a-f]{6}$/i.test(c) || c.toLowerCase() === ORIGINAL) return "";
  const claro = `--accent:${c};--accent-2:${mezcla(c, 75, "#000")};--accent-soft:${mezcla(c, 11, "#fff")};--accent-ink:${c};`
    + `--side-bg:linear-gradient(180deg,${c} 0%,${mezcla(c, 75, "#000")} 52%,${mezcla(c, 55, "#000")} 100%);`
    + `--side-flujo:linear-gradient(165deg,${mezcla(c, 88, "#fff")} 0%,${mezcla(c, 80, "#000")} 22%,${mezcla(c, 58, "#000")} 45%,${c} 68%,${mezcla(c, 82, "#fff")} 84%,${mezcla(c, 72, "#000")} 100%)`;
  const osc = `--accent:${mezcla(c, 88, "#fff")};--accent-2:${c};--accent-soft:${mezcla(c, 30, "#141113")};--accent-ink:${mezcla(c, 22, "#fff")};`
    + `--side-bg:linear-gradient(180deg,${mezcla(c, 85, "#000")} 0%,${mezcla(c, 65, "#000")} 55%,${mezcla(c, 45, "#000")} 100%);`
    + `--side-flujo:linear-gradient(165deg,${c} 0%,${mezcla(c, 70, "#000")} 22%,${mezcla(c, 45, "#000")} 45%,${mezcla(c, 82, "#000")} 68%,${mezcla(c, 92, "#fff")} 84%,${mezcla(c, 60, "#000")} 100%)`;
  return `:root.perso{${claro}}@media (prefers-color-scheme: dark){:root.perso:not([data-theme="light"]){${osc}}}:root.perso[data-theme="dark"]{${osc}}`
    + `.login{background:linear-gradient(160deg,${c},${mezcla(c, 60, "#000")})}`;
}
function cssDe(p) {
  let s = cssColor(p.color);
  if (p.zoom && p.zoom !== "1") s += `body.gestion{zoom:${+p.zoom || 1}}`;
  if (p.compacto) s += `body.gestion td{padding-top:6px;padding-bottom:6px}body.gestion th{padding-top:8px;padding-bottom:8px}`;
  if (p.quieto) s += `.side{animation:none!important;background-size:100% 100%!important}`;
  if (!p.dolar) s += `#dolar{display:none!important}`;
  if (!p.calc) s += `#calc-abrir{display:none!important}`;
  if (!p.web) s += `#web-abrir{display:none!important}`;
  if (!p.intercom) s += `#ic-abrir{display:none!important}`;
  return s;
}
/** Aplica la personalización a la pantalla (y deja una copia en el navegador para la próxima apertura). */
export function aplicarPerso(p = P) {
  P = { ...PERSO_BASE, ...(p || {}) };
  const css = cssDe(P);
  let st = document.getElementById("perso-css");
  if (!st) { st = document.createElement("style"); st.id = "perso-css"; document.head.appendChild(st); }
  st.textContent = css;
  document.documentElement.classList.add("perso");
  if (P.modo === "light" || P.modo === "dark") document.documentElement.dataset.theme = P.modo;
  else delete document.documentElement.dataset.theme;
  try { localStorage.setItem("perso-css", css); if (P.modo === "auto") localStorage.removeItem("tema"); else localStorage.setItem("tema", P.modo); } catch {}
}
/** Lee la personalización guardada del usuario que inició sesión. */
export async function cargarPerso(sb, c) {
  ctx = c;
  try {
    const { data } = await sb.from("preferencias_staff").select("datos").maybeSingle();
    let p = data?.datos;
    if (!p) { let t = null; try { t = localStorage.getItem("tema"); } catch {} p = { modo: t === "light" || t === "dark" ? t : "auto" }; }
    aplicarPerso(p);
  } catch { aplicarPerso(P); }
  return P;
}
export function guardarPerso(aviso) {
  clearTimeout(tGuardar);
  tGuardar = setTimeout(async () => {
    if (!ctx) return;
    const { error } = await ctx.sb.from("preferencias_staff").upsert({ user_id: ctx.userId, datos: P, updated_at: new Date().toISOString() });
    if (error) toast("No se pudo guardar la personalización: " + error.message, "bad"); else if (aviso) toast("Personalización guardada");
  }, 500);
}
/** Al tocar el botón de modo claro/oscuro del menú: queda guardado como preferencia. */
export function persoTema() { P.modo = document.documentElement.dataset.theme || "auto"; aplicarPerso(P); guardarPerso(false); }
/** Cambia y guarda algunos datos sin avisar (por ejemplo los favoritos de la web flotante). */
export function actualizarPerso(x) { aplicarPerso({ ...P, ...x }); guardarPerso(false); }
export function salirPerso() { try { localStorage.removeItem("perso-css"); } catch {} }

/** Las secciones del menú en el orden y con la visibilidad que eligió el usuario. */
export function vistasOrdenadas(vistas, p = P) {
  const k = vistas.map((v) => v[0]);
  const orden = [...(p.orden || []).filter((x) => k.includes(x)), ...k.filter((x) => !(p.orden || []).includes(x))];
  return orden.map((x) => vistas.find((v) => v[0] === x));
}
export const vistasVisibles = (vistas, p = P) => vistasOrdenadas(vistas, p).filter(([k]) => !(p.ocultos || []).includes(k));

/* ---------------- ventana de personalización ---------------- */
function html(vistas) {
  const p = P, propio = !COLORES.some(([c]) => c === p.color.toLowerCase());
  const seg = (nombre, ops, val) => `<div class="seg" role="group">${ops.map(([v, l]) => `<button type="button" data-pseg="${nombre}" data-v="${v}" aria-pressed="${String(val) === v}">${l}</button>`).join("")}</div>`;
  const sw = (k, l, d) => `<label class="pp-sw"><input type="checkbox" data-pchk="${k}" ${p[k] ? "checked" : ""}><span><b>${l}</b>${d ? `<small class="muted">${d}</small>` : ""}</span></label>`;
  const ord = vistasOrdenadas(vistas, p), n = ord.length;
  const visibles = ord.filter(([k]) => !p.ocultos.includes(k));
  return `<div class="mh"><div><h2>Personalizar mi sistema</h2><div class="muted">Solo cambia cómo lo ves vos. Los demás del equipo, los inquilinos, los propietarios y los recibos no cambian.</div></div><button class="x" data-cerrar aria-label="Cerrar">×</button></div>
  <div class="pp">
    <section><h3>Color</h3>
      <div class="pp-colores">${COLORES.map(([c, l]) => `<button type="button" class="pp-color" data-pcolor="${c}" style="--c:${c}" aria-pressed="${p.color.toLowerCase() === c}" title="${l}"><span></span>${esc(l)}</button>`).join("")}
        <label class="pp-color pp-propio" aria-pressed="${propio}" title="Elegir otro color"><input type="color" data-pcolor-libre value="${esc(p.color)}"><span style="--c:${esc(p.color)}"></span>Otro…</label></div></section>
    <section><h3>Modo</h3>${seg("modo", [["light", "Claro"], ["dark", "Oscuro"], ["auto", "Automático (como la compu)"]], p.modo)}</section>
    <section><h3>Tamaño de letra</h3>${seg("zoom", TAMANOS, p.zoom)}</section>
    <section><h3>Menú lateral</h3>
      <p class="muted">Destildá lo que no usás y ordená con las flechas. Lo que ocultes se puede volver a mostrar cuando quieras.</p>
      <div class="pp-menu">${ord.map(([k, l], i) => `<div class="pp-it ${p.ocultos.includes(k) ? "off" : ""}"><label><input type="checkbox" data-pver="${k}" ${p.ocultos.includes(k) ? "" : "checked"}> ${esc(l)}</label>
        <span class="pp-fl"><button type="button" class="btn small ghost" data-pmov="${k}" data-d="-1" ${i === 0 ? "disabled" : ""} aria-label="Subir ${esc(l)}">↑</button><button type="button" class="btn small ghost" data-pmov="${k}" data-d="1" ${i === n - 1 ? "disabled" : ""} aria-label="Bajar ${esc(l)}">↓</button></span></div>`).join("")}</div>
      <div class="pp-sws">${sw("dolar", "Mostrar dólar blue")}${sw("calc", "Mostrar botón de la calculadora")}${sw("web", "Mostrar botón de la web flotante")}${sw("intercom", "Mostrar intercomunicador")}${sw("quieto", "Fondo del menú sin movimiento")}</div></section>
    <section><h3>Al entrar al sistema abrir</h3>
      <select data-pinicio>${visibles.map(([k, l]) => `<option value="${k}" ${p.inicio === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></section>
    <section><h3>Tablas</h3><div class="pp-sws">${sw("compacto", "Tablas compactas", "Renglones más bajos: entran más contratos en la pantalla")}</div></section>
  </div>
  <div class="row" style="justify-content:space-between;margin-top:16px"><button type="button" class="btn" data-preset>Volver a como venía</button><button type="button" class="btn primary" data-cerrar>Listo</button></div>`;
}
export function abrirPersonalizar(vistas, alCambiar) {
  const pintar = () => {
    const m = document.querySelector("#modal .modal");
    if (!m) { abrirModal(html(vistas), true); } else { const sc = m.scrollTop; m.innerHTML = html(vistas); m.scrollTop = sc; }
    const r = document.querySelector("#modal .modal"); r.classList.add("pp-modal");
    r.onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      const d = b.dataset;
      if (d.pcolor) cambio({ color: d.pcolor });
      else if (d.pseg) cambio({ [d.pseg]: d.v });
      else if (d.pmov) {
        const o = vistasOrdenadas(vistas).map((v) => v[0]), i = o.indexOf(d.pmov), j = i + +d.d;
        if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; cambio({ orden: o });
      } else if (d.preset !== undefined) { if (confirm("¿Volver al diseño original del sistema?")) cambio({ ...PERSO_BASE, favs: P.favs }); }
    };
    r.onchange = (e) => {
      const t = e.target, d = t.dataset;
      if (d.pchk) cambio({ [d.pchk]: t.checked });
      else if (d.pinicio !== undefined) cambio({ inicio: t.value });
      else if (d.pver) {
        let oc = P.ocultos.filter((x) => x !== d.pver); if (!t.checked) oc.push(d.pver);
        if (oc.length >= vistas.length) { toast("Tiene que quedar al menos una sección en el menú", "bad"); t.checked = true; return; }
        const vis = vistas.map((v) => v[0]).filter((k) => !oc.includes(k));
        cambio({ ocultos: oc, inicio: vis.includes(P.inicio) ? P.inicio : vistasVisibles(vistas, { ...P, ocultos: oc })[0][0] });
      }
    };
    r.oninput = (e) => { if (e.target.dataset.pcolorLibre !== undefined) { aplicarPerso({ ...P, color: e.target.value }); } };
    const libre = r.querySelector("[data-pcolor-libre]"); if (libre) libre.addEventListener("change", (e) => cambio({ color: e.target.value }));
  };
  const cambio = (x) => { aplicarPerso({ ...P, ...x }); guardarPerso(true); alCambiar?.(); pintar(); };
  pintar();
}
