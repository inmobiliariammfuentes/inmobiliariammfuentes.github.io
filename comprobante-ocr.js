// Cobranza Fuentes · Leer CBU / alias / titular / banco de la captura de un comprobante de transferencia.
// La imagen se lee en esta computadora (no se sube a ningún lado). Usa Tesseract (reconocimiento de texto).
const TESSERACT = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";

// primeros 3 dígitos del CBU = banco
const BANCOS = { "007": "Banco Galicia", "011": "Banco Nación", "014": "Banco Provincia", "015": "ICBC", "016": "Citibank", "017": "BBVA", "020": "Banco de Córdoba",
  "027": "Banco Supervielle", "029": "Banco Ciudad", "034": "Banco Patagonia", "044": "Banco Hipotecario", "045": "Banco San Juan", "072": "Banco Santander",
  "083": "Banco del Chubut", "086": "Banco de Santa Cruz", "093": "Banco de La Pampa", "094": "Banco de Corrientes", "097": "Banco Provincia del Neuquén",
  "143": "Brubank", "147": "Banco Interfinanzas", "150": "HSBC", "158": "Openbank", "165": "JP Morgan", "191": "Banco Credicoop", "198": "Banco de Valores",
  "247": "Banco Roela", "254": "Banco Mariva", "259": "Banco Itaú", "262": "Bank of America", "266": "BNP Paribas", "268": "Banco Tierra del Fuego",
  "269": "Banco de la República Oriental del Uruguay", "277": "Banco Saenz", "281": "Banco Meridian", "285": "Banco Macro", "299": "Banco Comafi",
  "300": "Banco de Inversión y Comercio Exterior", "301": "Banco Piano", "305": "Banco Julio", "309": "Banco Rioja", "310": "Banco del Sol", "311": "Nuevo Banco del Chaco",
  "312": "Banco Voii", "315": "Banco de Formosa", "319": "Banco CMF", "321": "Banco de Santiago del Estero", "322": "Banco Industrial", "330": "Nuevo Banco de Santa Fe",
  "331": "Banco Cetelem", "332": "Banco de Servicios Financieros", "336": "Banco Bradesco", "338": "Banco de Servicios y Transacciones", "339": "RCI Banque",
  "340": "BACS", "341": "Banco Masventas", "384": "Wilobank", "386": "Nuevo Banco de Entre Ríos", "389": "Banco Columbia", "426": "Banco Bica", "431": "Banco Coinag",
  "432": "Banco de Comercio", "435": "Banco Sucredito", "448": "Banco Dino" };
const BILLETERAS = [["0000003100", "Mercado Pago"], ["00000079", "Ualá"], ["0000156", "Naranja X"], ["0000019", "Personal Pay"], ["0000168", "Lemon Cash"], ["0000044", "Prex"], ["0000013", "Cuenta DNI"]];
const NOMBRES_BANCO = ["Mercado Pago", "Ualá", "Uala", "Naranja X", "Brubank", "Galicia", "Santander", "BBVA", "Nación", "Nacion", "Provincia", "Macro", "ICBC", "HSBC", "Credicoop",
  "Ciudad", "Patagonia", "Supervielle", "Comafi", "Hipotecario", "Itaú", "Itau", "Personal Pay", "Lemon", "Prex", "Cuenta DNI", "Banco del Sol", "Columbia", "Industrial", "Openbank", "Reba", "Wilobank"];

export function bancoDeCbu(cbu) {
  const d = String(cbu || "").replace(/\D/g, "");
  if (d.length !== 22) return "";
  if (d.startsWith("000")) { const b = BILLETERAS.find(([p]) => d.startsWith(p)); return b ? b[1] : "Billetera virtual (CVU)"; }
  return BANCOS[d.slice(0, 3)] || "";
}
// dígitos verificadores del CBU (los dos bloques)
export function cbuValido(cbu) {
  const d = String(cbu || "").replace(/\D/g, ""); if (d.length !== 22) return false;
  if (d.startsWith("000")) return true;   // CVU: el control es distinto, alcanza con el largo
  const dv = (s, p) => (10 - (s.split("").reduce((a, c, i) => a + +c * p[i % p.length], 0) % 10)) % 10;
  return dv(d.slice(0, 7), [7, 1, 3, 9]) === +d[7] && dv(d.slice(8, 21), [3, 9, 7, 1]) === +d[21];
}

let cargando = null;
function cargarTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  cargando ||= new Promise((ok, mal) => { const s = document.createElement("script"); s.src = TESSERACT; s.onload = () => ok(window.Tesseract); s.onerror = () => { cargando = null; mal(new Error("No se pudo cargar el lector de comprobantes. Revisá la conexión.")); }; document.head.appendChild(s); });
  return cargando;
}

// ---------- Separar el comprobante en "quién manda" (origen) y "quién recibe" (destino) ----------
const sinT = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
// etiquetas que abren el bloque de quien ENVÍA (el inquilino) y de quien RECIBE (el propietario)
const ORIGEN = /^(?:DE|DESDE)\s*:?\s*$|^(?:DE|DESDE)\s*:|^(?:CUENTA\s+(?:DE\s+)?ORIGEN|DATOS\s+(?:DE\s+)?(?:LA\s+CUENTA\s+)?ORIGEN|ORIGEN|DEBITADO\s+DE|DEBITO\s+DE|DEBITADA|CUENTA\s+DEBITADA|ORDENANTE|REMITENTE|PAGADOR|ENVIADO\s+POR|ENVIA|QUIEN\s+ENVIA|TITULAR\s+(?:DE\s+)?(?:LA\s+CUENTA\s+)?ORIGEN|(?:CBU|CVU|ALIAS)\s+(?:DE\s+)?ORIGEN|TU\s+CUENTA|DESDE\s+TU\s+CUENTA|CUENTA\s+A\s+DEBITAR)\b/;
const DESTINO = /^(?:PARA|A)\s*:?\s*$|^(?:PARA|A)\s*:|^PARA\s+\S|^(?:CUENTA\s+(?:DE\s+)?DESTINO|DATOS\s+(?:DEL?\s+)?(?:LA\s+CUENTA\s+)?DESTINO|DESTINO|DESTINATARIO|BENEFICIARIO|ACREDITADO\s+(?:EN|A)|CUENTA\s+ACREDITADA|CUENTA\s+A\s+ACREDITAR|A\s+LA\s+CUENTA|LE\s+(?:ENVIASTE|TRANSFERISTE|PAGASTE)\s+A|(?:ENVIASTE|TRANSFERISTE|PAGASTE)\s+A|RECEPTOR|RECIBE|QUIEN\s+RECIBE|TITULAR\s+(?:DE\s+)?(?:LA\s+CUENTA\s+)?DESTINO|(?:CBU|CVU|ALIAS)\s+(?:DE\s+)?DESTINO|TRANSFERENCIA\s+A)\b/;
const NO_NOMBRE = /\b(CUENTA|BANCO|CBU|CVU|ALIAS|CUIT|CUIL|CAJA|AHORRO|CORRIENTE|PESOS|DOLARES|TRANSFERENCIA|COMPROBANTE|OPERACION|FECHA|HORA|MONTO|IMPORTE|CONCEPTO|REFERENCIA|MOTIVO|VARIOS|ALQUILER|ESTADO|EXITOSA|APROBADA|COMPARTIR|DESCARGAR|DESTINO|ORIGEN|PARA|DESDE|TITULAR|DOCUMENTO|DNI|NUMERO|CODIGO|MERCADO|PAGO|UALA|BRUBANK|NARANJA|PERSONAL|BILLETERA|ID|ENVIASTE|TRANSFERISTE|PAGASTE|ENVIO|ENVIADO|RECIBISTE)\b/;

function cuentaDe(lineas, primera) {
  const T = lineas.join("\n");
  const c = [...T.matchAll(/(?:\d[\s.-]?){21}\d/g)].map((m) => m[0].replace(/\D/g, "")).find((x) => x.length === 22) || "";
  const malos = /(www|http|\.com|\.ar|@|\d{6,})/i;
  const conEtiqueta = (T.match(/alias\s*(?:cbu|cvu)?\s*(?:de\s+)?(?:destino|origen)?\s*[:\-]?\s*\n?\s*([A-Za-z0-9-]{1,20}(?:\.[A-Za-z0-9-]{1,20}){1,3})/i) || [])[1];
  const suelto = [...T.matchAll(/\b([A-Za-z][A-Za-z0-9-]{1,19}\.[A-Za-z0-9-]{2,20}(?:\.[A-Za-z0-9-]{2,20})?)\b/g)].map((m) => m[1]);
  const okA = (a) => a && a.length >= 6 && a.length <= 20 && !malos.test(a);
  const alias = (okA(conEtiqueta) ? conEtiqueta : suelto.find(okA) || "").toLowerCase();
  // titular: el resto de la línea de la etiqueta ("Para: Juan Perez") o la primera línea que parezca un nombre
  const cands = [...[].concat(primera), ...lineas.filter((l) => !ORIGEN.test(sinT(l)) && !DESTINO.test(sinT(l)))].map((l) => String(l || "")
    .replace(/^[^A-Za-zÁÉÍÓÚÑÜáéíóúñü]+/, "").replace(/^[A-Za-z©®@]\s+(?=[A-ZÁÉÍÓÚÑ])/, "").replace(/^(?:titular|nombre|a nombre de|destinatario|beneficiario)\s*:?\s*/i, "").trim());
  const titular = cands.find((l) => /^[A-Za-zÁÉÍÓÚÑÜáéíóúñü][A-Za-zÁÉÍÓÚÑÜáéíóúñü ,.'-]{4,60}$/.test(l) && l.split(/\s+/).length >= 2 && !NO_NOMBRE.test(sinT(l))) || "";
  const cuit = ((T.match(/\b(\d{2})[\s-]?(\d{8})[\s-]?(\d)\b/) || []).slice(1)).join("-");
  let banco = bancoDeCbu(c);
  if (!banco) banco = NOMBRES_BANCO.find((b) => new RegExp("\\b" + b + "\\b", "i").test(T)) || "";
  if (/^(Uala|Nacion|Itau)$/.test(banco)) banco = { Uala: "Ualá", Nacion: "Banco Nación", Itau: "Banco Itaú" }[banco];
  return { cbu: c, alias, titular: titular.replace(/\s{2,}/g, " "), banco, cuit: /^\d{2}-\d{8}-\d$/.test(cuit) ? cuit : "" };
}

// Saca los datos del texto reconocido. Devuelve la cuenta de DESTINO (la del propietario) y, si hay dudas, las opciones.
// "nombres": nombres de propietarios posibles, para decidir cuando el comprobante no dice cuál es cuál.
export function datosDeTexto(texto, nombres = []) {
  const lineas = String(texto || "").replace(/[|]/g, " ").split(/\n+/).map((l) => l.replace(/[ \t]+/g, " ").trim()).filter(Boolean);
  const bloques = []; let actual = { rol: "?", lineas: [], primera: "" };
  for (const l of lineas) {
    const U = sinT(l);
    // "Origen y destino" (Mercado Pago): las dos cuentas vienen seguidas, primero la de quien envía
    const rol = /^ORIGEN\s*(?:Y|\/|-|E)\s*DESTINO/.test(U) ? "seq" : DESTINO.test(U) ? "destino" : ORIGEN.test(U) ? "origen" : null;
    if (rol) {
      bloques.push(actual);
      // lo que sigue a la etiqueta en la misma línea ("Para: Juan Perez", "CBU destino: 0720…")
      const resto = l.replace(/^[^:]*:\s*/, (m) => m).replace(/^(?:para|a|de|desde)\s*:?\s*/i, "").replace(/^(?:cuenta|datos|titular|cbu|cvu|alias)?\s*(?:de\s+|del\s+)?(?:la\s+cuenta\s+)?(?:origen|destino)\s*:?\s*/i, "")
        .replace(/^(?:destinatario|beneficiario|ordenante|remitente|le\s+)?(?:enviaste|transferiste|pagaste)?\s*(?:a)?\s*:?\s*/i, "");
      actual = { rol, lineas: [l], primera: resto };
    } else actual.lineas.push(l);
  }
  bloques.push(actual);
  // un bloque sin etiqueta con varias cuentas: se corta en cada CBU (nombre + CBU, nombre + CBU…)
  const esCbu = (l) => /(?:\d[\s.-]?){21}\d/.test(l);
  for (let k = bloques.length - 1; k >= 0; k--) {
    const b = bloques[k];
    if (b.lineas.filter(esCbu).length < 2) { if (b.rol === "seq") b.rol = "?"; continue; }
    const partes = []; let cur = [];
    for (const l of b.lineas) { cur.push(l); if (esCbu(l)) { partes.push(cur); cur = []; } }
    if (cur.length && partes.length) partes[partes.length - 1].push(...cur);
    const ult = partes.length - 1;
    const rolDe = (n) => b.rol === "seq" ? (n === 0 ? "origen" : n === ult ? "destino" : "?")
      : b.rol === "origen" ? (n === 0 ? "origen" : "?") : b.rol === "destino" ? (n === 0 ? "destino" : "?") : "?";
    bloques.splice(k, 1, ...partes.map((ls, n) => ({ rol: rolDe(n), lineas: ls, primera: n === 0 && b.rol !== "seq" ? b.primera : "" })));
  }
  const cuentas = bloques.map((b) => ({ rol: b.rol, ...cuentaDe(b.lineas, b.primera) })).filter((c) => c.cbu || c.alias);
  // juntar bloques del mismo rol (a veces el CBU aparece unas líneas después del nombre)
  const unir = (rol) => { const cs = bloques.filter((b) => b.rol === rol); if (!cs.length) return null; const r = cuentaDe(cs.flatMap((b) => b.lineas), cs.map((b) => b.primera).filter(Boolean)); return r.cbu || r.alias ? { rol, ...r } : null; };
  const dest = unir("destino"), orig = unir("origen");
  const sinRol = cuentas.filter((c) => c.rol === "?");
  const nombreCoincide = (c) => { const t = new Set(sinT(c.titular).split(/[^A-Z]+/).filter((w) => w.length > 2)); return nombres.some((n) => sinT(n).split(/[^A-Z]+/).filter((w) => w.length > 2 && t.has(w)).length >= 2); };
  let elegida, seguro;
  if (dest) { elegida = dest; seguro = true; }
  else if (orig && sinRol.length) { elegida = sinRol.find((c) => c.cbu !== orig.cbu) || sinRol[0]; seguro = sinRol.length === 1; }
  else if (cuentas.length === 1 && !orig) { elegida = cuentas[0]; seguro = true; }
  else { elegida = cuentas.find(nombreCoincide) || cuentas[cuentas.length - 1] || {}; seguro = !!cuentas.find(nombreCoincide); }
  // si el nombre del propietario aparece en otra cuenta, gana esa
  if (nombres.length && elegida && !nombreCoincide(elegida)) { const otra = cuentas.find(nombreCoincide); if (otra) { elegida = otra; seguro = true; } }
  const opciones = [];
  for (const c of [dest, orig, ...cuentas]) if (c && !opciones.some((o) => (o.cbu || o.alias) === (c.cbu || c.alias))) opciones.push(c);
  const e = elegida || {};
  return { cbu: e.cbu || "", cbuOk: e.cbu ? cbuValido(e.cbu) : false, alias: e.alias || "", titular: e.titular || "", banco: e.banco || "", cuit: e.cuit || "",
    seguro: !!seguro && opciones.length > 0, opciones: opciones.map((o) => ({ ...o, cbuOk: o.cbu ? cbuValido(o.cbu) : false })) };
}

export async function leerComprobante(file, progreso, nombres = []) {
  if (!file || !/^image\//.test(file.type)) throw new Error("Elegí una imagen (captura o foto del comprobante). Los PDF no se pueden leer acá.");
  const T = await cargarTesseract();
  const r = await T.recognize(file, "spa", { logger: (m) => { if (progreso && m.status === "recognizing text") progreso(Math.round(m.progress * 100)); } });
  return { ...datosDeTexto(r.data.text || "", nombres), texto: r.data.text || "" };
}
