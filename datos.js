// Cobranza Fuentes · Página pública "Mis datos": el inquilino o propietario completa sus datos y crea su clave del portal.
// Se abre con el link personal que manda la inmobiliaria (datos.html?t=...).
import { sb, esc, LOGO_URL } from "./comun.js?v=202610212003";

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
  const nombre = (d.nombre.split(",")[1] || d.nombre).trim().split(" ")[0];
  const prop = d.tipo === "propietario";
  const campo = (k, l, v, tipo = "text", extra = "") => `<label>${l}<input type="${tipo}" name="${k}" value="${esc(v || "")}" ${extra}></label>`;
  const falta = [!d.dni && "DNI", !d.telefono && "celular", !d.email && "email", prop && !d.cbu && !d.alias && "CBU o alias", !d.tiene_acceso && "tu clave del portal"].filter(Boolean);
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
    <h2 class="full">${d.tiene_acceso ? "Tu clave del portal" : "Creá tu clave del portal"}</h2>
    <p class="full muted" style="margin:0">${d.tiene_acceso ? "Ya tenés acceso al portal. Si querés cambiar la clave, escribí una nueva; si no, dejalo vacío." : "Con tu DNI y esta clave vas a poder ver lo que debés, mandar comprobantes y bajar tus recibos desde el portal."}</p>
    <label>Clave (mínimo 8 caracteres)<input type="password" name="clave" autocomplete="new-password" minlength="8"></label>
    <label>Repetí la clave<input type="password" name="clave2" autocomplete="new-password"></label>
    <div class="full error" id="d-error" role="alert"></div>
    <div class="full row"><button class="btn primary grande" type="submit">Guardar mis datos</button></div>
  </form>`;
}
function listo(r, d) {
  $("#app").innerHTML = cabecera(d.inmobiliaria) + `<section class="panel"><div class="estado ok"><b>¡Listo! Tus datos quedaron guardados.</b></div>
    ${r.con_clave || d.tiene_acceso ? `<p>Para entrar al portal usá:</p><dl class="dl"><div><dt>Usuario</dt><dd class="mono">${esc(r.usuario)} (tu DNI)</dd></div><div><dt>Clave</dt><dd>${r.con_clave ? "La que acabás de crear" : "La que ya tenías"}</dd></div></dl>
    <div class="row"><a class="btn primary grande" href="${PORTAL}">Ir al portal</a></div>` : `<p class="muted">Cuando quieras, podés volver a este link para crear tu clave del portal.</p>`}
  </section>`;
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
    if (v.clave || v.clave2) {
      if (v.clave.length < 8) return (err.textContent = "La clave tiene que tener al menos 8 caracteres.");
      if (v.clave !== v.clave2) return (err.textContent = "Las dos claves no coinciden.");
    } else if (!d.tiene_acceso && !confirm("No creaste tu clave del portal. ¿Guardar los datos igual?")) return;
    if (v.cbu && v.cbu.replace(/\D/g, "").length !== 22) return (err.textContent = "El CBU o CVU tiene que tener 22 números.");
    b.disabled = true; b.textContent = "Guardando…";
    try {
      const { clave } = v; delete v.clave; delete v.clave2;
      const r = await llamar("guardar", { datos: v, clave: clave || undefined });
      listo(r, d); scrollTo(0, 0);
    } catch (x) { err.textContent = x.message; b.disabled = false; b.textContent = "Guardar mis datos"; }
  });
}
iniciar();
