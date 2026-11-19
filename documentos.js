// Cobranza Fuentes · Reservas y renovaciones
// · Renovación: arma una imagen con las condiciones y los importes para mandarle al inquilino por WhatsApp.
// · Reserva: arma el "Recibo de reserva para alquiler" (mismo texto que el modelo de Word) en PDF y en imagen.
// Todo se dibuja en esta computadora; lo que se guarda queda en la tabla documentos_generados.
import { numeroALetras, LOGO_URL } from "./comun.js?v=202611191519";

const MEMBRETE_URL = new URL("membrete.png", LOGO_URL).href;
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const AJUSTES = [[1, "mensual"], [2, "bimestral"], [3, "trimestral"], [4, "cuatrimestral"], [6, "semestral"], [12, "anual"]];
const INDICES = ["IPC", "ICL", "Casa Propia", "CAC", "CER", "UVA"];
const TIPOS_INMUEBLE = ["departamento", "casa", "PH", "local", "oficina", "cochera", "galpón", "terreno"];
const BORDO = "#6e1b2a", BORDO2 = "#8c2a3b";

let X = null;          // contexto que pasa gestion.js: { sb, S, esc, toast, fecha, P, montoHoy, ymSumar, ymDe }
let st = { tab: "renovacion", ren: null, res: null, guardados: null, firma: undefined, imgs: {} };

/* ---------- utilidades ---------- */
const num = (v) => { const n = parseFloat(String(v ?? "").replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const pesos = (n) => "$ " + (Math.round(n * 100) / 100).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const letras = (n) => { const t = numeroALetras(n, "ARS").replace(/ (DE )?PESOS/, ""); return "PESOS " + t; };
const nombreNatural = (n) => { const s = String(n || "").trim(); if (!s.includes(",")) return s; const [a, b] = s.split(","); return (b.trim() + " " + a.trim()).trim(); };
const apellido = (n) => { const s = String(n || "").trim(); return (s.includes(",") ? s.split(",")[0] : s.split(" ").slice(-1)[0] || s).trim(); };
const mesTexto = (ym) => { if (!/^\d{4}-\d{2}$/.test(ym || "")) return ""; const [y, m] = ym.split("-").map(Number); return MESES[m - 1] + " " + y; };
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const hoyISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const textoAjuste = (m) => (AJUSTES.find((a) => a[0] === +m) || [0, `cada ${m} meses`])[1];
const e = (s) => X.esc(s ?? "");
function cargarImg(url) {
  if (st.imgs[url]) return st.imgs[url];
  st.imgs[url] = new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = url; });
  return st.imgs[url];
}
async function firma() {
  if (st.firma !== undefined) return st.firma;
  try { const { data } = await X.sb.from("recursos").select("valor").eq("clave", "firma").maybeSingle(); st.firma = data?.valor ? await cargarImg(data.valor) : null; }
  catch { st.firma = null; }
  return st.firma;
}

/* ---------- valores por defecto ---------- */
function renNueva(c) {
  const d = { contrato_id: null, inquilino: "", telefono: "", direccion: "", anios: 2, ajuste: 4, indice: "IPC", primer_mes: X.ymSumar(X.ymHoy(), 1), alquiler: "",
    renglones: [{ c: "Dif. depósito", m: "" }, { c: "Honorarios", m: "" }, { c: "Averiguación de garantía", m: "0", n: "Si es la misma garantía que la anterior" },
      { c: "Sellado", m: "0" }, { c: "Certificaciones", m: "0" }, { c: "Informes", m: "0" }, { c: "IVA", m: "0" }],
    total: true, valido: "", obs: "" };
  if (c) {
    const pi = X.P(c.inquilino_id);
    Object.assign(d, { contrato_id: c.id, inquilino: nombreNatural(pi.nombre), telefono: pi.telefono || "", direccion: c.direccion, ajuste: +c.ajuste_meses || 4,
      indice: INDICES.includes(c.indice) ? c.indice : c.indice || "IPC", primer_mes: X.ymSumar(X.ymDe(c.fin), 1), actual: X.montoHoy(c) });
  }
  return d;
}
function resNueva() {
  return { trato: "Sr.", nombre: "", dni: "", domicilio: "", localidad: "", email: "", telefono: "", reserva: "", forma: "TRANSFERENCIA",
    tipo: "departamento", direccion: "", ubicacion: "de Haedo, Pdo. de Morón, Pcia. de Bs. As.", composicion: "", alquiler: "",
    anios: 2, ajuste: 4, indice: "IPC", requisitos: "RECIBOS DE SUELDO", servicios: "LUZ", dias: 5, fecha: hoyISO(),
    deposito: "", mes: "", honorarios: "", sellado: "0", informes: "0", con_firma: true };
}
const totalRes = (d) => num(d.deposito) + num(d.mes || d.alquiler) + num(d.honorarios) + num(d.sellado) + num(d.informes) - num(d.reserva);
const totalRen = (d) => num(d.alquiler) + d.renglones.reduce((s, r) => s + num(r.m), 0);

/* ---------- pantalla ---------- */
export function vDocumentos() {
  return `<div class="head"><div><h1>Reservas y renovaciones</h1><p>Armá la imagen de una renovación para mandarle al inquilino, o el recibo de reserva de un inquilino nuevo.</p></div></div>
  <div class="tabs" role="tablist"><button data-dtab="renovacion" aria-selected="${st.tab === "renovacion"}">Renovación</button><button data-dtab="reserva" aria-selected="${st.tab === "reserva"}">Reserva</button><button data-dtab="guardados" aria-selected="${st.tab === "guardados"}">Guardados</button></div>
  <div id="docs-root"><div class="empty">Cargando…</div></div>`;
}
export async function montarDocumentos(ctx) {
  X = ctx;
  const root = document.getElementById("docs-root"); if (!root) return;
  if (st.tab === "guardados") return pintarGuardados(root);
  if (st.tab === "renovacion") { st.ren ||= renNueva(); root.innerHTML = formRen(st.ren); }
  else { st.res ||= resNueva(); root.innerHTML = formRes(st.res); }
  if (!root.dataset.escucha) { root.dataset.escucha = "1"; root.addEventListener("input", alEditar); root.addEventListener("change", alEditar); root.addEventListener("click", alClic); }
  vista();
}
export function tabDocumentos(t) { st.tab = t; }
export function abrirRenovacion(ctx, c) { X = ctx; st.tab = "renovacion"; st.ren = renNueva(c); }

const campo = (lbl, k, v, extra = "") => `<label>${lbl}<input type="text" data-k="${k}" value="${e(v)}" ${extra}></label>`;
const monto = (lbl, k, v) => `<label>${lbl}<input type="text" inputmode="decimal" data-k="${k}" value="${e(v)}" placeholder="0"></label>`;
const sel = (lbl, k, v, ops) => `<label>${lbl}<select data-k="${k}">${ops.map(([val, t]) => `<option value="${e(val)}" ${String(val) === String(v) ? "selected" : ""}>${e(t)}</option>`).join("")}</select></label>`;
const opsAjuste = AJUSTES.map(([m, t]) => [m, cap(t)]);
const opsIndice = (v) => [...new Set([...INDICES, v].filter(Boolean))].map((x) => [x, x]);
function opcionesContratos(soloVigentes) {
  const hoy = hoyISO();
  return [...X.S.contratos.values()].filter((c) => !soloVigentes || (!c.rescindido && c.fin >= X.ymSumar(X.ymHoy(), -3) + "-01"))
    .sort((a, b) => (soloVigentes ? (a.fin < b.fin ? -1 : 1) : a.direccion.localeCompare(b.direccion)))
    .map((c) => `<option value="${e(`${c.direccion} — ${nombreNatural(X.P(c.inquilino_id).nombre)}${soloVigentes ? " (vence " + X.fecha(c.fin) + ")" : ""}`)}" data-id="${c.id}"></option>`).join("");
}
function formRen(d) {
  return `<div class="docs-grid"><section class="panel"><h2>Datos de la renovación</h2><div class="form">
    <label class="full">Contrato a renovar<input type="search" id="dr-contrato" list="dl-dr" placeholder="Buscá por dirección o inquilino" autocomplete="off"><datalist id="dl-dr">${opcionesContratos(true)}</datalist></label>
    ${campo("Inquilino", "inquilino", d.inquilino)}${campo("Celular (para WhatsApp)", "telefono", d.telefono)}
    <label class="full">Propiedad<input type="text" data-k="direccion" value="${e(d.direccion)}"></label>
    <label>Duración (años)<input type="number" min="1" max="10" data-k="anios" value="${e(d.anios)}"></label>
    ${sel("Ajuste", "ajuste", d.ajuste, opsAjuste)}${sel("Índice", "indice", d.indice, opsIndice(d.indice))}
    <label>Primer mes<input type="month" data-k="primer_mes" value="${e(d.primer_mes)}"></label>
    <label>Alquiler del primer mes${d.actual ? ` <span class="muted">(hoy paga ${pesos(d.actual)})</span>` : ""}<input type="text" inputmode="decimal" data-k="alquiler" value="${e(d.alquiler)}" placeholder="0"></label>
    <label>Válido hasta (opcional)<input type="date" data-k="valido" value="${e(d.valido)}"></label>
  </div>
  <h3 style="margin:16px 0 6px">Otros importes</h3>
  <div class="doc-renglones">${d.renglones.map((r, i) => `<div class="doc-renglon" data-i="${i}"><input type="text" data-r="c" value="${e(r.c)}" aria-label="Concepto"><input type="text" inputmode="decimal" data-r="m" value="${e(r.m)}" placeholder="0" aria-label="Importe"><input type="text" data-r="n" value="${e(r.n || "")}" placeholder="Aclaración (opcional)" aria-label="Aclaración"><button type="button" class="x" data-quitarren="${i}" aria-label="Quitar">×</button></div>`).join("")}</div>
  <div class="row"><button type="button" class="btn small" data-agregarren>+ Agregar importe</button><label class="check"><input type="checkbox" data-k="total" ${d.total ? "checked" : ""}> Mostrar el total</label></div>
  <div class="form" style="margin-top:10px"><label class="full">Observaciones (opcional)<textarea data-k="obs" rows="2">${e(d.obs)}</textarea></label></div>
  </section>${panelVista("Mandar la imagen al inquilino")}</div>`;
}
function formRes(d) {
  const t = totalRes(d);
  return `<div class="docs-grid"><section class="panel"><h2>Quién reserva</h2><div class="form">
    ${sel("Trato", "trato", d.trato, [["Sr.", "Sr."], ["Sra.", "Sra."], ["Srta.", "Srta."], ["Sres.", "Sres."]])}
    ${campo("Nombre y apellido", "nombre", d.nombre)}${campo("DNI", "dni", d.dni, 'inputmode="numeric"')}${campo("Celular", "telefono", d.telefono)}
    ${campo("Domicilio", "domicilio", d.domicilio)}${campo("Localidad", "localidad", d.localidad, 'placeholder="Ituzaingó, Prov. de Bs. As."')}
    <label class="full">Email<input type="email" data-k="email" value="${e(d.email)}"></label>
    ${monto("Importe de la reserva", "reserva", d.reserva)}${sel("Forma de pago de la reserva", "forma", d.forma, [["TRANSFERENCIA", "Transferencia"], ["EFECTIVO", "Efectivo (se imprime y firma el inquilino)"]])}
  </div>
  <h2 style="margin-top:18px">La propiedad</h2><div class="form">
    <label class="full">Copiar dirección de un contrato (opcional)<input type="search" id="dres-contrato" list="dl-dres" placeholder="Buscá por dirección" autocomplete="off"><datalist id="dl-dres">${opcionesContratos(false)}</datalist></label>
    ${sel("Tipo", "tipo", d.tipo, TIPOS_INMUEBLE.map((x) => [x, cap(x)]))}${campo("Dirección", "direccion", d.direccion, 'placeholder="Emperanza N° 3051"')}
    <label class="full">Localidad y partido<input type="text" data-k="ubicacion" value="${e(d.ubicacion)}"></label>
    <label class="full">Compuesto por<input type="text" data-k="composicion" value="${e(d.composicion)}" placeholder="Living comedor y cocina integrados, baño completo"></label>
    ${monto("Alquiler", "alquiler", d.alquiler)}<label>Duración (años)<input type="number" min="1" max="10" data-k="anios" value="${e(d.anios)}"></label>
    ${sel("Ajuste", "ajuste", d.ajuste, opsAjuste)}${sel("Índice", "indice", d.indice, opsIndice(d.indice))}
    ${campo("Requisitos", "requisitos", d.requisitos)}${campo("Servicios a cargo del inquilino", "servicios", d.servicios)}
    <label>Días para presentar la documentación<input type="number" min="1" max="60" data-k="dias" value="${e(d.dias)}"></label>
    <label>Fecha<input type="date" data-k="fecha" value="${e(d.fecha)}"></label>
  </div>
  <h2 style="margin-top:18px">Liquidación</h2><div class="form">
    ${monto("Depósito", "deposito", d.deposito)}${monto("Mes adelantado", "mes", d.mes)}
    ${monto("Honorarios", "honorarios", d.honorarios)}${monto("Sellado del contrato", "sellado", d.sellado)}
    ${monto("Informes / certificaciones", "informes", d.informes)}
    <label>Reserva a descontar<input type="text" value="${e(pesos(num(d.reserva)))}" disabled></label>
    <div class="full total-line"><span>Total a abonar a la firma del contrato</span><span class="mono" id="dres-total">${pesos(t)}</span></div>
    <label class="check full"><input type="checkbox" data-k="con_firma" ${d.con_firma ? "checked" : ""}> Incluir la firma y el sello de M.M. Fuentes</label>
  </div></section>${panelVista("Mandar la reserva", true)}</div>`;
}
const panelVista = (titulo, pdf) => `<section class="panel doc-vista"><h2>${titulo}</h2>
  <div class="row" style="flex-wrap:wrap">${pdf ? `<button type="button" class="btn primary" data-dacc="pdf">Descargar PDF</button>` : ""}<button type="button" class="btn ${pdf ? "" : "primary"}" data-dacc="compartir">Compartir / WhatsApp</button><button type="button" class="btn" data-dacc="copiar">Copiar imagen</button><button type="button" class="btn" data-dacc="png">Descargar imagen</button><button type="button" class="btn" data-dacc="guardar">Guardar</button><button type="button" class="btn" data-dacc="nuevo">Empezar de cero</button></div>
  <p class="muted" style="margin:8px 0">En la compu: <b>Copiar imagen</b> y pegala en el chat de WhatsApp Web (Ctrl+V). En el celular: <b>Compartir</b>.</p>
  <div class="doc-canvas"><canvas id="doc-cv"></canvas></div></section>`;

/* ---------- edición ---------- */
let tVista = 0;
function alEditar(ev) {
  const t = ev.target, d = st.tab === "renovacion" ? st.ren : st.res; if (!d) return;
  if (t.id === "dr-contrato" || t.id === "dres-contrato") {
    const o = [...t.list.options].find((x) => x.value === t.value); if (!o) return;
    const c = X.S.contratos.get(+o.dataset.id); if (!c) return;
    if (t.id === "dr-contrato") { st.ren = renNueva(c); }
    else { st.res.direccion = c.direccion; }
    setTimeout(() => montarDocumentos(X), 0); return;
  }
  if (t.dataset.k) { d[t.dataset.k] = t.type === "checkbox" ? t.checked : t.value; }
  else if (t.dataset.r) { const i = +t.closest(".doc-renglon").dataset.i; d.renglones[i][t.dataset.r] = t.value; }
  else return;
  if (st.tab === "reserva") { const el = document.getElementById("dres-total"); if (el) el.textContent = pesos(totalRes(d)); }
  clearTimeout(tVista); tVista = setTimeout(vista, 250);
}
async function alClic(ev) {
  const b = ev.target.closest("button"); if (!b) return;
  if (b.dataset.agregarren !== undefined) { st.ren.renglones.push({ c: "", m: "" }); return montarDocumentos(X); }
  if (b.dataset.quitarren !== undefined) { st.ren.renglones.splice(+b.dataset.quitarren, 1); return montarDocumentos(X); }
  if (b.dataset.abrirdoc) { const g = st.guardados.find((x) => x.id === +b.dataset.abrirdoc); if (!g) return;
    st.tab = g.tipo; if (g.tipo === "renovacion") st.ren = { ...g.datos, _id: g.id }; else st.res = { ...g.datos, _id: g.id }; X.rerender(); return; }
  if (b.dataset.borrardoc) { if (!confirm("¿Borrar este documento guardado?")) return; const { error } = await X.sb.from("documentos_generados").delete().eq("id", +b.dataset.borrardoc); if (error) return X.toast(error.message, "bad"); st.guardados = null; return montarDocumentos(X); }
  const a = b.dataset.dacc; if (!a) return;
  const ren = st.tab === "renovacion", d = ren ? st.ren : st.res;
  if (a === "nuevo") { if (ren) st.ren = renNueva(); else st.res = resNueva(); return montarDocumentos(X); }
  if (!ren && !(d.nombre || "").trim()) return X.toast("Completá el nombre de quien reserva", "bad");
  if (ren && !(d.inquilino || "").trim()) return X.toast("Completá el nombre del inquilino", "bad");
  const cv = await vista(); if (!cv) return;
  const nombreArch = (ren ? "Renovacion " + (d.direccion || d.inquilino) : "Reserva " + (d.direccion || "") + " " + apellido(d.nombre)).replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  const blob = await new Promise((ok) => cv.toBlob(ok, "image/png"));
  if (a === "png") return bajar(URL.createObjectURL(blob), nombreArch + ".png");
  if (a === "pdf") {
    const { jsPDF } = window.jspdf || {}; if (!jsPDF) return X.toast("No se pudo cargar el generador de PDF. Revisá la conexión.", "bad");
    const doc = new jsPDF({ unit: "mm", format: "a4" }); doc.addImage(cv.toDataURL("image/jpeg", 0.93), "JPEG", 0, 0, 210, 297); doc.save(nombreArch + ".pdf"); return;
  }
  if (a === "copiar") {
    try { await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]); X.toast("Imagen copiada: pegala en el chat de WhatsApp con Ctrl+V"); }
    catch { X.toast("Este navegador no deja copiar imágenes. Usá Descargar imagen.", "bad"); }
    return;
  }
  if (a === "compartir") {
    const file = new File([blob], nombreArch + ".png", { type: "image/png" });
    const texto = ren ? `Hola ${(d.inquilino || "").split(" ")[0]}, te enviamos las condiciones para la renovación del contrato de ${d.direccion}.` : `Hola ${(d.nombre || "").split(" ")[0]}, te enviamos el recibo de la reserva de ${d.direccion}.`;
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], text: texto }); } catch {} return; }
    try { await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]); } catch {}
    const tel = String(d.telefono || "").replace(/\D/g, "").replace(/^0/, ""), n = tel ? (tel.startsWith("54") ? tel : "549" + tel.replace(/^15/, "")) : "";
    window.open("https://wa.me/" + n + "?text=" + encodeURIComponent(texto), "_blank", "noopener");
    X.toast("Se abrió WhatsApp. La imagen quedó copiada: pegala en el chat con Ctrl+V.");
    return;
  }
  if (a === "guardar") {
    const datos = { ...d }; delete datos._id;
    const fila = { tipo: st.tab, contrato_id: ren ? d.contrato_id || null : null, titulo: ren ? `${d.direccion} · ${d.inquilino}` : `${d.direccion} · ${d.nombre}`, datos, updated_at: new Date().toISOString() };
    const q = d._id ? X.sb.from("documentos_generados").update(fila).eq("id", d._id).select().single() : X.sb.from("documentos_generados").insert(fila).select().single();
    const { data, error } = await q; if (error) return X.toast(error.message, "bad");
    d._id = data.id; st.guardados = null; X.toast("Guardado. Lo encontrás en la pestaña Guardados.");
  }
}
function bajar(url, nombre) { const a = document.createElement("a"); a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); }

async function pintarGuardados(root) {
  if (!st.guardados) { const { data, error } = await X.sb.from("documentos_generados").select("*").order("updated_at", { ascending: false }).limit(200); if (error) { root.innerHTML = `<div class="error">${e(error.message)}</div>`; return; } st.guardados = data || []; }
  root.innerHTML = `<section class="panel"><div class="tw"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th><th></th></tr></thead><tbody>
  ${st.guardados.map((g) => `<tr><td class="num">${X.fecha(String(g.updated_at || g.created_at).slice(0, 10))}</td><td>${g.tipo === "reserva" ? "Reserva" : "Renovación"}</td><td>${e(g.titulo)}</td><td class="num"><button class="btn small" data-abrirdoc="${g.id}">Abrir</button> <button class="btn small danger" data-borrardoc="${g.id}">Borrar</button></td></tr>`).join("") || `<tr><td colspan="4"><div class="empty">Todavía no guardaste ninguna reserva ni renovación.</div></td></tr>`}
  </tbody></table></div></section>`;
  if (!root.dataset.escucha) { root.dataset.escucha = "1"; root.addEventListener("input", alEditar); root.addEventListener("change", alEditar); root.addEventListener("click", alClic); }
}

/* ---------- dibujo ---------- */
async function vista() {
  const cv = document.getElementById("doc-cv"); if (!cv) return null;
  try { await Promise.all([document.fonts?.load?.("700 40px 'Fraunces'"), document.fonts?.load?.("600 30px 'Plus Jakarta Sans'"), document.fonts?.load?.("400 30px 'Plus Jakarta Sans'")]); } catch {}
  if (st.tab === "renovacion") await dibujarRenovacion(cv, st.ren); else await dibujarReserva(cv, st.res);
  return cv;
}

// texto con estilos mezclados: [[texto, "biu"], ...]; devuelve la altura usada
function parrafo(g, partes, x, y, ancho, tam, alto, familia, justificar, color = "#111") {
  const fuente = (s) => `${s.includes("i") ? "italic " : ""}${s.includes("b") ? "bold " : ""}${tam}px ${familia}`;
  const palabras = [];
  for (const [t, s = ""] of partes) for (const w of String(t).split(/(\s+)/)) { if (!w) continue; palabras.push({ w, s, esp: /^\s+$/.test(w) }); }
  const lineas = []; let lin = [], an = 0;
  for (const p of palabras) {
    g.font = fuente(p.s); p.an = g.measureText(p.esp ? " " : p.w).width;
    if (p.esp) { if (lin.length) { lin.push(p); an += p.an; } continue; }
    if (an + p.an > ancho && lin.length) { while (lin.length && lin[lin.length - 1].esp) { an -= lin.pop().an; } lineas.push(lin); lin = []; an = 0; }
    lin.push(p); an += p.an;
  }
  if (lin.length) lineas.push(lin);
  let yy = y;
  lineas.forEach((l, k) => {
    const ult = k === lineas.length - 1, esps = l.filter((p) => p.esp).length, usado = l.reduce((s, p) => s + p.an, 0);
    const extra = justificar && !ult && esps ? (ancho - usado) / esps : 0; let xx = x;
    for (const p of l) {
      g.font = fuente(p.s); g.fillStyle = color;
      if (!p.esp) { g.fillText(p.w, xx, yy); if (p.s.includes("u")) g.fillRect(xx, yy + tam * 0.15, p.an, Math.max(1, tam / 14)); }
      else if (l[l.indexOf(p) - 1]?.s.includes("u") && l[l.indexOf(p) + 1]?.s.includes("u")) g.fillRect(xx, yy + tam * 0.15, p.an + extra, Math.max(1, tam / 14));
      xx += p.an + (p.esp ? extra : 0);
    }
    yy += alto;
  });
  return yy - y;
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

async function dibujarRenovacion(cv, d) {
  const W = 1080, SANS = "'Plus Jakarta Sans', Arial, sans-serif", SERIF = "'Fraunces', Georgia, serif";
  const logo = await cargarImg(LOGO_URL), cfg = X.S.cfg || {};
  const filas = [{ c: `1° mes${d.primer_mes ? " (" + cap(mesTexto(d.primer_mes)) + ")" : ""}`, m: num(d.alquiler) }]
    .concat(d.renglones.filter((r) => (r.c || "").trim()).map((r) => ({ c: r.c.trim(), m: num(r.m), n: (r.n || "").trim() })));
  const notas = filas.filter((f) => f.n); notas.forEach((f, i) => (f.ast = "*".repeat(i + 1)));
  const dibujar = (g) => {
    let y = 0;
    // cabecera bordó
    const grad = g.createLinearGradient(0, 0, W, 300); grad.addColorStop(0, BORDO2); grad.addColorStop(1, "#4a111c");
    g.fillStyle = grad; g.fillRect(0, 0, W, 300);
    g.fillStyle = "#fff"; rr(g, 64, 62, 150, 150, 28); g.fill();
    if (logo) { const s = Math.min(120 / logo.width, 120 / logo.height); g.drawImage(logo, 64 + (150 - logo.width * s) / 2, 62 + (150 - logo.height * s) / 2, logo.width * s, logo.height * s); }
    g.fillStyle = "rgba(255,255,255,.75)"; g.font = `600 26px ${SANS}`; g.fillText((cfg.nombre || "Inmobiliaria M.M. Fuentes").toUpperCase(), 250, 110);
    g.fillStyle = "#fff"; g.font = `700 64px ${SERIF}`; g.fillText("Renovación", 248, 182);
    g.font = `500 30px ${SANS}`; g.fillStyle = "rgba(255,255,255,.9)"; g.fillText("de contrato de alquiler", 250, 226);
    y = 360;
    // datos
    g.fillStyle = "#111";
    if (d.inquilino) { g.font = `500 26px ${SANS}`; g.fillStyle = "#7a6a6c"; g.fillText("INQUILINO", 72, y); g.fillStyle = "#111"; g.font = `700 36px ${SANS}`; g.fillText(d.inquilino, 72, y + 46); y += 96; }
    if (d.direccion) { g.font = `500 26px ${SANS}`; g.fillStyle = "#7a6a6c"; g.fillText("PROPIEDAD", 72, y); g.fillStyle = "#111"; g.font = `700 36px ${SANS}`; y += 46 + parrafo(g, [[d.direccion, "b"]], 72, y + 46, W - 144, 36, 44, SANS, false) - 44; y += 50; }
    // condiciones
    const cond = `Contrato por ${d.anios} año${+d.anios === 1 ? "" : "s"} con ajuste ${textoAjuste(d.ajuste)} por ${d.indice}`;
    g.font = `600 30px ${SANS}`; const lineasCond = Math.ceil(g.measureText(cond).width / (W - 200)) || 1;
    g.fillStyle = "#f6ecee"; rr(g, 56, y, W - 112, 60 + lineasCond * 40, 22); g.fill();
    y += 54 + parrafo(g, [[cond, "b"]], 88, y + 54, W - 176, 30, 40, SANS, false, BORDO) - 40 + 42;
    y += 28;
    // importes
    for (const f of filas) {
      g.strokeStyle = "#eadfe1"; g.lineWidth = 2; g.beginPath(); g.moveTo(72, y); g.lineTo(W - 72, y); g.stroke();
      g.fillStyle = "#222"; g.font = `500 32px ${SANS}`; g.fillText(f.c + (f.ast ? " " + f.ast : ""), 72, y + 58);
      g.font = `700 34px ${SANS}`; g.textAlign = "right"; g.fillStyle = f.m ? "#111" : "#8a8a8a"; g.fillText(pesos(f.m), W - 72, y + 58); g.textAlign = "left";
      y += 86;
    }
    if (d.total) {
      y += 12; g.fillStyle = BORDO; rr(g, 56, y, W - 112, 96, 22); g.fill();
      g.fillStyle = "#fff"; g.font = `600 32px ${SANS}`; g.fillText("Total a abonar", 92, y + 60);
      g.font = `800 40px ${SANS}`; g.textAlign = "right"; g.fillText(pesos(totalRen(d)), W - 92, y + 62); g.textAlign = "left"; y += 130;
    } else y += 20;
    for (const f of notas) { g.fillStyle = "#555"; y += parrafo(g, [[f.ast + " ", "b"], [f.n, ""]], 72, y + 30, W - 144, 26, 36, SANS, false, "#555"); }
    if (d.obs) { y += 16; y += parrafo(g, [[d.obs, ""]], 72, y + 30, W - 144, 27, 38, SANS, false, "#333"); }
    if (d.valido) { y += 10; g.font = `600 26px ${SANS}`; g.fillStyle = BORDO; g.fillText("Valores válidos hasta el " + X.fecha(d.valido), 72, y + 34); y += 50; }
    // pie
    y += 40; g.fillStyle = "#f4eff0"; g.fillRect(0, y, W, 120);
    g.fillStyle = "#4a3b3e"; g.font = `500 26px ${SANS}`;
    const pie = [cfg.telefono ? "Tel. " + cfg.telefono : "", cfg.whatsapp ? "WhatsApp " + cfg.whatsapp : "", cfg.email || ""].filter(Boolean).join("   ·   ");
    g.textAlign = "center"; g.fillText(cfg.nombre || "Inmobiliaria M.M. Fuentes", W / 2, y + 50); g.font = `400 24px ${SANS}`; g.fillText(pie, W / 2, y + 88); g.textAlign = "left";
    return y + 120;
  };
  const tmp = document.createElement("canvas"); tmp.width = W; tmp.height = 3000; const alto = Math.ceil(dibujar(tmp.getContext("2d")));
  cv.width = W; cv.height = alto; const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, W, alto); dibujar(g);
}

async function dibujarReserva(cv, d) {
  const W = 1654, H = 2339, M = 150, ARIAL = "Arial, Helvetica, sans-serif";   // A4 a 200 dpi
  const memb = await cargarImg(MEMBRETE_URL), fir = d.con_firma ? await firma() : null, cfg = X.S.cfg || {};
  cv.width = W; cv.height = H; const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); g.fillStyle = "#111"; g.textBaseline = "alphabetic";
  let y = 70;
  if (memb) { const w = 640, h = memb.height * (w / memb.width); g.drawImage(memb, (W - w) / 2 + 40, y, w, h); y += h + 18; }
  g.fillStyle = "#555"; g.fillRect(M, y, W - 2 * M, 2); y += 60;
  g.fillStyle = "#111"; g.font = `bold 34px ${ARIAL}`; g.textAlign = "center"; g.fillText("RECIBO DE RESERVA PARA ALQUILER", W / 2, y);
  const tw = g.measureText("RECIBO DE RESERVA PARA ALQUILER").width; g.fillRect(W / 2 - tw / 2, y + 6, tw, 2); g.textAlign = "left"; y += 66;
  const f = new Date((d.fecha || hoyISO()) + "T12:00:00"), dia = f.getDate(), mes = MESES[f.getMonth()], anio = f.getFullYear();
  const nom = (d.nombre || "").trim().toUpperCase(), ape = apellido(d.nombre).toUpperCase();
  const res = num(d.reserva), alq = num(d.alquiler);
  const partes = [
    ["Recibimos en este acto, de " + (d.trato === "Sr." ? "el " : d.trato === "Sres." ? "los " : "la ") + d.trato + " "], [nom + ", con D.N.I. Nº " + (d.dni || "____________"), "b"],
    [", con domicilio en " + (d.domicilio || "________________") + ", de la localidad de " + (d.localidad || "________________") + "; y constituye domicilio electrónico en la siguiente casilla de mail: "],
    [d.email || "________________", "u"], [", la "],
    ["suma de " + letras(res) + " (" + pesos(res) + ".-) en concepto de RESERVA de un inmueble del tipo " + (d.tipo || "") + ", sito en la calle " + (d.direccion || "________________") + ", " + (d.ubicacion || "") + " El alquiler se fija en la suma de " + letras(alq) + " (" + pesos(alq) + ".-)", "b"],
    [". - El mismo está compuesto por: " + (d.composicion || "________________") + ". - Este alquiler se fijará según el siguiente esquema"], [":", "b"],
    [" CONTRATO POR " + d.anios + " AÑO/s CON AJUSTE " + textoAjuste(d.ajuste).toUpperCase() + " SEGÚN " + String(d.indice || "").toUpperCase() + ". " + (d.requisitos ? d.requisitos.toUpperCase() + "; " : "") + (d.servicios ? "SERVICIOS A CARGO DEL LOCATARIO: " + d.servicios.toUpperCase() + ". " : "")],
    ["OBSERVACIONES", "b"], [": " + (d.trato === "Sr." ? "El " : d.trato === "Sres." ? "Los " : "La ") + d.trato + " " + ape + ", se compromete" + (d.trato === "Sres." ? "n" : "") + " a presentar la documentación requerida dentro de los próximos " + d.dias + " días CORRIDOS. "],
    ["Importante:", "biu"],
    [" En el caso de no presentarme a la firma del contrato de locación, o de no reunir los requisitos solicitados para llevar a cabo el contrato de locación, perderé el importe íntegro, entregado en éste documento, quedará la reserva a favor del propietario y de la firma interviniente por partes iguales; una vez debitados los gastos que hubiere incurrido la firma inmobiliaria, dejando en completa libertad de acción a la firma intermediaria para que pueda alquilar ésta propiedad, sin derecho de su parte a reclamo de alguna naturaleza; sin necesidad de interpelación judicial ni extrajudicial alguna. Por su parte la firma M.M. FUENTES, me devolverá el importe entregado en el caso de no ser aceptada esta propuesta, por el propietario del inmueble en cuestión. - En prueba de conformidad " + (d.forma === "EFECTIVO" ? "se firma" : "se envía por WhatsApp") + " el ejemplar de un mismo tenor y a un solo efecto, en Haedo a los "],
    [String(dia), "b"], [" días del mes de "], [mes, "b"], [" del presente año "], [String(anio) + ".-", "b"], [" ACEPTAMOS INTEGRAMENTE LAS CONDICIONES.", "i"],
  ];
  y += parrafo(g, partes, M, y, W - 2 * M, 27, 41, ARIAL, true);
  y += 10; g.fillStyle = "#111"; g.fillRect(M, y, W - 2 * M, 3); y += 70;
  g.font = `bold 30px ${ARIAL}`; g.fillText("LIQUIDACIÓN:", M, y); g.fillRect(M, y + 6, g.measureText("LIQUIDACIÓN:").width, 2); y += 62;
  const liq = [["Depósito", num(d.deposito)], ["Mes adelantado", num(d.mes || d.alquiler)], ["Honorarios", num(d.honorarios)], ["Sellado ctto.", num(d.sellado)], ["Informes/Certif.", num(d.informes)], ["Reserva a descontar:", -res, true]];
  g.font = `italic bold 27px ${ARIAL}`;
  for (const [c, m, sub] of liq) { const t = `${c} - - - - - - - - ${m < 0 ? "- " : ""}${pesos(Math.abs(m))}.-`; g.fillText(t, M, y); if (sub) g.fillRect(M, y + 5, g.measureText(c).width, 2); y += 40; }
  g.fillText(`Total a abonar a la firma del ctto: ${pesos(totalRes(d))}.-`, M, y); y += 60;
  // firmas
  const yf = Math.max(y + 170, 1880);
  if (fir) { const w = 300, h = fir.height * (w / fir.width); g.drawImage(fir, M + 50, yf - h - 6, w, h); }
  g.fillStyle = "#111"; g.font = `bold italic 27px ${ARIAL}`; g.textAlign = "center";
  // en efectivo queda en blanco: se imprime y el inquilino firma arriba de la línea
  if ((d.forma || "TRANSFERENCIA") !== "EFECTIVO") g.fillText("RESERVA POR " + (d.forma || "TRANSFERENCIA"), W - M - 300, yf - 40);
  g.fillRect(M, yf, 400, 2); g.fillRect(W - M - 520, yf, 440, 2);
  g.font = `bold 26px ${ARIAL}`; g.fillText("Por M.M.FUENTES", M + 200, yf + 40); g.fillText("Firma/s  Oferente/s", W - M - 300, yf + 40); g.textAlign = "left";
  // pie
  const yp = H - 120; g.fillStyle = "#999"; g.fillRect(M, yp, W - 2 * M, 2);
  g.textAlign = "center"; g.fillStyle = "#666"; g.font = `24px ${ARIAL}`;
  g.fillText([cfg.domicilio && !/Partido de Morón, Buenos Aires$/.test(cfg.domicilio) ? cfg.domicilio : "Carlos Tejedor 1211. Haedo", cfg.telefono ? "Te/fax: " + cfg.telefono : "Te/fax: 4460-3333", cfg.email ? "e-mail: " + cfg.email : ""].filter(Boolean).join(".  "), W / 2, yp + 44);
  g.textAlign = "left";
}
