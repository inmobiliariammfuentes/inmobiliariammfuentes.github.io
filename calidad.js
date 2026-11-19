// Cobranza Fuentes · Control de calidad de los datos de contacto
// Revisa a inquilinos y propietarios con contrato vigente: celular (vacío, mal escrito, repetido, varios números),
// email, DNI y cuenta bancaria. Es la base para conectar el WhatsApp del sistema: cada persona se reconoce por su celular.
import { esc, normCel, fmtCel } from "./comun.js?v=202611191553";

const TIPOS = {
  sin_cel: ["Sin celular", "bad", "cel"], cel_invalido: ["Celular mal escrito", "bad", "cel"], cel_repetido: ["Celular repetido", "bad", "rep"],
  cel_inmobiliaria: ["Es el número de la inmobiliaria", "bad", "cel"], cel_varios: ["Tiene más de un número", "warn", "cel"],
  cel_supuesto: ["Sin código de área (se supone 11)", "warn", "cel"], cel_exterior: ["Número del exterior", "acc", "cel"], cel_formato: ["Formato a corregir", "acc", "fmt"],
  sin_email: ["Sin email", "warn", "mail"], email_invalido: ["Email mal escrito", "bad", "mail"],
  sin_dni: ["Sin DNI", "warn", "dni"], dni_invalido: ["DNI raro", "warn", "dni"],
  sin_cuenta: ["Sin CBU ni alias", "warn", "cta"], cbu_invalido: ["CBU incompleto", "bad", "cta"],
};
const FILTROS = [["todos", "Todo"], ["cel", "Celular"], ["rep", "Repetidos"], ["fmt", "Se corrige solo"], ["mail", "Email"], ["dni", "DNI"], ["cta", "Cuenta bancaria"]];
const mismoNombre = (a, b) => String(a).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "") === String(b).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");

/** Revisa los datos. ctx: { personas: Map, contratos: iterable, activo: fn, cfg } */
export function revisarDatos(ctx) {
  const roles = new Map(); // persona_id -> { roles:Set, contratos:[] }
  for (const c of ctx.contratos) if (ctx.activo(c)) for (const [id, rol] of [[c.inquilino_id, "inquilino"], [c.propietario_id, "propietario"]]) {
    if (!id) continue; if (!roles.has(id)) roles.set(id, { roles: new Set(), contratos: [] });
    const r = roles.get(id); r.roles.add(rol); r.contratos.push(c);
  }
  const propios = new Set([ctx.cfg?.telefono, ctx.cfg?.whatsapp].map((t) => normCel(t)).filter((n) => n.ok).map((n) => n.cel));
  const filas = [], porCel = new Map();
  for (const [id, r] of roles) {
    const p = ctx.personas.get(id); if (!p) continue;
    const n = normCel(p.telefono), prob = [];
    if (n.vacio) prob.push("sin_cel");
    else if (!n.ok) prob.push("cel_invalido");
    else {
      if (propios.has(n.cel)) prob.push("cel_inmobiliaria");
      if (n.varios) prob.push("cel_varios");
      if (n.supuesto) prob.push("cel_supuesto");
      if (n.exterior) prob.push("cel_exterior");
      if (!n.varios && !n.supuesto && !n.exterior && String(p.telefono).trim() !== n.cel) prob.push("cel_formato");
      if (!porCel.has(n.cel)) porCel.set(n.cel, []); porCel.get(n.cel).push(p);
    }
    const em = (p.email || "").trim();
    if (!em) prob.push("sin_email"); else if (!/^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i.test(em)) prob.push("email_invalido");
    const dni = String(p.dni || "").replace(/\D/g, "");
    if (!dni) prob.push("sin_dni"); else if (!(dni.length === 7 || dni.length === 8 || dni.length === 11)) prob.push("dni_invalido");
    if (r.roles.has("propietario")) {
      const cbu = String(p.cbu || "").replace(/\D/g, "");
      if (!cbu && !(p.alias || "").trim()) prob.push("sin_cuenta"); else if (cbu && cbu.length !== 22) prob.push("cbu_invalido");
    }
    filas.push({ p, roles: [...r.roles], contratos: r.contratos, n, prob });
  }
  for (const [cel, ps] of porCel) {
    const distintos = ps.filter((x, i) => ps.findIndex((y) => y.id !== x.id && !mismoNombre(y.nombre, x.nombre) && String(y.dni || "x") !== String(x.dni || "y")) >= 0);
    for (const x of distintos) { const f = filas.find((f) => f.p.id === x.id); f.prob.push("cel_repetido"); f.con = ps.filter((y) => y.id !== x.id && !mismoNombre(y.nombre, x.nombre)).map((y) => y.nombre); }
  }
  const listos = filas.filter((f) => f.n.ok && !f.prob.some((k) => ["cel_repetido", "cel_inmobiliaria", "cel_varios", "cel_supuesto"].includes(k)));
  return { filas, listos: listos.length, total: filas.length, porCel };
}

/** Pantalla del control de calidad. st: { filtro, rol } */
export function vistaCalidad(r, st) {
  const cuenta = (k) => r.filas.filter((f) => f.prob.some((x) => TIPOS[x][2] === k)).length;
  const conRol = r.filas.filter((f) => st.rol === "ambos" || f.roles.includes(st.rol));
  const lista = conRol.filter((f) => f.prob.length && (st.filtro === "todos" || f.prob.some((x) => TIPOS[x][2] === st.filtro)))
    .sort((a, b) => peso(b) - peso(a) || a.p.nombre.localeCompare(b.p.nombre, "es"));
  const fmt = r.filas.filter((f) => f.prob.includes("cel_formato")).length;
  const pct = r.total ? Math.round((r.listos / r.total) * 100) : 0;
  const kpi = (t, v, d, cls = "") => `<div class="kpi ${cls}"><div class="t">${t}</div><div class="v">${v}</div><div class="muted">${d}</div></div>`;
  const rolB = (k, l) => `<button data-calrol="${k}" aria-pressed="${st.rol === k}">${l}</button>`;
  return `<section class="panel cal-res">
    <div class="cal-barra"><div><b>${pct}% listos para WhatsApp</b><span class="muted"> · ${r.listos} de ${r.total} personas con contrato vigente tienen un celular correcto y propio</span></div>
      <div class="bar-bg"><div class="bar" style="width:${pct}%"></div></div></div>
    <div class="kpis">${kpi("Sin celular o mal escrito", r.filas.filter((f) => f.prob.some((x) => ["sin_cel", "cel_invalido"].includes(x))).length, "no se los puede reconocer", "bad")}
      ${kpi("Celulares repetidos", cuenta("rep"), "el mismo número en varias personas", "bad")}
      ${kpi("A revisar", r.filas.filter((f) => f.prob.some((x) => ["cel_varios", "cel_supuesto", "cel_inmobiliaria"].includes(x))).length, "varios números o sin código de área")}
      ${kpi("Sin email", r.filas.filter((f) => f.prob.includes("sin_email")).length, "no reciben avisos por mail")}</div>
    ${fmt ? `<div class="banner cal-fmt"><span><b>${fmt} celulares</b> están bien pero escritos con espacios, guiones, 15 o 0. Se pueden dejar todos con el mismo formato de una vez.</span><button class="btn primary" data-a="cal-fix-todos">Corregir formato de los ${fmt}</button></div>` : ""}
  </section>
  <div class="row cal-filtros"><div class="seg">${rolB("ambos", "Todos")}${rolB("inquilino", "Inquilinos")}${rolB("propietario", "Propietarios")}</div>
    <div class="seg">${FILTROS.map(([k, l]) => `<button data-calfiltro="${k}" aria-pressed="${st.filtro === k}">${l}${k !== "todos" ? ` <span class="n">${cuentaRol(conRol, k)}</span>` : ""}</button>`).join("")}</div>
    <button class="btn" data-a="cal-csv">Descargar lista</button></div>
  <div class="tw"><table class="cal-tabla"><thead><tr><th>Persona</th><th>Contrato</th><th>Celular cargado</th><th>Qué pasa</th><th></th></tr></thead><tbody>
  ${lista.slice(0, st.limite || 150).map((f) => {
    const sug = f.n.ok && (f.prob.includes("cel_formato") || f.prob.includes("cel_varios") || f.prob.includes("cel_supuesto") || (f.prob.includes("cel_exterior") && String(f.p.telefono).trim() !== f.n.cel));
    return `<tr><td><button class="link" data-persona="${f.p.id}">${esc(f.p.nombre)}</button><div class="muted">${f.roles.map((x) => x === "inquilino" ? "Inquilino" : "Propietario").join(" y ")}</div></td>
    <td>${esc(f.contratos[0]?.direccion || "")}${f.contratos.length > 1 ? `<div class="muted">y ${f.contratos.length - 1} más</div>` : ""}</td>
    <td class="mono">${esc(f.p.telefono || "—")}${sug ? `<div class="cal-sug">→ ${esc(fmtCel(f.n.cel))}</div>` : ""}</td>
    <td>${f.prob.map((k) => `<span class="chip ${TIPOS[k][1]}">${TIPOS[k][0]}</span>`).join(" ")}${f.con?.length ? `<div class="muted">Igual que ${esc(f.con.slice(0, 2).join(", "))}${f.con.length > 2 ? " y otros" : ""}</div>` : ""}</td>
    <td class="num acciones">${sug ? `<button class="btn small primary" data-calfix="${f.p.id}" data-v="${f.n.cel}">Usar ${esc(fmtCel(f.n.cel))}</button>` : ""}<button class="btn small" data-persona="${f.p.id}">Corregir</button>${f.n.ok && !f.prob.includes("cel_repetido") && !f.prob.includes("cel_inmobiliaria") ? `<button class="btn small" data-pedirdatos="${f.p.id}" title="Le manda por WhatsApp el link para que complete sus datos">Pedir datos</button>` : ""}</td></tr>`; }).join("")
    || `<tr><td colspan="5"><div class="empty">${r.total ? "No hay nada para revisar con este filtro. ¡Bien!" : "No hay contratos vigentes."}</div></td></tr>`}
  </tbody></table></div>${lista.length > (st.limite || 150) ? `<div class="row"><button class="btn" data-a="mas">Mostrar más</button></div>` : ""}`;
}
const cuentaRol = (filas, k) => filas.filter((f) => f.prob.some((x) => TIPOS[x][2] === k)).length;
const peso = (f) => f.prob.reduce((s, k) => s + (TIPOS[k][1] === "bad" ? 10 : TIPOS[k][1] === "warn" ? 3 : 1), 0);

/** Los que se pueden corregir solos: un único número válido, solo cambia el formato. */
export const corregiblesFormato = (r) => r.filas.filter((f) => f.prob.includes("cel_formato")).map((f) => ({ id: f.p.id, nombre: f.p.nombre, antes: f.p.telefono, cel: f.n.cel }));

export function csvCalidad(r) {
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const filas = [["Persona", "Rol", "Contrato", "Celular cargado", "Sugerencia", "Email", "DNI", "Problemas"]]
    .concat(r.filas.filter((f) => f.prob.length).map((f) => [f.p.nombre, f.roles.join(" y "), f.contratos.map((c) => c.direccion).join(" | "), f.p.telefono || "", f.n.ok ? fmtCel(f.n.cel) : "", f.p.email || "", f.p.dni || "", f.prob.map((k) => TIPOS[k][0]).join(", ")]));
  return "﻿" + filas.map((x) => x.map(q).join(";")).join("\r\n");
}
