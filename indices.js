// Cobranza Fuentes · Índices oficiales y cálculo de aumentos
// Mismas fuentes y reglas que la "Calculadora de Alquileres" de la inmobiliaria:
//  - BCRA (API Estadísticas v4): ICL, CER, UVA  -> series diarias
//  - INDEC vía datos.gob.ar      : IPC, IPIM     -> series mensuales
//  - Diarios: nuevo = anterior × índice(fecha del ajuste) / índice(fecha del ajuste anterior)
//  - Mensuales: se acumulan las variaciones desde el mes del ajuste anterior hasta el mes previo al nuevo.
//  - Si el índice todavía no se publicó, el valor queda ESTIMADO (se repite la última variación).

const BCRA = "https://api.bcra.gob.ar/estadisticas/v4.0/monetarias";
const DATOS = "https://apis.datos.gob.ar/series/api/series";
export const FUENTES = {
  ICL: { k: "icl", tipo: "diario", bcra: 40, largo: "Índice para Contratos de Locación (BCRA)" },
  CER: { k: "cer", tipo: "diario", bcra: 30, largo: "Coeficiente de Estabilización de Referencia (BCRA)" },
  UVA: { k: "uva", tipo: "diario", bcra: 31, largo: "Unidad de Valor Adquisitivo (BCRA)" },
  IPC: { k: "ipc", tipo: "mensual", datos: "148.3_INIVELNAL_DICI_M_26", largo: "Índice de Precios al Consumidor (INDEC)" },
  IPIM: { k: "ipim", tipo: "mensual", datos: "448.1_NIVEL_GENERAL_0_0_13_46", largo: "Índice de Precios Internos al por Mayor (INDEC)" },
};
export const indiceAutomatico = (indice) => !!FUENTES[String(indice || "").toUpperCase()];

const pad = (n) => String(n).padStart(2, "0");
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const masDias = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const dimes = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export function masMeses(iso, n) {
  const [y, m, d] = iso.split("-").map(Number), t = y * 12 + (m - 1) + n, ny = Math.floor(t / 12), nm = ((t % 12) + 12) % 12 + 1;
  return `${ny}-${pad(nm)}-${pad(Math.min(d, dimes(ny, nm)))}`;
}
const mesNum = (iso) => { const [y, m] = iso.split("-").map(Number); return y * 12 + (m - 1); };
const mesISO = (mn) => `${Math.floor(mn / 12)}-${pad((mn % 12) + 1)}-01`;
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const nombreMes = (iso) => MESES[+iso.slice(5, 7) - 1] + " " + iso.slice(0, 4);

/* ---------- descarga (con caché de 6 horas en este navegador) ---------- */
// los servicios públicos a veces tardan o no responden: cada pedido tiene un tiempo máximo y hasta 3 intentos
async function traer(url) {
  let err;
  for (let i = 1; i <= 2; i++) {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), 25000);
    try { const r = await fetch(url, { signal: ac.signal }); if (r.ok) return r; err = new Error(new URL(url).host + " respondió " + r.status); if (r.status < 500 && r.status !== 429) break; }
    catch (e) { err = e.name === "AbortError" ? new Error(new URL(url).host + " no respondió a tiempo") : e; }
    finally { clearTimeout(t); }
    await new Promise((ok) => setTimeout(ok, 1500 * i));
  }
  throw err;
}
async function bajarBcra(id, desde) {
  const out = []; let offset = 0;
  for (let p = 0; p < 10; p++) {
    const r = await traer(`${BCRA}/${id}?desde=${desde}&limit=1000&offset=${offset}`);
    const j = await r.json(), det = j?.results?.[0]?.detalle;
    if (!Array.isArray(det) || !det.length) break;
    for (const it of det) out.push([String(it.fecha).slice(0, 10), +it.valor]);
    offset += det.length;
    if (offset >= (j?.metadata?.resultset?.count ?? 0)) break;
  }
  return out;
}
// Se piden la serie completa y los últimos 24 meses por separado: la consulta larga a veces viene sin el último mes publicado.
// Además datos.gob.ar a veces responde la serie VACÍA para una dirección puntual: se prueban formas equivalentes de la consulta.
async function bajarDatos(id) {
  const pedir = async (q) => (await (await traer(`${DATOS}?ids=${encodeURIComponent(id)}&${q}`)).json()).data || [];
  const primera = async (qs) => { let err; for (const q of qs) { try { const d = await pedir(q); if (d.length) return d; } catch (e) { err = e; } } if (err) throw err; return []; };
  const [todo, ult] = await Promise.all([
    primera(["limit=1000&format=json&start_date=2020-01-01", "limit=1000&format=json", "start_date=2020-01-01&limit=1000&format=json"]),
    primera(["last=24&format=json", "format=json&last=24"])]);
  const m = new Map(); for (const x of [...todo, ...ult]) m.set(String(x[0]), +x[1]);
  return [...m.entries()];
}
// IPC provisorio: el BCRA publica la inflación mensual del INDEC (variable 27) el mismo día que el INDEC, y datos.gob.ar
// suele tardar días en sumar el mes nuevo. Mientras tanto se reconstruye el índice con esa variación y queda "estimado";
// en la próxima descarga, cuando datos.gob.ar ya tiene el mes, se usa el valor exacto. (Igual que la Calculadora.)
const BCRA_INFLACION_MENSUAL = 27;
async function ipcProvisorio(puntos) {
  if (!puntos.length) return { puntos, provisorios: [] };
  const ord = puntos.slice().sort((a, b) => (a[0] < b[0] ? -1 : 1)), ult = ord[ord.length - 1];
  const tope = masDias(hoyISO(), -30), desde0 = masDias(ult[0].slice(0, 7) + "-01", -5), desde = desde0 > tope ? tope : desde0;
  const pct = new Map((await bajarBcra(BCRA_INFLACION_MENSUAL, desde)).filter((x) => Number.isFinite(x[1])).map(([f, v]) => [f.slice(0, 7), v]));
  const out = ord.slice(), provisorios = []; let mn = mesNum(ult[0]) + 1, nivel = ult[1];
  const sana = (v) => v > -5 && v < 30;                             // una variación fuera de este rango es un dato roto
  while (pct.has(mesISO(mn).slice(0, 7)) && sana(pct.get(mesISO(mn).slice(0, 7))) && mesISO(mn) <= hoyISO()) {
    nivel = Math.round(nivel * (1 + pct.get(mesISO(mn).slice(0, 7)) / 100) * 10000) / 10000;
    out.push([mesISO(mn), nivel]); provisorios.push(mesISO(mn).slice(0, 7)); mn++;
  }
  return { puntos: out, provisorios };
}
let cache = null, cargando = null;
export async function cargarIndices(forzar = false) {
  if (cache && !forzar) return cache;
  if (cargando) return cargando;
  cargando = (async () => {
    let guardado = null;
    try { guardado = JSON.parse(localStorage.getItem("indices-v2") || "null"); } catch {}
    if (!forzar && guardado && Date.now() - guardado.t < 6 * 3600e3) return (cache = armar(guardado.d));
    const d = { ...(guardado?.d || {}) }, errores = [];
    await Promise.all(Object.entries(FUENTES).map(async ([nombre, f]) => {
      try {
        d[f.k] = f.bcra ? await bajarBcra(f.bcra, "2022-06-01") : await bajarDatos(f.datos);
        if (nombre === "IPC") { d.ipc_prov = []; try { const x = await ipcProvisorio(d.ipc); d.ipc = x.puntos; d.ipc_prov = x.provisorios; } catch { /* sin dato provisorio */ } }
      } catch (e) { errores.push(nombre + ": " + e.message); }
    }));
    try { localStorage.setItem("indices-v2", JSON.stringify({ t: Date.now(), d })); } catch {}
    cache = armar(d); cache.errores = errores; return cache;
  })().finally(() => { cargando = null; });
  return cargando;
}
function armar(d) {
  const S = {};
  for (const [nombre, f] of Object.entries(FUENTES)) {
    const pts = (d[f.k] || []).filter((x) => x[1] > 0).sort((a, b) => (a[0] < b[0] ? -1 : 1));
    if (!pts.length) continue;
    if (f.tipo === "diario") {
      const fechas = pts.map((x) => x[0]), vals = pts.map((x) => x[1]), u = fechas.length - 1;
      S[nombre] = { tipo: "diario", ultima: fechas[u], ultimo: vals[u],
        en(iso) { let lo = 0, hi = u, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (fechas[m] <= iso) { r = m; lo = m + 1; } else hi = m - 1; } return r < 0 ? null : { fecha: fechas[r], valor: vals[r] }; } };
    } else {
      const mp = new Map(pts.map(([f2, v]) => [mesNum(f2), v])), meses = [...mp.keys()].sort((a, b) => a - b);
      const prim = meses[0], ult = meses[meses.length - 1], uv = mp.get(ult), prev = mp.get(ult - 1);
      const prov = new Set((d[f.k + "_prov"] || []).map((x) => mesNum(x + "-01")));
      const ratio = 1 + (prev ? Math.round((uv / prev - 1) * 10000) / 100 : 0) / 100;
      S[nombre] = { tipo: "mensual", ultimoMes: mesISO(ult),
        en(mn) { if (mn < prim) return null; if (mp.has(mn)) return { valor: mp.get(mn), estimado: prov.has(mn), provisorio: prov.has(mn) };
          if (mn > ult) return { valor: uv * Math.pow(ratio, mn - ult), estimado: true };
          let k = mn; while (k > prim && !mp.has(k)) k--; return { valor: mp.get(k), estimado: false }; } };
    }
  }
  return S;
}

/* ---------- cálculo de un aumento ---------- */
// desde: fecha (YYYY-MM-DD) del ajuste anterior / inicio · hasta: fecha del nuevo ajuste
export function calcularAumento(S, indice, monto, desde, hasta) {
  const nombre = String(indice || "").toUpperCase(), serie = S && S[nombre];
  if (!FUENTES[nombre]) return { error: `${indice}: se calcula a mano` };
  if (!serie) return { error: `No se pudieron bajar los datos del ${nombre}` };
  let factor, estimado, detalle;
  if (serie.tipo === "diario") {
    const n = Math.max(1, Math.round((mesNum(hasta) - mesNum(desde)) || 1));
    if (hasta > serie.ultima) {
      const base = serie.en(masMeses(serie.ultima, -n)); if (!base) return { error: "Faltan datos del " + nombre };
      factor = serie.ultimo / base.valor; estimado = true;
      detalle = `${nombre} al ${hasta.split("-").reverse().join("/")} todavía no publicado: se estimó con la variación de los últimos ${n} meses`;
    } else {
      const a = serie.en(desde), b = serie.en(hasta); if (!a) return { error: `El ${nombre} no tiene datos para ${desde}` };
      factor = b.valor / a.valor; estimado = false;
      detalle = `${nombre} ${a.fecha.split("-").reverse().join("/")}: ${a.valor} → ${b.fecha.split("-").reverse().join("/")}: ${b.valor}`;
    }
  } else {
    const m0 = mesNum(desde), m1 = mesNum(hasta) - 1, base = serie.en(m0 - 1), fin = serie.en(m1);
    if (!base) return { error: `El ${nombre} no tiene datos para ${nombreMes(mesISO(m0 - 1))}` };
    factor = fin.valor / base.valor; estimado = fin.estimado;
    const faltan = [], prov = []; for (let m = m0; m <= m1; m++) { const x = serie.en(m); if (x.provisorio) prov.push(nombreMes(mesISO(m))); else if (x.estimado) faltan.push(nombreMes(mesISO(m))); }
    detalle = `${nombre} acumulado de ${nombreMes(mesISO(m0))} a ${nombreMes(mesISO(m1))}`
      + (prov.length ? ` · ${prov.join(", ")} con la inflación publicada por el INDEC (vía BCRA), provisorio hasta que datos.gob.ar lo cargue` : "")
      + (faltan.length ? ` · estimado: falta publicar ${faltan.join(", ")}` : "");
  }
  const nuevo = Math.round(monto * factor);
  return { nuevo, pct: Math.round((nuevo / monto - 1) * 10000) / 100, estimado, detalle };
}

export { hoyISO, masDias };
