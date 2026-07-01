"use strict";

// ============================================================================
// LP Analyzer — shell unificado con login Google (Firebase) + portfolio
// ============================================================================

const RE_EVM = /^0x[a-fA-F0-9]{40}$/;
const RE_SOL = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const FB_VERSION = "10.12.2";

const $ = (id) => document.getElementById(id);

const els = {
  // tabs
  tabBtnPortfolio: $("tab-btn-portfolio"), tabBtnQuick: $("tab-btn-quick"), tabBtnProjection: $("tab-btn-projection"), tabBtnAllocator: $("tab-btn-allocator"), tabBtnGraficos: $("tab-btn-graficos"),
  tabPortfolio: $("tab-portfolio"), tabQuick: $("tab-quick"), tabProjection: $("tab-projection"), tabAllocator: $("tab-allocator"), tabGraficos: $("tab-graficos"),
  autoRefresh: $("auto-refresh"), refreshNow: $("refresh-now"), lastUpdated: $("last-updated"), privacyToggle: $("privacy-toggle"),
  authArea: $("auth-area"),
  // firebase setup
  fbSetup: $("fb-setup"), fbInput: $("fb-config-input"), fbErr: $("fb-config-err"), fbSave: $("fb-config-save"),
  openFbSetup: $("open-fb-setup"),
  // cifrado E2E
  encModal: $("enc-modal"), encTitle: $("enc-title"), encDesc: $("enc-desc"),
  encPass: $("enc-pass"), encPass2: $("enc-pass2"), encRemember: $("enc-remember"),
  encWarn: $("enc-warn"), encAck: $("enc-ack"), encErr: $("enc-err"), encSubmit: $("enc-submit"),
  encCancel: $("enc-cancel"), encForgot: $("enc-forgot"), changePass: $("change-pass"), deleteAccount: $("delete-account"),
  // login — portfolio
  loginGate: $("login-gate"), loginBtn: $("login-btn"), portfolioArea: $("portfolio-area"), gateMsg: $("gate-msg"),
  // login — quick
  quickLoginGate: $("quick-login-gate"), quickContent: $("quick-content"), quickLoginBtn: $("quick-login-btn"), quickGateMsg: $("quick-gate-msg"),
  // gestión de accesos (admin)
  manageAccess: $("manage-access"), accessModal: $("access-modal"), accessClose: $("access-close"),
  accessEmail: $("access-email"), accessAdd: $("access-add"), accessErr: $("access-err"), accessList: $("access-list"),
  // portfolio crud
  pfLabel: $("pf-label"), pfAddress: $("pf-address"), pfAdd: $("pf-add"), pfAddErr: $("pf-add-err"),
  pfList: $("pf-list"), analyzeAll: $("analyze-all"), pfStatus: $("pf-status"), pfCsv: $("pf-csv"),
  pfManageToggle: $("pf-manage-toggle"), pfManageBody: $("pf-manage-body"), pfManageChev: $("pf-manage-chev"), pfCount: $("pf-count"),
  pfCta: $("pf-cta"), pfCtaBtn: $("pf-cta-btn"),
  analyzingModal: $("analyzing-modal"), analyzingMsg: $("analyzing-msg"), analyzingBar: $("analyzing-bar"),
  analyzingList: $("analyzing-list"),
  // portfolio results
  pfSummary: $("pf-summary"), gValue: $("g-value"), gFees: $("g-fees"), gFeesSub: $("g-fees-sub"),
  gIl: $("g-il"), gIlSub: $("g-il-sub"), gPnl: $("g-pnl"), gPnlSub: $("g-pnl-sub"),
  gPositions: $("g-positions"), gPositionsSub: $("g-positions-sub"), gAddresses: $("g-addresses"),
  pfSections: $("pf-sections"),
  pfCharts: $("pf-charts"), chartByAddress: $("chart-by-address"), chartByFees: $("chart-by-fees"), chartByPillar: $("chart-by-pillar"),
  addrViewToggle: $("addr-view-toggle"), addrChartWrap: $("addr-chart-wrap"), addrTableWrap: $("addr-table-wrap"),
  quickBanner: $("quick-banner"), pfBanner: $("pf-banner"),
  pfFeesTimeline: $("pf-fees-timeline"), chartFeesTimeline: $("chart-fees-timeline"),
  pfFeesTimelineTotal: $("pf-fees-timeline-total"), chartFeesTimelineTotal: $("chart-fees-timeline-total"),
  feesMinThreshold: $("fees-min-threshold"), pfFeesSummary: $("pf-fees-summary"),
  prefChains: $("pref-chains"), prefProtocols: $("pref-protocols"),
  // quick
  modeEvm: $("mode-evm"), modeSol: $("mode-sol"), addr: $("addr"), go: $("go"),
  settingsOpen: $("settings-open"), hint: $("hint"),
  // settings modal (admin) — API keys que sobrescriben el proxy
  settingsModal: $("settings-modal"), settingsClose: $("settings-close"),
  settingsCancel: $("settings-cancel"), settingsSave: $("settings-save"),
  settingsTest: $("settings-test"), settingsStatus: $("settings-status"),
  setGraphKey: $("set-graph-key"), setHeliusKey: $("set-helius-key"), setBirdeyeKey: $("set-birdeye-key"), setEtherscanKey: $("set-etherscan-key"),
  frameEvm: $("frame-evm"), frameSol: $("frame-sol"),
  // histórico
  histEmpty: $("hist-empty"), histContent: $("hist-content"),
  histAportado: $("hist-aportado"), histValor: $("hist-valor"), histGanado: $("hist-ganado"), histGanadoSub: $("hist-ganado-sub"),
  histMonthlyAprPanel: $("hist-monthly-apr-panel"), histMonthlyApr: $("hist-monthly-apr"),
  histPnl: $("hist-pnl"), histPnlSub: $("hist-pnl-sub"), histIl: $("hist-il"), histIlSub: $("hist-il-sub"),
  histNote: $("hist-note"), chartProjection: $("chart-projection"),
};

const EVM_CHAINS = [
  { key: "ethereum", name: "Ethereum", color: "#627EEA" },
  { key: "arbitrum", name: "Arbitrum", color: "#28A0F0" },
  { key: "optimism", name: "Optimism", color: "#FF0420" },
  { key: "polygon", name: "Polygon", color: "#8247E5" },
  { key: "base", name: "Base", color: "#0052FF" },
  { key: "bnb", name: "BNB Chain", color: "#F3BA2F" },
  { key: "hyperevm", name: "HyperEVM", color: "#97FCE4" },
];
const SOL_PROTOCOLS = [
  { key: "orca", name: "Orca", color: "#FFD15C" },
  { key: "raydium", name: "Raydium", color: "#C200FB" },
];
const DEFAULT_PREFS = { chains: EVM_CHAINS.map((c) => c.key), protocols: SOL_PROTOCOLS.map((p) => p.key) };

// ⚠️ EMAIL ADMIN — fuente única conceptual. Si lo cambias, hay que cambiarlo TAMBIÉN en:
//   1) las reglas de Firestore  (función isAdmin(), en Firebase Console)
//   2) el Worker de Cloudflare   (variable ADMIN_EMAIL, o el default en cloudflare-worker.js)
// (No se puede compartir entre cliente, reglas y Worker porque viven en sistemas distintos.)
const ADMIN_EMAIL = "jrodzar@gmail.com";

// Config de Firebase embebida (NO es secreta: la web apiKey está pensada para ir en el
// cliente; la seguridad la dan las reglas de Firestore + dominios autorizados). Así
// nadie tiene que pegar nada en cada equipo. Se puede sobrescribir desde "Configúralo aquí".
const DEFAULT_FB_CONFIG = {
  apiKey: "AIzaSyARByGz7mXnpvljkIMl4Amp8bEmAu7Inc0",
  authDomain: "lp-analyzer-jrodzar.firebaseapp.com",
  projectId: "lp-analyzer-jrodzar",
  storageBucket: "lp-analyzer-jrodzar.firebasestorage.app",
  messagingSenderId: "838206100337",
  appId: "1:838206100337:web:8b2b4a726340c274ce1cd0",
  measurementId: "G-NCGRBL9BS4",
};

const state = {
  tab: "portfolio",
  mode: localStorage.getItem("lp:lastMode") || "evm",
  ready: { evm: false, sol: false },
  user: null,
  portfolio: [],          // [{ address, type, label }]
  prefs: structuredClone(DEFAULT_PREFS),
  results: [],            // [{ entry, items, status }]
  // Quién ha pintado lo que se ve actualmente en cada iframe: "quick" | "portfolio" | null.
  // Si entras a Quick y el iframe lo pintó Portfolio, hay que limpiar.
  iframeOwnedBy: { evm: null, sol: null },
};

const fb = { app: null, auth: null, db: null, authMod: null, fsMod: null };
const crypto_ = { key: null, salt: null }; // clave AES-GCM de sesión + salt del usuario
const pendingReqs = new Map(); // reqId -> resolve
let pfCharts = { addr: null, venue: null, fees: null, pillar: null, timeline: null, timelineTotal: null, projection: null };

// ─── Extension hooks ──────────────────────────────────────────────────────
// Módulos opcionales en `active/` (solo cargados en [pro]) pueden registrar
// callbacks en eventos del ciclo de vida del shell. En [main] el registro
// nunca ocurre (no hay `active/`), así que `emitHook` es no-op.
//   · modeChange: tras setMode(...). El hook recibe el nuevo modo (string).
//   · portfolioChange: tras renderPortfolioList() (CRUD de direcciones). Sin args.
const _hooks = { modeChange: [], portfolioChange: [] };
function emitHook(name, ...args) {
  const list = _hooks[name];
  if (!list) return;
  for (const fn of list) { try { fn(...args); } catch (e) { console.error(`[hook ${name}]`, e); } }
}
window.lpRegisterHook = function (name, fn) {
  if (!_hooks[name]) { console.warn(`[lpRegisterHook] unknown hook: ${name}`); return; }
  _hooks[name].push(fn);
};

// ============================================================================
// Helpers
// ============================================================================

function detectType(addr) {
  if (RE_EVM.test(addr)) return "evm";
  if (RE_SOL.test(addr)) return "sol";
  return null;
}
// ── Modo incógnito ─────────────────────────────────────────────────────────
// DIFUMINA los IMPORTES en $ y las CANTIDADES de token (manteniendo símbolos)
// para compartir pantalla/capturas sin revelar el patrimonio. DISPOSICIÓN
// idéntica al modo normal; se mantienen visibles %/APR/IL%, símbolos, nombres de
// pilar, par de pools, rangos, fechas y direcciones/etiquetas. Persiste POR
// DISPOSITIVO en localStorage (no se sincroniza). Mecánica: `body.lp-private` +
// CSS difumina los valores envueltos en `.lp-blur` (por fmtUSD y por
// maskMoneyHTML sobre el cardHTML del motor). NO se difumina la calculadora del
// repartidor (fmtAlloc — no son holdings reales). Los GRÁFICOS NO se difuminan (el
// blur del canvas los hacía ilegibles): sus etiquetas $ se enmascaran como texto
// "$•••" vía fmtUSD0/fmtUSDc y los datalabels se ocultan. El CSV usa valores
// crudos (no estos formateadores) → no se afecta.
function lpPriv() { try { return localStorage.getItem("lp-private") === "1"; } catch (e) { return false; } }
function walletDisp(entry) { return entry.label || shortAddr(entry.address); }
// Envuelve un valor en un span que se DIFUMINA por CSS (.lp-private .lp-blur).
function blurSpan(s) { return `<span class="lp-blur">${s}</span>`; }

// Enmascara los IMPORTES en $ y las CANTIDADES de token de un fragmento HTML
// (cardHTML del motor), difuminándolos y manteniendo la disposición EXACTA y los
// símbolos. SEGURO: se procesa SOLO el texto entre `>` y `<` (nunca atributos ni
// rutas SVG), así que no corrompe nada. % / APR / rangos / fechas / direcciones
// se conservan.
function maskAmountsText(text) {
  // importes en $ (todo el "$1,821.13")
  text = text.replace(/-?\$\s?\d[\d.,]*\s?[kMB]?/g, (m) => blurSpan(m));
  // cantidades de token: número seguido de su símbolo → difumina solo el número.
  text = text.replace(/(-?\d[\d.,]*)(\s+[A-Za-z][A-Za-z0-9.]{0,9})\b/g, (m, num, sym) => blurSpan(num) + sym);
  return text;
}
function maskMoneyHTML(html) {
  if (!lpPriv()) return html;
  return String(html).replace(/>([^<]+)</g, (m, text) => ">" + maskAmountsText(text) + "<");
}

// Botón "ojo" del header: alterna incógnito y repinta TODO lo visible. Los
// importes se enmascaran en los formateadores (fmtUSD…) y, en las fichas del
// motor (cardHTML ya generado), vía maskMoneyHTML. El estado vive en localStorage.
function togglePrivacy() {
  const on = !lpPriv();
  try { localStorage.setItem("lp-private", on ? "1" : "0"); } catch (e) {}
  updatePrivacyBtn();
  if (state.results && state.results.length) renderPortfolio();
  if (state.user) renderAllocator();
  try { if (state.results && state.results.length) renderHistorico(); } catch (e) {}
  renderPortfolioList();
}
function updatePrivacyBtn() {
  const b = els.privacyToggle; if (!b) return;
  const on = lpPriv();
  const eye = `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const eyeOff = `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
  b.innerHTML = on ? eyeOff : eye;
  b.title = on ? "Modo incógnito ACTIVO — importes difuminados (clic para mostrar)" : "Modo incógnito: difuminar importes para compartir pantalla";
  b.classList.toggle("bg-slate-900/15", on);
  b.classList.toggle("rounded-md", on);
  // Clase global → difumina los importes (.lp-blur) y los gráficos (canvas) vía CSS.
  document.body.classList.toggle("lp-private", on);
}

function shortAddr(a) {
  if (!a) return "";
  return a.startsWith("0x") ? `${a.slice(0, 6)}…${a.slice(-4)}` : `${a.slice(0, 4)}…${a.slice(-4)}`;
}
// Divisa de visualización: siempre USD.
const _fx = { rate: 1, sym: "$" };
// Decimales muy pequeños SIN notación científica: "0.00000002" en vez de "2.00e-8".
// Idéntica a la helper de common.js — los engines cargan common.js, el shell no.
function fmtTiny(n, sig = 3) {
  if (n === 0 || !isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1) return (n < 0 ? "-" : "") + abs.toFixed(sig).replace(/\.?0+$/, "");
  const pos = -Math.floor(Math.log10(abs));
  const decimals = pos + sig - 1;
  let s = n.toFixed(decimals);
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s;
}
const PRIV_MASK = "•••";
// Cálculo crudo del importe (interno). $8,300.00 con separador de miles.
function _usdRaw(n) {
  n = n * _fx.rate; const S = _fx.sym;
  const abs = Math.abs(n), s = n < 0 ? "-" : "";
  if (abs === 0) return S + "0";
  if (abs >= 1) return `${s}${S}${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (abs >= 0.01) return `${s}${S}${abs.toFixed(4)}`;
  return `${s}${S}${fmtTiny(abs, 3)}`;
}
// HTML: en incógnito devuelve el importe DIFUMINADO (span .lp-blur) con el valor
// real detrás. Para tarjetas, resúmenes, cabeceras, pilares, idle…
function fmtUSD(n) {
  if (n == null || !isFinite(n)) return "—";
  const out = _usdRaw(n);
  return lpPriv() ? blurSpan(out) : out;
}
// Para GRÁFICOS (canvas, NO se difuminan): en incógnito devuelve "$•••" como
// texto (el canvas no admite HTML/blur), manteniendo el gráfico nítido.
function fmtUSD0(n) {
  if (n == null || !isFinite(n)) return "—";
  return lpPriv() ? _fx.sym + PRIV_MASK : _usdRaw(n);
}
// Formato compacto: $8.30k / $1.20M (ejes/etiquetas de gráficos). En incógnito
// "$•••" como texto.
function fmtUSDc(n) {
  if (n == null || !isFinite(n)) return "—";
  if (lpPriv()) return _fx.sym + PRIV_MASK;
  n = n * _fx.rate; const S = _fx.sym;
  const abs = Math.abs(n), s = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${s}${S}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${s}${S}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${s}${S}${(abs / 1e3).toFixed(2)}k`;
  if (abs >= 1) return `${s}${S}${abs.toFixed(2)}`;
  if (abs === 0) return S + "0";
  if (abs >= 0.01) return `${s}${S}${abs.toFixed(4)}`;
  return `${s}${S}${fmtTiny(abs, 3)}`;
}
function pnlColor(n) { if (!isFinite(n)) return "text-slate-400"; return n > 0 ? "text-emerald-400" : n < 0 ? "text-rose-400" : "text-slate-300"; }

// ── Pilares (pestaña 🧮 Pilares) ───────────────────────────────────────────
// El usuario define sus PILARES (cuadrantes del curso): crear / renombrar /
// eliminar. Cada pilar tiene un `id` ESTABLE (para que renombrar no rompa el
// vínculo wallet→pilar de las fases siguientes) y un `name` editable, más su %
// y nº de pools del repartidor de capital. Se guardan en state.prefs.allocator
// (Firestore). Calculadora proporcional autocontenida: trabaja en la divisa que
// escriba el usuario (sin re-convertir por FX).
const DEFAULT_ALLOCATOR = { capital: 0, pillars: [
  { id: "P1",  name: "Pilar 1", pct: 70,  pools: 0 },
  { id: "P2",  name: "Pilar 2", pct: 10,  pools: 0 },
  { id: "P3",  name: "Pilar 3", pct: 7.5, pools: 0 },
  { id: "P4",  name: "Pilar 4", pct: 7.5, pools: 0 },
  { id: "RWA", name: "RWAs",    pct: 5,   pools: 0 },
] };
// Renombrado de los nombres por defecto (id estable). Migración única: a los
// pilares por defecto SIN tocar por el usuario (name === su id antiguo) se les
// pone el nombre nuevo, sin perder %/pools ni las asignaciones de wallets.
const DEFAULT_PILLAR_NAMES = { P1: "Pilar 1", P2: "Pilar 2", P3: "Pilar 3", P4: "Pilar 4", RWA: "RWAs" };
const MAX_PILLARS = 12;
let _pillarIdSeq = 0;
// id de pilar único y estable (no se usa el nombre como id: renombrar lo rompería).
function genPillarId() {
  _pillarIdSeq++;
  return "pil_" + Math.random().toString(36).slice(2, 8) + _pillarIdSeq.toString(36);
}

// Formato sin conversión FX (solo símbolo): el capital ya está en la divisa
// del usuario, así que NO multiplicamos por _fx.rate (eso lo hace fmtUSD).
// Calculadora del repartidor (pestaña Pilares): DINERO PILAR / POR POOL / Total
// se derivan del CAPITAL que teclea el usuario — NO son holdings reales, así que
// NUNCA se difuminan en incógnito.
function fmtAlloc(n) {
  if (n == null || !isFinite(n)) return "—";
  return (_fx ? _fx.sym : "$") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Normaliza el allocator guardado. Soporta N pilares dinámicos (no fuerza los 5
// por defecto) y MIGRA el formato antiguo `{key,pct,pools}` → `{id,name,pct,pools}`
// (id = key viejo, name = key viejo). Preserva el orden, deduplica ids y aplica
// clamps. Idempotente. Si no hay pilares válidos → los 5 por defecto.
function sanitizeAllocator(raw) {
  if (!raw || !Array.isArray(raw.pillars) || raw.pillars.length === 0) return structuredClone(DEFAULT_ALLOCATOR);
  const seen = new Set();
  const pillars = [];
  for (const r of raw.pillars) {
    if (!r || typeof r !== "object") continue;
    // id estable: el guardado, o migrado desde la `key` antigua, o generado.
    let id = (typeof r.id === "string" && r.id) ? r.id
      : (typeof r.key === "string" && r.key) ? r.key
      : genPillarId();
    if (seen.has(id)) id = genPillarId(); // dedupe
    seen.add(id);
    const rawName = (typeof r.name === "string" && r.name.trim()) ? r.name.trim()
      : (typeof r.key === "string" && r.key) ? r.key : id;
    const pct = Number(r.pct);
    const pools = Number(r.pools);
    pillars.push({
      id,
      name: rawName.slice(0, 24),
      pct: isFinite(pct) && pct >= 0 ? pct : 0,
      pools: isFinite(pools) && pools >= 0 ? Math.floor(pools) : 0,
    });
    if (pillars.length >= MAX_PILLARS) break;
  }
  if (!pillars.length) return structuredClone(DEFAULT_ALLOCATOR);
  const capital = Number(raw.capital);
  return { pillars, capital: isFinite(capital) && capital >= 0 ? capital : 0 };
}
// Resuelve un id de pilar a su objeto (o null si ya no existe).
function pillarById(id) {
  const a = state.prefs && state.prefs.allocator;
  if (!a || !id) return null;
  return a.pillars.find((p) => p.id === id) || null;
}

let _allocSaveTimer = null;
let _allocFocusedPct = 0; // índice del último input % enfocado (para "Ajustar a 100%")
function scheduleAllocSave() {
  const saved = $("alloc-saved"); if (saved) saved.textContent = "guardando…";
  if (_allocSaveTimer) clearTimeout(_allocSaveTimer);
  _allocSaveTimer = setTimeout(async () => {
    await savePrefs();
    const s = $("alloc-saved");
    if (s) { s.textContent = "✓ guardado"; setTimeout(() => { if (s.textContent === "✓ guardado") s.textContent = ""; }, 2000); }
  }, 600);
}

// Construye las filas (al entrar a la pestaña / tras cargar prefs). Los inputs
// se crean UNA vez aquí; el tecleo solo dispara recalcAllocator (no rebuild),
// para no perder el foco.
function renderAllocator() {
  const gate = $("alloc-gate"), content = $("alloc-content");
  if (!gate || !content) return;
  if (!state.user) { gate.classList.remove("hidden"); content.classList.add("hidden"); return; }
  gate.classList.add("hidden"); content.classList.remove("hidden");
  if (!state.prefs.allocator) state.prefs.allocator = structuredClone(DEFAULT_ALLOCATOR);
  const alloc = state.prefs.allocator;
  const cur = _fx ? _fx.sym : "$";
  const cl = $("alloc-cur"); if (cl) cl.textContent = cur;

  const tbody = $("alloc-rows");
  const onlyOne = alloc.pillars.length <= 1;
  tbody.innerHTML = alloc.pillars.map((p, i) => `
    <tr class="border-b border-slate-800/50">
      <td class="px-2 py-1.5">
        <div class="flex items-center gap-1">
          <span class="w-2 h-2 rounded-full shrink-0" style="background:${pillarColor(i)}"></span>
          <input data-alloc-i="${i}" data-alloc-name type="text" maxlength="24" value="${escapeHtml(p.name)}" placeholder="Pilar" class="w-24 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-sm font-semibold focus:outline-none focus:border-[#ECE600]">
          <button data-alloc-del="${i}" title="Eliminar pilar" class="text-slate-600 hover:text-rose-400 text-xs leading-none px-0.5 ${onlyOne ? "invisible" : ""}">✕</button>
        </div>
      </td>
      <td class="px-1 py-1.5 text-center"><input data-alloc-i="${i}" data-alloc-pct type="number" min="0" step="any" inputmode="decimal" value="${p.pct}" class="w-14 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center text-sm focus:outline-none focus:border-[#ECE600]"></td>
      <td class="px-1 py-1.5 text-center"><input data-alloc-i="${i}" data-alloc-pools type="number" min="0" step="1" inputmode="numeric" value="${p.pools}" class="w-14 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center text-sm focus:outline-none focus:border-[#ECE600]"></td>
      <td class="px-2 py-2 text-right font-mono" data-alloc-money="${i}">—</td>
      <td class="px-2 py-2 text-right font-mono text-slate-300" data-alloc-perpool="${i}">—</td>
    </tr>`).join("");

  // Renombrar: en vivo, sin rebuild (no perder el foco). Vacío → placeholder, pero
  // guardamos un nombre no vacío al perder el foco (un pilar sin nombre confunde).
  tbody.querySelectorAll("input[data-alloc-name]").forEach((inp) => {
    inp.oninput = () => {
      alloc.pillars[+inp.dataset.allocI].name = inp.value.slice(0, 24);
      scheduleAllocSave();
    };
    inp.onblur = () => {
      const p = alloc.pillars[+inp.dataset.allocI];
      if (!p.name.trim()) { p.name = "Pilar " + (+inp.dataset.allocI + 1); inp.value = p.name; scheduleAllocSave(); }
    };
  });
  tbody.querySelectorAll("button[data-alloc-del]").forEach((btn) => {
    btn.onclick = () => removePillar(+btn.dataset.allocDel);
  });
  tbody.querySelectorAll("input[data-alloc-pct]").forEach((inp) => {
    inp.oninput = () => {
      alloc.pillars[+inp.dataset.allocI].pct = Math.max(0, parseFloat(inp.value) || 0);
      recalcAllocator(); scheduleAllocSave();
    };
    // recordar el último campo % enfocado (para "Ajustar a 100%")
    inp.onfocus = () => { _allocFocusedPct = +inp.dataset.allocI; };
  });
  tbody.querySelectorAll("input[data-alloc-pools]").forEach((inp) => inp.oninput = () => {
    alloc.pillars[+inp.dataset.allocI].pools = Math.max(0, Math.floor(parseFloat(inp.value) || 0));
    recalcAllocator(); scheduleAllocSave();
  });
  // "+ Añadir pilar"
  const add = $("alloc-add");
  if (add) {
    const full = alloc.pillars.length >= MAX_PILLARS;
    add.disabled = full;
    add.classList.toggle("opacity-40", full);
    add.classList.toggle("cursor-not-allowed", full);
    add.title = full ? `Máximo ${MAX_PILLARS} pilares` : "Añadir un pilar nuevo";
    add.onclick = () => {
      if (alloc.pillars.length >= MAX_PILLARS) return;
      alloc.pillars.push({ id: genPillarId(), name: "Pilar " + (alloc.pillars.length + 1), pct: 0, pools: 0 });
      renderAllocator(); scheduleAllocSave();
    };
  }
  const cap = $("alloc-capital");
  if (cap) {
    cap.value = alloc.capital > 0 ? String(alloc.capital) : "";
    cap.oninput = () => { alloc.capital = Math.max(0, parseFloat(cap.value) || 0); recalcAllocator(); scheduleAllocSave(); };
  }
  const reset = $("alloc-reset"); if (reset) reset.onclick = () => {
    state.prefs.allocator = structuredClone(DEFAULT_ALLOCATOR);
    renderAllocator(); scheduleAllocSave();
  };
  // "Ajustar a 100%": corrige el delta en el campo % seleccionado (último enfocado).
  const fix = $("alloc-fix"); if (fix) fix.onclick = () => {
    const a = state.prefs.allocator; if (!a) return;
    const sum = a.pillars.reduce((s, p) => s + p.pct, 0);
    const delta = 100 - sum;
    if (Math.abs(delta) < 0.01) return;
    const n = a.pillars.length;
    const idx = (_allocFocusedPct != null && _allocFocusedPct >= 0 && _allocFocusedPct < n) ? _allocFocusedPct : 0;
    a.pillars[idx].pct = Math.max(0, Math.round((a.pillars[idx].pct + delta) * 100) / 100);
    const tgt = document.querySelector(`input[data-alloc-pct][data-alloc-i="${idx}"]`);
    if (tgt) tgt.value = a.pillars[idx].pct;
    recalcAllocator(); scheduleAllocSave();
  };
  recalcAllocator();
}

// Recalcula solo los números (sin rebuild) al cambiar capital/%/pools.
function recalcAllocator() {
  const alloc = state.prefs.allocator; if (!alloc) return;
  const capital = Math.max(0, parseFloat(($("alloc-capital") || {}).value) || 0);
  let sumPct = 0, sumPools = 0, sumMoney = 0;
  alloc.pillars.forEach((p, i) => {
    sumPct += p.pct; sumPools += p.pools;
    const money = capital * p.pct / 100; sumMoney += money;
    const perPool = p.pools > 0 ? money / p.pools : null;
    const m = document.querySelector(`[data-alloc-money="${i}"]`);
    const pp = document.querySelector(`[data-alloc-perpool="${i}"]`);
    if (m) m.innerHTML = fmtAlloc(money);
    if (pp) {
      if (perPool == null) pp.textContent = "—";
      else pp.innerHTML = fmtAlloc(perPool) + (p.pools > 1 ? ` <span class="text-slate-500 text-[11px]">×${p.pools}</span>` : "");
    }
  });
  const ok = Math.abs(sumPct - 100) < 0.01;
  const round2 = (x) => Math.round(x * 100) / 100;
  const sp = $("alloc-sumpct"); if (sp) { sp.textContent = round2(sumPct) + "%"; sp.className = "font-bold " + (ok ? "text-emerald-400" : "text-rose-400"); }
  const spo = $("alloc-sumpools"); if (spo) spo.textContent = String(sumPools);
  const st = $("alloc-sumtotal"); if (st) st.innerHTML = fmtAlloc(sumMoney);
  // Bloque de aviso (con el botón "Ajustar a 100%" dentro): solo si los % ≠ 100.
  const warnbox = $("alloc-warnbox"), warn = $("alloc-warn");
  if (warnbox) warnbox.classList.toggle("hidden", ok);
  if (warn && !ok) warn.textContent = `⚠️ Los porcentajes suman ${round2(sumPct)}% (deben sumar 100%). Selecciona un pilar y pulsa "Ajustar a 100%", o edítalos.`;
  renderPillarTargets(); // refresca "real vs objetivo" al cambiar los %
}

// Panel "Real vs objetivo" de la pestaña Pilares: por cada pilar una barra con el
// % REAL (relleno) y una marca en el % OBJETIVO + la desviación. Requiere haber
// analizado el portfolio y tener wallets asignadas; si no, muestra una pista.
function renderPillarTargets() {
  const box = document.getElementById("alloc-targets");
  if (!box) return;
  const alloc = state.prefs.allocator;
  if (!alloc) { box.classList.add("hidden"); return; }
  box.classList.remove("hidden");
  const { byId, total } = pillarValueById();
  if (!state.results.length || total <= 0) {
    box.innerHTML = `<div class="rounded-xl border border-slate-800 bg-slate-900 p-4 text-xs text-slate-400">📊 <b class="text-slate-200">Real vs objetivo.</b> Asigna tus billeteras a pilares (pestaña <b>Portfolio</b>) y pulsa <b>Analizar todo</b> para ver aquí tu distribución real frente a estos objetivos.</div>`;
    return;
  }
  const bar = (name, color, realPct, target) => {
    const dev = target != null ? realPct - target : null;
    const devTxt = dev == null ? `<span class="text-slate-500">sin objetivo</span>`
      : `<span class="${Math.abs(dev) < 2 ? "text-emerald-400" : Math.abs(dev) < 5 ? "text-amber-400" : "text-rose-400"}">${dev >= 0 ? "+" : ""}${dev.toFixed(1)}pp</span>`;
    const tgtTxt = target == null ? "" : `<span class="text-slate-400">${target % 1 ? target.toFixed(1) : target.toFixed(0)}% obj</span> · `;
    const marker = target == null ? "" : `<div class="absolute inset-y-0 w-0.5 bg-slate-100" style="left:${Math.min(100, target)}%" title="objetivo ${target}%"></div>`;
    return `<div>
      <div class="flex items-center justify-between text-xs mb-1">
        <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full" style="background:${color}"></span><span class="font-semibold text-slate-200">${escapeHtml(name)}</span></span>
        <span><span class="font-semibold text-slate-100">${realPct.toFixed(1)}% real</span> · ${tgtTxt}${devTxt}</span>
      </div>
      <div class="relative h-2.5 rounded bg-slate-800 overflow-hidden">
        <div class="absolute inset-y-0 left-0 rounded" style="width:${Math.min(100, realPct)}%;background:${color}"></div>
        ${marker}
      </div>
    </div>`;
  };
  const rows = alloc.pillars.map((p, i) => bar(p.name, pillarColor(i), (byId.get(p.id) || 0) / total * 100, p.pct));
  const sinV = byId.get(null) || 0;
  if (sinV > 0) rows.push(bar("Sin pilar", "#64748b", sinV / total * 100, null));
  box.innerHTML = `<div class="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
    <div class="flex items-center justify-between"><h3 class="text-sm font-semibold">📊 Real vs objetivo</h3><span class="text-[11px] text-slate-500">valor DeFi · ${fmtUSD(total)}</span></div>
    <div class="space-y-2.5">${rows.join("")}</div>
    <p class="text-[10px] text-slate-500">La barra es tu <b>% real</b> (valor DeFi del pilar sobre el total); la marca clara es tu <b>objetivo</b>. Desviación en puntos porcentuales.</p>
  </div>`;
}
function distinctColor(i) { const h = Math.round((i * 137.508) % 360); return `hsl(${h} 70% 60%)`; }
// Color ESTABLE por pilar (por índice). Paleta fija para los primeros (legible y
// consistente entre la tabla de Pilares, el selector del portfolio y los grupos
// de resultados); fallback rotativo para pilares extra.
const _PILLAR_PALETTE = ["#ECE600", "#38bdf8", "#a78bfa", "#34d399", "#fb923c", "#f472b6", "#22d3ee", "#facc15"];
function pillarColor(i) { return _PILLAR_PALETTE[i] || distinctColor(i + 11); }

// Elimina un pilar por índice. Las wallets asignadas a ese pilar pasan a "Sin
// pilar" (forward-compat con la asignación de la Fase 2; hoy aún no hay ninguna).
// No permite borrar el último. Persiste prefs (y portfolio si reasignó wallets).
async function removePillar(i) {
  const a = state.prefs.allocator; if (!a || a.pillars.length <= 1) return;
  const p = a.pillars[i]; if (!p) return;
  const affected = (state.portfolio || []).filter((w) => w.pillar === p.id);
  if (affected.length) {
    const ok = await uiConfirm(
      `El pilar "${escapeHtml(p.name)}" tiene ${affected.length} ${affected.length === 1 ? "billetera asignada" : "billeteras asignadas"}. Al eliminarlo pasarán a "Sin pilar".`,
      { title: "Eliminar pilar", okLabel: "Eliminar", okStyle: "danger" });
    if (!ok) return;
  }
  a.pillars.splice(i, 1);
  let portfolioChanged = false;
  for (const w of (state.portfolio || [])) {
    if (w.pillar === p.id) { w.pillar = null; portfolioChanged = true; }
  }
  renderAllocator();
  scheduleAllocSave();
  if (portfolioChanged) { try { await savePortfolio(); } catch (e) {} renderPortfolioList(); }
}

// ─── APR por mes natural ───────────────────────────────────────────────────
// DUPLICADO de common.js: el shell NO carga common.js (solo los iframes), pero
// renderHistorico() necesita estas funciones para la tabla agregada del
// portfolio. Mantener sincronizado con common.js si se cambia la lógica.
// (Las cards individuales usan la copia de common.js dentro de cada engine.)
function computeMonthlyAPRs(points) {
  if (!Array.isArray(points) || points.length === 0) return [];
  const sorted = [...points].sort((a, b) => a.ts - b.ts);
  const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const monthKey = (ts) => { const d = new Date(ts); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
  const monthLabel = (ts) => { const d = new Date(ts); return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
  const daysInMonth = (ts) => { const d = new Date(ts); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); };
  const monthsMap = new Map();
  for (const p of sorted) {
    const k = monthKey(p.ts);
    if (!monthsMap.has(k)) monthsMap.set(k, { key: k, label: monthLabel(p.ts), points: [], firstTs: p.ts, lastTs: p.ts });
    const m = monthsMap.get(k);
    m.points.push(p);
    if (p.ts < m.firstTs) m.firstTs = p.ts;
    if (p.ts > m.lastTs) m.lastTs = p.ts;
  }
  const months = [...monthsMap.values()].sort((a, b) => a.key.localeCompare(b.key));
  const result = [];
  let prevCumulativeFees = 0;
  const nowMs = Date.now();
  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    const cumFeesEnd = m.points[m.points.length - 1].feesUSD || 0;
    const feesMonth = Math.max(0, cumFeesEnd - prevCumulativeFees);
    // Capital medio ponderado por tiempo (no por nº de snapshots) — evita el
    // sesgo de promediar estados intermedios cuando las posiciones se abren
    // progresivamente. Ver comentario detallado en common.js.
    const mp = m.points;
    const monthStart = Date.UTC(new Date(m.firstTs).getUTCFullYear(), new Date(m.firstTs).getUTCMonth(), 1);
    const monthEnd = Date.UTC(new Date(m.firstTs).getUTCFullYear(), new Date(m.firstTs).getUTCMonth() + 1, 1);
    let capWeighted = 0, totalSpan = 0;
    for (let j = 0; j < mp.length; j++) {
      const cap = Math.max(0, (mp[j].depositedUSD || 0) - (mp[j].withdrawnUSD || 0));
      const from = Math.max(mp[j].ts, monthStart);
      const nextTs = (j + 1 < mp.length) ? mp[j + 1].ts : Math.min(monthEnd, Date.now());
      const span = Math.max(0, nextTs - from);
      capWeighted += cap * span;
      totalSpan += span;
    }
    const capitalAvg = totalSpan > 0
      ? capWeighted / totalSpan
      : mp.reduce((s, p) => s + Math.max(0, (p.depositedUSD || 0) - (p.withdrawnUSD || 0)), 0) / mp.length;
    // Días activos del mes = cobertura REAL del mes por la posición (clampada por el primer punto
    // de la serie = apertura, y el último = cierre/hoy). Antes usaba el span de PUNTOS, que para
    // timelines dispersos (lending: 1 punto/mes) daba 1 día e inflaba el APR (p.ej. 137%).
    const _mf = new Date(m.firstTs);
    const _mStart = Date.UTC(_mf.getUTCFullYear(), _mf.getUTCMonth(), 1);
    const _mEnd = Date.UTC(_mf.getUTCFullYear(), _mf.getUTCMonth() + 1, 1);
    const daysActive = Math.max(1, (Math.min(_mEnd, sorted[sorted.length - 1].ts, nowMs) - Math.max(_mStart, sorted[0].ts)) / 86400000);
    const isOngoing = (i === months.length - 1) && (nowMs - m.lastTs < 7 * 86400000);
    const apr = (capitalAvg > 0 && daysActive >= 1) ? (feesMonth / capitalAvg) * (365 / daysActive) * 100 : null;
    result.push({ monthKey: m.key, monthLabel: m.label, feesUSD: feesMonth, capitalAvg, daysActive, daysInMonth: daysInMonth(m.firstTs), apr, isOngoing });
    prevCumulativeFees = cumFeesEnd;
  }
  return result.reverse();
}
function monthlyAprTableHTML(rows, opts = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return "";
  // Orden cronológico ascendente en la tabla (antiguo arriba, actual abajo);
  // `rows` llega reciente-primero para que `limit` recorte los meses recientes.
  const shown = (opts.limit ? rows.slice(0, opts.limit) : rows).slice().reverse();
  const showCap = !!opts.showCapital;
  const rowsHTML = shown.map((r) => {
    const aprCls = r.apr == null ? "text-slate-500" : (r.apr >= 0 ? "text-emerald-400" : "text-rose-400");
    const aprStr = r.apr == null ? "—" : (r.apr >= 0 ? "+" : "") + r.apr.toFixed(1) + "%";
    const ongoingBadge = r.isOngoing ? ` <span class="text-amber-300 text-[9px]">·en curso</span>` : "";
    const capCell = showCap ? `<td class="py-1 pr-2 text-right font-mono text-slate-400">${fmtUSD(r.capitalAvg)}</td>` : "";
    return `<tr class="border-b border-slate-800/50 last:border-0">
      <td class="py-1 pr-2 text-slate-300 whitespace-nowrap">${r.monthLabel}${ongoingBadge}</td>
      <td class="py-1 pr-2 text-right text-emerald-400 font-mono">${fmtUSD(r.feesUSD)}</td>
      ${capCell}
      <td class="py-1 text-right font-mono font-semibold ${aprCls}">${aprStr}</td>
    </tr>`;
  }).join("");
  const capHeader = showCap ? `<th class="text-right pb-1 pr-2 font-semibold">Capital</th>` : "";
  return `
    <table class="w-full text-[10px]">
      <thead>
        <tr class="text-[9px] uppercase text-slate-500 border-b border-slate-700">
          <th class="text-left pb-1 font-semibold">Mes</th>
          <th class="text-right pb-1 pr-2 font-semibold">Fees</th>
          ${capHeader}
          <th class="text-right pb-1 font-semibold">APR</th>
        </tr>
      </thead>
      <tbody>${rowsHTML}</tbody>
    </table>`;
}

// Tabla del Histórico: APR por mes natural del portfolio agregado, con cada
// mes desplegable para ver el desglose por pool de ESE mes. `aggRows` = filas
// agregadas de computeMonthlyAPRs (reciente-primero). `poolsByMonthKey` =
// Map monthKey -> [{ label, venue, color, feesUSD, capitalAvg, apr }] ya
// filtrado a pools con fees > 0 ese mes. El toggle lo gestiona un listener
// delegado instalado una sola vez sobre #hist-monthly-apr (ver renderHistorico).
function monthlyAprByMonthHTML(aggRows, poolsByMonthKey, opts = {}) {
  if (!Array.isArray(aggRows) || aggRows.length === 0) return "";
  // Orden cronológico ascendente (antiguo arriba), igual que la tabla previa.
  const shown = (opts.limit ? aggRows.slice(0, opts.limit) : aggRows).slice().reverse();
  const aprStr = (apr) => apr == null ? "—" : (apr >= 0 ? "+" : "") + apr.toFixed(1) + "%";
  const mprStr = (apr) => apr == null ? "—" : (apr >= 0 ? "+" : "") + (apr / 12).toFixed(2) + "%"; // MPR = APR/12 (tasa mensual)

  // ── Heatmap: fondo de intensidad proporcional al valor ───────────────────
  // Curva sqrt para que valores medios-bajos sigan teniendo color visible pese
  // a outliers altos (p.ej. un pool a +66% no debe dejar al resto en blanco).
  // APR negativo → rojo (rose); todo lo demás → verde (emerald). `ref` es el
  // valor de intensidad máxima (el mayor del conjunto mostrado).
  const heatBg = (value, ref, allowNeg) => {
    if (value == null || !isFinite(value) || !(ref > 0)) return "";
    const t = Math.min(1, Math.sqrt(Math.abs(value) / ref));
    const a = (0.06 + 0.44 * t).toFixed(3);
    const rgb = (allowNeg && value < 0) ? "244,63,94" : "16,185,129";
    return `background:rgba(${rgb},${a})`;
  };
  const aprTextCls = (apr) => apr == null ? "text-slate-500" : (apr >= 0 ? "text-emerald-100" : "text-rose-100");
  // Celda numérica con pill heatmap. `extraCls` para color de texto del APR.
  const heatPill = (txt, style, extraCls) =>
    `<span class="inline-block px-1.5 py-0.5 rounded ${extraCls || "text-emerald-100"}" ${style ? `style="${style}"` : ""}>${txt}</span>`;

  // Referencias de intensidad. APR comparte escala global (mes + pools) para
  // que un mismo % tenga el mismo color en toda la tabla. Las fees usan escalas
  // separadas (mes vs pool) porque sus magnitudes son de órdenes distintos.
  const poolList = shown.flatMap((r) => poolsByMonthKey.get(r.monthKey) || []);
  const refApr = Math.max(1, ...shown.map((r) => Math.abs(r.apr || 0)), ...poolList.map((p) => Math.abs(p.apr || 0)));
  const refFeesAgg = Math.max(0.01, ...shown.map((r) => r.feesUSD || 0));
  const refFeesPool = Math.max(0.01, ...poolList.map((p) => p.feesUSD || 0));

  const rowsHTML = shown.map((r, mi) => {
    const pools = (poolsByMonthKey.get(r.monthKey) || []).slice().sort((a, b) => b.feesUSD - a.feesUSD);
    const ongoingBadge = r.isOngoing ? ` <span class="text-amber-300 text-[9px]">·en curso</span>` : "";
    const countLbl = pools.length ? `<span class="text-slate-500 text-[9px]">${pools.length} ${pools.length === 1 ? "pool" : "pools"}</span>` : "";
    const poolRowsHTML = pools.map((p, i) => `
      <tr class="${pools.length > 1 ? "border-b border-slate-800/40 last:border-0" : ""}"${i % 2 ? ' style="background:rgba(255,255,255,0.07)"' : ""}>
        <td class="py-1"><span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full shrink-0" style="background:${p.color || "#64748b"}"></span><span class="text-slate-300">${p.label}</span>${p.venue ? `<span class="text-slate-500 text-[9px]">${p.venue}</span>` : ""}</span></td>
        <td class="py-1 pr-3 text-right font-mono">${heatPill(fmtUSD(p.feesUSD), heatBg(p.feesUSD, refFeesPool, false))}</td>
        <td class="py-1 pr-3 text-right text-slate-400 font-mono">${fmtUSD(p.capitalAvg)}</td>
        <td class="py-1 pr-3 text-right font-mono font-semibold">${heatPill(aprStr(p.apr), heatBg(p.apr, refApr, true), aprTextCls(p.apr))}</td>
        <td class="py-1 text-right font-mono text-slate-300">${mprStr(p.apr)}</td>
      </tr>`).join("");
    const detailInner = poolRowsHTML
      ? `<table class="w-full text-[10px]">
           <thead><tr class="text-[9px] uppercase text-slate-500 border-b border-slate-700">
             <th class="text-left pb-1 font-semibold">Pool</th>
             <th class="text-right pb-1 pr-3 font-semibold">Fees</th>
             <th class="text-right pb-1 pr-3 font-semibold">Capital</th>
             <th class="text-right pb-1 pr-3 font-semibold">APR</th>
             <th class="text-right pb-1 font-semibold">MPR</th>
           </tr></thead>
           <tbody>${poolRowsHTML}</tbody>
         </table>`
      : `<div class="text-[10px] text-slate-500 py-1">Sin desglose por pool para este mes (las fees vienen de posiciones sin histórico temporal).</div>`;
    return `
      <tr class="apr-month-row ${mi % 2 ? "apr-zebra " : ""}border-b border-slate-800/50 cursor-pointer hover:bg-slate-800/40" data-apr-month="${r.monthKey}">
        <td class="py-1.5"><span class="inline-flex items-center gap-1.5"><span class="apr-chev text-slate-500 text-[9px]">▸</span><span class="text-slate-200 font-medium whitespace-nowrap">${r.monthLabel}</span>${ongoingBadge}${countLbl}</span></td>
        <td class="py-1.5 pr-3 text-right font-mono">${heatPill(fmtUSD(r.feesUSD), heatBg(r.feesUSD, refFeesAgg, false))}</td>
        <td class="py-1.5 pr-3 text-right text-slate-400 font-mono">${fmtUSD(r.capitalAvg)}</td>
        <td class="py-1.5 pr-3 text-right font-mono font-semibold">${heatPill(aprStr(r.apr), heatBg(r.apr, refApr, true), aprTextCls(r.apr))}</td>
        <td class="py-1.5 text-right font-mono text-slate-300">${mprStr(r.apr)}</td>
      </tr>
      <tr class="apr-detail-row" data-apr-detail="${r.monthKey}" hidden><td colspan="5" class="p-0">
        <div class="bg-slate-800/30 border-l-2 border-slate-600 px-3 py-2 mb-1 ml-3 rounded-r-lg">${detailInner}</div>
      </td></tr>`;
  }).join("");
  return `
    <table class="w-full text-[11px] border-collapse">
      <thead>
        <tr class="text-[9px] uppercase text-slate-500 border-b border-slate-700">
          <th class="text-left pb-2 font-semibold">Mes</th>
          <th class="text-right pb-2 pr-3 font-semibold">Fees</th>
          <th class="text-right pb-2 pr-3 font-semibold">Capital medio</th>
          <th class="text-right pb-2 pr-3 font-semibold">APR</th>
          <th class="text-right pb-2 font-semibold">MPR</th>
        </tr>
      </thead>
      <tbody>${rowsHTML}</tbody>
    </table>`;
}

// Listener delegado (una sola vez) para desplegar/plegar el desglose por pool
// de cada mes en la tabla del Histórico. Se instala sobre el contenedor
// persistente #hist-monthly-apr; renderHistorico reescribe su innerHTML en
// cada análisis pero el contenedor no cambia, así que el listener sobrevive.
function installMonthlyAprToggle() {
  const cont = els.histMonthlyApr;
  if (!cont || cont.__aprToggleInstalled) return;
  cont.__aprToggleInstalled = true;
  // Zebra de las filas-mes: clase de baja especificidad (0,1,0) → el hover
  // (`hover:bg-slate-800/40` = 0,2,0) la sobreescribe, así el hover sigue vivo.
  if (!document.getElementById("apr-zebra-style")) {
    const st = document.createElement("style");
    st.id = "apr-zebra-style";
    st.textContent = ".apr-zebra{background:rgba(255,255,255,0.07)}";
    document.head.appendChild(st);
  }
  cont.addEventListener("click", (e) => {
    const row = e.target.closest("[data-apr-month]");
    if (!row || !cont.contains(row)) return;
    const key = row.dataset.aprMonth;
    const detail = cont.querySelector(`[data-apr-detail="${(window.CSS && CSS.escape) ? CSS.escape(key) : key}"]`);
    if (!detail) return;
    const willOpen = detail.hasAttribute("hidden");
    if (willOpen) detail.removeAttribute("hidden"); else detail.setAttribute("hidden", "");
    row.classList.toggle("open", willOpen);
    const chev = row.querySelector(".apr-chev");
    if (chev) chev.textContent = willOpen ? "▾" : "▸";
  });
}

// Color por red/protocolo. Una posición es de una sola red (EVM chain o protocolo
// Solana o lending de una chain), así que mapeamos `venue` (el campo que envía el
// engine como label, p. ej. "Ethereum", "HyperEVM", "Orca Whirlpools", "Revert Lend ·
// Base") al color asociado a esa red. Mantiene consistencia visual: TODAS las
// posiciones de Ethereum salen del mismo azul morado, todas las de Arbitrum del
// mismo azul, etc.
const VENUE_COLORS = {
  // EVM (matchea el venue que envía evm/app.js → state.chains[key].name)
  "ethereum":   "#627EEA",
  "arbitrum":   "#28A0F0",
  "optimism":   "#FF0420",
  "polygon":    "#8247E5",
  "base":       "#0052FF",
  "bnb chain":  "#F3BA2F",
  "bnb":        "#F3BA2F",
  "hyperevm":   "#97FCE4",
  // Solana — el chip "Solana" lo usa el bloque idle (cadena nativa, no protocolo).
  // Los pools concretos siguen pintándose con su color de protocolo (orca / raydium).
  "solana":     "#FFEB3B",
  "orca":       "#FFD15C",
  "raydium":    "#C200FB",
};
function venueColor(venue) {
  if (!venue) return null;
  const v = String(venue).toLowerCase();
  // Match directo
  if (VENUE_COLORS[v]) return VENUE_COLORS[v];
  // Match parcial: el venue puede ser "Revert Lend · Base" o "Orca Whirlpools" etc.
  for (const [key, color] of Object.entries(VENUE_COLORS)) {
    if (v.includes(key)) return color;
  }
  return null;
}
// Nombre legible de la red a partir del chainKey que envían los engines.
const CHAIN_DISPLAY = {
  ethereum: "Ethereum",
  arbitrum: "Arbitrum",
  optimism: "Optimism",
  polygon: "Polygon",
  base: "Base",
  bnb: "BNB",
  hyperevm: "HyperEVM",
  solana: "Solana",
};
function chainDisplayName(chain) {
  if (!chain) return "";
  return CHAIN_DISPLAY[chain.toLowerCase()] || chain;
}
// Heurística anti-scam para tokens idle: airdrops basura que FALSIFICAN el nombre
// (símbolo con espacios tipo "U S D C", o un enlace/dominio metido en el nombre para
// engañar y vaciarte la wallet). Read-only: solo marca visualmente y no enlaza su
// gráfico. Conservadora para no marcar tokens legítimos (p. ej. "ether.fi" no se marca:
// no lleva http/www/ruta). Señales: URL/social/dominio-con-ruta, símbolo con espacios,
// o cebos de airdrop.
function isLikelyScamToken(t) {
  const sym = ((t && t.symbol) || "").trim();
  const name = ((t && t.name) || "").trim();
  const hay = `${sym} ${name}`;
  if (/https?:\/\/|www\.|\bt\.me\b|telegram|discord|[a-z0-9-]{2,}\.[a-z]{2,}\/\S/i.test(hay)) return true; // URL / red social / dominio-con-ruta
  if (/\S\s+\S/.test(sym)) return true;                          // símbolo con espacios internos (U S D C, U S D T…)
  if (/\b(airdrop|voucher|giveaway)\b/i.test(hay)) return true;  // cebos típicos de airdrop-scam
  return false;
}
// Formatea ticks de fecha y omite repetidos consecutivos (evita fechas duplicadas en rangos cortos)
function dateTick(fmtOpts) {
  return function (value, index, ticks) {
    const f = (v) => new Date(v).toLocaleDateString("es-ES", fmtOpts);
    const cur = f(value);
    const prev = index > 0 && ticks[index - 1] ? f(ticks[index - 1].value) : null;
    return cur === prev ? "" : cur;
  };
}

// ============================================================================
// Tabs
// ============================================================================

function setTab(tab) {
  state.tab = tab;
  const active = "seg px-2.5 sm:px-3 py-1.5 text-xs rounded-md font-semibold bg-[#ECE600] text-slate-900 shadow";
  const idle = "seg px-2.5 sm:px-3 py-1.5 text-xs rounded-md font-semibold text-slate-400 hover:text-slate-200";
  els.tabBtnPortfolio.className = tab === "portfolio" ? active : idle;
  els.tabBtnQuick.className = tab === "quick" ? active : idle;
  els.tabBtnProjection.className = tab === "projection" ? active : idle;
  if (els.tabBtnAllocator) els.tabBtnAllocator.className = tab === "allocator" ? active : idle;
  if (els.tabBtnGraficos) els.tabBtnGraficos.className = tab === "graficos" ? active : idle;
  // En móvil las pestañas son solo-icono (texto en <span class="hidden sm:inline">),
  // PERO la pestaña ACTIVA muestra su texto también en móvil (quitándole `hidden`)
  // para saber siempre en qué sección estás.
  const _tabTxt = (btn, on) => { const sp = btn && btn.querySelector("span"); if (sp) sp.classList.toggle("hidden", !on); };
  _tabTxt(els.tabBtnQuick, tab === "quick");
  _tabTxt(els.tabBtnPortfolio, tab === "portfolio");
  _tabTxt(els.tabBtnGraficos, tab === "graficos");
  _tabTxt(els.tabBtnProjection, tab === "projection");
  _tabTxt(els.tabBtnAllocator, tab === "allocator");
  els.tabPortfolio.classList.toggle("hidden", tab !== "portfolio");
  els.tabQuick.classList.toggle("hidden", tab !== "quick");
  els.tabProjection.classList.toggle("hidden", tab !== "projection");
  if (els.tabAllocator) els.tabAllocator.classList.toggle("hidden", tab !== "allocator");
  if (els.tabGraficos) els.tabGraficos.classList.toggle("hidden", tab !== "graficos");
  if (tab === "projection") renderHistorico();
  if (tab === "allocator") renderAllocator();
  // Los gráficos viven en su propia pestaña. Chart.js no dibuja bien en un
  // contenedor oculto (0×0), así que (re)dibujamos al entrar. Si no hay análisis,
  // mostramos una pista.
  if (tab === "graficos") {
    const has = state.results && state.results.length > 0;
    const empty = document.getElementById("graficos-empty");
    if (empty) empty.classList.toggle("hidden", has);
    if (has) renderPortfolioCharts();
  }
  // Al volver al Portfolio, repinta la lista para reflejar pilares creados/
  // renombrados/eliminados en la pestaña Pilares (los selectores se reconstruyen).
  if (tab === "portfolio" && state.user) renderPortfolioList();
  // El iframe de Quick se comparte con "Analizar todo" (headless). Si al entrar a Quick
  // el iframe activo lo había pintado el Portfolio, hay que limpiar para no enseñar
  // datos no analizados desde la pestaña Quick.
  if (tab === "quick") {
    const mode = state.mode; // "evm" o "sol"
    if (state.iframeOwnedBy[mode] === "portfolio") {
      const f = mode === "evm" ? els.frameEvm : els.frameSol;
      if (f && f.contentWindow) f.contentWindow.postMessage({ type: "lp-clear" }, "*");
      state.iframeOwnedBy[mode] = null;
      els.addr.value = "";
      clearQuickSummary();
    }
    // El iframe inactivo también lo limpiamos por si el usuario cambia de modo
    const other = mode === "evm" ? "sol" : "evm";
    if (state.iframeOwnedBy[other] === "portfolio") {
      const f = other === "evm" ? els.frameEvm : els.frameSol;
      if (f && f.contentWindow) f.contentWindow.postMessage({ type: "lp-clear" }, "*");
      state.iframeOwnedBy[other] = null;
    }
  } else {
    // al salir de Quick, escondemos su resumen (no es relevante en otros tabs)
    clearQuickSummary();
  }
}

// ============================================================================
// Auto-actualización de la pestaña activa
// ============================================================================
let _autoTimer = null;
let _autoBusy = false;

function applyAutoRefresh() {
  const ms = Number(els.autoRefresh.value || 0);
  localStorage.setItem("lp:autoRefresh", String(ms));
  if (_autoTimer) { clearInterval(_autoTimer); _autoTimer = null; }
  if (ms > 0) _autoTimer = setInterval(autoRefreshTick, ms);
}

function autoRefreshTick() {
  if (document.hidden) return; // no refrescar si la pestaña del navegador está oculta
  refreshActiveTab();
}

function spinRefresh(on) { if (els.refreshNow) els.refreshNow.firstElementChild.classList.toggle("animate-spin", !!on); }

// Refresca los datos de la pestaña activa en segundo plano (sin recargar la página).
// Lo usan tanto la auto-actualización como el botón de refresco manual.
function refreshActiveTab() {
  if (_autoBusy) return;
  if (state.tab === "quick") {
    const a = els.addr.value.trim();
    if (!a || !detectType(a)) return; // sin dirección válida no refrescamos
    _autoBusy = true; spinRefresh(true);
    quickAnalyze({ silent: true }); // _autoBusy y el spin se liberan en lp-analyze-done
  } else if (state.tab === "portfolio" || state.tab === "projection") {
    if (!state.portfolio.length || !crypto_.key || els.analyzeAll.disabled) return;
    _autoBusy = true; spinRefresh(true);
    Promise.resolve(analyzeAll({ silent: true })).finally(() => { _autoBusy = false; spinRefresh(false); });
  }
}

// ============================================================================
// Quick mode (single address -> iframe visible)
// ============================================================================

function setMode(mode) {
  const prevMode = state.mode;
  state.mode = mode;
  localStorage.setItem("lp:lastMode", mode);
  const active = "seg px-3 py-1.5 text-xs rounded-md font-semibold bg-[#ECE600] text-slate-900 shadow";
  const idle = "seg px-3 py-1.5 text-xs rounded-md font-semibold text-slate-400 hover:text-slate-200";
  els.modeEvm.className = mode === "evm" ? active : idle;
  els.modeSol.className = mode === "sol" ? active : idle;
  els.frameEvm.classList.toggle("hidden", mode !== "evm");
  els.frameSol.classList.toggle("hidden", mode !== "sol");
  // Notificar a módulos opcionales (active/*) del cambio de modo. No-op en [main].
  emitHook("modeChange", mode);
  // Al cambiar de cadena en Quick limpiamos el resumen (los datos del modo
  // anterior ya no aplican). El siguiente lp-summary lo vuelve a pintar.
  if (prevMode && prevMode !== mode) clearQuickSummary();
}

function showHint(msg, kind) {
  if (!msg) { els.hint.classList.add("hidden"); return; }
  els.hint.classList.remove("hidden");
  els.hint.className = `text-[11px] mb-2 ${kind === "err" ? "text-rose-400" : "text-slate-400"}`;
  els.hint.textContent = msg;
}

function activeFrame() { return state.mode === "evm" ? els.frameEvm : els.frameSol; }
function postToActive(m) { const f = activeFrame(); if (f && f.contentWindow) f.contentWindow.postMessage(m, "*"); }

function quickAnalyze(opts = {}) {
  const silent = opts && opts.silent;
  const addr = els.addr.value.trim();
  if (!addr) { if (!silent) showHint("Pega una dirección primero.", "err"); _autoBusy = false; return; }
  const t = detectType(addr);
  if (!t) { if (!silent) showHint("Formato no reconocido (EVM 0x… o Solana base58).", "err"); _autoBusy = false; return; }
  if (t !== state.mode) setMode(t);
  showHint(null); // el progreso se ve en el modal; sin aviso de texto
  if (!silent) {
    openAnalyzingModal(`Analizando la dirección en ${t === "evm" ? "EVM" : "Solana"}…`, false);
    clearTimeout(_quickModalTimer);
    _quickModalTimer = setTimeout(closeAnalyzingModal, 90000);
  }
  state.iframeOwnedBy[t] = "quick"; // marca: lo que aparezca en pantalla viene de un análisis Quick
  const send = async () => { await pushTokenToEngines(); postToActive({ type: "lp-analyze", address: addr }); };
  if (state.ready[state.mode]) send(); else setTimeout(send, 800);
}
let _quickModalTimer = null;

// ============================================================================
// Cifrado E2E (WebCrypto: PBKDF2 -> AES-GCM). La contraseña nunca sale del navegador.
// ============================================================================

const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(passphrase, saltBytes) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBytes, iterations: 210000, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
  );
}
async function encryptJSON(obj, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
  return { iv: b64(iv), ct: b64(ct) };
}
async function decryptJSON(blob, key) {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(blob.iv) }, key, unb64(blob.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
async function rememberKey(uid, key) {
  try { const raw = await crypto.subtle.exportKey("raw", key); localStorage.setItem("lp:enckey:" + uid, b64(raw)); } catch (e) {}
}
async function loadRememberedKey(uid) {
  const s = localStorage.getItem("lp:enckey:" + uid);
  if (!s) return null;
  try { return await crypto.subtle.importKey("raw", unb64(s), "AES-GCM", true, ["encrypt", "decrypt"]); } catch { return null; }
}
function forgetKey(uid) { localStorage.removeItem("lp:enckey:" + uid); }

// ============================================================================
// UI Modals — sustitutos de window.alert/confirm/prompt con estilo Tailwind.
//
// Por qué no nativos: window.confirm/alert/prompt bloquean el thread del
// navegador, no se pueden estilar, y en móvil aparecen con la URL completa
// del origen (feo). Los modales custom son no-bloqueantes (Promise-based),
// estilo coherente con el resto de la app, soportan Escape/Enter, y permiten
// botones con colores semánticos (danger en rojo para destructivos).
//
// API:
//   uiAlert(message, opts)            → Promise<void>
//   uiConfirm(message, opts)          → Promise<boolean>     (true = OK, false = cancel)
//   uiPrompt(message, defVal, opts)   → Promise<string|null> (null = cancel)
//
// opts comunes:
//   title         (string)  — encabezado, default según tipo
//   okLabel       (string)  — etiqueta del botón principal
//   cancelLabel   (string)  — etiqueta del botón secundario
//   okStyle       ("primary"|"danger"|"default") — color del botón OK
//   placeholder   (string)  — solo uiPrompt
//   html          (bool)    — si true, message se inserta como HTML (sin escape)
// ============================================================================
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function _showDialog(opts) {
  return new Promise((resolve) => {
    const { type, title, message, defaultValue, placeholder, okLabel, cancelLabel, okStyle, html } = opts;
    const okClasses = ({
      primary: "bg-[#ECE600] hover:bg-[#f5ef4d] text-slate-900",
      danger:  "bg-rose-600 hover:bg-rose-500 text-white",
      default: "bg-slate-700 hover:bg-slate-600 text-slate-100",
    })[okStyle || "primary"];
    const msgHtml = html ? message : escapeHtml(message).replace(/\n/g, "<br>");

    const overlay = document.createElement("div");
    overlay.className = "fixed inset-0 z-[300] bg-black/70 flex items-center justify-center p-4";
    overlay.innerHTML = `
      <div class="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold text-slate-100">${escapeHtml(title)}</h3>
          <button class="ui-close text-slate-400 hover:text-slate-100 text-2xl leading-none">×</button>
        </div>
        <div class="text-sm text-slate-300 leading-relaxed">${msgHtml}</div>
        ${type === "prompt" ? `<input type="text" class="ui-input w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-500" placeholder="${escapeHtml(placeholder || "")}" value="${escapeHtml(defaultValue || "")}" />` : ""}
        <div class="flex justify-end gap-2 pt-1">
          ${type !== "alert" ? `<button class="ui-cancel px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm text-slate-100">${escapeHtml(cancelLabel || "Cancelar")}</button>` : ""}
          <button class="ui-ok px-4 py-2 rounded-lg text-sm font-semibold ${okClasses}">${escapeHtml(okLabel)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const cleanup = () => { overlay.remove(); document.removeEventListener("keydown", onKey); };
    const finish = (val) => { cleanup(); resolve(val); };
    const onCancel = () => finish(type === "prompt" ? null : type === "confirm" ? false : undefined);
    const onOk = () => {
      if (type === "prompt") finish(overlay.querySelector(".ui-input").value);
      else if (type === "confirm") finish(true);
      else finish(undefined);
    };
    const input = overlay.querySelector(".ui-input");
    const okBtn = overlay.querySelector(".ui-ok");
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onCancel(); }
      else if (e.key === "Enter") {
        // En prompt: Enter en el input = OK. En alert/confirm: Enter siempre = OK.
        if (type === "prompt" && document.activeElement !== input) return;
        e.preventDefault(); onOk();
      }
    };

    overlay.onclick = (e) => { if (e.target === overlay) onCancel(); };
    overlay.querySelector(".ui-close").onclick = onCancel;
    okBtn.onclick = onOk;
    overlay.querySelector(".ui-cancel")?.addEventListener("click", onCancel);
    document.addEventListener("keydown", onKey);

    // Focus: input para prompt, OK button para alert/confirm
    setTimeout(() => {
      if (type === "prompt" && input) { input.focus(); input.select(); }
      else okBtn.focus();
    }, 50);
  });
}

window.uiAlert = (message, opts = {}) => _showDialog({
  type: "alert", message,
  title: opts.title || "Aviso",
  okLabel: opts.okLabel || "OK",
  okStyle: opts.okStyle || "primary",
  html: opts.html,
});
window.uiConfirm = (message, opts = {}) => _showDialog({
  type: "confirm", message,
  title: opts.title || "Confirmar",
  okLabel: opts.okLabel || "Confirmar",
  cancelLabel: opts.cancelLabel || "Cancelar",
  okStyle: opts.okStyle || "primary",
  html: opts.html,
});
window.uiPrompt = (message, defaultValue, opts = {}) => _showDialog({
  type: "prompt", message, defaultValue,
  title: opts.title || "Introduce un valor",
  okLabel: opts.okLabel || "OK",
  cancelLabel: opts.cancelLabel || "Cancelar",
  placeholder: opts.placeholder || "",
  okStyle: opts.okStyle || "primary",
  html: opts.html,
});

// Modal de contraseña. mode: "set" (nueva) | "unlock" (existente). Devuelve Promise<key|null>.
let encResolve = null;
function openEncModal(mode) {
  return new Promise((resolve) => {
    encResolve = resolve;
    const needsConfirm = mode === "set" || mode === "change";
    els.encTitle.textContent = mode === "set" ? "🔒 Crea tu contraseña de cifrado"
      : mode === "change" ? "🔑 Cambiar contraseña de cifrado" : "🔓 Desbloquea tu portfolio";
    els.encDesc.textContent = mode === "set"
      ? "Define una contraseña para cifrar tus direcciones. Será necesaria para acceder a ellas."
      : mode === "change" ? "Elige una nueva contraseña. Tus direcciones se volverán a cifrar con ella."
      : "Introduce tu contraseña para descifrar tus direcciones guardadas.";
    els.encPass.placeholder = mode === "change" ? "Nueva contraseña" : "Contraseña";
    els.encPass2.classList.toggle("hidden", !needsConfirm);
    els.encWarn.classList.toggle("hidden", !needsConfirm);
    els.encCancel.classList.toggle("hidden", mode !== "change"); // cancelar solo en cambio
    els.encForgot.classList.toggle("hidden", mode !== "unlock"); // "olvidé" solo al desbloquear
    els.encPass.value = ""; els.encPass2.value = ""; els.encErr.classList.add("hidden");
    els.encRemember.checked = false; els.encAck.checked = false;
    els.encModal.dataset.mode = mode;
    els.encModal.classList.remove("hidden");
    setTimeout(() => els.encPass.focus(), 50);
  });
}
function closeEncModal(result) {
  els.encModal.classList.add("hidden");
  const r = encResolve; encResolve = null;
  if (r) r(result);
}
async function handleEncSubmit() {
  const mode = els.encModal.dataset.mode;
  const pass = els.encPass.value;
  const needsConfirm = mode === "set" || mode === "change";
  els.encErr.classList.add("hidden");
  const err = (m) => { els.encErr.textContent = m; els.encErr.classList.remove("hidden"); };
  if (!pass || pass.length < 6) return err("Mínimo 6 caracteres.");
  if (needsConfirm && pass !== els.encPass2.value) return err("Las contraseñas no coinciden.");
  if (needsConfirm && !els.encAck.checked) return err("Marca la casilla de confirmación.");
  try {
    if (mode === "change") {
      // re-cifrar con nueva contraseña + nuevo salt (el portfolio ya está descifrado en memoria)
      const newSalt = crypto.getRandomValues(new Uint8Array(16));
      const key = await deriveKey(pass, newSalt);
      crypto_.salt = newSalt; crypto_.key = key;
      await savePortfolio(); // guarda con el nuevo salt/clave
      if (state.user) { if (els.encRemember.checked) await rememberKey(state.user.uid, key); else forgetKey(state.user.uid); }
      closeEncModal(key);
      setPfStatus("Contraseña actualizada.", "ok");
      return;
    }
    const key = await deriveKey(pass, crypto_.salt);
    if (mode === "unlock") {
      const ok = await tryDecryptPortfolio(key);
      if (!ok) return err("Contraseña incorrecta.");
    }
    crypto_.key = key;
    if (els.encRemember.checked && state.user) await rememberKey(state.user.uid, key);
    closeEncModal(key);
  } catch (e) {
    err("Error: " + e.message);
  }
}

// "Olvidé mi contraseña" (solo disponible en modo unlock): borra el blob cifrado
// de Firestore y permite empezar de cero con una contraseña nueva. NO recupera
// las direcciones — solo evita quedar bloqueado fuera de la app.
async function handleForgotPassword() {
  if (!state.user || !fb.db) return;
  const ok1 = await uiConfirm(
    "⚠️ ¿Seguro que quieres empezar de cero?\n\n" +
    "Esto BORRARÁ tus direcciones cifradas (no se pueden recuperar sin la contraseña).\n" +
    "Después podrás definir una nueva contraseña con un portfolio vacío.",
    { title: "Empezar de cero", okLabel: "Sí, borrar todo", okStyle: "danger" }
  );
  if (!ok1) return;
  const typed = await uiPrompt(
    "Para confirmar, escribe BORRAR en mayúsculas:",
    "",
    { title: "Confirmación final", placeholder: "BORRAR", okLabel: "Borrar", okStyle: "danger" }
  );
  if (typed !== "BORRAR") return;
  try {
    const ref = fb.fsMod.doc(fb.db, "users", state.user.uid);
    await fb.fsMod.setDoc(ref, {
      portfolioEnc: fb.fsMod.deleteField(),
      apiKeysEnc: fb.fsMod.deleteField(),
      encSalt: fb.fsMod.deleteField(),
    }, { merge: true });
    forgetKey(state.user.uid);
    _pendingEnc = null; _legacyPortfolio = null;
    _pendingApiKeysEnc = null; _apiKeys = { graph: "", helius: "", birdeye: "", etherscan: "" };
    crypto_.salt = crypto.getRandomValues(new Uint8Array(16));
    crypto_.key = null;
    state.portfolio = [];
    closeEncModal(null); // cierra el unlock actual; abajo abrimos uno nuevo en modo "set"
    const key = await openEncModal("set");
    if (!key) { setPfStatus("Define una contraseña para continuar.", "err"); return; }
    await savePortfolio();
    renderPortfolioList();
    setPfStatus("Portfolio reiniciado. Define ya tu nueva contraseña.", "ok");
  } catch (e) {
    console.error("forgot-password", e);
    setPfStatus(`No se pudo reiniciar: ${e.message}`, "err");
  }
}

// "Eliminar cuenta": borra el doc Firestore y la cuenta de Firebase Auth.
// Si Auth pide re-login (token viejo), reintenta tras un signInWithPopup.
async function handleDeleteAccount() {
  if (!state.user || !fb.auth || !fb.db) return;
  if (isAdminUser()) {
    await uiAlert("La cuenta de administrador no se puede eliminar desde la app.", { title: "Operación no permitida" });
    return;
  }
  const email = state.user.email || "";
  const ok1 = await uiConfirm(
    "⚠️ ¿Eliminar tu cuenta?\n\n" +
    "Se borrarán:\n" +
    "• Tus direcciones cifradas y preferencias\n" +
    "• Tu cuenta de Firebase Auth\n\n" +
    "Esta acción es IRREVERSIBLE.",
    { title: "Eliminar cuenta", okLabel: "Eliminar", okStyle: "danger" }
  );
  if (!ok1) return;
  const typed = await uiPrompt(
    `Para confirmar, escribe tu email exactamente:\n${email}`,
    "",
    { title: "Confirmación final", placeholder: email, okLabel: "Eliminar cuenta", okStyle: "danger" }
  );
  if ((typed || "").trim().toLowerCase() !== email.toLowerCase()) {
    await uiAlert("Email no coincide. Cancelado.", { title: "Cancelado" });
    return;
  }
  try {
    // 0) Marca la entrada de allowlist con deletedAt. NO la borramos: el admin
    //    quiere conservar el histórico de a quién dio acceso. El chip cambiará
    //    a "🚪 Dado de baja" en el modal Accesos.
    if (email && email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      try {
        await fb.fsMod.setDoc(
          fb.fsMod.doc(fb.db, "allowlist", email.toLowerCase()),
          { deletedAt: Date.now() }, { merge: true }
        );
      } catch (e) { console.warn("mark deletedAt in allowlist:", e); }
    }
    // 1) borra el doc del usuario en Firestore (datos cifrados + prefs)
    try { await fb.fsMod.deleteDoc(fb.fsMod.doc(fb.db, "users", state.user.uid)); }
    catch (e) { console.warn("deleteDoc users", e); }
    // 2) borra la clave recordada en este dispositivo
    forgetKey(state.user.uid);
    // 3) borra la cuenta de Firebase Auth (puede requerir reautenticación)
    try {
      await fb.authMod.deleteUser(fb.auth.currentUser);
    } catch (e) {
      if (e && e.code === "auth/requires-recent-login") {
        await uiAlert("Por seguridad, vuelve a iniciar sesión para confirmar el borrado.", { title: "Se requiere re-login" });
        const provider = new fb.authMod.GoogleAuthProvider();
        await fb.authMod.reauthenticateWithPopup(fb.auth.currentUser, provider);
        await fb.authMod.deleteUser(fb.auth.currentUser);
      } else { throw e; }
    }
    // 4) onAuthChange(null) se encarga del resto (vuelta al gate)
    await uiAlert("Tu cuenta ha sido eliminada. Hasta pronto 👋", { title: "Cuenta eliminada" });
  } catch (e) {
    console.error("delete-account", e);
    setPfStatus(`No se pudo eliminar la cuenta: ${e.message}`, "err");
  }
}

// intenta descifrar el portfolio guardado con una key; devuelve true/false (y rellena state.portfolio).
// También descifra (o migra) las API keys aprovechando la misma clave.
let _pendingEnc = null; // blob cifrado cargado de Firestore pendiente de descifrar
async function tryDecryptPortfolio(key) {
  let ok = true;
  if (!_pendingEnc) { state.portfolio = []; }
  else {
    try { state.portfolio = await decryptJSON(_pendingEnc, key); if (!Array.isArray(state.portfolio)) state.portfolio = []; }
    catch { ok = false; }
  }
  if (ok) {
    // descifrar (o migrar desde localStorage) las API keys y pushear a los engines
    await tryDecryptApiKeys(key);
    pushKeysToEngines();
  }
  return ok;
}

// ============================================================================
// Firebase
// ============================================================================

function getStoredFbConfig() {
  try { return JSON.parse(localStorage.getItem("lp:firebaseConfig") || "null"); } catch { return null; }
}

async function initFirebase(config) {
  const [appMod, authMod, fsMod] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-firestore.js`),
  ]);
  fb.app = appMod.initializeApp(config);
  fb.authMod = authMod;
  fb.fsMod = fsMod;
  fb.auth = authMod.getAuth(fb.app);
  fb.db = fsMod.getFirestore(fb.app);
  authMod.onAuthStateChanged(fb.auth, onAuthChange);
}

// Mensajes en los gates de login (portfolio y quick). style: "plain" | "denied".
const _GATE_BASE_CLS = "text-sm text-rose-400 mt-4 max-w-md mx-auto";
const _GATE_DENIED_CLS = "rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 mt-4 max-w-md mx-auto text-left";
function setGateMsg(el, text, style = "plain") {
  if (!el) return;
  if (!text) { el.className = "hidden " + _GATE_BASE_CLS; el.textContent = ""; return; }
  el.className = style === "denied" ? _GATE_DENIED_CLS : _GATE_BASE_CLS;
  if (style === "denied") el.innerHTML = text; else el.textContent = text;
}
function clearGateMsgs() { setGateMsg(els.gateMsg, ""); setGateMsg(els.quickGateMsg, ""); }

async function signInWithGoogle() {
  if (!fb.auth) {
    // Firebase todavía cargando (import async de CDN); esperar hasta 5 s
    const msgEl = state.tab === "quick" ? els.quickGateMsg : els.gateMsg;
    setGateMsg(msgEl, "Conectando con Firebase, espera un momento…");
    let waited = 0;
    while (!fb.auth && waited < 5000) { await new Promise(r => setTimeout(r, 200)); waited += 200; }
    if (!fb.auth) { setGateMsg(msgEl, "No se pudo conectar con Firebase. Recarga la página."); return; }
    setGateMsg(msgEl, "");
  }
  clearGateMsgs();
  try {
    const provider = new fb.authMod.GoogleAuthProvider();
    await fb.authMod.signInWithPopup(fb.auth, provider);
  } catch (e) {
    console.error(e);
    if (state.tab === "quick") setGateMsg(els.quickGateMsg, `Error de login: ${e.message}`);
    else setPfStatus(`Error de login: ${e.message}`, "err");
  }
}

// ---- Gestión de la allowlist (solo admin) ----
async function openAccessModal() {
  if (!isAdminUser()) return;
  els.accessErr.classList.add("hidden");
  els.accessEmail.value = "";
  els.accessModal.classList.remove("hidden");
  await renderAllowlist();
}
function closeAccessModal() { els.accessModal.classList.add("hidden"); }

async function renderAllowlist() {
  els.accessList.innerHTML = `<div class="text-xs text-slate-500">Cargando…</div>`;
  let rows = [];
  try {
    const col = fb.fsMod.collection(fb.db, "allowlist");
    const snap = await fb.fsMod.getDocs(col);
    rows = snap.docs.map((d) => ({ email: d.id, ...(d.data() || {}) }));
  } catch (e) {
    els.accessList.innerHTML = `<div class="text-xs text-rose-400">No se pudo leer la lista: ${e.message}</div>`;
    return;
  }
  rows.sort((a, b) => a.email.localeCompare(b.email));
  els.accessList.innerHTML = "";
  // admin (fijo, no borrable)
  const adminRow = document.createElement("div");
  adminRow.className = "flex items-center justify-between gap-2 bg-slate-950/40 rounded-lg px-3 py-2";
  adminRow.innerHTML = `<span class="font-mono text-xs truncate">${ADMIN_EMAIL}</span><span class="chip bg-[#ECE600]/20 text-yellow-300">admin</span>`;
  els.accessList.appendChild(adminRow);
  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "text-xs text-slate-500";
    empty.textContent = "Aún no hay emails autorizados (además del admin).";
    els.accessList.appendChild(empty);
  }
  for (const r of rows) {
    if (r.email === ADMIN_EMAIL.toLowerCase()) continue;
    const row = document.createElement("div");
    row.className = "flex items-center justify-between gap-2 bg-slate-950/40 rounded-lg px-3 py-2";
    // Estado: Pendiente → Registrado → (Dado de baja si deletedAt > registeredAt)
    // Si vuelve a entrar después, markAllowEntryRegistered actualiza registeredAt
    // y queda como "Registrado" otra vez (la lógica usa el timestamp más reciente).
    const isDeleted = r.deletedAt && (!r.registeredAt || r.deletedAt > r.registeredAt);
    let reg;
    if (isDeleted) {
      reg = `<span class="chip bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0" title="Se dio de baja el ${new Date(r.deletedAt).toLocaleString()}. La entrada se mantiene en la lista para histórico.">🚪 Dado de baja</span>`;
    } else if (r.registeredAt) {
      reg = `<span class="chip bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0" title="Registrado en la app el ${new Date(r.registeredAt).toLocaleString()}">✓ Registrado</span>`;
    } else {
      reg = `<span class="chip bg-slate-700/40 text-slate-400 border border-slate-700 shrink-0" title="Aún no ha iniciado sesión en la app">Pendiente</span>`;
    }
    row.innerHTML = `
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <span class="font-mono text-xs truncate">${r.email}</span>
        ${reg}
      </div>`;
    const btn = document.createElement("button");
    btn.className = "text-xs text-rose-400 hover:text-rose-300 shrink-0";
    btn.textContent = "Quitar";
    btn.onclick = () => removeAllowEmail(r.email);
    row.appendChild(btn);
    els.accessList.appendChild(row);
  }
}

async function addAllowEmail() {
  els.accessErr.classList.add("hidden");
  const email = (els.accessEmail.value || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    els.accessErr.textContent = "Email no válido."; els.accessErr.classList.remove("hidden"); return;
  }
  try {
    await fb.fsMod.setDoc(fb.fsMod.doc(fb.db, "allowlist", email), { addedAt: Date.now(), addedBy: state.user.email });
    els.accessEmail.value = "";
    await renderAllowlist();
  } catch (e) {
    els.accessErr.textContent = `No se pudo añadir: ${e.message}`; els.accessErr.classList.remove("hidden");
  }
}

// Marca el doc de allowlist como "registrado" (1ª vez que este usuario entra).
// Idempotente: solo escribe si no existe el campo ya. Tolera errores (p.ej.
// si las Firestore rules todavía no permiten la actualización por el usuario).
async function markAllowEntryRegistered(email) {
  if (!email || !fb.db) return;
  const e = email.toLowerCase();
  if (e === ADMIN_EMAIL.toLowerCase()) return; // admin no se lista
  try {
    const ref = fb.fsMod.doc(fb.db, "allowlist", e);
    const snap = await fb.fsMod.getDoc(ref);
    const data = snap.exists() ? snap.data() : null;
    // Ya marcado y NO se ha dado de baja después → nada que hacer.
    if (data && data.registeredAt && !(data.deletedAt && data.deletedAt > data.registeredAt)) return;
    // Re-registro tras baja: actualizamos registeredAt (deletedAt antiguo se queda
    // como histórico, pero la lógica del chip usa "el más reciente gana").
    await fb.fsMod.setDoc(ref, { registeredAt: Date.now() }, { merge: true });
  } catch (e2) {
    console.warn("markAllowEntryRegistered:", e2.message);
  }
}

async function removeAllowEmail(email) {
  try {
    await fb.fsMod.deleteDoc(fb.fsMod.doc(fb.db, "allowlist", email));
    await renderAllowlist();
  } catch (e) {
    els.accessErr.textContent = `No se pudo quitar: ${e.message}`; els.accessErr.classList.remove("hidden");
  }
}

async function signOutUser() {
  if (fb.auth) await fb.authMod.signOut(fb.auth);
}

function isAdminUser() {
  return !!state.user && (state.user.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

// ¿El email del usuario está autorizado? (admin siempre; resto, en la allowlist de Firestore)
async function checkAllowed(user) {
  if (!user || !user.email) return false;
  if (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return true;
  try {
    const ref = fb.fsMod.doc(fb.db, "allowlist", user.email.toLowerCase());
    const snap = await fb.fsMod.getDoc(ref);
    return snap.exists();
  } catch (e) {
    console.error("checkAllowed", e);
    return false; // ante error, denegar (seguro)
  }
}

async function onAuthChange(user) {
  state.user = user || null;
  renderAuthArea();
  if (user) {
    // Control de acceso: solo emails autorizados pueden entrar
    const allowed = await checkAllowed(user);
    if (!allowed) {
      const safeEmail = String(user.email).replace(/[<&>]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]);
      const html = `<div class="font-semibold mb-1">⛔ Acceso denegado</div>` +
        `El email <code class="font-mono text-rose-100">${safeEmail}</code> no está en la lista de acceso autorizados.<br>` +
        `Pide acceso al administrador (<code class="font-mono text-rose-100">${ADMIN_EMAIL}</code>) para que te añada.`;
      setGateMsg(els.gateMsg, html, "denied");
      setGateMsg(els.quickGateMsg, html, "denied");
      els.loginGate.classList.remove("hidden");
      els.portfolioArea.classList.add("hidden");
      await signOutUser(); // dispara onAuthChange(null); el mensaje permanece en ambos gates
      return;
    }
    // Marcar que este email se ha registrado en la app (para indicador del admin)
    markAllowEntryRegistered(user.email).catch(() => {});
    clearGateMsgs();
    els.manageAccess.classList.toggle("hidden", !isAdminUser());
    els.deleteAccount.classList.toggle("hidden", isAdminUser()); // admin no puede autoeliminarse
    els.loginGate.classList.add("hidden");
    els.portfolioArea.classList.remove("hidden");
    // Quick tab: ocultar gate, mostrar contenido
    els.quickLoginGate.classList.add("hidden");
    els.quickContent.classList.remove("hidden");
    setTab("portfolio"); // al loguear, ir al portfolio
    await loadPortfolio(user.uid);
    renderPrefs();
    pushPrefsToEngines();
    pushTokenToEngines(); // los engines necesitan el token para usar el proxy
    const unlocked = await ensureUnlocked(user.uid); // pide contraseña si hace falta
    if (!unlocked) setPfStatus("Introduce tu contraseña de cifrado para ver tu portfolio.", "err");
    renderPortfolioList();
  } else {
    els.loginGate.classList.remove("hidden");
    els.portfolioArea.classList.add("hidden");
    els.manageAccess.classList.add("hidden");
    // Quick tab: mostrar gate, ocultar contenido
    els.quickLoginGate.classList.remove("hidden");
    els.quickContent.classList.add("hidden");
    state.portfolio = [];
    crypto_.key = null; _pendingEnc = null;
    _pendingApiKeysEnc = null; _apiKeys = { graph: "", helius: "", birdeye: "", etherscan: "" };
    pushKeysToEngines(); // limpiar también las claves en los engines
    setTab("quick"); // sin sesión, mostrar el tab quick con el gate
  }
}

function renderAuthArea() {
  const isAdmin = state.user?.email === ADMIN_EMAIL;
  // Settings: disponible para cualquier usuario logueado (poner sus propias API keys
  // es opcional; sin claves se usa el proxy compartido). Ya está dentro de
  // #portfolio-area, así que solo se ve a usuarios autenticados de todas formas.
  els.authArea.innerHTML = "";
  if (state.user) {
    const wrap = document.createElement("div");
    wrap.className = "flex items-center gap-2";
    wrap.innerHTML = `
      <span class="text-xs font-semibold text-slate-900 hidden sm:inline">${state.user.email || "cuenta"}</span>
      <button id="signout-btn" class="px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 hover:bg-slate-800 text-white">Salir</button>`;
    els.authArea.appendChild(wrap);
    $("signout-btn").onclick = signOutUser;
  } else {
    const btn = document.createElement("button");
    btn.className = "px-3 py-1.5 text-xs rounded-lg bg-white text-slate-900 font-semibold hover:bg-slate-200";
    btn.textContent = "Iniciar sesión";
    btn.onclick = signInWithGoogle;
    els.authArea.appendChild(btn);
  }
}

// ---- Firestore portfolio (cifrado E2E) ----
let _legacyPortfolio = null; // datos en texto plano de cuentas antiguas (a migrar)

async function loadPortfolio(uid) {
  _pendingEnc = null; _legacyPortfolio = null; _pendingApiKeysEnc = null; crypto_.key = null;
  _apiKeys = { graph: "", helius: "", birdeye: "", etherscan: "" };
  try {
    const ref = fb.fsMod.doc(fb.db, "users", uid);
    const snap = await fb.fsMod.getDoc(ref);
    const data = snap.exists() ? snap.data() : {};
    state.prefs = {
      chains: Array.isArray(data.prefs?.chains) ? data.prefs.chains : DEFAULT_PREFS.chains.slice(),
      protocols: Array.isArray(data.prefs?.protocols) ? data.prefs.protocols : DEFAULT_PREFS.protocols.slice(),
      allocator: sanitizeAllocator(data.prefs?.allocator), // repartidor de capital
      ui: (data.prefs?.ui && typeof data.prefs.ui === "object") ? data.prefs.ui : {}, // groupBy, etc.
    };
    const prefsVer = Number(data.prefsVersion || 0);
    if (prefsVer < 2) {
      if (prefsVer < 1 && !state.prefs.chains.includes("hyperevm")) state.prefs.chains.push("hyperevm");
      // v2: renombrar los pilares por defecto no tocados (name === su id antiguo)
      // a los nombres nuevos ("P1"→"Pilar 1"…). No pisa los renombrados a mano.
      for (const p of state.prefs.allocator.pillars) {
        if (DEFAULT_PILLAR_NAMES[p.id] && p.name === p.id) p.name = DEFAULT_PILLAR_NAMES[p.id];
      }
      await fb.fsMod.setDoc(ref, { prefs: state.prefs, prefsVersion: 2 }, { merge: true }).catch(() => {});
    }
    // salt del usuario (no es secreto) y datos cifrados / legados
    crypto_.salt = data.encSalt ? unb64(data.encSalt) : crypto.getRandomValues(new Uint8Array(16));
    _pendingEnc = data.portfolioEnc || null;
    _pendingApiKeysEnc = data.apiKeysEnc || null;
    _legacyPortfolio = Array.isArray(data.portfolio) ? data.portfolio : null; // texto plano antiguo
    state.portfolio = [];
  } catch (e) {
    console.error("loadPortfolio", e);
    setPfStatus(`No se pudo cargar el portfolio: ${e.message}`, "err");
    state.portfolio = [];
    state.prefs = structuredClone(DEFAULT_PREFS);
  }
}

// Asegura que tenemos la clave y el portfolio descifrado (modal si hace falta)
async function ensureUnlocked(uid) {
  // 1) clave recordada en este dispositivo
  const rk = await loadRememberedKey(uid);
  if (rk && await tryDecryptPortfolio(rk)) { crypto_.key = rk; return true; }
  if (rk) forgetKey(uid); // recordada pero ya no descifra (cambió la contraseña) → descartar

  if (_pendingEnc) {
    // datos cifrados existentes → desbloquear
    const key = await openEncModal("unlock");
    return !!key; // handleEncSubmit ya descifró state.portfolio
  }
  // sin datos cifrados → crear contraseña (cuenta nueva o migración de texto plano)
  const key = await openEncModal("set");
  if (!key) return false;
  state.portfolio = (_legacyPortfolio && _legacyPortfolio.length) ? _legacyPortfolio : [];
  await savePortfolio(); // cifra y borra el texto plano antiguo
  return true;
}

async function savePortfolio() {
  if (!state.user || !fb.db || !crypto_.key) return;
  try {
    const ref = fb.fsMod.doc(fb.db, "users", state.user.uid);
    const enc = await encryptJSON(state.portfolio, crypto_.key);
    await fb.fsMod.setDoc(ref, {
      portfolioEnc: enc,
      encSalt: b64(crypto_.salt),
      portfolio: fb.fsMod.deleteField(), // eliminar texto plano antiguo
      email: fb.fsMod.deleteField(),     // no almacenar PII redundante
    }, { merge: true });
    _pendingEnc = enc;
    _legacyPortfolio = null;
  } catch (e) {
    console.error("savePortfolio", e);
    setPfStatus(`No se pudo guardar: ${e.message}`, "err");
  }
}

// ============================================================================
// Portfolio CRUD UI
// ============================================================================

function addPortfolioEntry() {
  const address = els.pfAddress.value.trim();
  const label = els.pfLabel.value.trim();
  els.pfAddErr.classList.add("hidden");
  const type = detectType(address);
  if (!type) { els.pfAddErr.textContent = "Dirección no válida (EVM 0x… o Solana base58)."; els.pfAddErr.classList.remove("hidden"); return; }
  if (state.portfolio.some((p) => p.address.toLowerCase() === address.toLowerCase())) {
    els.pfAddErr.textContent = "Esa dirección ya está en el portfolio."; els.pfAddErr.classList.remove("hidden"); return;
  }
  state.portfolio.push({ address, type, label, pillar: null });
  els.pfAddress.value = ""; els.pfLabel.value = "";
  renderPortfolioList();
  savePortfolio();
}

function removePortfolioEntry(address) {
  state.portfolio = state.portfolio.filter((p) => p.address !== address);
  renderPortfolioList();
  savePortfolio();
}

async function renamePortfolioEntry(address) {
  const entry = state.portfolio.find((p) => p.address === address);
  if (!entry) return;
  const input = await uiPrompt(
    `Nuevo nombre para ${shortAddr(address)}:`,
    entry.label || "",
    { title: "Renombrar dirección", placeholder: "Etiqueta (opcional)", okLabel: "Guardar" }
  );
  if (input === null) return;
  entry.label = input.trim();
  renderPortfolioList();
  savePortfolio();
}


let _dragIdx = null;

// Reordena una dirección del portfolio (drag & drop) y persiste el nuevo orden.
function reorderPortfolio(from, to) {
  if (from == null || to == null || from === to || from < 0 || to < 0) return;
  const arr = state.portfolio;
  const [moved] = arr.splice(from, 1);
  arr.splice(to, 0, moved);
  // que las secciones ya analizadas sigan el nuevo orden sin re-analizar
  if (state.results && state.results.length) {
    const ord = (a) => arr.findIndex((p) => p.address === a.entry.address && p.type === a.entry.type);
    state.results.sort((a, b) => ord(a) - ord(b));
  }
  renderPortfolioList();
  renderPortfolio();
  if (state.tab === "projection") renderHistorico();
  savePortfolio();
}

function updatePfCount() {
  const n = state.portfolio.length;
  const ev = state.portfolio.filter(p => p.type === "evm").length;
  const so = n - ev;
  if (!n) {
    els.pfCount.classList.add("hidden");
  } else {
    els.pfCount.classList.remove("hidden");
    els.pfCount.textContent = `${n} · ${ev} EVM · ${so} SOL`;
  }
}
function setPfManageOpen(open) {
  els.pfManageBody.classList.toggle("hidden", !open);
  els.pfManageChev.textContent = open ? "▾" : "▸";
}
// El usuario abrió/cerró el panel a mano en esta sesión → a partir de ahí
// respetamos su elección (no se persiste: se resetea al recargar, así no se
// queda "atascado" como pasaba con localStorage).
let _pfManageUserToggled = false;
function togglePfManage() {
  const open = els.pfManageBody.classList.contains("hidden"); // si estaba oculto, lo abrimos
  _pfManageUserToggled = true;
  setPfManageOpen(open);
}
// Estado por defecto: abierto solo cuando el portfolio está vacío (para añadir
// direcciones cómodamente); con direcciones se pliega para no ocupar espacio.
// PERO una vez que el usuario lo ha abierto/cerrado a mano, respetamos su
// elección y NO la pisamos en cada re-render (antes editar un pilar / renombrar
// volvía a plegar el panel, que es incómodo).
function applyPfManagePref() {
  if (_pfManageUserToggled) return;
  setPfManageOpen(state.portfolio.length === 0);
}

function renderPortfolioList() {
  els.pfList.innerHTML = "";
  updatePfCount();
  applyPfManagePref();
  // Notifica a módulos opcionales (active/*) que el portfolio cambió
  // (lo usa, p.ej., wallet-shell.js para refrescar sus botones "+ Añadir
  // <addr>"). Es no-op si nadie se registró al hook.
  emitHook("portfolioChange");
  if (!state.portfolio.length) {
    els.pfList.innerHTML = `<div class="text-xs text-slate-500">Aún no hay direcciones. Añade una arriba.</div>`;
    els.pfCta.classList.add("hidden");
    return;
  }
  // Mostrar CTA si hay direcciones pero aún no se ha analizado nada
  els.pfCta.classList.toggle("hidden", state.results.length > 0);
  state.portfolio.forEach((p, idx) => {
    const row = document.createElement("div");
    row.className = "flex items-center gap-2 text-sm bg-slate-950/40 rounded-lg px-3 py-2";
    row.draggable = true;
    row.dataset.idx = String(idx);
    const badge = p.type === "evm"
      ? `<span class="chip bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30">EVM</span>`
      : `<span class="chip bg-purple-500/15 text-purple-300 border border-purple-500/30">SOL</span>`;
    // Selector de pilar de la billetera. Las opciones salen de los pilares
    // definidos en la pestaña Pilares; un id que ya no exista (pilar borrado) se
    // trata como "Sin pilar". El dot refleja el color del pilar asignado.
    const pillars = (state.prefs.allocator && state.prefs.allocator.pillars) || [];
    const assignedIdx = p.pillar ? pillars.findIndex((pp) => pp.id === p.pillar) : -1;
    const assignedId = assignedIdx >= 0 ? p.pillar : "";
    const dotColor = assignedIdx >= 0 ? pillarColor(assignedIdx) : "#475569";
    const pillarSelect = `
      <span class="inline-flex items-center gap-1 flex-shrink-0">
        <span class="w-2 h-2 rounded-full" style="background:${dotColor}" title="Pilar"></span>
        <select data-pillar-idx="${idx}" title="Pilar de esta billetera" class="bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-[#ECE600] max-w-[8rem]">
          <option value=""${assignedId === "" ? " selected" : ""}>Sin pilar</option>
          ${pillars.map((pp) => `<option value="${escapeHtml(pp.id)}"${assignedId === pp.id ? " selected" : ""}>${escapeHtml(pp.name)}</option>`).join("")}
        </select>
      </span>`;
    row.innerHTML = `
      <span class="drag-handle cursor-move text-slate-600 hover:text-slate-300 select-none flex-shrink-0" title="Arrastra para reordenar">⠿</span>
      ${badge}
      ${p.label ? `<span class="font-semibold">${p.label}</span>` : ""}
      <span class="font-mono text-xs text-slate-400 truncate">${shortAddr(p.address)}</span>
      <button data-copy="${p.address}" title="Copiar dirección" class="text-slate-500 hover:text-emerald-400 flex-shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </button>
      <span class="flex-1"></span>
      ${pillarSelect}
      <button class="move-up text-xs leading-none ${idx === 0 ? "text-slate-700 cursor-default" : "text-slate-500 hover:text-slate-200"}" title="Subir" ${idx === 0 ? "disabled" : ""}>▲</button>
      <button class="move-down text-xs leading-none ${idx === state.portfolio.length - 1 ? "text-slate-700 cursor-default" : "text-slate-500 hover:text-slate-200"}" title="Bajar" ${idx === state.portfolio.length - 1 ? "disabled" : ""}>▼</button>
      <button data-rename="${p.address}" title="Renombrar" class="text-xs text-slate-500 hover:text-sky-400">✎</button>
      <button data-rm="${p.address}" class="text-xs text-slate-500 hover:text-rose-400">✕</button>`;
    // El <select> dentro de una fila draggable: desactivar el drag mientras se
    // interactúa con él para que el desplegable abra (si no, el navegador puede
    // iniciar arrastre al pulsar+mover sobre el select).
    const sel = row.querySelector("select[data-pillar-idx]");
    sel.addEventListener("mousedown", () => { row.draggable = false; });
    sel.addEventListener("blur", () => { row.draggable = true; });
    sel.onchange = () => {
      state.portfolio[idx].pillar = sel.value || null;
      row.draggable = true;
      savePortfolio();
      renderPortfolioList(); // refresca el dot de color del pilar
    };
    row.querySelector(".move-up").onclick = () => reorderPortfolio(idx, idx - 1);
    row.querySelector(".move-down").onclick = () => reorderPortfolio(idx, idx + 1);
    row.addEventListener("dragstart", (e) => { _dragIdx = idx; e.dataTransfer.effectAllowed = "move"; row.classList.add("opacity-40"); });
    row.addEventListener("dragend", () => row.classList.remove("opacity-40"));
    row.addEventListener("dragover", (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; row.classList.add("ring-1", "ring-[#ECE600]"); });
    row.addEventListener("dragleave", () => row.classList.remove("ring-1", "ring-[#ECE600]"));
    row.addEventListener("drop", (e) => { e.preventDefault(); row.classList.remove("ring-1", "ring-[#ECE600]"); reorderPortfolio(_dragIdx, idx); });
    els.pfList.appendChild(row);
  });
  els.pfList.querySelectorAll("[data-rm]").forEach((b) => { b.onclick = () => removePortfolioEntry(b.dataset.rm); });
  els.pfList.querySelectorAll("[data-rename]").forEach((b) => { b.onclick = () => renamePortfolioEntry(b.dataset.rename); });
  const copySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
  els.pfList.querySelectorAll("[data-copy]").forEach((b) => {
    b.onclick = () => navigator.clipboard.writeText(b.dataset.copy).then(() => { b.textContent = "✓"; setTimeout(() => { b.innerHTML = copySvg; }, 1200); });
  });
}

// ---- Preferencias de redes/protocolos ----
function renderPrefs() {
  const build = (container, list, selectedKeys, onToggle) => {
    container.innerHTML = "";
    for (const item of list) {
      const active = selectedKeys.includes(item.key);
      const btn = document.createElement("button");
      btn.className = `chip border ${active ? "border-[#ECE600] bg-[#ECE600]/15 text-yellow-200" : "border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700"}`;
      btn.innerHTML = `<span class="w-2 h-2 rounded-full" style="background:${item.color}"></span>${item.name}`;
      btn.onclick = () => onToggle(item.key);
      container.appendChild(btn);
    }
  };
  build(els.prefChains, EVM_CHAINS, state.prefs.chains, (key) => togglePref("chains", key));
  build(els.prefProtocols, SOL_PROTOCOLS, state.prefs.protocols, (key) => togglePref("protocols", key));
}

function togglePref(kind, key) {
  const arr = state.prefs[kind];
  const i = arr.indexOf(key);
  if (i >= 0) arr.splice(i, 1); else arr.push(key);
  renderPrefs();
  savePrefs();
  pushPrefsToEngines();
}

function pushPrefsToEngines() {
  if (els.frameEvm.contentWindow) els.frameEvm.contentWindow.postMessage({ type: "lp-set-chains", chains: state.prefs.chains }, "*");
  if (els.frameSol.contentWindow) els.frameSol.contentWindow.postMessage({ type: "lp-set-protocols", protocols: state.prefs.protocols }, "*");
}

// Envía el ID token de Firebase a los iframes para que puedan usar el proxy.
// (getIdToken refresca solo si está por expirar.) Sin sesión, no envía nada.
async function pushTokenToEngines() {
  try {
    if (!fb.auth || !fb.auth.currentUser) return;
    const token = await fb.auth.currentUser.getIdToken();
    [els.frameEvm, els.frameSol].forEach((f) => { if (f && f.contentWindow) f.contentWindow.postMessage({ type: "lp-set-token", token }, "*"); });
  } catch (e) { console.warn("pushTokenToEngines", e); }
}

// Sello de "última actualización" en la cabecera
function setLastUpdated() {
  if (!els.lastUpdated) return;
  const t = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  els.lastUpdated.textContent = `act. ${t}`;
  els.lastUpdated.classList.remove("hidden", "sm:inline");
  els.lastUpdated.classList.add("sm:inline");
}

// Exporta a CSV las posiciones del portfolio (todas las direcciones analizadas)
function exportPortfolioCSV() {
  const rows = [];
  for (const r of state.results) {
    const label = r.entry.label || shortAddr(r.entry.address);
    for (const it of (r.items || [])) {
      rows.push({
        Direccion: label,
        Wallet: r.entry.address,
        Tipo: it.lending ? "lending" : (it.kind === "evm" ? "EVM" : "SOL"),
        Red_Protocolo: it.venue || "",
        Par: it.pair || "",
        Valor_USD: (it.valueUSD || 0).toFixed(2),
        Fees_cobradas_USD: (it.feesUSD || 0).toFixed(4),
        Fees_pendientes_USD: it.feesPendingUSD == null ? "" : it.feesPendingUSD.toFixed(4),
        IL_USD: it.ilUSD == null ? "" : it.ilUSD.toFixed(2),
        PnL_USD: it.pnlUSD == null ? "" : it.pnlUSD.toFixed(2),
        Estado: it.lending ? "préstamo" : it.closed ? "cerrada" : it.inRange ? "en rango" : "fuera",
        ID: it.id || "",
      });
    }
  }
  if (!rows.length) { setPfStatus("No hay posiciones que exportar. Pulsa 'Analizar todo' primero.", "err"); return; }
  const cols = Object.keys(rows[0]);
  const esc = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }); // BOM para Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `booster-crypto-portfolio-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function savePrefs() {
  if (!state.user || !fb.db) return;
  try {
    const ref = fb.fsMod.doc(fb.db, "users", state.user.uid);
    await fb.fsMod.setDoc(ref, { prefs: state.prefs }, { merge: true });
  } catch (e) { console.error("savePrefs", e); }
}

function setPfStatus(msg, kind) {
  if (!msg) { els.pfStatus.classList.add("hidden"); return; }
  els.pfStatus.classList.remove("hidden");
  els.pfStatus.className = `text-sm ${kind === "err" ? "text-rose-400" : kind === "ok" ? "text-emerald-400" : "text-slate-300"}`;
  els.pfStatus.textContent = msg;
}

// Placeholders "esqueleto" mientras llegan los primeros resultados
function renderPortfolioSkeleton() {
  const cards = Math.min(6, Math.max(2, state.portfolio.length * 2));
  els.pfSections.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">${
    Array.from({ length: cards }).map(() => `
      <div class="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <div class="flex justify-between"><div class="skeleton h-3 w-24 rounded"></div><div class="skeleton h-4 w-14 rounded-full"></div></div>
        <div class="skeleton h-6 w-full rounded-md"></div>
        <div class="grid grid-cols-2 gap-2"><div class="skeleton h-10 rounded"></div><div class="skeleton h-10 rounded"></div></div>
      </div>`).join("")
  }</div>`;
}

// Modal de progreso mientras se consultan las direcciones.
// Estado per-dirección: "pending" | "running" | "done" | "error".
// Se guarda en state._analyzeStatus (Map<idx, status>) para que renderAnalyzingList
// pueda repintar sin que la lógica de analyzeAll tenga que reconstruir el DOM.
function openAnalyzingModal(msg, showBar = true) {
  if (msg) els.analyzingMsg.textContent = msg;
  if (els.analyzingBar) {
    els.analyzingBar.style.width = "0%";
    if (els.analyzingBar.parentElement) els.analyzingBar.parentElement.classList.toggle("hidden", !showBar);
  }
  els.analyzingModal.classList.remove("hidden");
  // Estado por dirección: todas en "pending" al abrir.
  state._analyzeStatus = new Map(state.portfolio.map((_, i) => [i, "pending"]));
  renderAnalyzingList();
}
function updateAnalyzingModal(msg, doneCount, total) {
  if (msg) els.analyzingMsg.textContent = msg;
  if (els.analyzingBar && total > 0) els.analyzingBar.style.width = `${Math.round((doneCount / total) * 100)}%`;
  renderAnalyzingList();
}
function setAnalyzeStatus(idx, status) {
  if (!state._analyzeStatus) return;
  state._analyzeStatus.set(idx, status);
  renderAnalyzingList();
}
// Renderiza la lista per-dirección con icono de estado, badge de red, label y
// dirección abreviada. Mantiene el orden original del portfolio.
function renderAnalyzingList() {
  if (!els.analyzingList || !state._analyzeStatus) return;
  if (!state.portfolio.length) { els.analyzingList.classList.add("hidden"); return; }
  els.analyzingList.classList.remove("hidden");
  const spinner = `<svg class="inline w-3 h-3 animate-spin text-cyan-400" viewBox="0 0 24 24" fill="none"><circle class="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>`;
  els.analyzingList.innerHTML = state.portfolio.map((p, i) => {
    const st = state._analyzeStatus.get(i) || "pending";
    const icon = st === "done"    ? `<span class="text-emerald-400 font-bold">✓</span>`
               : st === "running" ? spinner
               : st === "error"   ? `<span class="text-rose-400 font-bold">✕</span>`
               :                    `<span class="text-slate-600">○</span>`;
    const badge = p.type === "evm"
      ? `<span class="chip bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30">EVM</span>`
      : `<span class="chip bg-purple-500/15 text-purple-300 border border-purple-500/30">SOL</span>`;
    const dim = st === "pending" ? "opacity-50" : "";
    const labelSafe = (p.label || "").replace(/</g, "&lt;");
    return `<div class="flex items-center gap-2 px-2 py-1 rounded ${st === "running" ? "bg-cyan-500/5 ring-1 ring-cyan-500/20" : ""} ${dim}">
      <span class="w-4 flex-shrink-0 text-center">${icon}</span>
      ${badge}
      <span class="text-slate-200 truncate min-w-0 flex-1 text-left">${labelSafe}</span>
      <span class="font-mono text-slate-500 flex-shrink-0">${shortAddr(p.address)}</span>
    </div>`;
  }).join("");
}
function closeAnalyzingModal() {
  els.analyzingModal.classList.add("hidden");
  state._analyzeStatus = null;
}

// ============================================================================
// Portfolio analysis (orquesta los engines en headless, secuencial)
// ============================================================================

function analyzeAddressHeadless(address, type) {
  return new Promise((resolve) => {
    const reqId = "r" + Math.random().toString(36).slice(2);
    pendingReqs.set(reqId, resolve);
    const frame = type === "evm" ? els.frameEvm : els.frameSol;
    const send = async () => {
      await pushTokenToEngines(); // token fresco para que el engine use el proxy
      // fijar redes/protocolos según prefs antes de analizar (entrega ordenada por target)
      if (type === "evm") frame.contentWindow.postMessage({ type: "lp-set-chains", chains: state.prefs.chains }, "*");
      else frame.contentWindow.postMessage({ type: "lp-set-protocols", protocols: state.prefs.protocols }, "*");
      frame.contentWindow.postMessage({ type: "lp-portfolio-analyze", reqId, address }, "*");
      // El iframe se está pintando con datos del Portfolio; al cambiar a Quick habrá que limpiar
      state.iframeOwnedBy[type] = "portfolio";
    };
    if (state.ready[type]) send(); else setTimeout(send, 1200);
    setTimeout(() => {
      if (pendingReqs.has(reqId)) { pendingReqs.delete(reqId); resolve({ address, items: [], status: "timeout" }); }
    }, 90000);
  });
}

async function analyzeAll(opts = {}) {
  const silent = opts && opts.silent; // auto-actualización: sin modal bloqueante
  if (!state.portfolio.length) { if (!silent) setPfStatus("Añade alguna dirección primero.", "err"); return; }
  els.analyzeAll.disabled = true;
  els.analyzeAll.textContent = silent ? "Actualizando…" : "Analizando…";
    const n = state.portfolio.length;
  const results = new Array(n); // indexado por posición del portfolio → conserva el orden
  if (!silent) { openAnalyzingModal(`Analizando direcciones (0/${n})…`); if (!state.results.length) renderPortfolioSkeleton(); }
  let done = 0;
  // Dos "carriles" en paralelo: EVM y Solana usan iframes distintos (sin colisión de
  // estado). Dentro de cada carril es secuencial (mismo iframe, estado compartido).
  const runLane = async (type) => {
    let firstInLane = true;
    for (let i = 0; i < n; i++) {
      const entry = state.portfolio[i];
      if (entry.type !== type) continue;
      // Pequeña pausa entre direcciones consecutivas del mismo carril para no
      // saturar el rate limit del proxy (429). La primera no espera. Con el
      // Worker a 1000/60s podemos ser más agresivos que el 400 ms inicial.
      if (!firstInLane) await new Promise((r) => setTimeout(r, 250));
      firstInLane = false;
      // Marcar "en curso" antes del await: la lista del modal muestra spinner.
      if (!silent) setAnalyzeStatus(i, "running");
      const r = await analyzeAddressHeadless(entry.address, entry.type);
      results[i] = { entry, items: r.items || [], status: r.status || "", timeline: r.timeline || [], analysisStatus: r.analysisStatus || null, idleTokens: r.idleTokens || [], feesRealizableUSD: r.feesRealizableUSD != null ? r.feesRealizableUSD : null };
      // Estado final: error si timeout o status problemático; done en otro caso.
      const isError = (r.status || "").toLowerCase().includes("timeout") || (r.status || "").toLowerCase().includes("error");
      if (!silent) setAnalyzeStatus(i, isError ? "error" : "done");
      done++;
      const msg = `Analizando direcciones (${done}/${n})…`;
      if (!silent) { setPfStatus(msg); updateAnalyzingModal(msg, done, n); state.results = results.filter(Boolean); renderPortfolio(); }
    }
  };
  try {
    await Promise.all([runLane("evm"), runLane("sol")]);
    state.results = results.filter(Boolean);
    renderPortfolio();
    if (state.tab === "projection") renderHistorico(); // mantener Histórico sincronizado
    setLastUpdated();
    setPfStatus(null); // sin mensaje de "Listo…"; el resultado ya se ve en el resumen
  } finally {
    if (!silent) closeAnalyzingModal();
    els.analyzeAll.disabled = false;
    els.analyzeAll.textContent = "Analizar todo";
  }
}

// ============================================================================
// Render portfolio: resumen global + secciones por dirección
// ============================================================================

// Rellena las 5 cards del resumen (Valor, Fees, IL, PnL, Posiciones). Usado por
// Portfolio (prefix "g") y Quick (prefix "q"). Garantiza que ambos resúmenes
// muestren exactamente lo mismo a partir del array normalizado de items.
// Agregación PURA de un conjunto de items (NO toca el DOM). La usan tanto el
// resumen global/quick (fillSummary) como el resumen por pilar y las cabeceras
// de grupo → una sola fórmula, así los totales por pilar siempre cuadran con el
// global. Las cerradas (liquidez retirada) cuentan en todos los totales; solo se
// separan en el desglose del conteo. IL solo en LPs; PnL/APR incluyen lending.
function summarizeItems(items, extra = {}) {
  const totalValue = items.reduce((s, it) => s + (it.valueUSD || 0), 0);
  const totalCollected = items.reduce((s, it) => s + (it.feesUSD || 0), 0);
  const totalPending = items.reduce((s, it) => s + (it.feesPendingUSD || 0), 0);
  const lp = items.filter((it) => !it.lending);
  const lending = items.filter((it) => it.lending);
  const closed = items.filter((it) => it.closed);
  const lpOpen = lp.filter((it) => !it.closed);
  const inRange = lpOpen.filter((it) => it.inRange).length;
  let ilSum = 0, ilN = 0, pnlSum = 0, pnlN = 0;
  for (const it of lp) if (it.ilUSD != null && isFinite(it.ilUSD)) { ilSum += it.ilUSD; ilN++; }
  for (const it of items) if (it.pnlUSD != null && isFinite(it.pnlUSD)) { pnlSum += it.pnlUSD; pnlN++; }
  let wApr = 0, wTotal = 0, aprN = 0;
  for (const it of items) {
    if (typeof it.apr === "number" && isFinite(it.apr) && it.valueUSD > 0) { wApr += it.apr * it.valueUSD; wTotal += it.valueUSD; aprN++; }
  }
  const aprAnual = wTotal > 0 ? wApr / wTotal : null;
  const idleTotalUSD = Number(extra.idleTotalUSD || 0);
  return {
    totalValue, totalCollected, totalPending, totalFees: totalCollected + totalPending,
    idleTotalUSD, totalCombined: totalValue + idleTotalUSD,
    lpCount: lp.length, lendingCount: lending.length, closedCount: closed.length,
    inRange, outRange: lpOpen.length - inRange, count: items.length,
    ilSum, ilN, pnlSum, pnlN,
    aprAnual, aprMensual: aprAnual != null ? aprAnual * 30 / 365 : null, aprN,
  };
}

function fillSummary(prefix, items, extra = {}) {
  const $i = (id) => document.getElementById(`${prefix}-${id}`);
  const a = summarizeItems(items, extra);
  const pctOf = (x) => (a.totalValue > 0 ? ` (${x >= 0 ? "+" : ""}${((x / a.totalValue) * 100).toFixed(2)}%)` : "");

  if ($i("value")) {
    $i("value").innerHTML = fmtUSD(a.totalCombined);
    if ($i("value-sub")) {
      $i("value-sub").innerHTML = a.idleTotalUSD > 0
        ? `<span class="text-slate-100 font-semibold">${fmtUSD(a.totalValue)}</span> DeFi · <span class="text-slate-100 font-semibold">${fmtUSD(a.idleTotalUSD)}</span> idle`
        : `<span class="text-slate-500">${fmtUSD(a.totalValue)} en DeFi</span>`;
    }
  }
  if ($i("fees")) {
    $i("fees").innerHTML = fmtUSD(a.totalFees);
    if ($i("fees-sub")) $i("fees-sub").innerHTML = `<span class="text-amber-300 font-semibold">${fmtUSD(a.totalPending)}</span> pendientes · <span class="text-emerald-400 font-semibold">${fmtUSD(a.totalCollected)}</span> cobradas`;
  }
  if ($i("il")) {
    $i("il").innerHTML = a.ilN ? fmtUSD(a.ilSum) + pctOf(a.ilSum) : "—";
    $i("il").className = "text-xl font-bold mt-1 " + (a.ilN ? pnlColor(a.ilSum) : "");
    if ($i("il-sub")) $i("il-sub").textContent = a.ilN ? `${a.ilN}/${a.lpCount} posiciones con dato` : "requiere histórico (EVM / Birdeye en Solana)";
  }
  if ($i("pnl")) {
    $i("pnl").innerHTML = a.pnlN ? fmtUSD(a.pnlSum) + pctOf(a.pnlSum) : "—";
    $i("pnl").className = "text-xl font-bold mt-1 " + (a.pnlN ? pnlColor(a.pnlSum) : "");
    if ($i("pnl-sub")) $i("pnl-sub").textContent = a.pnlN ? `${a.pnlN}/${a.count} posiciones con dato` : "requiere histórico (EVM / Birdeye en Solana)";
  }
  if ($i("positions")) {
    $i("positions").textContent = a.count;
    if ($i("positions-sub")) $i("positions-sub").textContent =
      `${a.inRange} en rango · ${a.outRange} fuera` +
      (a.lendingCount ? ` · ${a.lendingCount} préstamo${a.lendingCount > 1 ? "s" : ""}` : "") +
      (a.closedCount ? ` · ${a.closedCount} cerrada${a.closedCount > 1 ? "s" : ""}` : "");
  }
  // Rentabilidad fees: APR anual ponderado por valor. Mensual = anual × 30/365.
  if ($i("yield")) {
    if (a.aprAnual != null) {
      const color = a.aprAnual >= 0 ? "text-emerald-400" : "text-rose-400";
      $i("yield").className = "text-xl font-bold mt-1 " + color;
      $i("yield").innerHTML = `${a.aprMensual >= 0 ? "+" : ""}${a.aprMensual.toFixed(2)}% <span class="text-[11px] text-slate-400 font-normal">mensual (MPR)</span>`;
      if ($i("yield-sub")) $i("yield-sub").innerHTML = `<span class="${color} font-semibold">${a.aprAnual >= 0 ? "+" : ""}${a.aprAnual.toFixed(2)}%</span> anual (APR) · ${a.aprN}/${a.count} pos.`;
    } else {
      $i("yield").className = "text-xl font-bold mt-1";
      $i("yield").textContent = "—";
      if ($i("yield-sub")) $i("yield-sub").textContent = "requiere histórico (EVM / Birdeye en Solana)";
    }
  }
  if ($i("addresses") && typeof extra.addresses === "number") $i("addresses").textContent = extra.addresses;
  if ($i("closed-note")) {
    const note = $i("closed-note");
    if (a.closedCount) {
      note.classList.remove("hidden");
      note.innerHTML = `🗃️ Incluye <span class="text-slate-300 font-semibold">${a.closedCount}</span> posición${a.closedCount > 1 ? "es" : ""} cerrada${a.closedCount > 1 ? "s" : ""} (liquidez retirada): sus <span class="text-slate-300">fees cobradas, PnL e IL</span> siguen contando en estos totales.`;
    } else {
      note.classList.add("hidden");
    }
  }
}

// Renderiza un banner de resultado del análisis (verde si OK, rojo si hubo errores).
// `errors` es un array de objetos { source, reason }. Si no hay errores, banner verde
// con un breve resumen. Si los hay, banner rojo listándolos + invitación a usar las
// API keys propias desde Settings (link a #settings-modal).
function renderAnalysisBanner(elem, opts) {
  if (!elem) return;
  if (!opts) { elem.classList.add("hidden"); elem.innerHTML = ""; return; }
  const errors = Array.isArray(opts.errors) ? opts.errors : [];
  const summary = String(opts.summary || "");
  if (errors.length === 0) {
    elem.className = "rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 mb-3";
    elem.innerHTML = `<span class="font-semibold">✓ Análisis completado</span>${summary ? " · " + summary : ""}`;
  } else {
    const byReason = new Map();
    for (const e of errors) {
      const k = e.reason || "error desconocido";
      if (!byReason.has(k)) byReason.set(k, []);
      byReason.get(k).push(e.source || "?");
    }
    const detail = [...byReason.entries()].map(([reason, srcs]) => `<span class="font-mono">${srcs.join(", ")}</span> <span class="text-rose-300/80">(${reason})</span>`).join(" · ");
    elem.className = "rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 mb-3 space-y-1";
    elem.innerHTML =
      `<div><span class="font-semibold">⚠ Análisis con errores</span>${summary ? " · " + summary : ""}</div>` +
      `<div class="text-[12px]">Fallaron: ${detail}.</div>` +
      `<div class="text-[11px] text-rose-300/80">Si los errores persisten, puedes configurar tus propias API keys desde <button type="button" id="banner-open-settings" class="underline hover:text-rose-100">⚙ Settings</button>.</div>`;
    const openBtn = elem.querySelector("#banner-open-settings");
    if (openBtn) openBtn.onclick = openSettingsModal;
  }
  elem.classList.remove("hidden");
}
function clearAnalysisBanner(elem) {
  if (!elem) return;
  elem.classList.add("hidden");
  elem.innerHTML = "";
}

// Resumen del Quick: lo recibe vía postMessage del engine (lp-summary {items}).
// Misma función (fillSummary) que el Portfolio → consistencia garantizada.
function renderQuickSummary(items, idleTokens) {
  const wrap = document.getElementById("quick-summary");
  if (!wrap) return;
  if (!items || !items.length) { wrap.classList.add("hidden"); return; }
  wrap.classList.remove("hidden");
  const idleTotalUSD = (idleTokens || []).reduce((s, t) => s + (t.valueUSD || 0), 0);
  fillSummary("q", items, { idleTotalUSD });
}
function clearQuickSummary() {
  const wrap = document.getElementById("quick-summary");
  if (wrap) wrap.classList.add("hidden");
  clearAnalysisBanner(els.quickBanner);
  const idle = document.getElementById("quick-idle");
  if (idle) { idle.classList.add("hidden"); idle.innerHTML = ""; }
}
function renderQuickIdleTokens(tokens) {
  const wrap = document.getElementById("quick-idle");
  if (!wrap) return;
  wrap.innerHTML = "";
  // Bloque cerrado por defecto — el resumen del header ya muestra el total y
  // el conteo, así que la lista detallada solo interesa cuando el usuario la pide.
  const block = idleTokensBlock(tokens || []);
  if (block) { wrap.appendChild(block); wrap.classList.remove("hidden"); }
  else wrap.classList.add("hidden");
}

function renderPortfolio() {
  // Las cerradas SIEMPRE cuentan en los totales/cálculos; en la lista se separan
  // a una sección colapsada por dirección (ver más abajo).
  const allItems = (r) => (r.items || []);
  const all = state.results.flatMap(allItems);
  // colores estables por red/protocolo. TODAS las posiciones de la misma red usan
  // el mismo color (Ethereum siempre azul, Arbitrum azul claro, …). Para posiciones
  // de redes sin color definido, fallback al color rotativo por índice.
  let colorIdx = 0;
  const colorOf = new Map();
  for (const r of state.results) {
    for (const it of allItems(r)) {
      colorOf.set(it, venueColor(it.venue) || distinctColor(colorIdx++));
    }
  }

  // ocultar CTA en cuanto haya resultados
  if (state.results.length > 0) els.pfCta.classList.add("hidden");

  // resumen global
  els.pfSummary.classList.toggle("hidden", all.length === 0 && state.results.length === 0);
  // Total de tokens idle de todas las direcciones (saldo en wallet, fuera de LPs).
  const idleTotalUSD = state.results
    .flatMap((r) => r.idleTokens || [])
    .reduce((s, t) => s + (t.valueUSD || 0), 0);
  fillSummary("g", all, { addresses: state.results.length, idleTotalUSD });

  // Banner de resultado del análisis (verde si OK, rojo si hubo errores por chain/protocolo
  // en alguna de las direcciones). Agregamos errores de TODAS las direcciones y prefijamos
  // con la etiqueta de la dirección que falló para que sea claro dónde.
  if (state.results.length === 0) {
    clearAnalysisBanner(els.pfBanner);
  } else {
    const allErrors = [];
    let failedAddrs = 0;
    for (const r of state.results) {
      const label = (r.entry?.label) || shortAddr(r.entry?.address || "");
      // Errores por chain/protocolo que el engine sí reportó (analysisStatus).
      const errs = r.analysisStatus?.errors || [];
      for (const e of errs) allErrors.push({ source: `${label} · ${e.source}`, reason: e.reason });
      // Fallo de la dirección ENTERA: timeout (el engine no respondió en 90s) o
      // error (excepción en el engine). Esto NO viene en analysisStatus, así que
      // sin esto el banner salía VERDE aunque la dirección no se analizara.
      // `status` lleva los sentinels exactos "timeout"/"error" (ver
      // analyzeAddressHeadless y el catch del postMessage del engine).
      const st = (r.status || "").trim().toLowerCase();
      if (st === "timeout") { allErrors.push({ source: label, reason: "timeout — el análisis tardó demasiado (reintenta o revisa el proxy/RPC)" }); failedAddrs++; }
      else if (st === "error") { allErrors.push({ source: label, reason: "error en el análisis de la dirección" }); failedAddrs++; }
    }
    const addrCount = state.results.length;
    const okAddrs = addrCount - failedAddrs;
    const summary = failedAddrs > 0
      ? `${all.length} posiciones · ${okAddrs}/${addrCount} direcciones OK, ${failedAddrs} con fallo`
      : `${all.length} posiciones en ${addrCount} ${addrCount === 1 ? "dirección" : "direcciones"}`;
    renderAnalysisBanner(els.pfBanner, { errors: allErrors, summary });
  }

  // Los gráficos están en su propia pestaña "Gráficos". Solo (re)dibujar si está
  // activa (Chart.js no dibuja en contenedor oculto); si no, se pintan al entrar.
  if (state.tab === "graficos") renderPortfolioCharts();

  // ── Agrupación por pilar / wallet ──────────────────────────────────────────
  // El toggle y el resumen por pilar SOLO aparecen si alguna wallet tiene pilar
  // asignado; si no, se mantiene la vista de siempre (secciones por wallet).
  const hasAnyPillar = state.results.some((r) => pillarIdOfResult(r) != null);
  const groupBar = document.getElementById("pf-groupbar");
  const pillarSummary = document.getElementById("pf-pillar-summary");
  const groupBy = (state.prefs.ui && state.prefs.ui.groupBy) || "pillar";
  const byPillar = hasAnyPillar && groupBy !== "wallet";
  if (groupBar) groupBar.classList.toggle("hidden", !hasAnyPillar);
  if (hasAnyPillar) updateGroupByToggle(groupBy);
  if (pillarSummary) {
    if (byPillar) { pillarSummary.classList.remove("hidden"); renderPillarSummary(colorOf); }
    else pillarSummary.classList.add("hidden");
  }

  els.pfSections.innerHTML = "";
  if (byPillar) {
    // Grupos en el ORDEN de los pilares de la pestaña Pilares; "Sin pilar" al final.
    const pillars = (state.prefs.allocator && state.prefs.allocator.pillars) || [];
    for (const pid of [...pillars.map((p) => p.id), null]) {
      const group = state.results.filter((r) => pillarIdOfResult(r) === pid);
      if (group.length) els.pfSections.appendChild(buildPillarGroup(pid, group, colorOf));
    }
  } else {
    for (const r of state.results) els.pfSections.appendChild(buildWalletSection(r, colorOf));
  }
}

// Pilar (id) al que pertenece un resultado, según la asignación ACTUAL del
// portfolio (no un snapshot del análisis: así reagrupar es inmediato al cambiar
// el pilar de una wallet). Un id obsoleto (pilar borrado) → null = "Sin pilar".
function pillarIdOfResult(r) {
  const addr = (r.entry && r.entry.address || "").toLowerCase();
  const w = state.portfolio.find((p) => (p.address || "").toLowerCase() === addr);
  const pid = w && w.pillar;
  return pillarById(pid) ? pid : null;
}

// Distribución REAL de valor DeFi por pilar (Map<id|null, USD>) + total, según la
// asignación actual. Base de "real vs objetivo" (% real = valor pilar / total).
function pillarValueById() {
  const byId = new Map();
  for (const r of state.results) {
    const pid = pillarIdOfResult(r);
    const v = (r.items || []).reduce((s, it) => s + (it.valueUSD || 0), 0);
    byId.set(pid, (byId.get(pid) || 0) + v);
  }
  let total = 0; for (const v of byId.values()) total += v;
  return { byId, total };
}

// Construye la sección <details> de UNA wallet (marco único: cabecera + idle +
// cards abiertas + cerradas). Es la misma .pf-section de siempre → los
// inyectores de pro (active/*) la siguen encontrando, agrupada o no.
// grouped=true (dentro de un pilar): borde NEUTRO y sin margen propio — el color
// y la jerarquía los aporta el grupo (banner + raíl); el chip EVM/SOL mantiene la
// identidad del ecosistema.
function buildWalletSection(r, colorOf, grouped) {
  const items = r.items || [];
  const openItems = items.filter((it) => !it.closed);
  const closedItems = items.filter((it) => it.closed);
  const subVal = items.reduce((s, it) => s + (it.valueUSD || 0), 0);
  const subFees = items.reduce((s, it) => s + (it.feesPendingUSD || 0) + (it.feesUSD || 0), 0);
  const subIdle = (r.idleTokens || []).reduce((s, t) => s + (t.valueUSD || 0), 0);
  const isEvm = r.entry.type === "evm";
  const borderCls = isEvm ? "border-l-fuchsia-500" : "border-l-purple-500";
  const bgCls = isEvm ? "bg-fuchsia-500/[0.04]" : "bg-purple-500/[0.04]";
  const badgeCls = isEvm
    ? "bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30"
    : "bg-purple-500/15 text-purple-300 border border-purple-500/30";

  const section = document.createElement("details");
  section.open = true;
  section.className = grouped
    ? "pf-section rounded-lg border border-slate-800 bg-slate-950/30 overflow-hidden"
    : `pf-section rounded-xl border border-slate-800 border-l-4 ${borderCls} ${bgCls} mb-4 overflow-hidden`;
  // Dirección del wallet para que los inyectores de pro (active/*) localicen el
  // result por dirección y NO por índice DOM (que se rompe al agrupar por pilares).
  section.dataset.lpWallet = String(r.entry.address || "").toLowerCase();

  const head = document.createElement("summary");
  head.className = "px-4 py-3 cursor-pointer hover:brightness-110 select-none";
  head.innerHTML = `
    <div class="flex items-center gap-3 flex-wrap">
      <span class="pf-chev inline-block text-slate-400 transition-transform">▾</span>
      <span class="chip ${badgeCls} text-xs font-semibold">${isEvm ? "EVM" : "SOL"}</span>
      <h3 class="font-bold text-lg text-slate-100">${walletDisp(r.entry)}</h3>
      <span class="font-mono text-[11px] text-slate-500">${shortAddr(r.entry.address)}</span>
      <span class="flex-1"></span>
      <span class="text-sm text-slate-300 flex items-center gap-2 flex-wrap">
        <span><span class="font-semibold text-slate-100">${openItems.length}</span> pos${closedItems.length ? ` <span class="text-slate-500">· ${closedItems.length} cerr.</span>` : ""}</span>
        <span class="text-slate-600">·</span>
        <span class="font-semibold text-slate-100">${fmtUSD(subVal)}</span><span class="text-slate-500 text-[11px] ml-1">DeFi</span>${subIdle > 0 ? ` <span class="text-slate-600">+</span> <span class="font-semibold text-slate-100">${fmtUSD(subIdle)}</span><span class="text-slate-500 text-[11px] ml-1">idle</span>` : ""}
        <span class="text-slate-600">·</span>
        <span title="Suma de fees cobradas + fees pendientes de todas las posiciones del wallet">fees totales <span class="font-semibold text-emerald-400">${fmtUSD(subFees)}</span></span>${r.feesRealizableUSD != null ? ` <span class="text-slate-600">·</span> <span title="Valor REALIZABLE de las fees cobradas: lo que sigues teniendo idle a precio de HOY + lo vendido a USDC al precio del día del swap.">fees cobradas (valor actual) <span class="font-semibold text-cyan-300">${lpPriv() ? blurSpan(fmtUSD(r.feesRealizableUSD)) : fmtUSD(r.feesRealizableUSD)}</span></span>` : ""}</span>
    </div>`;
  section.appendChild(head);

  const body = document.createElement("div");
  body.className = "px-4 pb-4 pt-1";

  // 1) Tokens "idle" primero (cerrados por defecto).
  const idleBlock = idleTokensBlock(r.idleTokens || []);
  if (idleBlock) body.appendChild(idleBlock);

  // 2) Posiciones LP / lending ABIERTAS de la dirección
  if (openItems.length) {
    const grid = document.createElement("div");
    grid.className = "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3";
    const sorted = [...openItems].sort((a, b) => (b.valueUSD || 0) - (a.valueUSD || 0));
    for (const it of sorted) grid.appendChild(portfolioCard(it, colorOf.get(it)));
    body.appendChild(grid);
  } else {
    const empty = document.createElement("div");
    if (closedItems.length) {
      empty.className = "text-xs text-slate-500";
      empty.textContent = "Sin posiciones abiertas (ver cerradas abajo).";
    } else {
      const isErr = r.status && /no se pudo|inicia sesión|no está autoriz|límite|error de red|servicio no disponible|api key/i.test(r.status);
      empty.className = `text-xs ${isErr ? "text-amber-400" : "text-slate-500"}`;
      empty.textContent = r.status && r.status.trim() ? r.status : "Sin posiciones abiertas.";
    }
    body.appendChild(empty);
  }

  // 3) Posiciones CERRADAS (colapsadas; sus fees/estadística ya cuentan arriba).
  const closedBlock = closedPositionsBlock(closedItems, colorOf);
  if (closedBlock) body.appendChild(closedBlock);

  section.appendChild(body);
  return section;
}

// Grupo de un pilar: cabecera con el AGREGADO del pilar (valor, fees, IL, PnL,
// nº pos) + las secciones de sus wallets dentro. NO es .pf-section (para no
// confundir a los inyectores de pro); las wallets de dentro sí lo son.
function buildPillarGroup(pid, results, colorOf) {
  const pillar = pillarById(pid);
  const idx = pid ? (state.prefs.allocator.pillars || []).findIndex((p) => p.id === pid) : -1;
  const color = idx >= 0 ? pillarColor(idx) : "#64748b";
  const name = pillar ? pillar.name : "Sin pilar";
  const items = results.flatMap((r) => r.items || []);
  const idleUSD = results.flatMap((r) => r.idleTokens || []).reduce((s, t) => s + (t.valueUSD || 0), 0);
  const a = summarizeItems(items, { idleTotalUSD: idleUSD });

  const wrap = document.createElement("details");
  wrap.open = true;
  wrap.className = "pf-pillar-group rounded-xl border border-slate-800 mb-6 overflow-hidden";

  // Banner del pilar: fondo TEÑIDO con su color + borde izquierdo grueso + nombre
  // grande. color-mix funciona con hex o hsl (degrada a transparente si no hay
  // soporte). Da identidad fuerte al grupo, distinta de las wallets de dentro.
  const head = document.createElement("summary");
  head.className = "px-4 py-3 cursor-pointer hover:brightness-110 select-none";
  head.style.background = `color-mix(in srgb, ${color} 15%, transparent)`;
  head.style.borderLeft = `6px solid ${color}`;
  const ilTxt = a.ilN ? `<span class="${pnlColor(a.ilSum)} font-semibold">${fmtUSD(a.ilSum)}</span>` : `<span class="text-slate-500">—</span>`;
  const pnlTxt = a.pnlN ? `<span class="${pnlColor(a.pnlSum)} font-semibold">${fmtUSD(a.pnlSum)}</span>` : `<span class="text-slate-500">—</span>`;
  head.innerHTML = `
    <div class="flex items-center gap-3 flex-wrap">
      <span class="pf-chev inline-block text-slate-300 transition-transform">▾</span>
      <span class="w-3.5 h-3.5 rounded-full shrink-0" style="background:${color}"></span>
      <h3 class="font-bold text-xl text-slate-50">${escapeHtml(name)}</h3>
      <span class="text-[11px] text-slate-400">${results.length} ${results.length === 1 ? "wallet" : "wallets"} · ${a.count} pos</span>
      <span class="flex-1"></span>
      <span class="text-xs text-slate-300 flex items-center gap-3 flex-wrap">
        <span title="Valor DeFi del pilar${idleUSD > 0 ? " (+ idle)" : ""}"><span class="text-slate-400">valor</span> <span class="font-semibold text-slate-50">${fmtUSD(a.totalValue)}</span></span>
        <span title="Fees cobradas + pendientes"><span class="text-slate-400">fees</span> <span class="font-semibold text-emerald-400">${fmtUSD(a.totalFees)}</span></span>
        <span title="Impermanent loss agregado del pilar"><span class="text-slate-400">IL</span> ${ilTxt}</span>
        <span title="PnL agregado del pilar"><span class="text-slate-400">PnL</span> ${pnlTxt}</span>
      </span>
    </div>`;
  wrap.appendChild(head);

  const body = document.createElement("div");
  body.className = "px-3 pb-3 pt-3 bg-slate-950/20";
  // Raíl: las wallets cuelgan de una línea vertical del color del pilar (sangría)
  // → se lee claramente qué wallets/pools están dentro de cada pilar.
  const rail = document.createElement("div");
  rail.className = "space-y-3 ml-1";
  rail.style.borderLeft = `3px solid ${color}`;
  rail.style.paddingLeft = "14px";
  // Ordenar wallets del pilar por valor DeFi desc.
  const sorted = [...results].sort((r1, r2) =>
    (r2.items || []).reduce((s, it) => s + (it.valueUSD || 0), 0) -
    (r1.items || []).reduce((s, it) => s + (it.valueUSD || 0), 0));
  for (const r of sorted) rail.appendChild(buildWalletSection(r, colorOf, true));
  body.appendChild(rail);
  wrap.appendChild(body);
  return wrap;
}

// Tabla-resumen por pilar (valor · fees · IL · PnL · pos · % del total). Una fila
// por pilar CON wallets + "Sin pilar" si hay + Total. Reutiliza summarizeItems.
function renderPillarSummary(colorOf) {
  const box = document.getElementById("pf-pillar-summary");
  if (!box) return;
  const pillars = (state.prefs.allocator && state.prefs.allocator.pillars) || [];
  const rowsData = [];
  for (let i = 0; i < pillars.length; i++) {
    const pid = pillars[i].id;
    const group = state.results.filter((r) => pillarIdOfResult(r) === pid);
    if (group.length) rowsData.push({ name: pillars[i].name, color: pillarColor(i), group, target: pillars[i].pct });
  }
  const noPillar = state.results.filter((r) => pillarIdOfResult(r) === null);
  if (noPillar.length) rowsData.push({ name: "Sin pilar", color: "#64748b", group: noPillar, target: null });

  const totalValue = state.results.flatMap((r) => r.items || []).reduce((s, it) => s + (it.valueUSD || 0), 0);
  const ilCell = (a) => a.ilN ? `<span class="${pnlColor(a.ilSum)}">${fmtUSD(a.ilSum)}</span>` : `<span class="text-slate-600">—</span>`;
  const pnlCell = (a) => a.pnlN ? `<span class="${pnlColor(a.pnlSum)}">${fmtUSD(a.pnlSum)}</span>` : `<span class="text-slate-600">—</span>`;
  const fmtPct = (t) => (t % 1 ? t.toFixed(1) : t.toFixed(0));
  // Desviación real−objetivo en puntos porcentuales (verde si ≈ on-target, ámbar
  // si se aleja, rojo si mucho). Sin objetivo ("Sin pilar") → —.
  const devCell = (dev) => dev == null ? `<span class="text-slate-600">—</span>`
    : `<span class="${Math.abs(dev) < 2 ? "text-emerald-400" : Math.abs(dev) < 5 ? "text-amber-400" : "text-rose-400"}">${dev >= 0 ? "+" : ""}${dev.toFixed(1)}pp</span>`;
  const objCell = (t) => t == null ? `<span class="text-slate-600">—</span>` : `<span class="text-slate-400">${fmtPct(t)}%</span>`;

  const rows = rowsData.map((rd) => {
    const a = summarizeItems(rd.group.flatMap((r) => r.items || []));
    const realPct = totalValue > 0 ? (a.totalValue / totalValue) * 100 : 0;
    const dev = rd.target != null ? realPct - rd.target : null;
    return `<tr class="border-b border-slate-800/50">
      <td class="px-2 py-1.5"><span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full" style="background:${rd.color}"></span><span class="font-semibold text-slate-200">${escapeHtml(rd.name)}</span></span></td>
      <td class="px-2 py-1.5 text-right font-mono text-slate-100">${fmtUSD(a.totalValue)}</td>
      <td class="px-2 py-1.5 text-right font-mono text-emerald-400">${fmtUSD(a.totalFees)}</td>
      <td class="px-2 py-1.5 text-right font-mono">${ilCell(a)}</td>
      <td class="px-2 py-1.5 text-right font-mono">${pnlCell(a)}</td>
      <td class="px-2 py-1.5 text-right text-slate-300">${a.count}</td>
      <td class="px-2 py-1.5 text-right font-mono text-slate-100">${totalValue > 0 ? realPct.toFixed(1) + "%" : "—"}</td>
      <td class="px-2 py-1.5 text-right font-mono">${objCell(rd.target)}</td>
      <td class="px-2 py-1.5 text-right font-mono">${devCell(dev)}</td>
    </tr>`;
  }).join("");
  const tot = summarizeItems(state.results.flatMap((r) => r.items || []));

  box.innerHTML = `
    <div class="rounded-xl border border-slate-800 bg-slate-900 overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-800">
            <th class="text-left px-2 py-2">Pilar</th>
            <th class="text-right px-2 py-2">Valor</th>
            <th class="text-right px-2 py-2">Fees</th>
            <th class="text-right px-2 py-2">IL</th>
            <th class="text-right px-2 py-2">PnL</th>
            <th class="text-right px-2 py-2">Pos</th>
            <th class="text-right px-2 py-2" title="% del valor DeFi total del portfolio">% real</th>
            <th class="text-right px-2 py-2" title="Objetivo definido en el repartidor">Obj</th>
            <th class="text-right px-2 py-2" title="Desviación real − objetivo, en puntos porcentuales">Desv</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr class="border-t border-slate-700 font-semibold">
            <td class="px-2 py-2">Total</td>
            <td class="px-2 py-2 text-right font-mono text-slate-100">${fmtUSD(tot.totalValue)}</td>
            <td class="px-2 py-2 text-right font-mono text-emerald-400">${fmtUSD(tot.totalFees)}</td>
            <td class="px-2 py-2 text-right font-mono">${ilCell(tot)}</td>
            <td class="px-2 py-2 text-right font-mono">${pnlCell(tot)}</td>
            <td class="px-2 py-2 text-right text-slate-300">${tot.count}</td>
            <td class="px-2 py-2 text-right font-mono text-slate-400">100%</td>
            <td class="px-2 py-2 text-right font-mono text-slate-600">—</td>
            <td class="px-2 py-2 text-right font-mono text-slate-600">—</td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

// Estado visual del toggle "Agrupar por" + cableado (una vez).
function updateGroupByToggle(mode) {
  const bP = document.getElementById("pf-groupby-pillar");
  const bW = document.getElementById("pf-groupby-wallet");
  if (!bP || !bW) return;
  const on = "px-3 py-1 rounded-md font-semibold bg-[#ECE600] text-slate-900";
  const off = "px-3 py-1 rounded-md font-semibold text-slate-400 hover:text-slate-200";
  bP.className = mode !== "wallet" ? on : off;
  bW.className = mode === "wallet" ? on : off;
  if (!bP.dataset.wired) {
    bP.dataset.wired = bW.dataset.wired = "1";
    const set = (m) => { if (!state.prefs.ui) state.prefs.ui = {}; state.prefs.ui.groupBy = m; savePrefs(); renderPortfolio(); };
    bP.onclick = () => set("pillar");
    bW.onclick = () => set("wallet");
  }
}

// Render del bloque "🗃️ Posiciones cerradas" — colapsado por defecto. Agrupa las
// posiciones con liquidez retirada (closed) para que no estorben en la lista; sus
// fees cobradas y su estadística YA cuentan en los totales de arriba. Mismo lenguaje
// visual que el bloque idle (pf-section + chevron).
function closedPositionsBlock(items, colorOf) {
  if (!Array.isArray(items) || !items.length) return null;
  const totVal = items.reduce((s, it) => s + (it.valueUSD || 0), 0);
  const totFees = items.reduce((s, it) => s + (it.feesPendingUSD || 0) + (it.feesUSD || 0), 0);

  const wrap = document.createElement("details"); // colapsado por defecto (sin .open)
  wrap.className = "pf-section rounded-xl border border-slate-800 border-l-4 bg-slate-900/40 p-3 mb-4 text-sm";
  wrap.style.borderLeftColor = "#64748b"; // slate-500 — diferenciar del idle (marrón)
  const head = document.createElement("summary");
  head.className = "flex items-center gap-2 cursor-pointer select-none text-slate-300 flex-wrap hover:brightness-125 transition";
  head.innerHTML = `
    <span class="pf-chev inline-block text-slate-400 transition-transform">▾</span>
    <span class="text-base">🗃️</span>
    <span class="font-semibold">Posiciones cerradas</span>
    <span class="text-[11px] text-slate-500 hidden sm:inline">— liquidez retirada</span>
    <span class="flex-1"></span>
    <span class="text-slate-400 text-xs whitespace-nowrap">${items.length} · <span class="text-slate-100 font-semibold">${fmtUSD(totVal)}</span> · <span class="text-emerald-400 font-semibold">${fmtUSD(totFees)}</span> fees</span>
  `;
  wrap.appendChild(head);

  const grid = document.createElement("div");
  grid.className = "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mt-3";
  // Ordenadas por fees totales desc — el valor actual de una cerrada es ~0, lo que
  // interesa es cuánto rindió antes de cerrarla.
  const sorted = [...items].sort((a, b) =>
    ((b.feesUSD || 0) + (b.feesPendingUSD || 0)) - ((a.feesUSD || 0) + (a.feesPendingUSD || 0)));
  for (const it of sorted) grid.appendChild(portfolioCard(it, colorOf.get(it)));
  wrap.appendChild(grid);
  return wrap;
}

// Render del bloque "💼 Tokens en wallet (idle)" — colapsable, ordenado por valor
// USD descendente. Por defecto oculta SOLO los tokens con valor < $0.01 (1 céntimo)
// para esconder el polvo sin valor real, con un toggle para mostrarlos.
const IDLE_DUST_THRESHOLD = 0.01;
// Stablecoins → no indicador (son el destino del swap, no tiene sentido).
const IDLE_STABLE_SYMS = new Set(["USDC", "USDT", "DAI", "USDE", "FDUSD", "USDC.E", "USDBC", "TUSD", "USDS", "PYUSD", "USDT0", "USD₮0", "SUSDE", "GUSD", "LUSD", "FRAX", "MIM", "USDD"]);
function isStableSym(t) {
  const s = (t.symbol || "").toUpperCase();
  return IDLE_STABLE_SYMS.has(s) || s.startsWith("USD") || s.startsWith("EUR");
}

// Indicador "¿buen momento para pasar a USDC?" en cada token idle no-stable.
// Datos OBJETIVOS (no recomienda comprar/vender): precio actual vs. precio medio
// de ENTRADA (t.entryPx, del coste base) + termómetro del rango de 30d (t.range30d).
// Degradación por token: si falta la entrada se muestra solo el rango y viceversa.
// Incógnito: difumina los importes $ pero mantiene los % y el termómetro (sin $).
function idleIndicatorHTML(t) {
  if (!t || isStableSym(t) || isLikelyScamToken(t)) return "";
  const cur = (t.priceUSD != null && isFinite(t.priceUSD)) ? t.priceUSD : (t.balance ? (t.valueUSD || 0) / t.balance : null);
  const entry = (t.entryPx != null && isFinite(t.entryPx) && t.entryPx > 0) ? t.entryPx : null;
  const range = (t.range30d && t.range30d.max > t.range30d.min) ? t.range30d : null;
  if (!cur || (!entry && !range)) return "";
  const priv = lpPriv();
  const fmtPx = (n) => "$" + (n >= 1 ? n.toLocaleString("es-ES", { maximumFractionDigits: 2 }) : fmtTiny(n, 3));
  const px = (n) => (priv ? blurSpan(fmtPx(n)) : fmtPx(n));

  let badge = "";
  if (entry) {
    const d = (cur - entry) / entry * 100;
    const up = d >= 0;
    const cls = up ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-amber-500/15 text-amber-300 border-amber-500/30";
    badge = `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border whitespace-nowrap ${cls}" title="Precio actual frente a tu precio medio de entrada al aportar liquidez. Dato objetivo, no es una recomendación.">${up ? "▲ +" : "▼ "}${d.toFixed(1)}% vs entrada</span>`;
  }

  let bar = "", ctx = "";
  if (range) {
    const clamp = (x) => Math.max(0, Math.min(1, x));
    const pos = (v) => clamp((v - range.min) / (range.max - range.min)) * 100;
    const cp = pos(cur);
    const ep = entry ? pos(entry) : null;
    const curColor = (entry ? cur >= entry : true) ? "#34d399" : "#fbbf24";
    const entryTick = ep != null ? `<span class="absolute -top-0.5 w-px h-2.5 bg-slate-500" style="left:${ep.toFixed(1)}%"></span>` : "";
    bar = `<span class="relative inline-block w-32 shrink-0 h-1.5 rounded-full bg-slate-800 align-middle" title="Posición del precio actual dentro de su rango de 30 días (la marca fina es tu entrada).">${entryTick}<span class="absolute -top-1 w-1.5 h-3.5 rounded-sm" style="left:calc(${cp.toFixed(1)}% - 3px);background:${curColor}"></span></span>`;
    const f = cp / 100;
    ctx = f > 0.8 ? "cerca de máx 30d" : f < 0.2 ? "cerca de mín 30d" : "zona media 30d";
  }

  const detail = `ahora ${px(cur)}${entry ? ` · entró ${px(entry)}` : ""}${ctx ? ` · ${ctx}` : ""}`;
  return `<div data-idle-ind class="mt-1.5 basis-full order-last flex items-center gap-2 flex-wrap text-[10px] text-slate-500">${badge}${bar}<span class="whitespace-nowrap">${detail}</span></div>`;
}

function idleTokensBlock(tokens, opts = {}) {
  if (!Array.isArray(tokens) || !tokens.length) return null;
  const known = tokens.filter((t) => t.valueUSD != null);
  const dust = known.filter((t) => t.valueUSD < IDLE_DUST_THRESHOLD);
  const significant = known.filter((t) => t.valueUSD >= IDLE_DUST_THRESHOLD);
  const noPrice = tokens.filter((t) => t.valueUSD == null);
  const totalUSD = known.reduce((s, t) => s + (t.valueUSD || 0), 0);
  const totalSignificantUSD = significant.reduce((s, t) => s + (t.valueUSD || 0), 0);

  const wrap = document.createElement("details");
  if (opts.open) wrap.open = true;
  // Borde lateral marrón al estilo "maletín" 💼 (mismo lenguaje visual que el de las
  // cabeceras de dirección con border-l-4 de color).
  // `pf-section` reutiliza el CSS global (en index.html) que oculta el marcador
  // nativo del <summary> y rota el `▾` (.pf-chev) según el estado [open].
  wrap.className = "pf-section rounded-xl border border-slate-800 border-l-4 bg-slate-900/40 p-3 mb-4 text-sm";
  wrap.style.borderLeftColor = "#92604A";
  const head = document.createElement("summary");
  head.className = "flex items-center gap-2 cursor-pointer select-none text-slate-300 flex-wrap hover:brightness-125 transition";
  head.innerHTML = `
    <span class="pf-chev inline-block text-slate-400 transition-transform">▾</span>
    <span class="text-base">💼</span>
    <span class="font-semibold">Tokens en wallet (idle)</span>
    <span class="text-[11px] text-slate-500 hidden sm:inline">— fuera de LPs</span>
    <span class="flex-1"></span>
    <span class="text-slate-400 text-xs whitespace-nowrap">${significant.length}${dust.length ? ` <span class="text-slate-600">(+${dust.length} polvo)</span>` : ""} · <span class="text-slate-100 font-semibold">${fmtUSD(totalSignificantUSD)}</span></span>
  `;
  wrap.appendChild(head);

  const body = document.createElement("div");
  body.className = "mt-2 space-y-1 text-xs";
  const rowFor = (t) => {
    const valStr = t.valueUSD != null ? fmtUSD(t.valueUSD) : `<span class="text-slate-600">sin precio</span>`;
    const bal0 = t.balance >= 1 ? t.balance.toFixed(4) : fmtTiny(t.balance, 4);
    const bal = lpPriv() ? blurSpan(bal0) : bal0;
    const chainName = chainDisplayName(t.chain);
    const chainHex = venueColor(chainName) || "#94a3b8";
    const chip = chainName
      ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap" style="background:${chainHex}22;color:${chainHex};border:1px solid ${chainHex}44">${chainName}</span>`
      : "";
    // Icono → gráfico de precio. Read-only (solo abre un enlace externo) → vale en
    // [main]. Preferimos TRADINGVIEW: xStocks → acción subyacente (CRCLx→CRCL…);
    // nativos / cripto envuelta → par {SYM}USD; el resto de tokens on-chain →
    // DexScreener por dirección (TradingView no tiene esos tokens sueltos).
    const dexSlug = { solana: "solana", ethereum: "ethereum", arbitrum: "arbitrum", optimism: "optimism", polygon: "polygon", base: "base", bnb: "bsc", hyperevm: "hyperevm" }[t.chain];
    // Direcciones de nativos/envueltos por chain (SOL nativo llega como WSOL mint;
    // los nativos EVM como placeholder 0x0…0). Se mapean a su par {SYM}USD en TV.
    const WRAPPED_NATIVE = {
      solana: "So11111111111111111111111111111111111111112",
      ethereum: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      arbitrum: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
      optimism: "0x4200000000000000000000000000000000000006",
      base: "0x4200000000000000000000000000000000000006",
      polygon: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
      bnb: "0xbB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
      hyperevm: "0x5555555555555555555555555555555555555555",
    };
    const tvUrl = (s) => `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(s)}`;
    const xm = (t.symbol || "").match(/^([A-Za-z0-9]{1,8})x$/);
    const isXStock = !!(xm && /xstock|backed/i.test(t.name || ""));
    const nativeAddrs = new Set(Object.values(WRAPPED_NATIVE).map((a) => a.toLowerCase()));
    const isNativeCrypto = !t.address || /^0x0+$/i.test(t.address) || nativeAddrs.has((t.address || "").toLowerCase());
    let chartHref, chartLabel;
    if (isXStock) {
      const ticker = xm[1].toUpperCase();
      chartHref = tvUrl(ticker); chartLabel = `${ticker} en TradingView`;
    } else if (isNativeCrypto) {
      const base = (t.symbol || "").toUpperCase().replace(/^W(?=[A-Z])/, ""); // WETH→ETH, WSOL→SOL…
      chartHref = tvUrl(base + "USD"); chartLabel = `${base} en TradingView`;
    } else {
      chartHref = dexSlug ? `https://dexscreener.com/${dexSlug}/${t.address}` : `https://dexscreener.com/search?q=${encodeURIComponent(t.address || t.symbol || "")}`;
      chartLabel = "gráfico (DexScreener)";
    }
    const scam = isLikelyScamToken(t);
    // Insignia de aviso para tokens-estafa. Para ellos NO mostramos el icono de gráfico
    // (no enlazar a nada relacionado con un token malicioso).
    const scamBadge = scam ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/40 whitespace-nowrap mr-1 align-middle" title="Token sospechoso de estafa: el nombre lleva un enlace o el símbolo está falsificado. NO interactúes con él ni visites enlaces que aparezcan en su nombre.">⚠️ posible scam</span>` : "";
    const chartIcon = scam ? "" : `<a href="${chartHref}" target="_blank" rel="noopener noreferrer" title="Ver ${chartLabel}" aria-label="Ver ${chartLabel}" class="shrink-0 text-slate-500 hover:text-cyan-300 transition"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg></a>`;
    // Indicador "¿buen momento para pasar a USDC?" (vs entrada + rango 30d). "" si no hay datos.
    const ind = idleIndicatorHTML(t);
    // Dos layouts:
    //   - Desktop (sm+): una sola fila con 5 columnas alineadas
    //     [SYMBOL w-20] [CHAIN w-24] [NAME flex-1] [BALANCE w-28 derecha] [USD w-20 derecha]
    //   - Mobile (< sm): dos filas compactas porque ~432px de columnas no caben en 375px
    //     Fila 1: [SYMBOL] [chain]                            [USD]
    //     Fila 2: [name compacto]                             [BALANCE mono]
    return `
      <div class="bg-slate-950/40 rounded-md px-2 py-1.5">
        <!-- Desktop -->
        <div class="hidden sm:flex sm:items-center sm:gap-3">
          <span class="font-semibold text-slate-100 w-20 shrink-0 truncate">${t.symbol || "?"}</span>
          <div class="w-24 shrink-0">${chip}</div>
          <span class="text-slate-500 text-[11px] truncate flex-1">${scamBadge}${t.name || ""}</span>
          <span class="font-mono text-[11px] text-slate-400 w-28 shrink-0 text-right">${bal}</span>
          <span class="font-semibold text-slate-100 w-20 shrink-0 text-right">${valStr}</span>
          ${chartIcon}
        </div>
        <!-- Mobile -->
        <div class="sm:hidden">
          <div class="flex items-center gap-2">
            <span class="font-semibold text-slate-100 truncate min-w-0">${t.symbol || "?"}</span>
            <div class="shrink-0">${chip}</div>
            <span class="ml-auto font-semibold text-slate-100 shrink-0">${valStr}</span>
            ${chartIcon}
          </div>
          <div class="flex items-center justify-between gap-2 mt-0.5">
            <span class="text-slate-500 text-[10px] truncate min-w-0">${scamBadge}${t.name || ""}</span>
            <span class="font-mono text-[10px] text-slate-400 shrink-0">${bal}</span>
          </div>
        </div>
        ${ind}
      </div>`;
  };
  body.innerHTML = significant.map(rowFor).join("");
  // Sección "polvo" + sin precio, oculta por defecto bajo un toggle
  if (dust.length || noPrice.length) {
    const extra = document.createElement("div");
    extra.className = "mt-2 pt-2 border-t border-slate-800 space-y-1";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "text-[11px] text-slate-500 hover:text-slate-300";
    toggle.textContent = `▾ Mostrar ${dust.length + noPrice.length} tokens de bajo valor / sin precio`;
    const dustWrap = document.createElement("div");
    dustWrap.className = "hidden space-y-1 mt-2";
    dustWrap.innerHTML = [...dust, ...noPrice].map(rowFor).join("");
    toggle.onclick = () => {
      const hidden = dustWrap.classList.toggle("hidden");
      toggle.textContent = `${hidden ? "▾" : "▴"} ${hidden ? "Mostrar" : "Ocultar"} ${dust.length + noPrice.length} tokens de bajo valor / sin precio`;
    };
    extra.appendChild(toggle); extra.appendChild(dustWrap);
    body.appendChild(extra);
  }
  wrap.appendChild(body);
  return wrap;
}

function renderPortfolioCharts() {
  const open = (r) => (r.items || []); // las cerradas también cuentan en los gráficos
  // valor por dirección
  const byAddr = state.results
    .map((r) => ({ label: walletDisp(r.entry), value: open(r).reduce((s, it) => s + (it.valueUSD || 0), 0) }))
    .filter((x) => x.value > 0);
  // fees (cobradas + pendientes) por dirección
  const byFees = state.results
    .map((r) => ({ label: walletDisp(r.entry), value: open(r).reduce((s, it) => s + (it.feesUSD || 0) + (it.feesPendingUSD || 0), 0) }))
    .filter((x) => x.value > 0);

  // valor por PILAR (solo si hay asignaciones; usa los colores de cada pilar)
  const pillars = (state.prefs.allocator && state.prefs.allocator.pillars) || [];
  const pvm = pillarValueById();
  const byPillar = [];
  pillars.forEach((p, i) => { const v = pvm.byId.get(p.id) || 0; if (v > 0) byPillar.push({ label: p.name, value: v, color: pillarColor(i) }); });
  const sinV = pvm.byId.get(null) || 0;
  if (sinV > 0) byPillar.push({ label: "Sin pilar", value: sinV, color: "#64748b" });
  const pillarCard = document.getElementById("pf-chart-pillar-card");
  if (pillarCard) pillarCard.classList.toggle("hidden", byPillar.length === 0);

  els.pfCharts.classList.toggle("hidden", byAddr.length === 0);
  state._lastByAddr = byAddr;       // cache para alternar gráfico/tabla sin re-analizar
  applyAddrView();                  // pinta doughnut o tabla según preferencia
  drawDoughnut("fees", els.chartByFees, byFees);
  drawDoughnut("pillar", els.chartByPillar, byPillar, byPillar.map((d) => d.color));
  renderFeesTimelineChart();
  renderFeesTimelineTotalChart();
}

function renderFeesTimelineChart() {
  if (pfCharts.timeline) { pfCharts.timeline.destroy(); pfCharts.timeline = null; }
  els.pfFeesSummary.classList.add("hidden");
  // Recoger todas las series por posición de todas las direcciones
  const allSeries = state.results.flatMap((r) => r.timeline || []);
  els.pfFeesTimeline.classList.toggle("hidden", allSeries.length === 0);
  if (!allSeries.length || typeof Chart === "undefined") return;

  // Total cobrado por serie (último punto = acumulado final)
  const withTotals = allSeries.map((s) => ({
    series: s,
    total: s.points.length ? s.points[s.points.length - 1].feesUSD : 0,
  }));
  // Ordenar de mayor a menor para que la leyenda muestre primero las relevantes
  withTotals.sort((a, b) => b.total - a.total);

  // Umbral configurable: ocultar pools con menos de X$ cobrados
  const minThreshold = Math.max(0, Number(els.feesMinThreshold.value) || 0);
  const visible = withTotals.filter((x) => x.total >= minThreshold);
  const hiddenCount = withTotals.length - visible.length;

  // Mini-resumen: top pool + % del total, y nº de pools ocultas por umbral
  const grandTotal = withTotals.reduce((s, x) => s + x.total, 0);
  if (withTotals.length && grandTotal > 0) {
    const top = withTotals[0];
    const pct = (top.total / grandTotal) * 100;
    let html = `📈 <span class="text-slate-200 font-semibold">Pool top:</span> ${top.series.label} → <span class="text-emerald-300">${fmtUSD(top.total)}</span> <span class="text-slate-500">(${pct.toFixed(1)}% del total cobrado · ${fmtUSD(grandTotal)} en ${withTotals.length} ${withTotals.length === 1 ? "pool" : "pools"})</span>`;
    if (hiddenCount > 0) html += ` <span class="text-slate-500">· ${hiddenCount} ${hiddenCount === 1 ? "pool oculta" : "pools ocultas"} por umbral</span>`;
    els.pfFeesSummary.innerHTML = html;
    els.pfFeesSummary.classList.remove("hidden");
  }

  if (!visible.length) return; // todo filtrado por umbral

  const datasets = visible.map((x, i) => ({
    label: x.series.label,
    data: x.series.points.map((pt) => ({ x: pt.ts, y: pt.feesUSD })),
    borderColor: distinctColor(i),
    backgroundColor: "transparent",
    stepped: "after",      // honesto: cada Collect es un escalón, sin curva interpolada
    pointRadius: 0,
    borderWidth: 1.5,
  }));
  pfCharts.timeline = new Chart(els.chartFeesTimeline, {
    type: "line",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#cbd5e1", font: { size: 10 }, boxWidth: 12 } },
        tooltip: {
          mode: "index", intersect: false,
          callbacks: {
            title: (items) => items.length ? new Date(items[0].parsed.x).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "",
            label: (c) => `${c.dataset.label}: ${fmtUSD0(c.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          type: "linear",
          ticks: { color: "#94a3b8", maxTicksLimit: 8, callback: dateTick({ day: "numeric", month: "short" }) },
          grid: { color: "#1e293b" },
        },
        y: { ticks: { color: "#94a3b8", callback: (v) => fmtUSDc(v) }, grid: { color: "#1e293b" } },
      },
    },
  });
}

function renderFeesTimelineTotalChart() {
  if (pfCharts.timelineTotal) { pfCharts.timelineTotal.destroy(); pfCharts.timelineTotal = null; }
  // Agregar todas las series por posición en una sola curva total
  const allSeries = state.results.flatMap((r) => r.timeline || []);
  els.pfFeesTimelineTotal.classList.toggle("hidden", allSeries.length === 0);
  if (!allSeries.length || typeof Chart === "undefined") return;
  // Para cada ts conocido, sumar el valor más reciente de cada posición
  const events = allSeries.flatMap((s) => s.points.map((pt) => ({ ts: pt.ts, posId: s.posId, feesUSD: pt.feesUSD })));
  events.sort((a, b) => a.ts - b.ts);
  const current = new Map();
  const points = [];
  for (const ev of events) {
    current.set(ev.posId, ev.feesUSD);
    const total = [...current.values()].reduce((s, v) => s + v, 0);
    points.push({ x: ev.ts, y: total });
  }
  // Agrupar por día (último valor del día)
  const byDay = new Map();
  for (const pt of points) {
    const day = Math.floor(pt.x / 86400000) * 86400000;
    byDay.set(day, pt.y);
  }
  const data = [...byDay.entries()].map(([x, y]) => ({ x, y })).sort((a, b) => a.x - b.x);
  const lineOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: "#cbd5e1", font: { size: 10 } } },
      tooltip: {
        callbacks: {
          title: (items) => items.length ? new Date(items[0].parsed.x).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "",
          label: (c) => `Total: ${fmtUSD0(c.parsed.y)}`,
        },
      },
    },
    scales: {
      x: { type: "linear", ticks: { color: "#94a3b8", maxTicksLimit: 8, callback: dateTick({ day: "numeric", month: "short" }) }, grid: { color: "#1e293b" } },
      y: { ticks: { color: "#94a3b8", callback: (v) => fmtUSD0(v) }, grid: { color: "#1e293b" } },
    },
  };
  pfCharts.timelineTotal = new Chart(els.chartFeesTimelineTotal, {
    type: "line",
    data: { datasets: [{ label: "Total fees", data, borderColor: "#10b981", backgroundColor: "rgba(16,185,129,0.08)", fill: true, stepped: "after", pointRadius: 0, borderWidth: 2 }] },
    options: lineOptions,
  });
}

// Tabla alternativa al doughnut "Valor por dirección": MISMO orden (portfolio)
// y MISMOS colores que el gráfico (distinctColor por índice); columnas
// Dirección · % · Valor (al final) + fila Total.
function buildAddrTableHTML(byAddr) {
  if (!byAddr || !byAddr.length) return "";
  const total = byAddr.reduce((s, d) => s + d.value, 0);
  const rows = byAddr.map((d, i) => {
    const color = distinctColor(i); // mismo color que el segmento del doughnut
    const pct = total > 0 ? (d.value / total) * 100 : 0;
    return `<tr class="border-b border-slate-800/60">
      <td class="py-1.5"><span class="inline-flex items-center gap-2"><span class="w-2 h-2 rounded-full shrink-0" style="display:inline-block;width:9px;height:9px;border-radius:9999px;background:${color}"></span><span class="text-slate-200">${d.label}</span></span></td>
      <td class="py-1.5 pr-3 text-right font-mono text-slate-300 tabular-nums">${pct.toFixed(1)}%</td>
      <td class="py-1.5 text-right font-mono font-semibold text-slate-100">${fmtUSD(d.value)}</td>
    </tr>`;
  }).join("");
  return `<table class="w-full text-sm">
    <thead><tr class="text-[10px] uppercase tracking-wide text-slate-500 border-b border-slate-700">
      <th class="text-left pb-1.5 font-semibold">Dirección</th>
      <th class="text-right pb-1.5 pr-3 font-semibold">%</th>
      <th class="text-right pb-1.5 font-semibold">Valor</th>
    </tr></thead>
    <tbody>${rows}</tbody></table>`;
}

// Aplica la vista elegida (gráfico/tabla) al panel "Valor por dirección".
// Persiste en localStorage; usa state._lastByAddr (cacheado al renderizar) para
// poder alternar sin re-analizar.
function applyAddrView() {
  if (!els.addrChartWrap || !els.addrTableWrap) return;
  const isTable = localStorage.getItem("lp:addrView") === "table";
  els.addrChartWrap.classList.toggle("hidden", isTable);
  els.addrTableWrap.classList.toggle("hidden", !isTable);
  if (els.addrViewToggle) els.addrViewToggle.textContent = isTable ? "Gráfico" : "Tabla";
  const data = state._lastByAddr || [];
  if (isTable) els.addrTableWrap.innerHTML = buildAddrTableHTML(data);
  else drawDoughnut("addr", els.chartByAddress, data); // redibuja al volver a gráfico
}

function drawDoughnut(key, canvas, data, colorList) {
  if (!canvas || typeof Chart === "undefined") return;
  if (pfCharts[key]) { pfCharts[key].destroy(); pfCharts[key] = null; }
  if (!data.length) return;
  const total = data.reduce((s, d) => s + d.value, 0);
  const colors = colorList || data.map((_, i) => distinctColor(i));
  const extraPlugins = typeof ChartDataLabels !== "undefined" ? [ChartDataLabels] : [];
  pfCharts[key] = new Chart(canvas, {
    type: "doughnut",
    plugins: extraPlugins,
    data: { labels: data.map((d) => d.label), datasets: [{ data: data.map((d) => d.value), backgroundColor: colors, borderColor: "#0f172a", borderWidth: 2 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { color: "#cbd5e1", font: { size: 10 }, boxWidth: 12 } },
        tooltip: { callbacks: { label: (c) => `${c.label}: ${fmtUSD0(c.parsed)}` } },
        datalabels: {
          color: "#fff",
          font: { size: 10, weight: "bold" },
          formatter: (value) => {
            if (lpPriv()) return "";                 // incógnito: sin etiquetas $ en el donut (la forma/proporción ya se ve)
            const pct = total > 0 ? (value / total * 100) : 0;
            return pct < 4 ? "" : fmtUSDc(value);   // ocultar etiqueta si el segmento es muy pequeño
          },
          textShadowColor: "rgba(0,0,0,0.6)",
          textShadowBlur: 4,
        },
      },
    },
  });
}

// Barra gráfica de rango para las fichas del portfolio.
function rangeBarHTML(tickLower, tickUpper, tickCur, dec0, dec1, inRange, closed) {
  if (tickLower == null || tickUpper == null || !isFinite(tickLower) || !isFinite(tickUpper)) return "";
  const decAdj = Math.pow(10, (Number(dec0) || 0) - (Number(dec1) || 0));
  const priceAt = (t) => Math.pow(1.0001, Number(t)) * decAdj;
  const pLow = priceAt(tickLower), pHigh = priceAt(tickUpper);
  const pCur = (tickCur != null && isFinite(tickCur)) ? priceAt(tickCur) : null;
  if (!isFinite(pLow) || !isFinite(pHigh) || pHigh <= pLow) return "";
  const span = pHigh - pLow;
  let vMin = pLow - span * 0.5, vMax = pHigh + span * 0.5;
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

function portfolioCard(it, color) {
  // Si el motor envió la ficha completa (misma que en Quick), úsala tal cual
  // para que Portfolio y Quick sean idénticas. Solo sobrescribimos el borde con
  // el color global distintivo. En modo incógnito, la disposición es IDÉNTICA:
  // solo se enmascaran los importes en $ del HTML (maskMoneyHTML).
  if (it.cardHTML) {
    const tpl = document.createElement("template");
    tpl.innerHTML = maskMoneyHTML(it.cardHTML).trim();
    const node = tpl.content.firstElementChild;
    if (node) { if (color) node.style.borderLeft = `3px solid ${color}`; return node; }
  }
  // Respaldo: ficha simple anterior (por si faltara cardHTML)
  const el = document.createElement("article");
  el.className = "rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-2";
  el.style.borderLeft = `3px solid ${color}`;
  const rangeChip = it.lending
    ? `<span class="chip bg-sky-500/15 text-sky-300 border border-sky-500/30">préstamo</span>`
    : it.closed
      ? `<span class="chip bg-slate-700 text-slate-300">cerrada</span>`
      : it.inRange
        ? `<span class="chip bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">en rango</span>`
        : `<span class="chip bg-amber-500/15 text-amber-300 border border-amber-500/30">fuera</span>`;
  // APR de fees (anual, %): NO es un importe → se muestra también en incógnito.
  // Va DENTRO de la columna "Fees" (bajo cobradas/pendientes), como en la ficha
  // completa del motor.
  const aprLine = (typeof it.apr === "number" && isFinite(it.apr))
    ? `<div class="text-[10px] text-slate-400 pt-0.5">APR ~ <span class="text-slate-200 font-semibold">${it.apr.toFixed(1)}%</span> · MPR ~ <span class="text-slate-200 font-semibold">${(it.apr / 12).toFixed(2)}%</span></div>`
    : "";
  let feesLine;
  if (it.lending) {
    feesLine = `<div class="text-emerald-400 font-semibold">${fmtUSD(it.feesUSD)} <span class="text-[10px] font-normal text-slate-400">ganado</span></div>` + aprLine;
  } else {
    const hasCollected = (it.kind === "evm" || (it.kind === "sol" && it.pnlUSD != null));
    const pendStr = it.feesPendingUSD == null ? "n/d" : fmtUSD(it.feesPendingUSD);
    const collectedLine = hasCollected
      ? `<div class="text-emerald-400 font-semibold leading-tight">${fmtUSD(it.feesUSD || 0)} <span class="text-[10px] font-normal text-slate-400">cobradas</span></div>`
      : "";
    const pendingLine = `<div class="text-amber-300 font-semibold leading-tight">${pendStr} <span class="text-[10px] font-normal text-slate-400">pendientes</span></div>`;
    feesLine = collectedLine + pendingLine + aprLine;
  }
  const showPnl = !it.lending && (it.kind === "evm" || (it.kind === "sol" && it.pnlUSD != null));
  const evmExtra = showPnl
    ? `<div class="grid grid-cols-2 gap-2 text-xs pt-1">
         <div><div class="text-[10px] uppercase text-slate-500">IL <span class="cursor-help" title="IL vs HODL: valor del LP frente a mantener los tokens depositados. Estimación; no incluye gas.">ⓘ</span></div><div class="${pnlColor(it.ilUSD)}">${it.ilUSD == null ? "—" : fmtUSD(it.ilUSD)}</div></div>
         <div><div class="text-[10px] uppercase text-slate-500">PnL <span class="cursor-help" title="PnL neto = valor actual + retirado + fees − depositado. Estimación; NO incluye gas. En Solana, fees/retiros por heurística.">ⓘ</span></div><div class="${pnlColor(it.pnlUSD)}">${it.pnlUSD == null ? "—" : fmtUSD(it.pnlUSD)}</div></div>
       </div>`
    : "";
  el.innerHTML = `
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full" style="background:${color}"></span>
          <span class="text-[11px] uppercase tracking-wide text-slate-400">${it.venue}</span>
        </div>
        <div class="font-semibold mt-0.5 truncate">${it.pair}</div>
      </div>
      ${rangeChip}
    </div>
    ${it.lending ? "" : rangeBarHTML(it.tickLower, it.tickUpper, it.tick, it.dec0, it.dec1, it.inRange, it.closed)}
    <div class="grid grid-cols-2 gap-2 text-xs">
      <div><div class="text-[10px] uppercase text-slate-500">Valor</div><div class="font-semibold">${fmtUSD(it.valueUSD)}</div></div>
      <div><div class="text-[10px] uppercase text-slate-500">Fees</div>${feesLine}</div>
    </div>
    ${evmExtra}`;
  return el;
}

// ============================================================================
// Firebase setup modal
// ============================================================================

function openFbSetup() {
  els.fbSetup.classList.remove("hidden");
  const cfg = getStoredFbConfig();
  if (cfg) els.fbInput.value = JSON.stringify(cfg, null, 2);
}

async function saveFbConfig() {
  els.fbErr.classList.add("hidden");
  let cfg;
  try {
    const raw = els.fbInput.value.trim();
    // Accept both JSON and JS object literal (keys without quotes)
    cfg = JSON.parse(raw);
  } catch {
    try {
      const raw = els.fbInput.value.trim()
        .replace(/^\s*const\s+\w+\s*=\s*/, "").replace(/;?\s*$/, "")
        .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3')
        .replace(/'/g, '"');
      cfg = JSON.parse(raw);
    } catch (e) {
      els.fbErr.textContent = "Formato no válido. Pega el objeto firebaseConfig de Firebase Console.";
      els.fbErr.classList.remove("hidden"); return;
    }
  }
  if (!cfg.apiKey || !cfg.projectId || !cfg.authDomain) {
    els.fbErr.textContent = "Faltan campos (apiKey, authDomain, projectId)."; els.fbErr.classList.remove("hidden"); return;
  }
  localStorage.setItem("lp:firebaseConfig", JSON.stringify(cfg));
  try {
    await initFirebase(cfg);
    els.fbSetup.classList.add("hidden");
  } catch (e) {
    els.fbErr.textContent = `Error al iniciar Firebase: ${e.message}`; els.fbErr.classList.remove("hidden");
  }
}

// ============================================================================
// Mensajes desde los iframes
// ============================================================================

window.addEventListener("message", (e) => {
  const d = e.data || {};
  if (d.type === "lp-ready" && (d.app === "evm" || d.app === "sol")) {
    state.ready[d.app] = true;
    pushTokenToEngines(); // dar al engine recién listo el token actual (si hay sesión)
    if (crypto_.key) pushKeysToEngines(); // y las API keys descifradas, si ya las tenemos
  } else if (d.type === "lp-result" && pendingReqs.has(d.reqId)) {
    const resolve = pendingReqs.get(d.reqId);
    pendingReqs.delete(d.reqId);
    resolve({ address: d.address, items: d.items || [], status: d.status, app: d.app, timeline: d.timeline || [], analysisStatus: d.analysisStatus || null, idleTokens: d.idleTokens || [], feesRealizableUSD: d.feesRealizableUSD != null ? d.feesRealizableUSD : null });
  } else if (d.type === "lp-analyze-done") {
    // el engine terminó el análisis de Quick → cerrar el modal de progreso
    clearTimeout(_quickModalTimer);
    closeAnalyzingModal();
    _autoBusy = false; // liberar el guard de auto-actualización
    spinRefresh(false);
    setLastUpdated();
  } else if (d.type === "lp-summary" && (d.app === "evm" || d.app === "sol")) {
    // El engine ha pintado su Quick → renderizamos el mismo resumen aquí encima
    // del iframe, con la misma plantilla que el Portfolio (consistencia garantizada).
    renderQuickSummary(d.items || [], d.idleTokens || []);
    renderQuickIdleTokens(d.idleTokens || []);
    // Banner verde/rojo con el resultado del análisis (errores por chain/protocolo)
    const status = d.analysisStatus || {};
    const items = d.items || [];
    const lpN = items.filter((it) => !it.lending).length;
    const lendN = items.length - lpN;
    const summary = items.length
      ? `${items.length} posiciones${lendN ? ` (${lpN} LP + ${lendN} lending)` : ""} en ${d.app === "evm" ? "EVM" : "Solana"}`
      : `Sin posiciones en ${d.app === "evm" ? "las redes seleccionadas" : "los protocolos activos"}`;
    renderAnalysisBanner(els.quickBanner, { errors: status.errors || [], summary });
  }
});

// ============================================================================
// Histórico real: capital aportado vs valor acumulado en el tiempo
// ============================================================================

// Construye dos curvas diarias agregadas a partir de los timelines de las posiciones.
// timeline por posición: [{ posId, points: [{ ts(ms), feesUSD, depositedUSD, withdrawnUSD }] }]
function buildHistoricalCurves() {
  const allSeries = state.results.flatMap((r) => r.timeline || []);
  if (!allSeries.length) return null;
  const timed = allSeries.filter((s) => !s.flat && s.points && s.points.length);
  const flat = allSeries.filter((s) => s.flat && s.points && s.points.length);

  // Constante aportada por las series "planas" (Solana: sin histórico → valor actual)
  let flatDep = 0, flatFees = 0;
  for (const s of flat) { const pt = s.points[s.points.length - 1]; flatDep += pt.depositedUSD || 0; flatFees += pt.feesUSD || 0; }

  // eventos de las series temporales (último estado conocido por posición)
  const events = [];
  for (const s of timed) for (const pt of s.points) events.push({ ts: pt.ts, posId: s.posId, fees: pt.feesUSD || 0, dep: pt.depositedUSD || 0 });
  events.sort((a, b) => a.ts - b.ts);

  let days, aportadoByDay = new Map(), valorByDay = new Map();
  if (events.length) {
    const lastFees = new Map(), lastDep = new Map();
    for (const ev of events) {
      lastFees.set(ev.posId, ev.fees);
      lastDep.set(ev.posId, ev.dep);
      const aportado = [...lastDep.values()].reduce((s, v) => s + v, 0) + flatDep;
      const fees = [...lastFees.values()].reduce((s, v) => s + v, 0) + flatFees;
      const day = Math.floor(ev.ts / 86400000) * 86400000;
      aportadoByDay.set(day, aportado);
      valorByDay.set(day, aportado + fees);
    }
    days = [...aportadoByDay.keys()].sort((a, b) => a - b);
  } else if (flat.length) {
    // solo series planas: dibujamos una línea constante de ~30 días
    const today = Math.floor(Date.now() / 86400000) * 86400000;
    days = [today - 30 * 86400000, today];
    for (const d of days) { aportadoByDay.set(d, flatDep); valorByDay.set(d, flatDep + flatFees); }
  } else {
    return null;
  }

  const aportado = days.map((d) => ({ x: d, y: aportadoByDay.get(d) }));
  const valor = days.map((d) => ({ x: d, y: valorByDay.get(d) }));
  const lastAportado = aportado[aportado.length - 1]?.y || 0;
  const lastValor = valor[valor.length - 1]?.y || 0;
  return { aportado, valor, lastAportado, lastValor, ganado: lastValor - lastAportado, hasFlat: flat.length > 0 };
}

// Construye una serie temporal agregada del portfolio en el shape estándar
// `timelineSeries` ([{ ts, depositedUSD, withdrawnUSD, feesUSD }]) sumando los
// últimos valores conocidos de TODAS las posiciones en cada timestamp único.
// Usada por `computeMonthlyAPRs` para sacar el APR mensual del portfolio.
function aggregatedPortfolioTimeline() {
  const allSeries = state.results.flatMap((r) => r.timeline || []);
  const timed = allSeries.filter((s) => !s.flat && s.points && s.points.length);
  const flat = allSeries.filter((s) => s.flat && s.points && s.points.length);
  if (!timed.length) return [];

  // Capital y fees de las series "planas" (Solana sin histórico temporal:
  // Jupiter Lend, RWA sin Birdeye). No tienen evolución en el tiempo, así que
  // las tratamos como una base CONSTANTE presente en todo el periodo —
  // exactamente igual que buildHistoricalCurves para que el capital de la
  // tabla cuadre con el gráfico de arriba. (Aproximación: asume que esas
  // posiciones existían durante todos los meses mostrados; sin fecha de
  // apertura no podemos hacerlo mejor.)
  // Solo sumamos su CAPITAL al denominador. Sus "fees" (interés de lending)
  // no tienen distribución temporal conocida — atribuirlas a un mes concreto
  // sería arbitrario, así que se omiten del numerador mensual.
  let flatDep = 0;
  for (const s of flat) {
    const pt = s.points[s.points.length - 1];
    flatDep += Math.max(0, (pt.depositedUSD || 0) - (pt.withdrawnUSD || 0));
  }

  // Eventos de las series temporales ordenados cronológicamente.
  const events = [];
  for (const s of timed) {
    for (const pt of s.points) {
      events.push({
        ts: pt.ts,
        posId: s.posId || s.label,
        dep: pt.depositedUSD || 0,
        wd: pt.withdrawnUSD || 0,
        fees: pt.feesUSD || 0,
      });
    }
  }
  events.sort((a, b) => a.ts - b.ts);
  // Para cada evento, mantenemos el último estado conocido por posición y
  // emitimos un snapshot agregado (sumando dep/wd/fees de todas + base flat).
  const lastDep = new Map(), lastWd = new Map(), lastFees = new Map();
  const byDay = new Map();
  for (const ev of events) {
    lastDep.set(ev.posId, ev.dep);
    lastWd.set(ev.posId, ev.wd);
    lastFees.set(ev.posId, ev.fees);
    const day = Math.floor(ev.ts / 86400000) * 86400000;
    const sum = (m) => [...m.values()].reduce((s, v) => s + v, 0);
    byDay.set(day, {
      ts: day,
      // depositedUSD aquí es ya neto (dep - wd) por posición; sumamos la base
      // flat de Solana. withdrawnUSD se deja en 0 porque ya está descontado.
      depositedUSD: sum(lastDep) - sum(lastWd) + flatDep,
      withdrawnUSD: 0,
      feesUSD: sum(lastFees),
    });
  }
  return [...byDay.values()].sort((a, b) => a.ts - b.ts);
}

function renderHistorico() {
  if (typeof Chart === "undefined" || !els.chartProjection) return;
  const curves = buildHistoricalCurves();
  if (!curves) {
    els.histEmpty.classList.remove("hidden");
    els.histContent.classList.add("hidden");
    if (pfCharts.projection) { pfCharts.projection.destroy(); pfCharts.projection = null; }
    return;
  }
  els.histEmpty.classList.add("hidden");
  els.histContent.classList.remove("hidden");
  els.histAportado.innerHTML = fmtUSD(curves.lastAportado);
  els.histValor.innerHTML = fmtUSD(curves.lastValor);
  els.histGanado.innerHTML = fmtUSD(curves.ganado);
  // Sub de "Ganado (fees)": solo fees pendientes (las cobradas ya están en el
  // valor principal — mostrarlas sería redundante). Pendientes = fees aún
  // on-chain no reclamadas, mismo cómputo que el resumen global de Portfolio.
  const allOpen = state.results.flatMap((r) => r.items || []);
  const feesPending = allOpen.reduce((s, it) => s + (it.feesPendingUSD || 0), 0);
  if (els.histGanadoSub) {
    els.histGanadoSub.innerHTML = `<span class="text-amber-300 font-semibold">${fmtUSD(feesPending)}</span> pendientes`;
  }

  // PnL e IL agregados a partir de las posiciones analizadas (incluye variación de precio).
  // Solo cuentan las posiciones que aportan el dato (EVM siempre; Solana solo con Birdeye key).
  const items = state.results.flatMap((r) => r.items || []).filter((it) => !it.lending);
  let pnlSum = 0, pnlN = 0, ilSum = 0, ilN = 0, valSum = 0;
  for (const it of items) {
    valSum += it.valueUSD || 0;
    if (it.pnlUSD != null && isFinite(it.pnlUSD)) { pnlSum += it.pnlUSD; pnlN++; }
    if (it.ilUSD != null && isFinite(it.ilUSD)) { ilSum += it.ilUSD; ilN++; }
  }
  const totalLP = items.length;
  const pctOf = (x) => (valSum > 0 ? ` (${x >= 0 ? "+" : ""}${((x / valSum) * 100).toFixed(2)}%)` : "");
  els.histPnl.innerHTML = pnlN ? fmtUSD(pnlSum) + pctOf(pnlSum) : "—";
  els.histPnl.className = "text-xl font-bold mt-1 " + (pnlN ? pnlColor(pnlSum) : "");
  els.histPnlSub.textContent = pnlN ? `${pnlN}/${totalLP} posiciones con dato` : "requiere histórico (EVM / Birdeye en Solana)";
  els.histIl.innerHTML = ilN ? fmtUSD(ilSum) + pctOf(ilSum) : "—";
  els.histIl.className = "text-xl font-bold mt-1 " + (ilN ? pnlColor(ilSum) : "");
  els.histIlSub.textContent = ilN ? `${ilN}/${totalLP} posiciones con dato` : "requiere histórico (EVM / Birdeye en Solana)";

  // "Valor real hoy" = suma de valueUSD de todas las posiciones DeFi abiertas
  // (LP + lending). Mismo scope que la curva (no incluye idle tokens), pero a
  // precios actuales. Visualiza el gap por variación de precio (lo que la curva
  // "aportado + fees" no captura).
  const realNowUSD = state.results
    .flatMap((r) => r.items || [])
    .reduce((s, it) => s + (it.valueUSD || 0), 0);
  const lastTs = curves.valor[curves.valor.length - 1]?.x ?? Date.now();
  // Línea horizontal del mismo span x que la curva, con marcador en el extremo.
  const realLine = curves.valor.map((p, i) => ({ x: p.x, y: realNowUSD }));
  const lastIdx = realLine.length - 1;

  const gap = realNowUSD - curves.lastValor;
  const gapPct = curves.lastValor > 0 ? (gap / curves.lastValor) * 100 : 0;
  const gapTxt = gap >= 0
    ? `(+${fmtUSD(gap).replace("$", "$")} ≈ +${gapPct.toFixed(2)}% por variación de precio)`
    : `(${fmtUSD(gap)} ≈ ${gapPct.toFixed(2)}% por variación de precio)`;
  els.histNote.innerHTML = `La curva = aportado + fees (eventos on-chain EVM/HyperEVM/lending y transacciones Solana). La línea ámbar "Valor real hoy" muestra el valor actual de las posiciones a precios de mercado ${gapTxt}. PnL e IL del resumen también incluyen variación de precio, calculados por posición.`;

  const datasets = [
    { label: "Capital aportado", data: curves.aportado, borderColor: "#94a3b8", borderDash: [5, 4], pointRadius: 2, borderWidth: 1.5, stepped: "after" },
    { label: "Valor acumulado (aportado + fees)", data: curves.valor, borderColor: "#34d399", backgroundColor: "rgba(52,211,153,0.12)", pointRadius: 2, borderWidth: 2.5, fill: true, stepped: "after" },
    {
      label: "Valor real hoy (con variación de precio)",
      data: realLine,
      borderColor: "#fbbf24",
      backgroundColor: "rgba(251,191,36,0.05)",
      borderDash: [3, 6],
      borderWidth: 1.5,
      pointRadius: (ctx) => (ctx.dataIndex === lastIdx ? 6 : 0),
      pointHoverRadius: (ctx) => (ctx.dataIndex === lastIdx ? 8 : 0),
      pointStyle: "rectRot",
      pointBackgroundColor: "#fbbf24",
      pointBorderColor: "#fbbf24",
      fill: false,
    },
  ];
  // formato del eje según el rango: pocas semanas → "día mes"; meses/años → "mes año"
  const xs = curves.valor.map((p) => p.x);
  const spanDays = xs.length ? (Math.max(...xs) - Math.min(...xs)) / 86400000 : 0;
  const xFmt = spanDays > 120 ? { month: "short", year: "2-digit" } : { day: "numeric", month: "short" };
  if (pfCharts.projection) { pfCharts.projection.destroy(); pfCharts.projection = null; }
  pfCharts.projection = new Chart(els.chartProjection, {
    type: "line",
    data: { datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#cbd5e1", font: { size: 10 } } },
        tooltip: {
          callbacks: {
            title: (items) => items.length ? new Date(items[0].parsed.x).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "",
            label: (c) => `${c.dataset.label}: ${fmtUSD0(c.parsed.y)}`,
          },
        },
      },
      scales: {
        x: { type: "linear", ticks: { color: "#94a3b8", maxTicksLimit: 8, callback: dateTick(xFmt) }, grid: { color: "#1e293b" } },
        y: { ticks: { color: "#94a3b8", callback: (v) => fmtUSDc(v) }, grid: { color: "#1e293b" } },
      },
    },
  });

  // Tabla "APR por mes natural" — agregado del portfolio, con cada mes
  // desplegable para ver el desglose POR POOL de ese mes. La mini-tabla que
  // antes vivía en cada card se eliminó: el detalle por pool vive solo aquí.
  if (els.histMonthlyAprPanel && els.histMonthlyApr) {
    installMonthlyAprToggle(); // listener delegado (idempotente)
    const monthlyRows = computeMonthlyAPRs(aggregatedPortfolioTimeline());
    // Solo meses con fees efectivamente cobradas: un mes sin cobros tiene
    // APR 0% trivial y solo añade ruido (ej. el mes en que empezaste a abrir
    // posiciones pero aún no habías cobrado nada).
    const positiveRows = monthlyRows.filter((r) => r.feesUSD > 0);
    els.histMonthlyAprPanel.classList.remove("hidden");
    if (positiveRows.length) {
      // Desglose por pool: para cada serie temporal (no "flat"), calculamos su
      // propio APR mensual y lo agrupamos por mes. El color/venue del pool se
      // resuelve cruzando posId/label con los items analizados.
      const venueByPosId = new Map(), venueByLabel = new Map();
      for (const r of state.results) {
        for (const it of (r.items || [])) {
          if (it.id) venueByPosId.set(String(it.id), it.venue || "");
          if (it.pair) venueByLabel.set(it.pair, it.venue || "");
        }
      }
      const poolsByMonth = new Map(); // monthKey -> [{label, venue, color, feesUSD, capitalAvg, apr}]
      for (const s of state.results.flatMap((r) => r.timeline || [])) {
        if (s.flat || !s.points || !s.points.length) continue; // flat = sin distribución mensual
        const venue = venueByPosId.get(String(s.posId)) || venueByLabel.get(s.label) || "";
        const color = venueColor(venue) || venueColor(s.label) || "#64748b";
        for (const m of computeMonthlyAPRs(s.points)) {
          // Muestra el pool si tuvo CAPITAL real ese mes (> $1), tenga o no fees cobradas:
          // así se ven TODAS las posiciones activas cada mes (incl. recién abiertas con $0 fees),
          // y se siguen ocultando los meses fantasma de posiciones ya CERRADAS (capital ~0).
          if (!(m.capitalAvg > 1)) continue;
          if (!poolsByMonth.has(m.monthKey)) poolsByMonth.set(m.monthKey, []);
          poolsByMonth.get(m.monthKey).push({ label: s.label, venue, color, feesUSD: m.feesUSD, capitalAvg: m.capitalAvg, apr: m.apr });
        }
      }
      els.histMonthlyApr.innerHTML = monthlyAprByMonthHTML(positiveRows, poolsByMonth, { limit: 24 });
    } else {
      // Caso típico: las fees están reflejadas como "pendientes" (no se han
      // ejecutado collect() reales), así que el delta de fees cobradas entre
      // snapshots es 0. La tabla necesita fees efectivamente cobradas para
      // calcular el APR realizado de cada mes.
      els.histMonthlyApr.innerHTML = `<div class="text-xs text-slate-400 py-2">Aún no hay fees <strong>cobradas</strong> repartidas por meses. El APR mensual se calcula sobre fees efectivamente cobradas (no las pendientes). Aparecerá en cuanto cobres fees o el histórico registre cobros pasados.</div>`;
    }
  }
}

// ============================================================================
// Eventos
// ============================================================================

els.tabBtnPortfolio.onclick = () => setTab("portfolio");
els.tabBtnQuick.onclick = () => setTab("quick");
els.tabBtnProjection.onclick = () => setTab("projection");
if (els.tabBtnAllocator) els.tabBtnAllocator.onclick = () => setTab("allocator");
if (els.tabBtnGraficos) els.tabBtnGraficos.onclick = () => setTab("graficos");

els.go.onclick = quickAnalyze;
els.addr.addEventListener("keydown", (e) => { if (e.key === "Enter") quickAnalyze(); });
els.addr.addEventListener("input", () => { const t = detectType(els.addr.value.trim()); if (t && t !== state.mode) setMode(t); });
els.modeEvm.onclick = () => setMode("evm");
els.modeSol.onclick = () => setMode("sol");
// Settings unificados: modal en el shell con las 3 API keys (Graph / Helius /
// Birdeye). Se persisten CIFRADAS en Firestore (mismo AES-GCM + clave PBKDF2
// que el portfolio) → multi-dispositivo y nunca legibles por el servidor.
// En memoria viven en _apiKeys; el blob cifrado pendiente, en _pendingApiKeysEnc.
let _apiKeys = { graph: "", helius: "", birdeye: "", etherscan: "" };
let _pendingApiKeysEnc = null;

function pushKeysToEngines() {
  const k = _apiKeys || {};
  const msgEvm = { type: "lp-apply-keys", app: "evm", graph: k.graph || "", etherscan: k.etherscan || "" };
  const msgSol = { type: "lp-apply-keys", app: "sol", helius: k.helius || "", birdeye: k.birdeye || "" };
  if (els.frameEvm?.contentWindow) els.frameEvm.contentWindow.postMessage(msgEvm, "*");
  if (els.frameSol?.contentWindow) els.frameSol.contentWindow.postMessage(msgSol, "*");
}

// Descifrar las API keys con la clave del usuario (la misma que descifra el portfolio).
// Si no hay blob cifrado y hay datos antiguos en localStorage, migra a Firestore.
async function tryDecryptApiKeys(key) {
  if (!_pendingApiKeysEnc) {
    _apiKeys = { graph: "", helius: "", birdeye: "", etherscan: "" };
    // Migración desde la versión anterior que guardaba en localStorage
    try {
      const legacy = JSON.parse(localStorage.getItem("lp:apiKeys") || "null");
      if (legacy && (legacy.graph || legacy.helius || legacy.birdeye)) {
        _apiKeys = { graph: legacy.graph || "", helius: legacy.helius || "", birdeye: legacy.birdeye || "", etherscan: legacy.etherscan || "" };
        await saveApiKeysToFirestore(_apiKeys, key).catch((e) => console.warn("migrate apiKeys:", e));
        localStorage.removeItem("lp:apiKeys");
      }
    } catch (e) {}
    return true;
  }
  try {
    const dec = await decryptJSON(_pendingApiKeysEnc, key);
    _apiKeys = {
      graph: typeof dec?.graph === "string" ? dec.graph : "",
      helius: typeof dec?.helius === "string" ? dec.helius : "",
      birdeye: typeof dec?.birdeye === "string" ? dec.birdeye : "",
      etherscan: typeof dec?.etherscan === "string" ? dec.etherscan : "",
    };
    return true;
  } catch { _apiKeys = { graph: "", helius: "", birdeye: "", etherscan: "" }; return false; }
}

async function saveApiKeysToFirestore(keys, key) {
  if (!state.user || !fb.db || !key) return;
  const enc = await encryptJSON(keys, key);
  const ref = fb.fsMod.doc(fb.db, "users", state.user.uid);
  await fb.fsMod.setDoc(ref, { apiKeysEnc: enc }, { merge: true });
  _pendingApiKeysEnc = enc;
}

// Pinta debajo de cada input si esa key está en uso ("tu key personal") o si
// pasa por el proxy compartido. Se llama al abrir el modal, al teclear y tras
// guardar — el usuario ve al instante por qué camino van sus peticiones.
function updateApiKeyStatusIndicators() {
  const set = (id, hasKey) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (hasKey) {
      el.className = "text-[10px] mt-1 text-emerald-400";
      el.textContent = "✓ Usando tu key personal (sin pasar por el proxy)";
    } else {
      el.className = "text-[10px] mt-1 text-slate-500";
      el.textContent = "🌐 Sin key → usa el proxy compartido";
    }
  };
  set("set-graph-status",   !!(els.setGraphKey.value || "").trim());
  set("set-helius-status",  !!(els.setHeliusKey.value || "").trim());
  set("set-birdeye-status", !!(els.setBirdeyeKey.value || "").trim());
  if (els.setEtherscanKey) set("set-etherscan-status", !!(els.setEtherscanKey.value || "").trim());
}

function openSettingsModal() {
  if (!crypto_.key) {
    setPfStatus("Desbloquea tu portfolio primero para gestionar tus API keys.", "err");
    return;
  }
  els.setGraphKey.value = _apiKeys.graph || "";
  els.setHeliusKey.value = _apiKeys.helius || "";
  els.setBirdeyeKey.value = _apiKeys.birdeye || "";
  if (els.setEtherscanKey) els.setEtherscanKey.value = _apiKeys.etherscan || "";
  updateApiKeyStatusIndicators();
  els.settingsStatus.classList.add("hidden");
  els.settingsModal.classList.remove("hidden");
  setTimeout(() => els.setGraphKey.focus(), 50);
}
function closeSettingsModal() { els.settingsModal.classList.add("hidden"); }
async function saveSettingsModal() {
  if (!crypto_.key) { setPfStatus("Desbloquea tu portfolio primero.", "err"); return; }
  const keys = {
    graph: (els.setGraphKey.value || "").trim(),
    helius: (els.setHeliusKey.value || "").trim(),
    birdeye: (els.setBirdeyeKey.value || "").trim(),
    etherscan: (els.setEtherscanKey?.value || "").trim(),
  };
  els.settingsStatus.className = "text-[11px] text-slate-300";
  els.settingsStatus.textContent = "Guardando…";
  els.settingsStatus.classList.remove("hidden");
  try {
    await saveApiKeysToFirestore(keys, crypto_.key);
    _apiKeys = keys;
    pushKeysToEngines();
    els.settingsStatus.className = "text-[11px] text-emerald-400";
    els.settingsStatus.textContent = "Guardado y cifrado en Firestore. Se aplicarán al siguiente análisis.";
    setTimeout(closeSettingsModal, 1100);
  } catch (e) {
    console.error("saveApiKeys", e);
    els.settingsStatus.className = "text-[11px] text-rose-400";
    els.settingsStatus.textContent = `No se pudo guardar: ${e.message}`;
  }
}
// "Probar mis keys": hace una petición real al provider con la key escrita en el
// campo (NO usa el proxy). Sirve para descartar typos y confirmar que el provider
// la acepta. Si el campo está vacío, deja un mensaje neutro indicando que esa
// API tirará del proxy compartido.
async function testGraphKey(k) {
  const url = `https://gateway.thegraph.com/api/${k}/subgraphs/id/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV`;
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "{ _meta { block { number } } }" }) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  if (j.errors) throw new Error(j.errors[0]?.message || "error gql");
  return j.data?._meta?.block?.number ? `bloque ${j.data._meta.block.number}` : "ok";
}
async function testHeliusKey(k) {
  const r = await fetch(`https://mainnet.helius-rpc.com/?api-key=${k}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSlot" }) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "error rpc");
  return j.result ? `slot ${j.result}` : "ok";
}
async function testBirdeyeKey(k) {
  const r = await fetch("https://public-api.birdeye.so/defi/price?address=So11111111111111111111111111111111111111112", { headers: { "accept": "application/json", "X-API-KEY": k, "x-chain": "solana" } });
  if (r.status === 401 || r.status === 403) throw new Error(`HTTP ${r.status} (key inválida / sin permisos)`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  if (j.success === false) throw new Error(j.message || "rechazada");
  return j.data?.value ? `SOL=$${j.data.value.toFixed(2)}` : "ok";
}
async function testEtherscanKey(k) {
  const r = await fetch(`https://api.etherscan.io/v2/api?chainid=1&module=stats&action=ethprice&apikey=${k}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  if (String(j.status) !== "1") throw new Error(j.result || j.message || "rechazada");
  return j.result?.ethusd ? `ETH=$${Number(j.result.ethusd).toFixed(0)}` : "ok";
}
async function runApiKeyTests() {
  const tests = [
    { id: "set-graph-status",   key: els.setGraphKey.value.trim(),   label: "The Graph", fn: testGraphKey },
    { id: "set-helius-status",  key: els.setHeliusKey.value.trim(),  label: "Helius",    fn: testHeliusKey },
    { id: "set-birdeye-status", key: els.setBirdeyeKey.value.trim(), label: "Birdeye",   fn: testBirdeyeKey },
    { id: "set-etherscan-status", key: (els.setEtherscanKey?.value || "").trim(), label: "Etherscan", fn: testEtherscanKey },
  ];
  // Marcar todos como "probando"
  for (const t of tests) {
    const el = document.getElementById(t.id); if (!el) continue;
    if (!t.key) { el.className = "text-[10px] mt-1 text-slate-500"; el.textContent = "🌐 Sin key → usa el proxy compartido"; continue; }
    el.className = "text-[10px] mt-1 text-slate-300"; el.textContent = "⏳ Probando…";
  }
  // Lanzar en paralelo solo las que tienen key
  await Promise.all(tests.map(async (t) => {
    if (!t.key) return;
    const el = document.getElementById(t.id); if (!el) return;
    try {
      const detail = await t.fn(t.key);
      el.className = "text-[10px] mt-1 text-emerald-400";
      el.textContent = `✓ ${t.label} responde con tu key (${detail})`;
    } catch (e) {
      el.className = "text-[10px] mt-1 text-rose-400";
      el.textContent = `✗ ${t.label} rechazó tu key: ${e.message}`;
    }
  }));
}

els.settingsOpen.onclick = openSettingsModal;
els.settingsClose.onclick = closeSettingsModal;
els.settingsCancel.onclick = closeSettingsModal;
els.settingsSave.onclick = saveSettingsModal;
els.settingsTest.onclick = runApiKeyTests;
els.settingsModal.addEventListener("click", (e) => { if (e.target === els.settingsModal) closeSettingsModal(); });
// Indicador en vivo: al teclear en cualquier campo, refrescar los badges.
for (const id of ["set-graph-key", "set-helius-key", "set-birdeye-key", "set-etherscan-key"]) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("input", updateApiKeyStatusIndicators);
}

els.loginBtn.onclick = signInWithGoogle;
els.quickLoginBtn.onclick = signInWithGoogle;
els.pfCtaBtn.onclick = () => analyzeAll();
if (els.openFbSetup) els.openFbSetup.onclick = openFbSetup;
els.fbSave.onclick = saveFbConfig;
els.encSubmit.onclick = handleEncSubmit;
els.encCancel.onclick = () => closeEncModal(null);
els.encPass.addEventListener("keydown", (e) => { if (e.key === "Enter") handleEncSubmit(); });
els.encPass2.addEventListener("keydown", (e) => { if (e.key === "Enter") handleEncSubmit(); });
els.changePass.onclick = () => {
  if (!crypto_.key) { setPfStatus("Desbloquea tu portfolio primero.", "err"); return; }
  openEncModal("change");
};
els.encForgot.onclick = handleForgotPassword;
els.deleteAccount.onclick = handleDeleteAccount;
els.manageAccess.onclick = openAccessModal;
els.accessClose.onclick = closeAccessModal;
els.accessAdd.onclick = addAllowEmail;
els.accessEmail.addEventListener("keydown", (e) => { if (e.key === "Enter") addAllowEmail(); });
els.accessModal.addEventListener("click", (e) => { if (e.target === els.accessModal) closeAccessModal(); });
els.pfAdd.onclick = addPortfolioEntry;
els.pfAddress.addEventListener("keydown", (e) => { if (e.key === "Enter") addPortfolioEntry(); });
els.analyzeAll.onclick = () => analyzeAll();
els.pfCsv.onclick = exportPortfolioCSV;
els.autoRefresh.onchange = applyAutoRefresh;
els.refreshNow.onclick = refreshActiveTab;
els.pfManageToggle.onclick = togglePfManage;
if (els.privacyToggle) els.privacyToggle.onclick = togglePrivacy;
updatePrivacyBtn();
if (els.addrViewToggle) els.addrViewToggle.onclick = () => {
  localStorage.setItem("lp:addrView", localStorage.getItem("lp:addrView") === "table" ? "chart" : "table");
  applyAddrView();
};
els.feesMinThreshold.addEventListener("input", () => {
  localStorage.setItem("lp:feesMinThreshold", String(els.feesMinThreshold.value || 0));
  renderFeesTimelineChart();
});
// restaurar umbral guardado
{ const v = localStorage.getItem("lp:feesMinThreshold"); if (v !== null) els.feesMinThreshold.value = v; }

// ============================================================================
// Init
// ============================================================================

// Tooltips por toque (móvil): muestra el title de los ⓘ al pulsar.
// Event delegation: switching de tabs en los accordions de "📜 logs" de las
// cards EVM. Los botones tienen `data-tab-btn="<id>"` + `data-uid="<unique>"`;
// los paneles correspondientes llevan `data-tab-panel="<id>"` con el mismo
// uid. Hacemos delegación a nivel de document para que sobreviva el round-trip
// de postMessage (cardHTML → template.innerHTML pierde onclick inline).
//
// Esta función VIVE en shell.js (no en common.js) porque el shell NO carga
// common.js, solo los iframes. Las cards re-instanciadas viven en el DOM del
// shell, así que el handler debe estar aquí también. common.js tiene el suyo
// análogo para Quick mode (cards en el iframe).
// Switch de denominación del precio del rango (sym0|sym1) en las cards. Sólo
// show/hide de HTML pre-renderizado (rangeBarHTML pinta ambas orientaciones).
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

function setupTabDelegation(doc) {
  doc.addEventListener("click", (e) => {
    const rq = e.target && e.target.closest ? e.target.closest("[data-range-quote]") : null;
    if (rq) { toggleRangeQuote(doc, rq); return; }
    const btn = e.target && e.target.closest ? e.target.closest("[data-tab-btn]") : null;
    if (!btn) return;
    const uid = btn.dataset.uid;
    const tab = btn.dataset.tabBtn;
    if (!uid || !tab) return;
    doc.querySelectorAll(`[data-tab-btn][data-uid="${uid}"]`).forEach((b) => {
      const isActive = b.dataset.tabBtn === tab;
      b.classList.toggle("border-emerald-400", isActive);
      b.classList.toggle("text-emerald-300", isActive);
      b.classList.toggle("font-semibold", isActive);
      b.classList.toggle("border-transparent", !isActive);
      b.classList.toggle("text-slate-400", !isActive);
    });
    doc.querySelectorAll(`[data-tab-panel][data-uid="${uid}"]`).forEach((p) => {
      p.classList.toggle("hidden", p.dataset.tabPanel !== tab);
    });
  });
}

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

(function init() {
  // Cargar los iframes con la versión única (cache-busting propagado a los motores)
  const V = window.APP_VERSION || "0";
  if (els.frameEvm && !els.frameEvm.src) els.frameEvm.src = els.frameEvm.dataset.src + "?v=" + V;
  if (els.frameSol && !els.frameSol.src) els.frameSol.src = els.frameSol.dataset.src + "?v=" + V;
  // Etiqueta de versión en la cabecera (útil al depurar que la versión cargada
  // es la última publicada — antes había que mirar View Source).
  const verEl = document.getElementById("app-version");
  if (verEl) verEl.textContent = "v" + V;

  // Registrar el Service Worker (mínimo, sin caché) → marca la PWA como instalable
  // en Chrome. Fallos silenciosos (HTTP local sin HTTPS, navegadores muy viejos…).
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((e) => console.warn("SW register:", e));
    });
  }

  setupTipTaps(document);
  setupTabDelegation(document); // tabs de los accordions "📜 logs" en las cards
  setTab("quick"); // por defecto, análisis de una dirección (como hasta ahora)
  setMode(state.mode);
  renderAuthArea();
  renderPortfolioList();
  renderPrefs();

  // intervalo de auto-actualización: el guardado, o 15 min por defecto.
  // Migración v2: forzar 15 min en todos los usuarios (incluidos los que tenían el
  // 5 min del default antiguo). Solo se aplica una vez; si después el usuario lo
  // cambia voluntariamente, su elección se respeta. Bump del número para reaplicar.
  const AUTO_REFRESH_MIGRATION = "2";
  if (localStorage.getItem("lp:autoRefreshMigration") !== AUTO_REFRESH_MIGRATION) {
    localStorage.setItem("lp:autoRefresh", "900000");
    localStorage.setItem("lp:autoRefreshMigration", AUTO_REFRESH_MIGRATION);
  }
  els.autoRefresh.value = localStorage.getItem("lp:autoRefresh") || "900000";
  applyAutoRefresh();

  // Config guardada por el usuario (override avanzado) o la embebida por defecto.
  const cfg = getStoredFbConfig() || DEFAULT_FB_CONFIG;
  if (cfg) {
    initFirebase(cfg).catch((e) => {
      console.error("initFirebase", e);
      setPfStatus(`Error al conectar Firebase: ${e.message}. Revisa la config.`, "err");
    });
  }
})();
