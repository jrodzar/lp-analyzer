/**
 * Helpers compartidos por los motores EVM (evm/app.js) y Solana (sol/app.js).
 * Se carga ANTES de app.js en cada index.html. Son funciones puras (formato y UI),
 * sin lógica específica de cadena. La lógica propia de cada motor sigue en su app.js.
 *
 * Nota: shortAddr NO está aquí porque difiere por motor (EVM usa 6 chars de prefijo,
 * Solana 4).
 */

// Divisa de visualización: siempre USD.
var _fx = { rate: 1, sym: "$" };
function setCurrency(rate, sym) { _fx = { rate: Number(rate) || 1, sym: sym || "$" }; }

// Formato normal con separador de miles: $8,300.00 (tarjetas, resúmenes…)
// Decimales muy pequeños SIN notación científica: "0.00000002" en vez de "2.00e-8".
// `sig` = cifras significativas (3 por defecto). Quita ceros sobrantes a la derecha.
function fmtTiny(n, sig = 3) {
  if (n === 0 || !isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1) {
    // Para valores >= 1 usamos toFixed normal y quitamos ceros finales.
    const s = abs.toFixed(sig);
    return (n < 0 ? "-" : "") + s.replace(/\.?0+$/, "");
  }
  // Para valores < 1, calculamos cuántos decimales necesitamos para alcanzar `sig`
  // cifras significativas: si abs = 0.000…0X (X primer dígito no-cero), llamamos
  // pos = nº ceros tras el punto + 1; necesitamos pos + sig - 1 decimales.
  const pos = -Math.floor(Math.log10(abs));
  const decimals = pos + sig - 1;
  let s = n.toFixed(decimals);
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s;
}

function fmtUSD(n) {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  n = n * _fx.rate; const S = _fx.sym;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs === 0) return S + "0";
  if (abs >= 1) return `${sign}${S}${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (abs >= 0.01) return `${sign}${S}${abs.toFixed(4)}`;
  return `${sign}${S}${fmtTiny(abs, 3)}`;
}

// Formato compacto: $8.30k / $1.20M (solo ejes y etiquetas de gráficos)
function fmtUSDc(n) {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  n = n * _fx.rate; const S = _fx.sym;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}${S}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${S}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${S}${(abs / 1e3).toFixed(2)}k`;
  if (abs >= 1) return `${sign}${S}${abs.toFixed(2)}`;
  if (abs >= 0.01) return `${sign}${S}${abs.toFixed(4)}`;
  if (abs === 0) return S + "0";
  return `${sign}${S}${fmtTiny(abs, 3)}`;
}

function fmtToken(n, sym) {
  if (!isFinite(n)) return `— ${sym}`;
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M ${sym}`;
  if (abs >= 1) return `${n.toFixed(4)} ${sym}`;
  if (abs >= 0.0001) return `${n.toFixed(6)} ${sym}`;
  if (abs === 0) return `0 ${sym}`;
  return `${fmtTiny(n, 3)} ${sym}`;
}

function fmtPct(n) {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function pnlColor(n) {
  if (n === null || n === undefined || !isFinite(n)) return "text-slate-400";
  if (n > 0) return "text-emerald-400";
  if (n < 0) return "text-rose-400";
  return "text-slate-300";
}

// Barra gráfica de rango: precio min/max + marcador del precio actual.
// price(tick) = 1.0001^tick * 10^(dec0-dec1)
function rangeBarHTML(tickLower, tickUpper, tickCur, dec0, dec1, inRange, closed) {
  if (tickLower == null || tickUpper == null || !isFinite(tickLower) || !isFinite(tickUpper)) return "";
  const decAdj = Math.pow(10, (Number(dec0) || 0) - (Number(dec1) || 0));
  const priceAt = (t) => Math.pow(1.0001, Number(t)) * decAdj;
  const pLow = priceAt(tickLower), pHigh = priceAt(tickUpper);
  const pCur = (tickCur != null && isFinite(tickCur)) ? priceAt(tickCur) : null;
  if (!isFinite(pLow) || !isFinite(pHigh) || pHigh <= pLow) return "";

  // Ventana visible: rango ±50%, incluyendo siempre el precio actual.
  const span = pHigh - pLow;
  let vMin = pLow - span * 0.5;
  let vMax = pHigh + span * 0.5;
  if (pCur != null) { vMin = Math.min(vMin, pCur); vMax = Math.max(vMax, pCur); }
  const W = vMax - vMin || 1;
  const pct = (v) => Math.max(0, Math.min(100, ((v - vMin) / W) * 100));
  const left = pct(pLow), right = pct(pHigh);
  const bandColor = closed ? "rgba(100,116,139,0.35)" : inRange ? "rgba(16,185,129,0.30)" : "rgba(245,158,11,0.28)";
  const borderC = closed ? "rgba(100,116,139,0.5)" : inRange ? "rgba(16,185,129,0.6)" : "rgba(245,158,11,0.6)";
  const fmtP = (v) => v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 })
                    : v >= 1 ? v.toFixed(3) : fmtTiny(v, 3);
  const marker = pCur != null
    ? `<div class="absolute top-0 bottom-0 w-0.5 bg-slate-100" style="left:${pct(pCur)}%"></div>
       <div class="absolute -top-1 w-2 h-2 rounded-full bg-slate-100" style="left:${pct(pCur)}%;transform:translateX(-50%)"></div>`
    : "";
  return `
    <div class="pt-0.5">
      <div class="relative h-6 rounded-md bg-slate-950/60 border border-slate-800 overflow-hidden">
        <div class="absolute top-0 bottom-0 rounded-sm" style="left:${left}%;width:${Math.max(1, right - left)}%;background:${bandColor};border-left:2px solid ${borderC};border-right:2px solid ${borderC}"></div>
        ${marker}
      </div>
      <div class="flex justify-between text-[9px] text-slate-500 mt-0.5">
        <span>${fmtP(pLow)}</span>
        ${pCur != null ? `<span class="text-slate-300 font-semibold">${fmtP(pCur)}</span>` : ""}
        <span>${fmtP(pHigh)}</span>
      </div>
    </div>`;
}

// Tooltips por toque: en móvil no hay hover, así que al pulsar un elemento con
// clase "cursor-help" y atributo title se muestra el texto en un pequeño popover.
// (En escritorio se mantiene el hover nativo del title.)
function setupTipTaps(doc) {
  let tip = null;
  const hide = () => { if (tip) { tip.remove(); tip = null; } };
  doc.addEventListener("click", (e) => {
    const el = e.target.closest && e.target.closest(".cursor-help[title]");
    if (!el) { hide(); return; }
    e.preventDefault(); e.stopPropagation();
    hide();
    tip = doc.createElement("div");
    tip.textContent = el.getAttribute("title");
    tip.style.cssText = "position:fixed;z-index:9999;max-width:260px;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:8px 10px;font-size:12px;line-height:1.4;box-shadow:0 4px 16px rgba(0,0,0,.45)";
    doc.body.appendChild(tip);
    const r = el.getBoundingClientRect();
    let top = r.bottom + 6;
    let left = Math.min(r.left, doc.documentElement.clientWidth - tip.offsetWidth - 8);
    if (top + tip.offsetHeight > doc.documentElement.clientHeight) top = r.top - tip.offsetHeight - 6;
    tip.style.top = Math.max(8, top) + "px";
    tip.style.left = Math.max(8, left) + "px";
  }, true);
  doc.addEventListener("scroll", hide, true);
}
if (typeof document !== "undefined") {
  if (document.readyState !== "loading") setupTipTaps(document);
  else document.addEventListener("DOMContentLoaded", () => setupTipTaps(document));
}

// Plugin Chart.js: imprime el valor (compacto) encima de cada barra.
var barValueLabels = {
  id: "barValueLabels",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    chart.data.datasets.forEach((ds, di) => {
      const meta = chart.getDatasetMeta(di);
      if (meta.hidden) return;
      meta.data.forEach((bar, i) => {
        const val = ds.data[i];
        if (val == null) return;
        ctx.save();
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "600 11px ui-sans-serif, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(fmtUSDc(val), bar.x, bar.y - 4);
        ctx.restore();
      });
    });
  },
};
