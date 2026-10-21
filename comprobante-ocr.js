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

// Saca los datos del texto reconocido. Si hay dos cuentas (origen y destino), se queda con la de destino.
export function datosDeTexto(texto) {
  const T = texto.replace(/[|]/g, " ").replace(/[ \t]+/g, " ");
  const U = T.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  const iDest = (() => { const m = U.search(/\b(PARA|DESTINO|DESTINATARIO|BENEFICIARIO|CUENTA DESTINO|A NOMBRE DE|ENVIASTE A|TRANSFERISTE A)\b/); return m < 0 ? 0 : m; })();
  const iOrig = U.search(/\b(DE|DESDE|ORIGEN|CUENTA ORIGEN|ORDENANTE)\b\s*[:\n]/);
  // CBU / CVU: 22 dígitos (a veces separados por espacios o guiones)
  const cbus = [...T.matchAll(/(?:\d[\s-]?){21}\d/g)].map((m) => ({ v: m[0].replace(/\D/g, ""), i: m.index })).filter((x) => x.v.length === 22);
  const cbu = (cbus.find((x) => x.i >= iDest && !(iOrig >= 0 && x.i > iOrig && iOrig > iDest)) || cbus[cbus.length - 1] || {}).v || "";
  // alias: palabras separadas por puntos (ej.: casa.perro.sol), mejor si está al lado de la palabra "alias"
  const malos = /(www|http|\.com|\.ar|@|\d{6,})/i;
  const conEtiqueta = [...T.matchAll(/alias\s*(?:cbu|cvu)?\s*[:\-]?\s*\n?\s*([A-Za-z0-9-]{1,20}(?:\.[A-Za-z0-9-]{1,20}){1,3})/gi)].map((m) => ({ v: m[1], i: m.index }));
  const sueltos = [...T.matchAll(/\b([A-Za-z][A-Za-z0-9-]{1,19}\.[A-Za-z0-9-]{2,20}(?:\.[A-Za-z0-9-]{2,20})?)\b/g)].map((m) => ({ v: m[1], i: m.index }));
  const aliasOk = (a) => a.v.length >= 6 && a.v.length <= 20 && !malos.test(a.v);
  const alias = ((conEtiqueta.filter(aliasOk).find((a) => a.i >= iDest) || conEtiqueta.filter(aliasOk)[0]) || sueltos.filter(aliasOk).find((a) => a.i >= iDest) || {}).v || "";
  // titular: la línea que sigue a "Para" / "Destinatario" / "Titular" / "Nombre"
  const lineas = T.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  let titular = "";
  for (let k = 0; k < lineas.length && !titular; k++) {
    const L = lineas[k].normalize("NFD").replace(/[̀-ͯ]/g, "");
    const m = L.match(/^(?:para|destinatario|beneficiario|titular(?: de la cuenta)?|nombre|a nombre de|le transferiste a|enviaste a)\s*:?\s*(.*)$/i);
    if (m) { const cand = (m[1] || lineas[k + 1] || "").trim(); if (/^[A-Za-zÁÉÍÓÚÑáéíóúñ ,.'-]{5,60}$/.test(cand) && !/cuenta|banco|cbu|cvu|alias|\d/i.test(cand)) titular = cand; }
  }
  const cuit = ((T.slice(iDest).match(/\b(\d{2})[\s-]?(\d{8})[\s-]?(\d)\b/) || [])).slice(1).join("-");
  let banco = bancoDeCbu(cbu);
  if (!banco) { const zona = T.slice(iDest, iDest + 600); banco = NOMBRES_BANCO.find((b) => new RegExp("\\b" + b + "\\b", "i").test(zona)) || ""; }
  if (/^(Uala|Nacion|Itau)$/.test(banco)) banco = { Uala: "Ualá", Nacion: "Banco Nación", Itau: "Banco Itaú" }[banco];
  return { cbu, cbuOk: cbu ? cbuValido(cbu) : false, alias: alias.toLowerCase(), titular: titular.replace(/\s{2,}/g, " "), banco, cuit: /^\d{2}-\d{8}-\d$/.test(cuit) ? cuit : "" };
}

export async function leerComprobante(file, progreso) {
  if (!file || !/^image\//.test(file.type)) throw new Error("Elegí una imagen (captura o foto del comprobante). Los PDF no se pueden leer acá.");
  const T = await cargarTesseract();
  const r = await T.recognize(file, "spa", { logger: (m) => { if (progreso && m.status === "recognizing text") progreso(Math.round(m.progress * 100)); } });
  return { ...datosDeTexto(r.data.text || ""), texto: r.data.text || "" };
}
