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
  tabBtnPortfolio: $("tab-btn-portfolio"), tabBtnQuick: $("tab-btn-quick"), tabBtnProjection: $("tab-btn-projection"),
  tabPortfolio: $("tab-portfolio"), tabQuick: $("tab-quick"), tabProjection: $("tab-projection"),
  authArea: $("auth-area"),
  // firebase setup
  fbSetup: $("fb-setup"), fbInput: $("fb-config-input"), fbErr: $("fb-config-err"), fbSave: $("fb-config-save"),
  openFbSetup: $("open-fb-setup"),
  // login
  loginGate: $("login-gate"), loginBtn: $("login-btn"), portfolioArea: $("portfolio-area"),
  // portfolio crud
  pfLabel: $("pf-label"), pfAddress: $("pf-address"), pfAdd: $("pf-add"), pfAddErr: $("pf-add-err"),
  pfList: $("pf-list"), analyzeAll: $("analyze-all"), pfStatus: $("pf-status"),
  addRabby: $("add-rabby"), addPhantom: $("add-phantom"),
  // portfolio results
  pfSummary: $("pf-summary"), gValue: $("g-value"), gFees: $("g-fees"), gFeesSub: $("g-fees-sub"),
  gPositions: $("g-positions"), gPositionsSub: $("g-positions-sub"), gAddresses: $("g-addresses"),
  pfSections: $("pf-sections"),
  pfCharts: $("pf-charts"), chartByAddress: $("chart-by-address"), chartByVenue: $("chart-by-venue"), chartByFees: $("chart-by-fees"),
  pfFeesTimeline: $("pf-fees-timeline"), chartFeesTimeline: $("chart-fees-timeline"),
  pfFeesTimelineTotal: $("pf-fees-timeline-total"), chartFeesTimelineTotal: $("chart-fees-timeline-total"),
  prefChains: $("pref-chains"), prefProtocols: $("pref-protocols"),
  // quick
  modeEvm: $("mode-evm"), modeSol: $("mode-sol"), addr: $("addr"), go: $("go"),
  wallet: $("wallet"), settings: $("settings"), hint: $("hint"),
  frameEvm: $("frame-evm"), frameSol: $("frame-sol"),
  // histórico
  histEmpty: $("hist-empty"), histContent: $("hist-content"),
  histAportado: $("hist-aportado"), histValor: $("hist-valor"), histGanado: $("hist-ganado"),
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

const ADMIN_EMAIL = "jrodzar@gmail.com";

const state = {
  tab: "portfolio",
  mode: localStorage.getItem("lp:lastMode") || "evm",
  ready: { evm: false, sol: false },
  wallet: { evm: null, sol: null },
  user: null,
  portfolio: [],          // [{ address, type, label }]
  prefs: structuredClone(DEFAULT_PREFS),
  results: [],            // [{ entry, items, status }]
};

const fb = { app: null, auth: null, db: null, authMod: null, fsMod: null };
const pendingReqs = new Map(); // reqId -> resolve
const pendingWalletAdd = { evm: false, sol: false }; // añadir al portfolio tras conectar
let pfCharts = { addr: null, venue: null, fees: null, timeline: null, timelineTotal: null, projection: null };

// ============================================================================
// Helpers
// ============================================================================

function detectType(addr) {
  if (RE_EVM.test(addr)) return "evm";
  if (RE_SOL.test(addr)) return "sol";
  return null;
}
function shortAddr(a) {
  if (!a) return "";
  return a.startsWith("0x") ? `${a.slice(0, 6)}…${a.slice(-4)}` : `${a.slice(0, 4)}…${a.slice(-4)}`;
}
function fmtUSD(n) {
  if (n == null || !isFinite(n)) return "—";
  const abs = Math.abs(n), s = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${s}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${s}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${s}$${(abs / 1e3).toFixed(2)}k`;
  if (abs >= 1) return `${s}$${abs.toFixed(2)}`;
  if (abs === 0) return "$0";
  if (abs >= 0.01) return `${s}$${abs.toFixed(4)}`;
  return `${s}$${abs.toExponential(2)}`;
}
function pnlColor(n) { if (!isFinite(n)) return "text-slate-400"; return n > 0 ? "text-emerald-400" : n < 0 ? "text-rose-400" : "text-slate-300"; }
function distinctColor(i) { const h = Math.round((i * 137.508) % 360); return `hsl(${h} 70% 60%)`; }

// ============================================================================
// Tabs
// ============================================================================

function setTab(tab) {
  state.tab = tab;
  const active = "seg px-3 py-1.5 text-xs rounded-md font-semibold bg-slate-950 text-white shadow";
  const idle = "seg px-3 py-1.5 text-xs rounded-md font-semibold text-slate-400 hover:text-slate-200";
  els.tabBtnPortfolio.className = tab === "portfolio" ? active : idle;
  els.tabBtnQuick.className = tab === "quick" ? active : idle;
  els.tabBtnProjection.className = tab === "projection" ? active : idle;
  els.tabPortfolio.classList.toggle("hidden", tab !== "portfolio");
  els.tabQuick.classList.toggle("hidden", tab !== "quick");
  els.tabProjection.classList.toggle("hidden", tab !== "projection");
  if (tab === "projection") renderHistorico();
}

// ============================================================================
// Quick mode (single address -> iframe visible)
// ============================================================================

function setMode(mode) {
  state.mode = mode;
  localStorage.setItem("lp:lastMode", mode);
  const active = "seg px-3 py-1.5 text-xs rounded-md font-semibold bg-slate-950 text-white shadow";
  const idle = "seg px-3 py-1.5 text-xs rounded-md font-semibold text-slate-400 hover:text-slate-200";
  els.modeEvm.className = mode === "evm" ? active : idle;
  els.modeSol.className = mode === "sol" ? active : idle;
  els.frameEvm.classList.toggle("hidden", mode !== "evm");
  els.frameSol.classList.toggle("hidden", mode !== "sol");
  renderWalletButton();
}

function showHint(msg, kind) {
  if (!msg) { els.hint.classList.add("hidden"); return; }
  els.hint.classList.remove("hidden");
  els.hint.className = `text-[11px] mb-2 ${kind === "err" ? "text-rose-400" : "text-slate-400"}`;
  els.hint.textContent = msg;
}

function activeFrame() { return state.mode === "evm" ? els.frameEvm : els.frameSol; }
function postToActive(m) { const f = activeFrame(); if (f && f.contentWindow) f.contentWindow.postMessage(m, "*"); }

function quickAnalyze() {
  const addr = els.addr.value.trim();
  if (!addr) { showHint("Pega una dirección primero.", "err"); return; }
  const t = detectType(addr);
  if (!t) { showHint("Formato no reconocido (EVM 0x… o Solana base58).", "err"); return; }
  if (t !== state.mode) setMode(t);
  showHint(`Detectado: ${t === "evm" ? "EVM" : "Solana"}. Analizando…`);
  const send = () => postToActive({ type: "lp-analyze", address: addr });
  if (state.ready[state.mode]) send(); else setTimeout(send, 800);
}

function renderWalletButton() {
  const connected = state.wallet[state.mode];
  els.wallet.classList.remove("hidden");
  if (connected) {
    els.wallet.innerHTML = `<span class="text-emerald-400">●</span> ${shortAddr(connected)} <span class="text-slate-500 ml-1">✕</span>`;
  } else {
    els.wallet.textContent = state.mode === "evm" ? "🔗 Conectar Rabby" : "👻 Conectar Phantom";
  }
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

async function signInWithGoogle() {
  if (!fb.auth) { openFbSetup(); return; }
  try {
    const provider = new fb.authMod.GoogleAuthProvider();
    await fb.authMod.signInWithPopup(fb.auth, provider);
  } catch (e) {
    console.error(e);
    setPfStatus(`Error de login: ${e.message}`, "err");
  }
}

async function signOutUser() {
  if (fb.auth) await fb.authMod.signOut(fb.auth);
}

async function onAuthChange(user) {
  state.user = user || null;
  renderAuthArea();
  if (user) {
    els.loginGate.classList.add("hidden");
    els.portfolioArea.classList.remove("hidden");
    setTab("portfolio"); // al loguear, ir al portfolio
    await loadPortfolio(user.uid);
    renderPortfolioList();
    renderPrefs();
    pushPrefsToEngines();
  } else {
    els.loginGate.classList.remove("hidden");
    els.portfolioArea.classList.add("hidden");
    state.portfolio = [];
    setTab("quick"); // sin sesión, la app funciona como antes (una dirección)
  }
}

function renderAuthArea() {
  const isAdmin = state.user?.email === ADMIN_EMAIL;
  els.settings.classList.toggle("hidden", !isAdmin);
  els.authArea.innerHTML = "";
  if (state.user) {
    const wrap = document.createElement("div");
    wrap.className = "flex items-center gap-2";
    wrap.innerHTML = `
      <span class="text-xs text-slate-300 hidden sm:inline">${state.user.email || "cuenta"}</span>
      <button id="signout-btn" class="px-2.5 py-1.5 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700">Salir</button>`;
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

// ---- Firestore portfolio ----
async function loadPortfolio(uid) {
  try {
    const ref = fb.fsMod.doc(fb.db, "users", uid);
    const snap = await fb.fsMod.getDoc(ref);
    const data = snap.exists() ? snap.data() : {};
    state.portfolio = Array.isArray(data.portfolio) ? data.portfolio : [];
    state.prefs = {
      chains: Array.isArray(data.prefs?.chains) ? data.prefs.chains : DEFAULT_PREFS.chains.slice(),
      protocols: Array.isArray(data.prefs?.protocols) ? data.prefs.protocols : DEFAULT_PREFS.protocols.slice(),
    };
    // Migración v1: HyperEVM activado por defecto (una sola vez para cuentas existentes)
    if (Number(data.prefsVersion || 0) < 1) {
      if (!state.prefs.chains.includes("hyperevm")) state.prefs.chains.push("hyperevm");
      await fb.fsMod.setDoc(ref, { prefs: state.prefs, prefsVersion: 1 }, { merge: true }).catch(() => {});
    }
  } catch (e) {
    console.error("loadPortfolio", e);
    setPfStatus(`No se pudo cargar el portfolio: ${e.message}`, "err");
    state.portfolio = [];
    state.prefs = structuredClone(DEFAULT_PREFS);
  }
}
async function savePortfolio() {
  if (!state.user || !fb.db) return;
  try {
    const ref = fb.fsMod.doc(fb.db, "users", state.user.uid);
    await fb.fsMod.setDoc(ref, { email: state.user.email, portfolio: state.portfolio }, { merge: true });
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
  state.portfolio.push({ address, type, label });
  els.pfAddress.value = ""; els.pfLabel.value = "";
  renderPortfolioList();
  savePortfolio();
}

function removePortfolioEntry(address) {
  state.portfolio = state.portfolio.filter((p) => p.address !== address);
  renderPortfolioList();
  savePortfolio();
}

function renamePortfolioEntry(address) {
  const entry = state.portfolio.find((p) => p.address === address);
  if (!entry) return;
  const input = prompt(`Nuevo nombre para ${shortAddr(address)}:`, entry.label || "");
  if (input === null) return;
  entry.label = input.trim();
  renderPortfolioList();
  savePortfolio();
}

// Añadir la wallet conectada (Rabby EVM / Phantom SOL) al portfolio.
// Siempre re-solicita la dirección activa para soportar cambio de cuenta en la wallet.
function addConnectedWallet(type) {
  pendingWalletAdd[type] = true;
  const frame = type === "evm" ? els.frameEvm : els.frameSol;
  frame.contentWindow.postMessage({ type: "lp-connect-wallet" }, "*");
  if (!state.wallet[type]) setPfStatus(`Abriendo ${type === "evm" ? "Rabby/MetaMask" : "Phantom"} para conectar…`);
}

function addWalletAddress(type) {
  const address = state.wallet[type];
  if (!address) { setPfStatus(`No hay wallet ${type === "evm" ? "EVM" : "Solana"} conectada.`, "err"); return; }
  if (state.portfolio.some((p) => p.address.toLowerCase() === address.toLowerCase())) {
    setPfStatus("Esa wallet ya está en el portfolio.", "err"); return;
  }
  const defaultLabel = type === "evm" ? "Rabby" : "Phantom";
  const input = prompt(`Nombre para esta dirección (${shortAddr(address)}):`, defaultLabel);
  if (input === null) return; // usuario canceló
  const label = input.trim() || defaultLabel;
  state.portfolio.push({ address, type, label });
  renderPortfolioList();
  savePortfolio();
  setPfStatus(`Añadida ${shortAddr(address)} al portfolio.`, "ok");
}

function renderPortfolioList() {
  els.pfList.innerHTML = "";
  if (!state.portfolio.length) {
    els.pfList.innerHTML = `<div class="text-xs text-slate-500">Aún no hay direcciones. Añade una arriba.</div>`;
    return;
  }
  for (const p of state.portfolio) {
    const row = document.createElement("div");
    row.className = "flex items-center gap-2 text-sm bg-slate-950/40 rounded-lg px-3 py-2";
    const badge = p.type === "evm"
      ? `<span class="chip bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30">EVM</span>`
      : `<span class="chip bg-purple-500/15 text-purple-300 border border-purple-500/30">SOL</span>`;
    row.innerHTML = `
      ${badge}
      ${p.label ? `<span class="font-semibold">${p.label}</span>` : ""}
      <span class="font-mono text-xs text-slate-400 truncate">${shortAddr(p.address)}</span>
      <button data-copy="${p.address}" title="Copiar dirección" class="text-slate-500 hover:text-emerald-400 flex-shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </button>
      <span class="flex-1"></span>
      <button data-rename="${p.address}" title="Renombrar" class="text-xs text-slate-500 hover:text-sky-400">✎</button>
      <button data-rm="${p.address}" class="text-xs text-slate-500 hover:text-rose-400">✕</button>`;
    els.pfList.appendChild(row);
  }
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
      btn.className = `chip border ${active ? "border-purple-500 bg-purple-500/15 text-purple-200" : "border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700"}`;
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

// ============================================================================
// Portfolio analysis (orquesta los engines en headless, secuencial)
// ============================================================================

function analyzeAddressHeadless(address, type) {
  return new Promise((resolve) => {
    const reqId = "r" + Math.random().toString(36).slice(2);
    pendingReqs.set(reqId, resolve);
    const frame = type === "evm" ? els.frameEvm : els.frameSol;
    const send = () => {
      // fijar redes/protocolos según prefs antes de analizar (entrega ordenada por target)
      if (type === "evm") frame.contentWindow.postMessage({ type: "lp-set-chains", chains: state.prefs.chains }, "*");
      else frame.contentWindow.postMessage({ type: "lp-set-protocols", protocols: state.prefs.protocols }, "*");
      frame.contentWindow.postMessage({ type: "lp-portfolio-analyze", reqId, address }, "*");
    };
    if (state.ready[type]) send(); else setTimeout(send, 1200);
    setTimeout(() => {
      if (pendingReqs.has(reqId)) { pendingReqs.delete(reqId); resolve({ address, items: [], status: "timeout" }); }
    }, 90000);
  });
}

async function analyzeAll() {
  if (!state.portfolio.length) { setPfStatus("Añade alguna dirección primero.", "err"); return; }
  els.analyzeAll.disabled = true;
  els.analyzeAll.textContent = "Analizando…";
  state.results = [];
  for (let i = 0; i < state.portfolio.length; i++) {
    const entry = state.portfolio[i];
    setPfStatus(`Analizando ${entry.label || shortAddr(entry.address)} (${i + 1}/${state.portfolio.length})…`);
    const r = await analyzeAddressHeadless(entry.address, entry.type);
    state.results.push({ entry, items: r.items || [], status: r.status || "", timeline: r.timeline || [] });
    renderPortfolio();
  }
  const total = state.results.reduce((n, r) => n + r.items.length, 0);
  setPfStatus(`Listo. ${total} posiciones en ${state.results.length} direcciones.`, "ok");
  els.analyzeAll.disabled = false;
  els.analyzeAll.textContent = "Analizar todo";
}

// ============================================================================
// Render portfolio: resumen global + secciones por dirección
// ============================================================================

function renderPortfolio() {
  const all = state.results.flatMap((r) => r.items);
  // colores globales estables por posición
  let colorIdx = 0;
  const colorOf = new Map();
  for (const r of state.results) for (const it of r.items) colorOf.set(it, distinctColor(colorIdx++));

  // resumen global
  els.pfSummary.classList.toggle("hidden", all.length === 0 && state.results.length === 0);
  const totalValue = all.reduce((s, it) => s + (it.valueUSD || 0), 0);
  const totalCollected = all.reduce((s, it) => s + (it.feesUSD || 0), 0);
  const totalPending = all.reduce((s, it) => s + (it.feesPendingUSD || 0), 0);
  const totalFees = totalCollected + totalPending;
  // separar LP de préstamos para clasificar bien (un préstamo no tiene "rango")
  const lp = all.filter((it) => !it.lending);
  const lending = all.filter((it) => it.lending);
  const open = lp.filter((it) => !it.closed).length;
  const inRange = lp.filter((it) => !it.closed && it.inRange).length;
  els.gValue.textContent = fmtUSD(totalValue);
  els.gFees.textContent = fmtUSD(totalFees);
  els.gFeesSub.textContent = `${fmtUSD(totalPending)} pendientes · ${fmtUSD(totalCollected)} cobradas`;
  els.gPositions.textContent = all.length;
  els.gPositionsSub.textContent =
    `${inRange} en rango · ${open - inRange} fuera · ${lp.length - open} cerradas` +
    (lending.length ? ` · ${lending.length} préstamo${lending.length > 1 ? "s" : ""}` : "");
  els.gAddresses.textContent = state.results.length;

  renderPortfolioCharts();

  // secciones por dirección
  els.pfSections.innerHTML = "";
  for (const r of state.results) {
    const section = document.createElement("section");
    const subVal = r.items.reduce((s, it) => s + (it.valueUSD || 0), 0);
    const subFees = r.items.reduce((s, it) => s + (it.feesPendingUSD || 0) + (it.feesUSD || 0), 0);
    const badge = r.entry.type === "evm"
      ? `<span class="chip bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30">EVM</span>`
      : `<span class="chip bg-purple-500/15 text-purple-300 border border-purple-500/30">SOL</span>`;
    const head = document.createElement("div");
    head.className = "flex items-center gap-2 mb-2 flex-wrap";
    head.innerHTML = `
      ${badge}
      <span class="font-semibold">${r.entry.label || shortAddr(r.entry.address)}</span>
      <span class="font-mono text-[11px] text-slate-500">${shortAddr(r.entry.address)}</span>
      <span class="flex-1"></span>
      <span class="text-xs text-slate-400">${r.items.length} pos · ${fmtUSD(subVal)} · fees ${fmtUSD(subFees)}</span>`;
    section.appendChild(head);

    if (!r.items.length) {
      const empty = document.createElement("div");
      empty.className = "text-xs text-slate-500 mb-4";
      empty.textContent = r.status && r.status !== "ok" ? `Sin posiciones (${r.status}).` : "Sin posiciones.";
      section.appendChild(empty);
    } else {
      const grid = document.createElement("div");
      grid.className = "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-4";
      for (const it of r.items) grid.appendChild(portfolioCard(it, colorOf.get(it)));
      section.appendChild(grid);
    }
    els.pfSections.appendChild(section);
  }
}

function renderPortfolioCharts() {
  // valor por dirección
  const byAddr = state.results
    .map((r) => ({ label: r.entry.label || shortAddr(r.entry.address), value: r.items.reduce((s, it) => s + (it.valueUSD || 0), 0) }))
    .filter((x) => x.value > 0);
  // valor por red/protocolo
  const venueMap = new Map();
  for (const r of state.results) for (const it of r.items) venueMap.set(it.venue, (venueMap.get(it.venue) || 0) + (it.valueUSD || 0));
  const byVenue = [...venueMap.entries()].map(([label, value]) => ({ label, value })).filter((x) => x.value > 0);
  // fees (cobradas + pendientes) por dirección
  const byFees = state.results
    .map((r) => ({ label: r.entry.label || shortAddr(r.entry.address), value: r.items.reduce((s, it) => s + (it.feesUSD || 0) + (it.feesPendingUSD || 0), 0) }))
    .filter((x) => x.value > 0);

  els.pfCharts.classList.toggle("hidden", byAddr.length === 0);
  drawDoughnut("addr", els.chartByAddress, byAddr);
  drawDoughnut("venue", els.chartByVenue, byVenue);
  drawDoughnut("fees", els.chartByFees, byFees);
  renderFeesTimelineChart();
  renderFeesTimelineTotalChart();
}

function renderFeesTimelineChart() {
  if (pfCharts.timeline) { pfCharts.timeline.destroy(); pfCharts.timeline = null; }
  // Recoger todas las series por posición de todas las direcciones
  const allSeries = state.results.flatMap((r) => r.timeline || []);
  els.pfFeesTimeline.classList.toggle("hidden", allSeries.length === 0);
  if (!allSeries.length || typeof Chart === "undefined") return;
  const datasets = allSeries.map((s, i) => ({
    label: s.label,
    data: s.points.map((pt) => ({ x: pt.ts, y: pt.feesUSD })),
    borderColor: distinctColor(i),
    backgroundColor: "transparent",
    tension: 0.3,
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
        tooltip: { mode: "index", intersect: false, callbacks: { label: (c) => `${c.dataset.label}: ${fmtUSD(c.parsed.y)}` } },
      },
      scales: {
        x: {
          type: "linear",
          ticks: { color: "#94a3b8", maxTicksLimit: 8, callback: (v) => new Date(v).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) },
          grid: { color: "#1e293b" },
        },
        y: { ticks: { color: "#94a3b8", callback: (v) => fmtUSD(v) }, grid: { color: "#1e293b" } },
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
      tooltip: { callbacks: { label: (c) => `Total: ${fmtUSD(c.parsed.y)}` } },
    },
    scales: {
      x: { type: "linear", ticks: { color: "#94a3b8", maxTicksLimit: 8, callback: (v) => new Date(v).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) }, grid: { color: "#1e293b" } },
      y: { ticks: { color: "#94a3b8", callback: (v) => fmtUSD(v) }, grid: { color: "#1e293b" } },
    },
  };
  pfCharts.timelineTotal = new Chart(els.chartFeesTimelineTotal, {
    type: "line",
    data: { datasets: [{ label: "Total fees", data, borderColor: "#10b981", backgroundColor: "rgba(16,185,129,0.08)", fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 }] },
    options: lineOptions,
  });
}

function drawDoughnut(key, canvas, data) {
  if (!canvas || typeof Chart === "undefined") return;
  if (pfCharts[key]) { pfCharts[key].destroy(); pfCharts[key] = null; }
  if (!data.length) return;
  const total = data.reduce((s, d) => s + d.value, 0);
  const colors = data.map((_, i) => distinctColor(i));
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
        tooltip: { callbacks: { label: (c) => `${c.label}: ${fmtUSD(c.parsed)}` } },
        datalabels: {
          color: "#fff",
          font: { size: 10, weight: "bold" },
          formatter: (value) => {
            const pct = total > 0 ? (value / total * 100) : 0;
            return pct < 4 ? "" : fmtUSD(value);   // ocultar etiqueta si el segmento es muy pequeño
          },
          textShadowColor: "rgba(0,0,0,0.6)",
          textShadowBlur: 4,
        },
      },
    },
  });
}

function portfolioCard(it, color) {
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
  const feesLine = it.lending
    ? `<div class="text-emerald-400 font-semibold">${fmtUSD(it.feesUSD)}</div>`
    : it.kind === "evm"
      ? `<div class="text-emerald-400 font-semibold">${fmtUSD(it.feesUSD)}<span class="text-[10px] text-amber-300 ml-1">${it.feesPendingUSD == null ? "+pend n/d" : "+" + fmtUSD(it.feesPendingUSD)}</span></div>`
      : `<div class="text-emerald-400 font-semibold">${fmtUSD(it.feesPendingUSD)}</div>`;
  const evmExtra = it.kind === "evm"
    ? `<div class="grid grid-cols-2 gap-2 text-xs pt-1">
         <div><div class="text-[10px] uppercase text-slate-500">IL</div><div class="${pnlColor(it.ilUSD)}">${it.ilUSD == null ? "—" : fmtUSD(it.ilUSD)}</div></div>
         <div><div class="text-[10px] uppercase text-slate-500">PnL</div><div class="${pnlColor(it.pnlUSD)}">${it.pnlUSD == null ? "—" : fmtUSD(it.pnlUSD)}</div></div>
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
  } else if (d.type === "lp-wallet" && (d.app === "evm" || d.app === "sol")) {
    state.wallet[d.app] = d.address || null;
    if (d.app === state.mode) { renderWalletButton(); if (d.address) els.addr.value = d.address; }
    // si estábamos esperando para añadir esta wallet al portfolio, hazlo ahora
    if (d.address && pendingWalletAdd[d.app]) { pendingWalletAdd[d.app] = false; addWalletAddress(d.app); }
  } else if (d.type === "lp-result" && pendingReqs.has(d.reqId)) {
    const resolve = pendingReqs.get(d.reqId);
    pendingReqs.delete(d.reqId);
    resolve({ address: d.address, items: d.items || [], status: d.status, app: d.app, timeline: d.timeline || [] });
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
  // eventos ordenados; mantenemos el último estado conocido por posición
  const events = [];
  for (const s of allSeries) {
    for (const pt of s.points) {
      events.push({ ts: pt.ts, posId: s.posId, fees: pt.feesUSD || 0, dep: pt.depositedUSD || 0, wd: pt.withdrawnUSD || 0 });
    }
  }
  if (!events.length) return null;
  events.sort((a, b) => a.ts - b.ts);
  const lastFees = new Map(), lastDep = new Map();
  const aportadoByDay = new Map(), valorByDay = new Map();
  for (const ev of events) {
    lastFees.set(ev.posId, ev.fees);
    lastDep.set(ev.posId, ev.dep); // depositado bruto acumulado de la posición
    const aportado = [...lastDep.values()].reduce((s, v) => s + v, 0);
    const fees = [...lastFees.values()].reduce((s, v) => s + v, 0);
    const day = Math.floor(ev.ts / 86400000) * 86400000;
    aportadoByDay.set(day, aportado);
    valorByDay.set(day, aportado + fees); // valor acumulado = aportado + fees ganadas
  }
  const days = [...new Set([...aportadoByDay.keys(), ...valorByDay.keys()])].sort((a, b) => a - b);
  const aportado = days.map((d) => ({ x: d, y: aportadoByDay.get(d) }));
  const valor = days.map((d) => ({ x: d, y: valorByDay.get(d) }));
  const lastAportado = aportado[aportado.length - 1]?.y || 0;
  const lastValor = valor[valor.length - 1]?.y || 0;
  return { aportado, valor, lastAportado, lastValor, ganado: lastValor - lastAportado };
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
  els.histAportado.textContent = fmtUSD(curves.lastAportado);
  els.histValor.textContent = fmtUSD(curves.lastValor);
  els.histGanado.textContent = fmtUSD(curves.ganado);
  els.histNote.textContent = "Valor acumulado = capital aportado + fees ganadas (snapshots del subgraph; no incluye variación de precio/IL)";

  const datasets = [
    { label: "Capital aportado", data: curves.aportado, borderColor: "#94a3b8", borderDash: [5, 4], pointRadius: 2, borderWidth: 1.5, tension: 0.2 },
    { label: "Valor acumulado", data: curves.valor, borderColor: "#34d399", backgroundColor: "rgba(52,211,153,0.12)", pointRadius: 2, borderWidth: 2.5, fill: true, tension: 0.2 },
  ];
  if (pfCharts.projection) { pfCharts.projection.destroy(); pfCharts.projection = null; }
  pfCharts.projection = new Chart(els.chartProjection, {
    type: "line",
    data: { datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#cbd5e1", font: { size: 10 } } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmtUSD(c.parsed.y)}` } } },
      scales: {
        x: { type: "linear", ticks: { color: "#94a3b8", maxTicksLimit: 8, callback: (v) => new Date(v).toLocaleDateString("es-ES", { month: "short", year: "2-digit" }) }, grid: { color: "#1e293b" } },
        y: { ticks: { color: "#94a3b8", callback: (v) => fmtUSD(v) }, grid: { color: "#1e293b" } },
      },
    },
  });
}

// ============================================================================
// Eventos
// ============================================================================

els.tabBtnPortfolio.onclick = () => setTab("portfolio");
els.tabBtnQuick.onclick = () => setTab("quick");
els.tabBtnProjection.onclick = () => setTab("projection");

els.go.onclick = quickAnalyze;
els.addr.addEventListener("keydown", (e) => { if (e.key === "Enter") quickAnalyze(); });
els.addr.addEventListener("input", () => { const t = detectType(els.addr.value.trim()); if (t && t !== state.mode) setMode(t); });
els.modeEvm.onclick = () => setMode("evm");
els.modeSol.onclick = () => setMode("sol");
els.settings.onclick = () => postToActive({ type: "lp-open-settings" });
els.wallet.onclick = () => postToActive({ type: state.wallet[state.mode] ? "lp-disconnect-wallet" : "lp-connect-wallet" });

els.loginBtn.onclick = signInWithGoogle;
els.openFbSetup.onclick = openFbSetup;
els.fbSave.onclick = saveFbConfig;
els.pfAdd.onclick = addPortfolioEntry;
els.pfAddress.addEventListener("keydown", (e) => { if (e.key === "Enter") addPortfolioEntry(); });
els.analyzeAll.onclick = analyzeAll;
els.addRabby.onclick = () => addConnectedWallet("evm");
els.addPhantom.onclick = () => addConnectedWallet("sol");

// ============================================================================
// Init
// ============================================================================

(function init() {
  setTab("quick"); // por defecto, análisis de una dirección (como hasta ahora)
  setMode(state.mode);
  renderAuthArea();
  renderPortfolioList();
  renderPrefs();

  const cfg = getStoredFbConfig();
  if (cfg) {
    initFirebase(cfg).catch((e) => {
      console.error("initFirebase", e);
      setPfStatus(`Error al conectar Firebase: ${e.message}. Revisa la config.`, "err");
    });
  } else {
    // sin config: el gate ofrece configurarla
  }
})();
