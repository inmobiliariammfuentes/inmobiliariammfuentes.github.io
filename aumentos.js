// Cobranza Fuentes · Funciones de la "Calculadora de Alquileres" dentro del sistema
// · Redondeo de los aumentos calculados (exacto, para arriba o para abajo, de a $ 5.000 u otro paso)
// · Imagen del aumento para mandarle al inquilino (copiar / compartir / WhatsApp)
// · Calculadora libre: alquiler inicial + fecha + cada cuántos meses + índice → progresión completa
import { LOGO_URL } from "./comun.js?v=202611191546";
import { calcularAumento, FUENTES, masMeses, hoyISO } from "./indices.js?v=202611191546";

const BORDO = "#6e1b2a", BORDO2 = "#8c2a3b";
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const pesos = (n, usd) => (usd ? "U$S " : "$ ") + Math.round(n).toLocaleString("es-AR");
const pctTxt = (p) => (p >= 0 ? "+" : "") + String(Math.round(p * 100) / 100).replace(".", ",") + "%";
const mesTexto = (ym) => { const [y, m] = String(ym).split("-").map(Number); return MESES[m - 1] + " " + y; };
const fechaTxt = (iso) => String(iso || "").slice(0, 10).split("-").reverse().join("/");
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/* ---------- redondeo ---------- */
export const PASOS = [1000, 5000, 10000];
export function redondear(n, modo, paso = 5000) {
  if (!(n > 0) || !paso || (modo !== "arriba" && modo !== "abajo")) return Math.round(n);
  return (modo === "arriba" ? Math.ceil(n / paso) : Math.floor(n / paso)) * paso;
}
// aplica el redondeo de la configuración a un cálculo { nuevo, pct, ... } hecho sobre "base"
export function redondearCalculo(calc, base, cfg) {
  if (!calc || calc.error) return calc;
  const modo = cfg?.redondeo || "exacto", paso = +cfg?.redondeo_paso || 5000;
  const nuevo = redondear(calc.nuevo, modo, paso);
  if (nuevo === calc.nuevo) return calc;
  return { ...calc, original: calc.nuevo, nuevo, pct: Math.round((nuevo / base - 1) * 10000) / 100, redondeado: modo };
}
export function controlRedondeo(cfg) {
  const modo = cfg?.redondeo || "exacto", paso = +cfg?.redondeo_paso || 5000;
  const b = (m, t, tip) => `<button type="button" data-redondeo="${m}" aria-pressed="${modo === m}" title="${tip}">${t}</button>`;
  return `<div class="row redondeo-ctl" style="align-items:center;gap:10px"><span class="muted">Redondeo de los aumentos</span>
    <div class="seg">${b("exacto", "Exacto", "Sin redondear")}${b("arriba", "▲ Para arriba", "Redondea hacia arriba")}${b("abajo", "▼ Para abajo", "Redondea hacia abajo")}</div>
    <label class="row" style="gap:6px;align-items:center" title="Múltiplo al que se redondea"><span class="muted">de a</span><select data-redpaso style="width:auto">${PASOS.map((p) => `<option value="${p}" ${p === paso ? "selected" : ""}>$ ${p.toLocaleString("es-AR")}</option>`).join("")}</select></label></div>`;
}

/* ---------- imagen del aumento ---------- */
const imgs = {};
const cargarImg = (url) => (imgs[url] ||= new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = url; }));
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function lineas(g, txt, ancho) { const out = []; let l = ""; for (const w of String(txt).split(" ")) { const t = l ? l + " " + w : w; if (g.measureText(t).width > ancho && l) { out.push(l); l = w; } else l = t; } if (l) out.push(l); return out; }

// d: { inquilino, direccion, indice, meses, anterior, nuevo, pct, desde (YYYY-MM), estimado, usd, proximo (YYYY-MM opcional) }
export async function imagenAumento(d, cfg = {}) {
  try { await Promise.all([document.fonts?.load?.("700 40px 'Fraunces'"), document.fonts?.load?.("600 30px 'Plus Jakarta Sans'")]); } catch {}
  const W = 1080, SANS = "'Plus Jakarta Sans', Arial, sans-serif", SERIF = "'Fraunces', Georgia, serif", logo = await cargarImg(LOGO_URL);
  const dibujar = (g) => {
    const grad = g.createLinearGradient(0, 0, W, 300); grad.addColorStop(0, BORDO2); grad.addColorStop(1, "#4a111c");
    g.fillStyle = grad; g.fillRect(0, 0, W, 290);
    g.fillStyle = "#fff"; rr(g, 64, 62, 150, 150, 28); g.fill();
    if (logo) { const s = Math.min(120 / logo.width, 120 / logo.height); g.drawImage(logo, 64 + (150 - logo.width * s) / 2, 62 + (150 - logo.height * s) / 2, logo.width * s, logo.height * s); }
    g.fillStyle = "rgba(255,255,255,.75)"; g.font = `600 26px ${SANS}`; g.fillText((cfg.nombre || "Inmobiliaria M.M. Fuentes").toUpperCase(), 250, 108);
    g.fillStyle = "#fff"; g.font = `700 60px ${SERIF}`; g.fillText("Actualización", 248, 176);
    g.font = `500 30px ${SANS}`; g.fillStyle = "rgba(255,255,255,.9)"; g.fillText("del alquiler", 250, 220);
    let y = 350;
    const etiqueta = (t, v, grande) => { g.font = `600 24px ${SANS}`; g.fillStyle = "#7a6a6c"; g.fillText(t, 72, y); g.fillStyle = "#111"; g.font = `${grande ? 700 : 600} ${grande ? 36 : 32}px ${SANS}`;
      for (const l of lineas(g, v, W - 144)) { y += 46; g.fillText(l, 72, y); } y += 44; };
    if (d.inquilino) etiqueta("INQUILINO", d.inquilino, true);
    if (d.direccion) etiqueta("PROPIEDAD", d.direccion);
    g.font = `600 28px ${SANS}`; const cond = `Ajuste ${d.meses ? "cada " + d.meses + (+d.meses === 1 ? " mes" : " meses") + " " : ""}por ${d.indice}`;
    g.fillStyle = "#f6ecee"; rr(g, 56, y, W - 112, 76, 20); g.fill(); g.fillStyle = BORDO; g.fillText(cond, 88, y + 48); y += 112;
    // si el valor final no es el que daba el índice (redondeo o valor puesto a mano), se muestran los dos
    const conIndice = d.indiceMonto > 0 && Math.abs(d.indiceMonto - d.nuevo) >= 1;
    if (conIndice) {
      const pi = d.indicePct != null ? d.indicePct : (d.indiceMonto / d.anterior - 1) * 100;
      g.strokeStyle = "#e3d6d8"; g.lineWidth = 2; rr(g, 56, y, W - 112, 96, 20); g.stroke();
      g.fillStyle = "#7a6a6c"; g.font = `700 22px ${SANS}`; g.fillText(("SEGÚN EL ÍNDICE " + d.indice).toUpperCase(), 88, y + 40);
      g.fillStyle = "#444"; g.font = `600 30px ${SANS}`; g.fillText(pesos(d.indiceMonto, d.usd) + "   (" + pctTxt(pi) + ")", 88, y + 78);
      y += 124;
    }
    // tarjetas: actual → nuevo
    const cw = (W - 112 - 24) / 2;
    g.fillStyle = "#f7f3f3"; rr(g, 56, y, cw, 190, 22); g.fill();
    g.fillStyle = BORDO; rr(g, 56 + cw + 24, y, cw, 190, 22); g.fill();
    g.fillStyle = "#7a6a6c"; g.font = `700 22px ${SANS}`; g.fillText("ALQUILER ACTUAL", 88, y + 50);
    g.fillStyle = "#111"; g.font = `800 46px ${SANS}`; g.fillText(pesos(d.anterior, d.usd), 88, y + 112);
    g.fillStyle = "rgba(255,255,255,.8)"; g.font = `700 22px ${SANS}`; g.fillText(((conIndice ? "QUEDA EN · " : "") + "DESDE " + mesTexto(d.desde)).toUpperCase(), 88 + cw + 24, y + 50);
    g.fillStyle = "#fff"; g.font = `800 46px ${SANS}`; g.fillText(pesos(d.nuevo, d.usd), 88 + cw + 24, y + 112);
    g.font = `600 26px ${SANS}`; g.fillStyle = "rgba(255,255,255,.9)"; g.fillText(pctTxt(d.pct) + " de aumento", 88 + cw + 24, y + 158);
    y += 230;
    if (d.estimado) { g.fillStyle = "#8a5a00"; g.font = `600 24px ${SANS}`; for (const l of lineas(g, "Valor estimado: algún mes del índice todavía no fue publicado. Puede cambiar levemente.", W - 144)) { g.fillText(l, 72, y); y += 34; } y += 10; }
    if (d.proximo) { g.fillStyle = "#555"; g.font = `500 24px ${SANS}`; g.fillText("Próxima actualización: " + mesTexto(d.proximo), 72, y); y += 44; }
    y += 20; g.fillStyle = "#f4eff0"; g.fillRect(0, y, W, 120);
    g.fillStyle = "#4a3b3e"; g.textAlign = "center"; g.font = `600 26px ${SANS}`; g.fillText(cfg.nombre || "Inmobiliaria M.M. Fuentes", W / 2, y + 50);
    g.font = `400 24px ${SANS}`; g.fillText([cfg.telefono ? "Tel. " + cfg.telefono : "", cfg.whatsapp ? "WhatsApp " + cfg.whatsapp : "", cfg.email || ""].filter(Boolean).join("   ·   "), W / 2, y + 88); g.textAlign = "left";
    return y + 120;
  };
  const tmp = document.createElement("canvas"); tmp.width = W; tmp.height = 2400; const alto = Math.ceil(dibujar(tmp.getContext("2d")));
  const cv = document.createElement("canvas"); cv.width = W; cv.height = alto; const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, W, alto); dibujar(g);
  return cv;
}
export function textoAumento(d) {
  const n = (d.inquilino || "").split(" ")[0];
  const conIndice = d.indiceMonto > 0 && Math.abs(d.indiceMonto - d.nuevo) >= 1;
  const pi = conIndice ? (d.indicePct != null ? d.indicePct : (d.indiceMonto / d.anterior - 1) * 100) : null;
  return `Hola${n ? " " + n : ""}, te informamos la actualización del alquiler de ${d.direccion}: desde ${mesTexto(d.desde)} pasa de ${pesos(d.anterior, d.usd)} a ${pesos(d.nuevo, d.usd)} (${pctTxt(d.pct)}).`
    + (conIndice ? ` Según el índice ${d.indice} correspondía ${pesos(d.indiceMonto, d.usd)} (${pctTxt(pi)}); el valor quedó redondeado en ${pesos(d.nuevo, d.usd)}.` : ` Ajuste por ${d.indice}.`);
}
const pesos2 = (n, usd) => { const r = Math.round(n * 100) / 100; return (usd ? "U$S " : "$ ") + r.toLocaleString("es-AR", { minimumFractionDigits: Number.isInteger(r) ? 0 : 2, maximumFractionDigits: 2 }); };
/* ---------- imagen con el detalle a pagar ---------- */
// d: { inquilino, direccion, grupos:[{ p, label, filas:[{ desc, monto, menos, mora }] }], total, usd, vence (ISO o ""), bonificado, obs }
export async function imagenDetalle(d, cfg = {}) {
  try { await Promise.all([document.fonts?.load?.("700 40px 'Fraunces'"), document.fonts?.load?.("600 30px 'Plus Jakarta Sans'")]); } catch {}
  const W = 1080, SANS = "'Plus Jakarta Sans', Arial, sans-serif", SERIF = "'Fraunces', Georgia, serif", logo = await cargarImg(LOGO_URL);
  const varios = d.grupos.length > 1;
  const p0 = d.grupos[0].p, p1 = d.grupos[d.grupos.length - 1].p;
  const titMes = !varios ? cap(mesTexto(p0)) : p0.slice(0, 4) === p1.slice(0, 4) ? cap(MESES[+p0.slice(5, 7) - 1]) + " a " + mesTexto(p1) : cap(mesTexto(p0)) + " a " + mesTexto(p1);
  const dibujar = (g) => {
    const grad = g.createLinearGradient(0, 0, W, 300); grad.addColorStop(0, BORDO2); grad.addColorStop(1, "#4a111c");
    g.fillStyle = grad; g.fillRect(0, 0, W, 290);
    g.fillStyle = "#fff"; rr(g, 64, 62, 150, 150, 28); g.fill();
    if (logo) { const s = Math.min(120 / logo.width, 120 / logo.height); g.drawImage(logo, 64 + (150 - logo.width * s) / 2, 62 + (150 - logo.height * s) / 2, logo.width * s, logo.height * s); }
    g.fillStyle = "rgba(255,255,255,.75)"; g.font = `600 26px ${SANS}`; g.fillText((cfg.nombre || "Inmobiliaria M.M. Fuentes").toUpperCase(), 250, 108);
    g.fillStyle = "#fff"; g.font = `700 60px ${SERIF}`; g.fillText("Detalle a pagar", 248, 176);
    g.font = `500 30px ${SANS}`; g.fillStyle = "rgba(255,255,255,.9)"; g.fillText(titMes, 250, 220);
    let y = 350;
    const etiqueta = (t, v, grande) => { g.font = `600 24px ${SANS}`; g.fillStyle = "#7a6a6c"; g.fillText(t, 72, y); g.fillStyle = "#111"; g.font = `${grande ? 700 : 600} ${grande ? 36 : 32}px ${SANS}`;
      for (const l of lineas(g, v, W - 144)) { y += 46; g.fillText(l, 72, y); } y += 44; };
    if (d.inquilino) etiqueta("INQUILINO", d.inquilino, true);
    if (d.direccion) etiqueta("PROPIEDAD", d.direccion);
    // tabla
    const x0 = 56, ancho = W - 112, xd = 88, xm = W - 88;
    const top = y; y += 24;
    for (const gr of d.grupos) {
      if (varios) { g.fillStyle = BORDO; g.font = `700 22px ${SANS}`; g.fillText(("PERÍODO " + mesTexto(gr.p)).toUpperCase(), xd, y + 30); y += 52; }
      for (const f of gr.filas) {
        g.font = `600 30px ${SANS}`;
        const monto = (f.menos ? "− " : "") + pesos2(f.monto, d.usd), wm = g.measureText(monto).width;
        const ls = lineas(g, f.desc, xm - xd - wm - 40);
        g.fillStyle = f.menos ? "#1f7a4a" : f.mora ? "#a03a1a" : "#222";
        ls.forEach((l, i) => g.fillText(l, xd, y + 34 + i * 40));
        g.textAlign = "right"; g.font = `700 30px ${SANS}`; g.fillText(monto, xm, y + 34); g.textAlign = "left";
        if (f.menos && !/descuento|bonific/i.test(f.desc)) { g.font = `600 20px ${SANS}`; g.fillText("DESCUENTO", xd, y + 34 + ls.length * 40); y += 26; }
        y += 34 + ls.length * 40 - 14;
        g.strokeStyle = "#eee3e4"; g.lineWidth = 2; g.beginPath(); g.moveTo(xd, y); g.lineTo(xm, y); g.stroke(); y += 8;
      }
      y += 14;
    }
    y += 6;
    g.strokeStyle = "#e3d6d8"; g.lineWidth = 2; rr(g, x0, top, ancho, y - top, 22); g.stroke();
    y += 28;
    // total
    g.fillStyle = BORDO; rr(g, x0, y, ancho, 150, 22); g.fill();
    g.fillStyle = "rgba(255,255,255,.85)"; g.font = `700 24px ${SANS}`; g.fillText("TOTAL A PAGAR", xd, y + 56);
    if (d.vence) { g.font = `500 24px ${SANS}`; g.fillText("Vence el " + fechaTxt(d.vence), xd, y + 104); }
    g.fillStyle = "#fff"; g.textAlign = "right"; g.font = `800 56px ${SANS}`; g.fillText(pesos2(d.total, d.usd), xm, y + 96); g.textAlign = "left";
    y += 190;
    const nota = (t, col) => { g.fillStyle = col; g.font = `500 24px ${SANS}`; for (const l of lineas(g, t, W - 144)) { g.fillText(l, 72, y); y += 34; } y += 8; };
    if (d.bonificado) nota("Los intereses por mora fueron bonificados.", "#1f7a4a");
    if (d.vence) nota("Pasado el vencimiento se suman intereses por mora.", "#666");
    if (d.obs) nota(d.obs, "#444");
    y += 16; g.fillStyle = "#f4eff0"; g.fillRect(0, y, W, 120);
    g.fillStyle = "#4a3b3e"; g.textAlign = "center"; g.font = `600 26px ${SANS}`; g.fillText(cfg.nombre || "Inmobiliaria M.M. Fuentes", W / 2, y + 50);
    g.font = `400 24px ${SANS}`; g.fillText([cfg.telefono ? "Tel. " + cfg.telefono : "", cfg.whatsapp ? "WhatsApp " + cfg.whatsapp : "", cfg.email || ""].filter(Boolean).join("   ·   "), W / 2, y + 88); g.textAlign = "left";
    return y + 120;
  };
  const tmp = document.createElement("canvas"); tmp.width = W; tmp.height = 4000; const alto = Math.ceil(dibujar(tmp.getContext("2d")));
  const cv = document.createElement("canvas"); cv.width = W; cv.height = alto; const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, W, alto); dibujar(g);
  return cv;
}
export function textoDetalle(d) {
  const n = (d.inquilino || "").split(" ")[0];
  const meses = d.grupos.map((x) => mesTexto(x.p));
  const filas = d.grupos.flatMap((gr) => gr.filas.map((f) => `• ${f.desc}${d.grupos.length > 1 ? " (" + mesTexto(gr.p) + ")" : ""}: ${f.menos ? "− " : ""}${pesos2(f.monto, d.usd)}`));
  return `Hola${n ? " " + n : ""}, te pasamos el detalle a pagar de ${meses.length > 1 ? meses[0] + " a " + meses[meses.length - 1] : meses[0]} de ${d.direccion}:\n${filas.join("\n")}\nTotal: ${pesos2(d.total, d.usd)}${d.vence ? ` (vence el ${fechaTxt(d.vence)})` : ""}.`;
}
// accion: "copiar" | "compartir" | "descargar"
export async function enviarImagen(cv, accion, { tel, texto, nombre, toast }) {
  const blob = await new Promise((ok) => cv.toBlob(ok, "image/png"));
  if (accion === "descargar") { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = (nombre || "aumento") + ".png"; document.body.appendChild(a); a.click(); a.remove(); return; }
  if (accion === "compartir") {
    const file = new File([blob], (nombre || "aumento") + ".png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], text: texto }); } catch {} return; }
  }
  let copiada = false; try { await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]); copiada = true; } catch {}
  if (accion === "copiar") { toast(copiada ? "Imagen copiada: pegala en el chat de WhatsApp con Ctrl+V" : "Este navegador no deja copiar imágenes: usá Descargar", copiada ? undefined : "bad"); return; }
  const t = String(tel || "").replace(/\D/g, "").replace(/^0/, ""), n = t ? (t.startsWith("54") ? t : "549" + t.replace(/^15/, "")) : "";
  window.open("https://wa.me/" + n + "?text=" + encodeURIComponent(texto || ""), "_blank", "noopener");
  toast(copiada ? "Se abrió WhatsApp. La imagen quedó copiada: pegala en el chat con Ctrl+V." : "Se abrió WhatsApp con el mensaje.");
}
export function modalImagenHtml(titulo) {
  return `<div class="mh"><div><h2>${titulo}</h2><div class="muted">Mandásela al inquilino por WhatsApp</div></div><button class="x" data-cerrar aria-label="Cerrar">×</button></div>
  <div class="row" style="flex-wrap:wrap"><button class="btn primary" data-aumacc="compartir">Compartir / WhatsApp</button><button class="btn" data-aumacc="copiar">Copiar imagen</button><button class="btn" data-aumacc="descargar">Descargar imagen</button></div>
  <p class="muted" style="margin:8px 0">En la compu: <b>Copiar imagen</b> y pegala en WhatsApp Web (Ctrl+V). En el celular: <b>Compartir</b>.</p>
  <div class="doc-canvas" id="aum-cv"></div>`;
}

/* ---------- calculadora libre ---------- */
export function calculadoraHtml(v = {}) {
  const ind = Object.keys(FUENTES);
  return `<div class="mh"><div><h2>Calculadora de aumentos</h2><div class="muted">Igual que la Calculadora de Alquileres: con los índices oficiales que ya bajó el sistema</div></div><button class="x" data-cerrar aria-label="Cerrar">×</button></div>
  <form class="form" id="f-calcaum">
    <label>Alquiler inicial<input type="number" step="1" min="1" name="monto" value="${v.monto || ""}" required autofocus></label>
    <label>Fecha de inicio del contrato<input type="date" name="inicio" value="${v.inicio || ""}" required></label>
    <label>Se actualiza cada (meses)<input type="number" min="1" max="36" name="meses" value="${v.meses || 4}" required></label>
    <label>Índice<select name="indice">${ind.map((k) => `<option ${k === (v.indice || "IPC") ? "selected" : ""}>${k}</option>`).join("")}</select></label>
    <label class="full">Nombre del inquilino y dirección (opcional, para la imagen)<input type="text" name="quien" value="${v.quien || ""}" placeholder="Ej.: Juan Pérez · Rivadavia 1234 2°A"></label>
    <div class="full row"><button class="btn primary" type="submit">Calcular</button></div>
  </form><div id="calcaum-res"></div>`;
}
// devuelve la progresión: [{ n, desde, monto, pct, estimado, detalle }] hasta el próximo ajuste posterior a hoy
export function progresion(indices, { monto, inicio, meses, indice }, cfg) {
  const hoy = hoyISO(), filas = [{ n: 1, desde: inicio, monto: +monto, pct: null }];
  let ant = inicio, base = +monto, k = 1;
  while (k < 120) {
    const fechaAj = masMeses(inicio, k * +meses);
    let calc = calcularAumento(indices, indice, base, ant, fechaAj);
    if (calc.error) { filas.push({ n: k + 1, desde: fechaAj, error: calc.error }); break; }
    const futuro = fechaAj > hoy;
    if (futuro) calc = redondearCalculo(calc, base, cfg);
    filas.push({ n: k + 1, desde: fechaAj, monto: calc.nuevo, pct: calc.pct, estimado: calc.estimado, detalle: calc.detalle, original: calc.original, proximo: futuro });
    if (futuro) break;
    base = calc.nuevo; ant = fechaAj; k++;
  }
  return filas;
}
export function resultadoHtml(filas, money) {
  const ult = filas[filas.length - 1], vig = [...filas].reverse().find((f) => !f.proximo && !f.error) || filas[0];
  return `<div class="kpis" style="margin-top:14px;grid-template-columns:repeat(2,minmax(0,1fr))"><div class="kpi"><span class="lbl">Alquiler vigente hoy</span><b>${money(vig.monto)}</b><span class="muted">desde ${fechaTxt(vig.desde)}</span></div>
    ${ult.proximo ? `<div class="kpi"><span class="lbl">Próximo ajuste · ${fechaTxt(ult.desde)}</span><b>${money(ult.monto)}</b><span class="muted">${pctTxt(ult.pct)}${ult.estimado ? " · estimado" : ""}${ult.original ? ` · redondeado (antes ${money(ult.original)})` : ""}</span></div>` : ""}</div>
  <div class="tw" style="margin-top:12px"><table><thead><tr><th>Período</th><th>Desde</th><th class="num">Alquiler</th><th class="num">Aumento</th></tr></thead><tbody>
  ${filas.map((f) => `<tr><td>${f.n}</td><td>${fechaTxt(f.desde)}${f.proximo ? ' <span class="chip acc">Próximo</span>' : ""}</td><td class="num">${f.error ? `<span class="muted">${f.error}</span>` : money(f.monto)}</td><td class="num">${f.pct == null ? "—" : pctTxt(f.pct) + (f.estimado ? ' <span class="chip warn">estimado</span>' : "")}</td></tr>`).join("")}
  </tbody></table></div>
  ${ult.proximo ? `<div class="row" style="margin-top:12px"><button class="btn primary" data-calcimg>Imagen para el inquilino</button></div><div class="doc-canvas" id="aum-cv" style="margin-top:12px" hidden></div>` : ""}`;
}
export { mesTexto, cap };
