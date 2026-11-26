// Cobranza Fuentes · Borrador del contrato en Word a partir de una reserva
// Usa las plantillas de la inmobiliaria (garantía propietaria con fiador, o seguro de caución FINAER),
// guardadas en la base (tabla "recursos", solo el equipo). Completa los «campos» con los datos de la
// reserva y del propietario; lo que falta queda resaltado en amarillo como "COMPLETAR: …".
// Todo se arma en esta computadora: nada se manda a servicios externos.
import { numeroALetras } from "./comun.js?v=202611262134";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const PERIODO = { 1: ["mes", "meses", "MENSUALMENTE", "mensual", "un"], 2: ["bimestre", "bimestres", "BIMESTRALMENTE", "bimestral", "dos"], 3: ["trimestre", "trimestres", "TRIMESTRALMENTE", "trimestral", "tres"],
  4: ["cuatrimestre", "cuatrimestres", "CUATRIMESTRALMENTE", "cuatrimestral", "cuatro"], 6: ["semestre", "semestres", "SEMESTRALMENTE", "semestral", "seis"], 12: ["año", "años", "ANUALMENTE", "anual", "doce"] };
const ANIOS = ["", "UN (1) AÑO", "DOS (2) AÑOS", "TRES (3) AÑOS", "CUATRO (4) AÑOS", "CINCO (5) AÑOS"];
export const GARANTIAS = { fiador: "Garantía propietaria (fiador con inmueble)", caucion: "Seguro de caución (FINAER)" };

const num = (v) => { const n = parseFloat(String(v ?? "").replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const miles = (n) => Math.round(n).toLocaleString("es-AR");
const enLetras = (n) => numeroALetras(n, "ARS").replace(/ (DE )?PESOS$/, "");
const fechaLarga = (iso) => { const [y, m, d] = String(iso).split("-").map(Number); return `${String(d).padStart(2, "0")} de ${MESES[m - 1]} de ${y}`; };
const isoMas = (iso, meses, dias = 0) => { const d = new Date(iso + "T12:00"); d.setMonth(d.getMonth() + meses); d.setDate(d.getDate() + dias); return d.toISOString().slice(0, 10); };
const conPuntos = (dni) => { const d = String(dni || "").replace(/\D/g, ""); return d ? d.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : ""; };
const natural = (n) => { const s = String(n || "").trim().replace(/\s+/g, " "); if (!s.includes(",")) return s; const [a, b] = s.split(","); return `${b.trim()} ${a.trim()}`.trim(); };
const apellidoDe = (n) => { const s = String(n || "").trim(); return (s.includes(",") ? s.split(",")[0] : s.split(" ").slice(-1)[0] || s).trim(); };
const esMujer = (trato) => /^(sra|srta)/i.test(String(trato || "").trim());

// CUIT/CUIL a partir del DNI (20 varón, 27 mujer; si el dígito da 10 se usa 23)
export function cuilDe(dni, mujer) {
  const d = String(dni || "").replace(/\D/g, ""); if (d.length < 7 || d.length > 8) return "";
  const calc = (pre) => { const b = pre + d.padStart(8, "0"), f = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]; const s = [...b].reduce((a, c, i) => a + +c * f[i], 0); const r = 11 - (s % 11); return r === 11 ? 0 : r; };
  let pre = mujer ? "27" : "20", v = calc(pre);
  if (v === 10) { pre = "23"; v = mujer ? 4 : 9; }
  return `${pre}-${d.padStart(8, "0")}-${v}`;
}

let jszip = null;
function cargarJSZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  return (jszip ||= new Promise((ok, mal) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"; s.onload = () => ok(window.JSZip); s.onerror = () => { jszip = null; mal(new Error("No se pudo cargar el armador de Word. Revisá la conexión.")); }; document.head.appendChild(s); }));
}

/** Arma los valores de cada «campo». r: datos de la reserva; o: { garantia, propietario (persona), propTrato, inicio, firma, fiador: {trato, nombre, dni} } */
export function valoresContrato(r, o) {
  const mL = esMujer(o.propTrato), mI = esMujer(r.trato), mF = esMujer(o.fiador?.trato);
  const p = o.propietario || {}, pNom = natural(p.nombre || o.propNombre || ""), iNom = natural(r.nombre);
  const meses = Math.max(1, Math.round((num(r.anios) || 2) * 12)), aj = +r.ajuste || 4, per = PERIODO[aj] || [`período de ${aj} meses`, `períodos de ${aj} meses`, `CADA ${aj} MESES`, `de ${aj} meses`, String(aj)];
  const inicio = o.inicio, fin = isoMas(inicio, meses, -1), firma = o.firma || new Date().toISOString().slice(0, 10);
  const alq = num(r.alquiler), dep = num(r.deposito) || alq;
  const ubic = String(r.ubicacion || "").trim().replace(/\.$/, "");
  const domI = [r.domicilio && `la calle ${String(r.domicilio).trim()}`, r.localidad && `de la localidad de ${String(r.localidad).trim()}`].filter(Boolean).join(", ");
  const F = o.fiador || {};
  return {
    firma_dia: String(+firma.slice(8, 10)), firma_mes: MESES[+firma.slice(5, 7) - 1], firma_anio: firma.slice(0, 4),
    L_nombre: pNom.toUpperCase(), L_apellido: apellidoDe(p.nombre || o.propNombre || "").toUpperCase(), L_dni: conPuntos(p.dni), L_cuit: cuilDe(p.dni, mL), L_domicilio: "", L_email: p.email || "",
    L_el: mL ? "la Sra." : "el Sr.", L_El: mL ? "La Sra." : "El Sr.", L_denominado: mL ? "denominada" : "denominado",
    I_nombre: iNom.toUpperCase(), I_apellido: apellidoDe(r.nombre).toUpperCase(), I_dni: conPuntos(r.dni), I_cuit: cuilDe(r.dni, mI), I_domicilio: domI, I_email: r.email || "",
    I_el: mI ? "la Sra." : "el Sr.", I_El: mI ? "La Sra." : "El Sr.", I_al: mI ? "a la Sra." : "al Sr.", I_denominado: mI ? "denominada" : "denominado",
    tipo: r.tipo || "", direccion: r.direccion || "", ubicacion: ubic ? (/^de\s/i.test(ubic) ? "de la localidad " + ubic : ubic) + "." : "", comodidades: String(r.composicion || "").replace(/\.$/, ""),
    plazo_letras: ANIOS[Math.round(meses / 12)] && meses % 12 === 0 ? ANIOS[meses / 12] : `${meses} MESES`, inicio_largo: fechaLarga(inicio), fin_largo: fechaLarga(fin),
    periodo: per[0], periodos: per[1], ajuste_adverbio: per[2], ajuste_adjetivo: per[3], ajuste_letras: per[4], ajuste_n: String(aj),
    alquiler_letras: alq ? enLetras(alq) : "", alquiler_num: alq ? miles(alq) : "", deposito_letras: dep ? enLetras(dep) : "", deposito_num: dep ? miles(dep) : "",
    servicios: String(r.servicios || "").trim(),
    F_nombre: natural(F.nombre).toUpperCase(), F_dni: conPuntos(F.dni), F_cuit: cuilDe(F.dni, mF), F_el: mF ? "la Sra." : "el Sr.", F_denominado: mF ? "denominada" : "denominado",
    F_nacionalidad: mF ? "argentina" : "argentino", F_nacido: mF ? "nacida" : "nacido", F_nacimiento: "", F_estado_civil: "", F_domicilio: "", F_email: "", F_inmueble: "", F_conyuge: "",
    caucion_codigo: "", caucion_apoderado: "", caucion_apoderado_dni: "",
    _mujer: { L: mL, I: mI },
  };
}
const ETIQUETA = { L_domicilio: "domicilio del propietario", L_email: "email del propietario", L_nombre: "nombre del propietario", L_dni: "DNI del propietario", L_cuit: "CUIT del propietario", L_apellido: "apellido del propietario",
  I_email: "email del inquilino", I_dni: "DNI del inquilino", I_cuit: "CUIT del inquilino", I_domicilio: "domicilio actual del inquilino", comodidades: "comodidades del inmueble", servicios: "servicios a cargo del inquilino",
  F_nombre: "nombre del fiador", F_dni: "DNI del fiador", F_cuit: "CUIT del fiador", F_nacimiento: "fecha de nacimiento del fiador", F_estado_civil: "estado civil del fiador (y cónyuge)", F_domicilio: "domicilio del inmueble en garantía",
  F_email: "email del fiador", F_inmueble: "descripción del inmueble en garantía (unidad, nomenclatura catastral, partida, escritura, matrícula e informe de dominio)",
  F_conyuge: "asentimiento del cónyuge del fiador (o borrar si no corresponde)", caucion_codigo: "código del contrato de garantía FINAER", caucion_apoderado: "apoderado de FINAER", caucion_apoderado_dni: "DNI del apoderado de FINAER" };

const xmlEsc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// LOCATARIO / LOCADOR en femenino (las plantillas están en masculino)
function femenino(t, palabra) {
  const P = palabra, F = P.endsWith("OR") ? P + "A" : P.slice(0, -1) + "A";                      // LOCATARIO→LOCATARIA, LOCADOR→LOCADORA
  const fem = (w) => (w === w.toUpperCase() ? F : w[0] + F.slice(1).toLowerCase());
  const w = `(${P}|${P[0] + P.slice(1).toLowerCase()}|${P.toLowerCase()})`;
  return t
    .replace(new RegExp(`\\b([Aa])l ${w}\\b`, "g"), (_, a, x) => `${a} la ${fem(x)}`)
    .replace(new RegExp(`\\b([Dd])el ${w}\\b`, "g"), (_, d, x) => `${d}e la ${fem(x)}`)
    .replace(new RegExp(`\\b(El|el|EL) ${w}\\b`, "g"), (_, e, x) => `${{ El: "La", el: "la", EL: "LA" }[e]} ${fem(x)}`)
    .replace(new RegExp(`\\b${w}( incumplidor)\\b`, "g"), (_, x) => `${fem(x)} incumplidora`)
    .replace(new RegExp(`\\b${w}\\b`, "g"), (_, x) => fem(x));
}

export async function generarBorrador(sb, garantia, valores) {
  const JSZip = await cargarJSZip();
  const { data, error } = await sb.from("recursos").select("valor").eq("clave", "plantilla_" + garantia).maybeSingle();
  if (error) throw error; if (!data?.valor) throw new Error("Falta cargar la plantilla del contrato en el sistema");
  const bin = Uint8Array.from(atob(data.valor), (c) => c.charCodeAt(0));
  const zip = await JSZip.loadAsync(bin);
  let xml = await zip.file("word/document.xml").async("string");
  const faltan = new Set();
  // 1) «campos»: cada uno está solo en su run; si no hay dato queda "COMPLETAR: …" resaltado en amarillo
  xml = xml.replace(/<w:r(?:\s[^>]*)?>(?:(?!<\/w:r>)[\s\S])*?<\/w:r>/g, (run) => {
    const m = run.match(/<w:t(?:\s[^>]*)?>«([A-Za-z_]+)»<\/w:t>/); if (!m) return run;
    const k = m[1], v = valores[k];
    if (v != null && String(v).trim() !== "") return run.replace(m[0], `<w:t xml:space="preserve">${xmlEsc(v)}</w:t>`);
    faltan.add(ETIQUETA[k] || k);
    const marcado = run.replace(m[0], `<w:t xml:space="preserve">${xmlEsc("[COMPLETAR: " + (ETIQUETA[k] || k) + "]")}</w:t>`);
    return /<w:rPr>/.test(marcado) ? marcado.replace("</w:rPr>", '<w:highlight w:val="yellow"/></w:rPr>') : marcado.replace(/<w:r(\s[^>]*)?>/, (a) => a + '<w:rPr><w:highlight w:val="yellow"/></w:rPr>');
  });
  // 2) género de las partes en todo el texto
  const sx = valores._mujer || {};
  if (sx.I || sx.L) xml = xml.replace(/(<w:t(?:\s[^>]*)?>)([^<]*)(<\/w:t>)/g, (_, a, t, b) => { let s = t; if (sx.I) s = femenino(s, "LOCATARIO"); if (sx.L) s = femenino(s, "LOCADOR"); return a + s + b; });
  zip.file("word/document.xml", xml);
  const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", compression: "DEFLATE" });
  return { blob, faltan: [...faltan] };
}
