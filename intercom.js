// Cobranza Fuentes · Intercomunicador entre las computadoras de la oficina
// Voz directa entre los navegadores (WebRTC). Supabase Realtime solo se usa para saber quién está conectado
// y para pasar los avisos de la llamada; el audio no pasa por ningún servidor.
// Canal privado "intercom": solo lo pueden usar usuarios del equipo (ver supabase/32_intercomunicador.sql).
import { esc, toast } from "./comun.js?v=202611202006";
import { perso, actualizarPerso } from "./personalizar.js?v=202611202006";
import { iniciarWalkie, recibirWalkie, botonHablar, pintarBotones, elegirDestino, destinoWalkie } from "./walkie.js?v=202611202006";

const ICE = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
const SID = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
let sb, yo, canal = null, conectados = [], panel = null, abierto = false;
let llamada = null;   // { id, inicio, miembros:Set<sid>, pcs:Map<sid,{pc,audio,an}>, local, invitados:Set<sid>, timer }
let entrante = null;  // { id, de, nombre }
let ctxAudio = null, timbre = null, cola = new Map();

const cfg = () => ({ auto: false, mic: "", out: "", ...(perso().ic || {}) });
const nombreDe = (sid) => conectados.find((c) => c.sid === sid)?.nombre || llamada?.nombres?.get(sid) || "Alguien";
const enviar = (p) => canal?.send({ type: "broadcast", event: "ic", payload: { ...p, de: SID, nombre: yo.nombre } });
const nuevoId = () => Math.random().toString(36).slice(2, 10);

/* ---------------- sonidos ---------------- */
function audioCtx() { if (!ctxAudio) ctxAudio = new (window.AudioContext || window.webkitAudioContext)(); if (ctxAudio.state === "suspended") ctxAudio.resume().catch(() => {}); return ctxAudio; }
function tono(frecs, dur = 0.18, vol = 0.18) {
  try {
    const c = audioCtx(); let t = c.currentTime;
    for (const f of frecs) { const o = c.createOscillator(), g = c.createGain(); o.type = "sine"; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.linearRampToValueAtTime(0, t + dur); o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02); t += dur + 0.04; }
  } catch {}
}
function sonar(tipo) {
  pararTimbre();
  const f = tipo === "entrante" ? () => tono([880, 660, 880, 660], 0.16, 0.22) : () => tono([440], 0.5, 0.08);
  f(); timbre = setInterval(f, tipo === "entrante" ? 1800 : 2600);
}
function pararTimbre() { clearInterval(timbre); timbre = null; }

/* ---------------- conexión con el resto ---------------- */
export function iniciarIntercom(cliente, staff) {
  sb = cliente; yo = { uid: staff.user_id, nombre: staff.nombre || "Equipo" };
  canal = sb.channel("intercom", { config: { private: true, broadcast: { self: false }, presence: { key: SID } } });
  canal.on("presence", { event: "sync" }, () => { leerPresencia(); pintar(); })
    .on("broadcast", { event: "ic" }, ({ payload }) => recibir(payload).catch((e) => console.warn("intercom", e)))
    .subscribe(async (estado) => {
      if (estado === "SUBSCRIBED") await anunciar();
      if (estado === "CHANNEL_ERROR" || estado === "TIMED_OUT") { document.getElementById("ic-abrir")?.classList.add("ic-error"); }
    });
  addEventListener("beforeunload", () => { if (llamada) enviar({ t: "salir", id: llamada.id }); });
  iniciarWalkie({ enviar, conectados: () => conectados, cfg, tono, nombreDe });
  botonHablar(document.getElementById("wk-hablar"));
  pintarBoton();
}
const anunciar = () => canal?.track({ sid: SID, uid: yo.uid, nombre: yo.nombre, ocupado: !!llamada, ts: Date.now() });
function leerPresencia() {
  const st = canal.presenceState(), porUsuario = new Map();
  for (const lista of Object.values(st)) for (const m of lista) {
    if (!m.sid || m.sid === SID || m.uid === yo.uid) continue;
    const prev = porUsuario.get(m.uid); if (!prev || m.ts > prev.ts) porUsuario.set(m.uid, m);
  }
  conectados = [...porUsuario.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  pintarBoton(); pintarBotones();
  document.getElementById("wk-hablar")?.toggleAttribute("disabled", !conectados.length);
}

async function recibir(p) {
  if (p.para && !p.para.includes?.(SID) && p.para !== SID) return;
  if (p.t?.startsWith("w-")) return recibirWalkie(p);
  const enEsta = llamada && p.id === llamada.id;
  switch (p.t) {
    case "invitar":
      if (enEsta) return;
      if (llamada || entrante) { enviar({ t: "rechazar", id: p.id, para: p.de, motivo: "ocupado" }); return; }
      entrante = { id: p.id, de: p.de, nombre: p.nombre };
      if (cfg().auto) { tono([660, 990], 0.12); await atender(); return; }
      sonar("entrante"); avisoEscritorio(`${p.nombre} te está llamando`); abierto = true; pintar();
      entrante.timer = setTimeout(() => { if (entrante?.id === p.id) { entrante = null; pararTimbre(); toast(`Llamada perdida de ${p.nombre}`); pintar(); } }, 35000);
      return;
    case "rechazar":
      if (!enEsta) return;
      llamada.invitados.delete(p.de);
      toast(p.motivo === "ocupado" ? `${p.nombre} está en otra llamada` : `${p.nombre} no puede atender ahora`);
      if (!llamada.miembros.size && !llamada.invitados.size) terminar(false);
      pintar(); return;
    case "atender":
      if (!enEsta) return;
      llamada.invitados.delete(p.de); llamada.nombres.set(p.de, p.nombre);
      if (!llamada.miembros.size) { pararTimbre(); clearTimeout(llamada.timer); llamada.inicio = Date.now(); }
      enviar({ t: "presente", id: llamada.id, para: p.de });
      await unir(p.de); pintar(); return;
    case "presente":
      if (!enEsta) return; llamada.nombres.set(p.de, p.nombre); await unir(p.de); pintar(); return;
    case "salir":
      if (entrante && entrante.id === p.id && entrante.de === p.de) { clearTimeout(entrante.timer); entrante = null; pararTimbre(); toast(`Llamada perdida de ${p.nombre}`); pintar(); return; }
      if (!enEsta) return;
      llamada.invitados.delete(p.de); cortarPar(p.de);
      if (!llamada.miembros.size && !llamada.invitados.size) { toast(`${p.nombre} cortó`); terminar(false); } else pintar();
      return;
    case "senal": if (enEsta) await senal(p); return;
  }
}

/* ---------------- WebRTC ---------------- */
async function microfono() {
  const mic = cfg().mic;
  const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true, ...(mic ? { deviceId: { exact: mic } } : {}) };
  try { return await navigator.mediaDevices.getUserMedia({ audio }); }
  catch (e) {
    if (mic) { try { return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch {} }
    throw new Error(e.name === "NotAllowedError" ? "No hay permiso para usar el micrófono. Tocá el candado de la barra de direcciones y permití el micrófono." : e.name === "NotFoundError" ? "No se encontró ningún micrófono conectado." : e.message);
  }
}
async function unir(sid) {
  if (!llamada || llamada.pcs.has(sid)) return;
  llamada.miembros.add(sid);
  const pc = new RTCPeerConnection({ iceServers: ICE });
  const audio = new Audio(); audio.autoplay = true; audio.playsInline = true;
  const par = { pc, audio, hablando: false }; llamada.pcs.set(sid, par);
  if (cfg().out && audio.setSinkId) audio.setSinkId(cfg().out).catch(() => {});
  llamada.local.getTracks().forEach((t) => pc.addTrack(t, llamada.local));
  pc.ontrack = (e) => { audio.srcObject = e.streams[0]; audio.play().catch(() => {}); medir(e.streams[0], (v) => { if (v !== par.hablando) { par.hablando = v; marcarHablando(sid, v); } }); };
  pc.onicecandidate = (e) => { if (e.candidate) enviar({ t: "senal", id: llamada.id, para: sid, cand: e.candidate.toJSON() }); };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed") { toast(`No se pudo conectar el audio con ${nombreDe(sid)}`, "bad"); }
    pintar();
  };
  if (SID < sid) { const of = await pc.createOffer(); await pc.setLocalDescription(of); enviar({ t: "senal", id: llamada.id, para: sid, sdp: pc.localDescription.toJSON() }); }
  for (const p of cola.get(sid) || []) await senal(p); cola.delete(sid);
}
async function senal(p) {
  const par = llamada.pcs.get(p.de);
  if (!par) { if (!cola.has(p.de)) cola.set(p.de, []); cola.get(p.de).push(p); if (p.sdp?.type === "offer") { llamada.nombres.set(p.de, p.nombre); await unir(p.de); } return; }
  const pc = par.pc;
  if (p.sdp) {
    await pc.setRemoteDescription(p.sdp);
    if (p.sdp.type === "offer") { await pc.setLocalDescription(await pc.createAnswer()); enviar({ t: "senal", id: llamada.id, para: p.de, sdp: pc.localDescription.toJSON() }); }
    for (const c of par.pend || []) await pc.addIceCandidate(c).catch(() => {}); par.pend = [];
  } else if (p.cand) {
    if (!pc.remoteDescription) (par.pend ||= []).push(p.cand); else await pc.addIceCandidate(p.cand).catch(() => {});
  }
}
function medir(stream, cb) {
  try {
    const c = audioCtx(), src = c.createMediaStreamSource(stream), an = c.createAnalyser(); an.fftSize = 512; src.connect(an);
    const buf = new Uint8Array(an.fftSize); let ultimo = 0;
    const loop = () => { if (!llamada) return; an.getByteTimeDomainData(buf); let s = 0; for (const x of buf) s += (x - 128) ** 2; const v = Math.sqrt(s / buf.length); if (v > 6) ultimo = Date.now(); cb(Date.now() - ultimo < 350); setTimeout(loop, 120); };
    loop();
  } catch {}
}
function marcarHablando(sid, v) { panel?.querySelector(`[data-ic-sid="${sid}"]`)?.classList.toggle("habla", v); }
function cortarPar(sid) { const par = llamada?.pcs.get(sid); if (par) { try { par.pc.close(); } catch {} par.audio.srcObject = null; llamada.pcs.delete(sid); } llamada?.miembros.delete(sid); }

/* ---------------- acciones ---------------- */
async function llamar(sids) {
  sids = sids.filter(Boolean); if (!sids.length) return;
  audioCtx();
  if (!llamada) {
    let local; try { local = await microfono(); } catch (e) { toast(e.message, "bad"); return; }
    llamada = { id: nuevoId(), inicio: 0, miembros: new Set(), pcs: new Map(), local, invitados: new Set(), nombres: new Map(), mute: false };
    medir(local, (v) => marcarHablando("yo", v));
    sonar("saliente"); anunciar();
    llamada.timer = setTimeout(() => { if (llamada && !llamada.miembros.size) { toast("No atendieron"); terminar(true); } }, 35000);
  }
  for (const s of sids) { llamada.invitados.add(s); llamada.nombres.set(s, nombreDe(s)); }
  enviar({ t: "invitar", id: llamada.id, para: sids });
  pintar();
}
async function atender() {
  if (!entrante) return;
  const e = entrante; clearTimeout(e.timer); entrante = null; pararTimbre(); audioCtx();
  let local; try { local = await microfono(); } catch (er) { toast(er.message, "bad"); enviar({ t: "rechazar", id: e.id, para: e.de }); pintar(); return; }
  llamada = { id: e.id, inicio: Date.now(), miembros: new Set(), pcs: new Map(), local, invitados: new Set(), nombres: new Map([[e.de, e.nombre]]), mute: false };
  medir(local, (v) => marcarHablando("yo", v));
  anunciar(); abierto = true;
  enviar({ t: "atender", id: e.id });
  pintar();
}
function rechazar() { if (!entrante) return; clearTimeout(entrante.timer); enviar({ t: "rechazar", id: entrante.id, para: entrante.de }); entrante = null; pararTimbre(); pintar(); }
function terminar(avisar = true) {
  if (!llamada) return;
  if (avisar) enviar({ t: "salir", id: llamada.id });
  clearTimeout(llamada.timer); pararTimbre();
  for (const sid of [...llamada.pcs.keys()]) cortarPar(sid);
  llamada.local.getTracks().forEach((t) => t.stop());
  llamada = null; cola.clear(); tono([520, 390], 0.14, 0.12);
  anunciar(); pintar();
}
function silenciar() { if (!llamada) return; llamada.mute = !llamada.mute; llamada.local.getAudioTracks().forEach((t) => (t.enabled = !llamada.mute)); pintar(); }
function avisoEscritorio(txt) {
  try { if (document.hidden && "Notification" in window && Notification.permission === "granted") { const n = new Notification("Intercomunicador", { body: txt, tag: "intercom", requireInteraction: true }); n.onclick = () => { focus(); n.close(); }; } } catch {}
}

/* ---------------- pantalla ---------------- */
function pintarBoton() {
  const b = document.getElementById("ic-abrir"); if (!b) return;
  const n = conectados.length;
  b.querySelector(".ic-n").textContent = llamada ? "En llamada" : n ? `${n} conectado${n === 1 ? "" : "s"}` : "Nadie conectado";
  b.classList.toggle("activo", !!llamada || !!entrante); b.classList.toggle("hay", n > 0);
}
const dur = () => { if (!llamada?.inicio) return ""; const s = Math.floor((Date.now() - llamada.inicio) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
let reloj = null;
async function opcionesDisp() {
  try {
    const ds = await navigator.mediaDevices.enumerateDevices(), c = cfg();
    const op = (k) => ds.filter((d) => d.kind === k).map((d, i) => `<option value="${esc(d.deviceId)}" ${c[k === "audioinput" ? "mic" : "out"] === d.deviceId ? "selected" : ""}>${esc(d.label || (k === "audioinput" ? "Micrófono " : "Salida ") + (i + 1))}</option>`).join("");
    const mi = panel?.querySelector("[data-ic-mic]"), sa = panel?.querySelector("[data-ic-out]");
    if (mi) mi.innerHTML = `<option value="">El predeterminado de la compu</option>` + op("audioinput");
    if (sa) { const o = op("audiooutput"); if (o && "setSinkId" in HTMLAudioElement.prototype) sa.innerHTML = `<option value="">El predeterminado de la compu</option>` + o; else sa.closest("label").hidden = true; }
  } catch {}
}
function pintar() {
  pintarBoton();
  if (!abierto && !entrante && !llamada) { panel?.remove(); panel = null; clearInterval(reloj); reloj = null; return; }
  if (!panel) { panel = document.createElement("div"); panel.className = "ic-panel"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Intercomunicador"); document.documentElement.appendChild(panel); eventos(); }
  if (entrante) panel.classList.remove("ic-oculto");
  const c = cfg();
  let h = `<div class="ic-bar"><b>Intercomunicador</b><button type="button" data-ic="cerrar" aria-label="Cerrar" title="${llamada ? "Ocultar (la llamada sigue)" : "Cerrar"}">×</button></div>`;
  if (entrante) {
    h += `<div class="ic-entra"><div class="ic-pulso"></div><div><b>${esc(entrante.nombre)}</b><span>te está llamando</span></div>
      <div class="ic-acc"><button type="button" class="btn primary ic-ok" data-ic="atender">Atender</button><button type="button" class="btn" data-ic="rechazar">Ahora no</button></div></div>`;
  } else if (llamada) {
    const gente = [...llamada.miembros].map((s) => { const st = llamada.pcs.get(s)?.pc.connectionState; return `<li data-ic-sid="${s}"><span class="ic-av">${esc(nombreDe(s).slice(0, 1))}</span>${esc(nombreDe(s))}<small>${st === "connected" ? "" : st === "failed" ? "sin conexión" : "conectando…"}</small></li>`; }).join("")
      + [...llamada.invitados].map((s) => `<li class="ic-espera"><span class="ic-av">${esc(nombreDe(s).slice(0, 1))}</span>${esc(nombreDe(s))}<small>llamando…</small></li>`).join("");
    const libres = conectados.filter((x) => !llamada.miembros.has(x.sid) && !llamada.invitados.has(x.sid));
    h += `<div class="ic-llam"><div class="ic-est">${llamada.miembros.size ? `En llamada <span class="ic-dur">${dur()}</span>` : "Llamando…"}</div>
      <ul class="ic-gente"><li data-ic-sid="yo" class="ic-yo"><span class="ic-av">${esc(yo.nombre.slice(0, 1))}</span>Vos${llamada.mute ? "<small>micrófono apagado</small>" : ""}</li>${gente}</ul>
      <div class="ic-acc"><button type="button" class="btn ${llamada.mute ? "primary" : ""}" data-ic="mute">${llamada.mute ? "Prender micrófono" : "Silenciar"}</button><button type="button" class="btn ic-colgar" data-ic="colgar">Cortar</button></div>
      ${libres.length ? `<div class="ic-sumar"><span class="muted">Sumar a:</span>${libres.map((x) => `<button type="button" class="link" data-ic-llamar="${x.sid}">${esc(x.nombre)}</button>`).join("")}</div>` : ""}</div>`;
  } else {
    const dest = conectados.some((x) => x.sid === destinoWalkie()) ? destinoWalkie() : "todos";
    h += conectados.length ? `<div class="wk-sec"><div class="wk-tit"><b>Walkie-talkie</b><span class="muted">mantené apretado, hablá y soltá</span></div>
      <div class="wk-fila"><select data-wk-dest aria-label="A quién le hablás"><option value="todos">A todos</option>${conectados.map((x) => `<option value="${x.sid}" ${dest === x.sid ? "selected" : ""}>A ${esc(x.nombre)}</option>`).join("")}</select>
      <button type="button" class="wk-btn" data-wk-boton><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4"/></svg><span class="wk-lbl">Mantener para hablar</span></button></div>
      ${cfg().f2 !== false ? `<div class="muted wk-ayuda">También podés mantener apretada la tecla <kbd>F2</kbd> mientras el sistema está en pantalla.</div>` : ""}</div>` : "";
    h += conectados.length
      ? `<div class="wk-tit ic-llam-tit"><b>Llamada</b><span class="muted">para charlar un rato</span></div><ul class="ic-lista">${conectados.map((x) => `<li><span class="ic-av">${esc(x.nombre.slice(0, 1))}</span><span class="ic-nom">${esc(x.nombre)}<small>${x.ocupado ? "en otra llamada" : "conectado"}</small></span><button type="button" class="btn small wk-mini" data-wk-boton data-wk-para="${x.sid}" title="Walkie-talkie: mantené apretado para decirle algo a ${esc(x.nombre)}" aria-label="Walkie-talkie a ${esc(x.nombre)}: mantener apretado para hablar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4"/></svg><span class="wk-lbl sr">Mantener</span></button><button type="button" class="btn small primary" data-ic-llamar="${x.sid}" ${x.ocupado ? "disabled" : ""}>Llamar</button></li>`).join("")}</ul>
        ${conectados.length > 1 ? `<button type="button" class="btn" data-ic="todos">Llamar a todos</button>` : ""}`
      : `<p class="muted ic-vacio">No hay nadie más del equipo con el sistema abierto ahora. Cuando alguien lo abra, aparece acá.</p>`;
    h += `<details class="ic-conf"><summary>Auriculares y opciones</summary>
      <label>Micrófono<select data-ic-mic><option value="">El predeterminado de la compu</option></select></label>
      <label>Escuchar por<select data-ic-out><option value="">El predeterminado de la compu</option></select></label>
      <label class="ic-sw"><input type="checkbox" data-ic-auto ${c.auto ? "checked" : ""}> Atender solo (modo intercomunicador): cuando me llaman, se conecta sin tocar nada</label>
      <label class="ic-sw"><input type="checkbox" data-ic-walkie ${c.walkie !== false ? "checked" : ""}> Escuchar los mensajes de walkie-talkie</label>
      <label class="ic-sw"><input type="checkbox" data-ic-f2 ${c.f2 !== false ? "checked" : ""}> Hablar manteniendo apretada la tecla F2</label>
      <button type="button" class="link" data-ic="probar">Probar sonido</button></details>`;
  }
  panel.innerHTML = h;
  panel.querySelectorAll("[data-wk-boton]").forEach((b) => botonHablar(b, !!b.dataset.wkPara)); pintarBotones();
  if (!llamada && !entrante) opcionesDisp();
  clearInterval(reloj); reloj = llamada ? setInterval(() => { const d = panel?.querySelector(".ic-dur"); if (d) d.textContent = dur(); }, 1000) : null;
}
function eventos() {
  panel.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return; const d = b.dataset;
    if (d.icLlamar) return llamar([d.icLlamar]);
    const a = d.ic;
    if (a === "cerrar") { abierto = false; if (llamada || entrante) { panel.classList.add("ic-oculto"); return; } pintar(); }
    if (a === "atender") atender();
    if (a === "rechazar") rechazar();
    if (a === "colgar") terminar(true);
    if (a === "mute") silenciar();
    if (a === "todos") llamar(conectados.filter((x) => !x.ocupado).map((x) => x.sid));
    if (a === "probar") { const c = cfg(); const au = new Audio(); if (c.out && au.setSinkId) au.setSinkId(c.out).catch(() => {}); tono([660, 880, 990], 0.15); }
  });
  panel.addEventListener("change", (e) => {
    const t = e.target, c = cfg();
    if (t.matches("[data-ic-mic]")) actualizarPerso({ ic: { ...c, mic: t.value } });
    if (t.matches("[data-ic-out]")) actualizarPerso({ ic: { ...c, out: t.value } });
    if (t.matches("[data-ic-auto]")) actualizarPerso({ ic: { ...c, auto: t.checked } });
    if (t.matches("[data-ic-walkie]")) actualizarPerso({ ic: { ...c, walkie: t.checked } });
    if (t.matches("[data-ic-f2]")) { actualizarPerso({ ic: { ...c, f2: t.checked } }); pintar(); }
    if (t.matches("[data-wk-dest]")) elegirDestino(t.value);
  });
}
/** Para revisar: bytes de audio recibidos por cada conexión. */
export async function estadoIntercom() { if (!llamada) return null; const r = []; for (const [sid, { pc }] of llamada.pcs) { let bytes = 0; (await pc.getStats()).forEach((x) => { if (x.type === "inbound-rtp" && x.kind === "audio") bytes += x.bytesReceived; }); r.push({ sid, estado: pc.connectionState, bytes }); } return r; }
window.__intercom = estadoIntercom;
/** Botón del menú lateral. */
export async function alternarIntercom() {
  audioCtx();
  if (panel && panel.classList.contains("ic-oculto")) { panel.classList.remove("ic-oculto"); abierto = true; return; }
  abierto = !abierto || !!llamada || !!entrante; pintar();
  if (abierto && "Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
  // pedir permiso del micrófono la primera vez, así después se ven los nombres de los auriculares
  try { const st = await navigator.permissions?.query({ name: "microphone" }); if (st && st.state === "prompt") { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach((t) => t.stop()); opcionesDisp(); } } catch {}
}
