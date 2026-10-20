// Cobranza Fuentes · Calculadora a mano (botón en la barra lateral)
// Cuentas como una calculadora de escritorio: 100.000 + 15% = 115.000 · 2.500 × 3 = 7.500 · paréntesis y teclado.
const fmt = (n) => (Number.isFinite(n) ? n.toLocaleString("es-AR", { maximumFractionDigits: 6 }) : "Error");

// Evaluador sin eval(): números con coma decimal, + − × ÷, paréntesis y % (a + b% = a más el b% de a)
function evaluar(txt) {
  const s = txt.replace(/\s+/g, "").replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
  let i = 0;
  const num = () => {
    const m = /^(\d[\d.]*)(,\d*)?/.exec(s.slice(i)); if (!m) throw new Error("número");
    i += m[0].length; return parseFloat(m[1].replace(/\./g, "") + (m[2] ? "." + m[2].slice(1) : ""));
  };
  const factor = () => {
    let v;
    if (s[i] === "-") { i++; return { v: -factor().v, pct: false }; }
    if (s[i] === "+") { i++; return factor(); }
    if (s[i] === "(") { i++; v = expr(); if (s[i] !== ")") throw new Error(")"); i++; } else v = num();
    let pct = false; if (s[i] === "%") { i++; pct = true; }
    return { v, pct };
  };
  const term = () => {
    let f = factor(), v = f.pct ? f.v / 100 : f.v, pct = f.pct, raw = f.v;
    while (s[i] === "*" || s[i] === "/") {
      const op = s[i++], g = factor(), w = g.pct ? g.v / 100 : g.v;
      v = op === "*" ? v * w : v / w; pct = false;
    }
    return { v, pct, raw };
  };
  const expr = () => {
    let t = term(), v = t.v;
    while (s[i] === "+" || s[i] === "-") {
      const op = s[i++], u = term(), w = u.pct ? v * u.raw / 100 : u.v;
      v = op === "+" ? v + w : v - w;
    }
    return v;
  };
  const r = expr(); if (i < s.length) throw new Error("sobra");
  return Math.round(r * 1e8) / 1e8;
}

export function iniciarCalculadora() {
  const abrir = document.getElementById("calc-abrir"); if (!abrir) return;
  let ultimoCampo = null;   // último campo numérico donde estaba escribiendo, para pegarle el resultado
  document.addEventListener("focusin", (e) => { if (e.target.matches?.('input[type="number"], input.ct-monto, input.pl-monto')) ultimoCampo = e.target; });
  const p = document.createElement("div"); p.className = "calc"; p.id = "calc"; p.hidden = true; p.setAttribute("role", "dialog"); p.setAttribute("aria-label", "Calculadora");
  const teclas = ["C", "(", ")", "⌫", "7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "−", "0", ",", "%", "+"];
  p.innerHTML = `<div class="calc-h"><b>Calculadora</b><button type="button" class="x" data-calc="cerrar" aria-label="Cerrar">×</button></div>
    <div class="calc-hist" aria-live="polite"></div>
    <input class="calc-pant" type="text" inputmode="decimal" aria-label="Cuenta" autocomplete="off">
    <div class="calc-res" aria-live="polite">0</div>
    <div class="calc-teclas">${teclas.map((t) => `<button type="button" data-k="${t}" class="${/[÷×−+%()]/.test(t) ? "op" : t === "C" || t === "⌫" ? "fn" : ""}">${t}</button>`).join("")}
      <button type="button" data-k="=" class="igual">=</button></div>
    <div class="calc-acc"><button type="button" class="btn small" data-calc="copiar">Copiar resultado</button><button type="button" class="btn small" data-calc="pegar" title="Lo escribe en el último campo de importe que usaste">Pasar al campo</button></div>`;
  document.body.appendChild(p);
  const pant = p.querySelector(".calc-pant"), res = p.querySelector(".calc-res"), hist = p.querySelector(".calc-hist");
  let resultado = 0; const historial = [];
  const vivo = () => { if (!pant.value.trim()) { res.textContent = fmt(resultado); return; } try { res.textContent = "= " + fmt(evaluar(pant.value)); res.classList.remove("err"); } catch { res.textContent = "…"; } };
  const igual = () => {
    if (!pant.value.trim()) return;
    try { resultado = evaluar(pant.value); historial.unshift(`${pant.value} = ${fmt(resultado)}`); historial.length = Math.min(historial.length, 4);
      hist.innerHTML = historial.map((h) => `<div>${h.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))}</div>`).join("");
      pant.value = fmt(resultado); res.textContent = "= " + fmt(resultado); }
    catch { res.textContent = "Cuenta incompleta"; res.classList.add("err"); }
  };
  const tecla = (k) => {
    if (k === "=") return igual();
    if (k === "C") { pant.value = ""; resultado = 0; return vivo(); }
    if (k === "⌫") { pant.value = pant.value.slice(0, -1); return vivo(); }
    pant.value += k; vivo();
  };
  const mostrar = (si) => { p.hidden = !si; document.body.classList.toggle("calc-abierta", si); if (si) setTimeout(() => pant.focus(), 0); };
  abrir.addEventListener("click", () => mostrar(p.hidden));
  p.addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.k) { tecla(b.dataset.k); pant.focus(); return; }
    if (b.dataset.calc === "cerrar") return mostrar(false);
    const valor = pant.value.trim() ? (() => { try { return evaluar(pant.value); } catch { return resultado; } })() : resultado;
    if (b.dataset.calc === "copiar") { try { await navigator.clipboard.writeText(String(valor).replace(".", ",")); b.textContent = "Copiado"; setTimeout(() => (b.textContent = "Copiar resultado"), 1500); } catch {} }
    if (b.dataset.calc === "pegar") {
      if (!ultimoCampo || !ultimoCampo.isConnected) { b.textContent = "Tocá antes un campo"; setTimeout(() => (b.textContent = "Pasar al campo"), 1800); return; }
      ultimoCampo.value = Math.round(valor * 100) / 100; ultimoCampo.dispatchEvent(new Event("input", { bubbles: true })); ultimoCampo.dispatchEvent(new Event("change", { bubbles: true })); ultimoCampo.focus();
    }
  });
  pant.addEventListener("input", () => { pant.value = pant.value.replace(/\*/g, "×").replace(/\//g, "÷").replace(/[^\d.,+\-−×÷%()\s]/g, ""); vivo(); });
  pant.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === "=") { e.preventDefault(); igual(); }
    else if (e.key === "Escape") { e.preventDefault(); mostrar(false); }
    else if (e.key === "Delete") { e.preventDefault(); tecla("C"); }
  });
}
