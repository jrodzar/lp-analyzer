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

// ─── PnL en token base + desglose ─────────────────────────────────────────────
// El PnL en USD es informativo pero engañoso en pares con tokens muy volátiles:
// si depositaste 1 ETH cuando valía $4000 y ahora vale $3500, tu LP vale menos
// USD pero puede que tengas casi 1 ETH equivalente. Por eso ofrecemos también
// el PnL convertido al token "base" (el no-stable del par) a precio actual.

// ¿El símbolo parece una stablecoin? Cubre el set común + cualquier cosa con
// "USD" en el nombre (USDC, USDT, USDC.e, USDÞ0, USDe, USDP, USDS, sUSD…).
function isStableSymbol(sym) {
  if (!sym) return false;
  const s = String(sym).toUpperCase();
  if (["DAI", "FRAX", "LUSD", "MIM", "SUSD", "PYUSD", "GUSD", "TUSD"].includes(s)) return true;
  if (s.includes("USD")) return true;
  return false;
}

// Índice del token base del par (0 ó 1), o -1 si ambos son stables.
// Heurística: el NO-stable es el base. Si los dos son volátiles, token0.
// Si los dos son stables, no hay base útil (devolver -1).
function pickBaseTokenIdx(sym0, sym1) {
  const s0 = isStableSymbol(sym0), s1 = isStableSymbol(sym1);
  if (s0 && !s1) return 1;
  if (!s0 && s1) return 0;
  if (s0 && s1) return -1;
  return 0;
}

// Línea "≈ -0.00046 WBTC" (sin USD), color verde/rojo según signo. "" si no aplica.
function pnlInBaseHTML(pnlUSD, sym0, sym1, price0, price1) {
  if (pnlUSD == null || !isFinite(pnlUSD)) return "";
  const idx = pickBaseTokenIdx(sym0, sym1);
  if (idx < 0) return ""; // ambas stables → la conversión "≈ X USDT" no aporta
  const sym = idx === 0 ? sym0 : sym1;
  const price = idx === 0 ? price0 : price1;
  if (!price || price <= 0 || !isFinite(price)) return "";
  const tokens = pnlUSD / price;
  const cls = pnlColor(tokens);
  const signed = (tokens >= 0 ? "+" : "") + fmtTiny(tokens, 3);
  return `<div class="text-[10px] ${cls} mt-0.5">≈ ${signed} ${sym}</div>`;
}

// Desglose colapsable del PnL: Δ precio tokens + IL + Fees = PnL.
// "Δ precio tokens" se calcula como residual (pnl − il − fees) para que la
// suma cuadre siempre, incluso con retiradas (donde el HODL exacto es ambiguo
// porque depende del precio del token EN EL MOMENTO de cada retirada).
function pnlBreakdownHTML(pnlUSD, ilUSD, feesAllUSD) {
  if (pnlUSD == null || !isFinite(pnlUSD)) return "";
  const il = (ilUSD == null || !isFinite(ilUSD)) ? 0 : ilUSD;
  const fees = (feesAllUSD == null || !isFinite(feesAllUSD)) ? 0 : feesAllUSD;
  const priceChg = pnlUSD - il - fees;
  const row = (label, val, tipKey) => {
    const tip = tipKey ? ` <span class="cursor-help" title="${tipKey}">ⓘ</span>` : "";
    return `<div class="flex justify-between gap-2"><span class="text-slate-400">${label}${tip}</span><span class="${pnlColor(val)} font-mono">${fmtUSD(val)}</span></div>`;
  };
  return `
    <details class="mt-1 group">
      <summary class="text-[10px] text-slate-500 cursor-pointer hover:text-slate-300 select-none list-none">
        <span class="group-open:hidden">▾ desglose</span><span class="hidden group-open:inline">▴ desglose</span>
      </summary>
      <div class="mt-1 space-y-0.5 text-[10px]">
        ${row("Δ precio tokens", priceChg, "Cambio de valor de los tokens depositados a precios actuales: lo que ganarías o perderías por haberlos mantenido sin proveer liquidez. Es el efecto puro del mercado.")}
        ${row("IL vs HODL", il, "Pérdida (o ganancia) por estar en LP en vez de HODL: divergencia de precios entre los dos tokens del par.")}
        ${row("Fees totales", fees, "Suma de fees cobradas + fees pendientes (lo que has ganado proveyendo liquidez).")}
        <div class="flex justify-between gap-2 pt-1 mt-0.5 border-t border-slate-800">
          <span class="text-slate-300 font-semibold">PnL neto</span>
          <span class="${pnlColor(pnlUSD)} font-semibold font-mono">${fmtUSD(pnlUSD)}</span>
        </div>
      </div>
    </details>`;
}

// ─── Histórico de APR por mes natural ─────────────────────────────────────
// `computeMonthlyAPRs` y `monthlyAprTableHTML` vivían aquí cuando cada card
// mostraba su propia mini-tabla "📅 APR mensual". Esa mini-tabla se eliminó:
// ahora el APR por mes (y su desglose por pool) vive SOLO en el Histórico,
// que lo renderiza shell.js con su propia copia de `computeMonthlyAPRs` +
// el nuevo `monthlyAprByMonthHTML`. El shell no carga common.js, así que la
// lógica está en shell.js. Aquí ya no hace falta — borradas para no dejar
// código muerto. Si en el futuro una card vuelve a necesitar el cálculo,
// recupéralo de shell.js (es la copia canónica).

// Barra gráfica de rango: precio min/max + marcador del precio actual.
// price(tick) = 1.0001^tick * 10^(dec0-dec1) = token1 por token0.
// Con sym0/sym1 añade un switch para invertir la denominación del precio entre
// las dos monedas del pool (útil para leer el rango desde cualquiera de las dos).
// Renderiza AMBAS orientaciones y el switch sólo conmuta su visibilidad (handler
// delegado), así sobrevive al round-trip postMessage de las cards en el shell.
let _rbUid = 0;
function rangeBarInner(lo, hi, cur, inRange, closed) {
  const fmtP = (v) => v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 })
                    : v >= 1 ? v.toFixed(3) : fmtTiny(v, 3);
  const span = hi - lo;
  let vMin = lo - span * 0.5, vMax = hi + span * 0.5;
  if (cur != null) { vMin = Math.min(vMin, cur); vMax = Math.max(vMax, cur); }
  const W = vMax - vMin || 1;
  const pct = (v) => Math.max(0, Math.min(100, ((v - vMin) / W) * 100));
  const left = pct(lo), right = pct(hi);
  const bandColor = closed ? "rgba(100,116,139,0.35)" : inRange ? "rgba(16,185,129,0.30)" : "rgba(245,158,11,0.28)";
  const borderC = closed ? "rgba(100,116,139,0.5)" : inRange ? "rgba(16,185,129,0.6)" : "rgba(245,158,11,0.6)";
  const marker = cur != null
    ? `<div class="absolute top-0 bottom-0 w-0.5 bg-slate-100" style="left:${pct(cur)}%"></div>
       <div class="absolute -top-1 w-2 h-2 rounded-full bg-slate-100" style="left:${pct(cur)}%;transform:translateX(-50%)"></div>`
    : "";
  return `
      <div class="relative h-6 rounded-md bg-slate-950/60 border border-slate-800 overflow-hidden">
        <div class="absolute top-0 bottom-0 rounded-sm" style="left:${left}%;width:${Math.max(1, right - left)}%;background:${bandColor};border-left:2px solid ${borderC};border-right:2px solid ${borderC}"></div>
        ${marker}
      </div>
      <div class="flex justify-between text-[9px] text-slate-500 mt-0.5">
        <span>${fmtP(lo)}</span>
        ${cur != null ? `<span class="text-slate-300 font-semibold">${fmtP(cur)}</span>` : ""}
        <span>${fmtP(hi)}</span>
      </div>`;
}
function rangeBarHTML(tickLower, tickUpper, tickCur, dec0, dec1, inRange, closed, sym0, sym1) {
  if (tickLower == null || tickUpper == null || !isFinite(tickLower) || !isFinite(tickUpper)) return "";
  const decAdj = Math.pow(10, (Number(dec0) || 0) - (Number(dec1) || 0));
  const priceAt = (t) => Math.pow(1.0001, Number(t)) * decAdj;
  const pLow = priceAt(tickLower), pHigh = priceAt(tickUpper);
  const pCur = (tickCur != null && isFinite(tickCur)) ? priceAt(tickCur) : null;
  if (!isFinite(pLow) || !isFinite(pHigh) || pHigh <= pLow) return "";
  const view1 = rangeBarInner(pLow, pHigh, pCur, inRange, closed);
  if (!sym0 || !sym1) return `<div class="pt-0.5">${view1}</div>`;
  const view0 = rangeBarInner(1 / pHigh, 1 / pLow, pCur != null ? 1 / pCur : null, inRange, closed);
  const uid = "rb" + (++_rbUid) + Math.random().toString(36).slice(2, 6);
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const s0 = esc(sym0), s1 = esc(sym1);
  const btn = (q, lbl, on) => `<button type="button" data-range-quote="${q}" data-uid="${uid}" class="px-2 py-0.5 rounded ${on ? "bg-emerald-500 text-slate-900" : "text-slate-400 hover:text-slate-200"} font-semibold transition">${lbl}</button>`;
  return `
    <div class="pt-0.5" data-rangebar>
      <div class="flex justify-end mb-1">
        <div class="inline-flex items-center gap-0.5 rounded-md bg-slate-800/70 border border-slate-700 p-0.5 text-[10px]" title="Cambia la moneda en la que se ven los precios del rango">
          ${btn("0", s0, false)}${btn("1", s1, true)}
        </div>
      </div>
      <div data-range-view="1" data-uid="${uid}">${view1}</div>
      <div data-range-view="0" data-uid="${uid}" class="hidden">${view0}</div>
    </div>`;
}

// Símbolo del PAR de un pool para TradingView (SOL/USDC → SOLUSDC, UNI/WETH →
// UNIETH). Ordena base/quote por "rango de quote" (stable > BTC > ETH > L1 >
// resto) porque token0/token1 vienen ordenados por dirección, no por relevancia.
// Devuelve null si algún símbolo no es resoluble (dirección abreviada con "…").
const _PAIR_STABLE_RX = /^(USDC|USDT|DAI|USD|USDE|USDS|FDUSD|PYUSD|TUSD|FRAX|GHO|LUSD|SUSD|USDD|USDBC|USR|DOLA|CRVUSD|GUSD)$/;
const _PAIR_UNWRAP = { WETH: "ETH", WBTC: "BTC", WSOL: "SOL", WBNB: "BNB", WMATIC: "MATIC", WPOL: "POL", WHYPE: "HYPE", WAVAX: "AVAX", CBBTC: "BTC", TBTC: "BTC" };
function poolPairTvSymbol(sym0, sym1) {
  // xStock en el par → graficar la acción subyacente directamente (TSLAx → TSLA),
  // que es lo que TradingView resuelve (NASDAQ:TSLA) en vez de un par inexistente.
  const isX = (s) => { const m = String(s || "").match(/^([A-Za-z0-9]{1,8})x$/); return m && /^[A-Z]/.test(m[1]) ? m[1].toUpperCase() : null; };
  const x0 = isX(sym0), x1 = isX(sym1);
  if (x0) return x0;
  if (x1) return x1;
  const norm = (s) => {
    let u = String(s || "").toUpperCase().trim();
    if (!u || u.includes("…") || u.includes("...")) return null; // dirección abreviada → no resoluble
    u = u.replace(/\.E$/, "");                                    // USDC.E → USDC
    if (/^USD[TC]0$/.test(u)) u = u.slice(0, 4);                  // USDT0/USDC0 (HyperEVM) → USDT/USDC
    u = _PAIR_UNWRAP[u] || u;                                     // WETH→ETH, WBTC→BTC, … (lista cerrada: WIF/WEN no se tocan)
    return u;
  };
  const a = norm(sym0), b = norm(sym1);
  if (!a || !b) return null;
  const rank = (s) => _PAIR_STABLE_RX.test(s) ? 4 : s === "BTC" ? 3 : s === "ETH" ? 2 : (s === "SOL" || s === "BNB") ? 1 : 0;
  const [base, quote] = rank(a) <= rank(b) ? [a, b] : [b, a];
  return base + quote;
}
// Icono → gráfico del par en TradingView (mismo icono que los tokens idle del
// portfolio). Read-only (solo abre un enlace externo) → vive en [main].
function poolPairChartHTML(p) {
  if (!p || !p.token0 || !p.token1) return "";
  const sym = poolPairTvSymbol(p.token0.symbol, p.token1.symbol);
  if (!sym) return "";
  const href = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(sym)}`;
  const label = `${sym} en TradingView`;
  return `<a href="${href}" target="_blank" rel="noopener noreferrer" title="Ver ${label}" aria-label="Ver ${label}" class="shrink-0 text-slate-500 hover:text-cyan-300 transition"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg></a>`;
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

// Conmuta la denominación del precio del rango (switch sym0|sym1): muestra la
// vista correspondiente, actualiza el botón activo y la etiqueta de unidad. Sólo
// show/hide de HTML pre-renderizado → sobrevive al round-trip postMessage.
function toggleRangeQuote(doc, rq) {
  const uid = rq.dataset.uid, q = rq.dataset.rangeQuote;
  if (!uid || q == null) return;
  doc.querySelectorAll(`[data-range-quote][data-uid="${uid}"]`).forEach((b) => {
    const on = b.dataset.rangeQuote === q;
    b.classList.toggle("bg-emerald-500", on);
    b.classList.toggle("text-slate-900", on);
    b.classList.toggle("text-slate-400", !on);
    b.classList.toggle("hover:text-slate-200", !on);
  });
  doc.querySelectorAll(`[data-range-view][data-uid="${uid}"]`).forEach((v) => {
    v.classList.toggle("hidden", v.dataset.rangeView !== q);
  });
  const unit = doc.querySelector(`[data-range-unit][data-uid="${uid}"]`);
  if (unit) unit.textContent = q === "0" ? (unit.dataset.s0 || "") : (unit.dataset.s1 || "");
}

// ============================================================================
// Event delegation: switching de tabs en los accordions de "logs" de las cards.
// ============================================================================
// Los botones tienen `data-tab-btn="<id>"` y `data-uid="<unique>"`. Los paneles
// asociados llevan `data-tab-panel="<id>"` con el mismo `data-uid`. Hacemos
// delegación a nivel de document para que sobreviva el round-trip postMessage
// que sufren las cards en Portfolio mode (cardHTML → template.innerHTML pierde
// onclick inline). Idempotente: si common.js se vuelve a evaluar, no se
// duplican listeners porque comprobamos un flag global.
if (typeof window !== "undefined" && !window.__lpTabDelegationInstalled) {
  window.__lpTabDelegationInstalled = true;
  document.addEventListener("click", function (e) {
    // Switch de denominación del precio del rango (data-range-quote: "0"|"1").
    const rq = e.target && e.target.closest ? e.target.closest("[data-range-quote]") : null;
    if (rq) { toggleRangeQuote(document, rq); return; }
    const btn = e.target && e.target.closest ? e.target.closest("[data-tab-btn]") : null;
    if (!btn) return;
    const uid = btn.dataset.uid;
    const tab = btn.dataset.tabBtn;
    if (!uid || !tab) return;
    // Update active state on all sibling buttons sharing this uid
    document.querySelectorAll(`[data-tab-btn][data-uid="${uid}"]`).forEach((b) => {
      const isActive = b.dataset.tabBtn === tab;
      b.classList.toggle("border-emerald-400", isActive);
      b.classList.toggle("text-emerald-300", isActive);
      b.classList.toggle("font-semibold", isActive);
      b.classList.toggle("border-transparent", !isActive);
      b.classList.toggle("text-slate-400", !isActive);
    });
    // Show/hide panels
    document.querySelectorAll(`[data-tab-panel][data-uid="${uid}"]`).forEach((p) => {
      p.classList.toggle("hidden", p.dataset.tabPanel !== tab);
    });
  });
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
