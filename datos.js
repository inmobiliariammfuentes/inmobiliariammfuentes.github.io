// Cobranza Fuentes · Página pública "Mis datos": el inquilino o propietario completa sus datos y crea su clave del portal.
// Se abre con el link personal que manda la inmobiliaria (datos.html?t=...).
import { sb, esc, LOGO_URL } from "./comun.js?v=202611181443";

const $ = (s) => document.querySelector(s);
const token = (new URLSearchParams(location.search).get("t") || "").trim();
const PORTAL = new URL("./", location.href).href;
const llamar = async (accion, extra = {}) => {
  const { data, error } = await sb.functions.invoke("datos", { body: { accion, token, ...extra } });
  if (error) { let m = ""; try { m = (await error.context?.json())?.error; } catch {} throw new Error(m || "No se pudo conectar. Probá de nuevo en un rato."); }
  if (data?.error) throw new Error(data.error);
  return data;
};
const cabecera = (cfg = {}) => `<header class="cp-h"><div class="brand brand-fila"><img class="logo logo-chico" src="${LOGO_URL}" alt="Logo de Inmobiliaria M.M. Fuentes"><div><b>${esc(cfg.nombre || "M.M. Fuentes")}</b><span>${esc([cfg.whatsapp ? "WhatsApp " + cfg.whatsapp : "", cfg.telefono ? "Tel. " + cfg.telefono : ""].filter(Boolean).join(" · "))}</span></div></div></header>`;
const error = (m) => { $("#app").innerHTML = cabecera() + `<section class="panel"><h1>No pudimos abrir el link</h1><p>${esc(m)}</p></section>`; };

function pantalla(d) {
  const n0 = (d.nombre.split(",")[1] || d.nombre).trim().split(" ")[0] || "";
  const nombre = n0.charAt(0).toUpperCase() + n0.slice(1).toLowerCase();
  const prop = d.tipo === "propietario";
  const campo = (k, l, v, tipo = "text", extra = "") => `<label>${l}<input type="${tipo}" name="${k}" value="${esc(v || "")}" ${extra}></label>`;
  const falta = [!d.dni && "DNI", !d.telefono && "celular", !d.email && "email", prop && !d.cbu && !d.alias && "CBU o alias"].filter(Boolean);
  $("#app").innerHTML = cabecera(d.inmobiliaria) + `
  <section class="panel">
    <h1>Hola ${esc(nombre)}</h1>
    <p style="margin:0">Completá o corregí tus datos para que te lleguen los recibos${prop ? " y las liquidaciones, y para transferirte los alquileres" : " y los avisos"}.
    ${falta.length ? `Nos falta: <b>${esc(falta.join(", "))}</b>.` : "Ya tenemos todo: revisá que esté bien."}</p>
    ${d.direcciones.length ? `<p class="muted" style="margin:0">${prop ? "Tus propiedades" : "Tu alquiler"}: ${esc(d.direcciones.join(" · "))}</p>` : ""}
  </section>
  <form class="panel form" id="f-datos" novalidate>
    <h2 class="full">Tus datos</h2>
    ${campo("dni", "DNI (sin puntos)", d.dni, "text", `inputmode="numeric" autocomplete="off" ${d.tiene_acceso && d.dni ? "readonly" : ""} required`)}
    ${campo("telefono", "Celular (con característica)", d.telefono, "tel", 'autocomplete="tel" placeholder="Ej.: 11 2345-6789"')}
    <label class="full">Email<input type="email" name="email" value="${esc(d.email)}" autocomplete="email" placeholder="nombre@ejemplo.com"></label>
    ${prop ? `<h2 class="full">Cuenta donde te transferimos</h2>
    ${campo("cbu", "CBU o CVU (22 números)", d.cbu, "text", 'inputmode="numeric" autocomplete="off"')}${campo("alias", "Alias", d.alias, "text", 'autocomplete="off" autocapitalize="none"')}
    ${campo("banco", "Banco o billetera", d.banco)}${campo("titular", "Titular de la cuenta", d.titular)}` : ""}
    <div class="full error" id="d-error" role="alert"></div>
    <div class="full row"><button class="btn primary grande" type="submit">Guardar y entrar a mi portal</button></div>
  </form>`;
}
function listo(r, d, dni) {
  const ir = `${PORTAL}${PORTAL.includes("?") ? "&" : "?"}dni=${encodeURIComponent(dni)}`;
  $("#app").innerHTML = cabecera(d.inmobiliaria) + `<section class="panel"><div class="estado ok"><b>¡Listo! Tus datos quedaron guardados.</b></div>
    <p>Para entrar al portal no necesitás clave: solo tu DNI. Te queda abierto en este celular.</p>
    <div class="row"><a class="btn primary grande" href="${esc(ir)}">Entrar a mi portal</a></div>
  </section>`;
  setTimeout(() => { location.href = ir; }, 2500);
}

async function iniciar() {
  if (!/^[a-f0-9]{32}$/i.test(token)) return error("El link está incompleto. Copialo entero del mensaje de WhatsApp o pedile uno nuevo a la inmobiliaria.");
  let d;
  try { d = await llamar("ver"); } catch (e) { return error(e.message); }
  pantalla(d);
  $("#app").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target, v = Object.fromEntries(new FormData(f).entries()), err = $("#d-error"), b = f.querySelector("[type=submit]");
    err.textContent = "";
    const dni = (v.dni || "").replace(/\D/g, "");
    if (dni.length < 7 || dni.length > 8) return (err.textContent = "Escribí tu DNI (7 u 8 números, sin puntos).");
    if (v.cbu && v.cbu.replace(/\D/g, "").length !== 22) return (err.textContent = "El CBU o CVU tiene que tener 22 números.");
    b.disabled = true; b.textContent = "Guardando…";
    try {
      const r = await llamar("guardar", { datos: v });
      listo(r, d, dni); scrollTo(0, 0);
    } catch (x) { err.textContent = x.message; b.disabled = false; b.textContent = "Guardar y entrar a mi portal"; }
  });
}
iniciar();
