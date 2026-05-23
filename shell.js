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
  autoRefresh: $("auto-refresh"), refreshNow: $("refresh-now"), lastUpdated: $("last-updated"),
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
  addRabby: $("add-rabby"), addPhantom: $("add-phantom"),
  analyzingModal: $("analyzing-modal"), analyzingMsg: $("analyzing-msg"), analyzingBar: $("analyzing-bar"),
  // portfolio results
  pfSummary: $("pf-summary"), gValue: $("g-value"), gFees: $("g-fees"), gFeesSub: $("g-fees-sub"),
  gIl: $("g-il"), gIlSub: $("g-il-sub"), gPnl: $("g-pnl"), gPnlSub: $("g-pnl-sub"),
  gPositions: $("g-positions"), gPositionsSub: $("g-positions-sub"), gAddresses: $("g-addresses"),
  pfSections: $("pf-sections"),
  pfCharts: $("pf-charts"), chartByAddress: $("chart-by-address"), chartByVenue: $("chart-by-venue"), chartByFees: $("chart-by-fees"),
  quickBanner: $("quick-banner"), pfBanner: $("pf-banner"),
  pfFeesTimeline: $("pf-fees-timeline"), chartFeesTimeline: $("chart-fees-timeline"),
  pfFeesTimelineTotal: $("pf-fees-timeline-total"), chartFeesTimelineTotal: $("chart-fees-timeline-total"),
  feesMinThreshold: $("fees-min-threshold"), pfFeesSummary: $("pf-fees-summary"),
  prefChains: $("pref-chains"), prefProtocols: $("pref-protocols"),
  // quick
  modeEvm: $("mode-evm"), modeSol: $("mode-sol"), addr: $("addr"), go: $("go"),
  wallet: $("wallet"), settingsOpen: $("settings-open"), hint: $("hint"),
  // settings modal (admin) — API keys que sobrescriben el proxy
  settingsModal: $("settings-modal"), settingsClose: $("settings-close"),
  settingsCancel: $("settings-cancel"), settingsSave: $("settings-save"),
  settingsStatus: $("settings-status"),
  setGraphKey: $("set-graph-key"), setHeliusKey: $("set-helius-key"), setBirdeyeKey: $("set-birdeye-key"),
  frameEvm: $("frame-evm"), frameSol: $("frame-sol"),
  // histórico
  histEmpty: $("hist-empty"), histContent: $("hist-content"),
  histAportado: $("hist-aportado"), histValor: $("hist-valor"), histGanado: $("hist-ganado"),
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
  wallet: { evm: null, sol: null },
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
// Divisa de visualización: siempre USD.
const _fx = { rate: 1, sym: "$" };
// Formato normal con separador de miles: $8,300.00 (para tarjetas, resúmenes, etc.)
function fmtUSD(n) {
  if (n == null || !isFinite(n)) return "—";
  n = n * _fx.rate; const S = _fx.sym;
  const abs = Math.abs(n), s = n < 0 ? "-" : "";
  if (abs === 0) return S + "0";
  if (abs >= 1) return `${s}${S}${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (abs >= 0.01) return `${s}${S}${abs.toFixed(4)}`;
  return `${s}${S}${abs.toExponential(2)}`;
}
// Formato compacto: $8.30k / $1.20M (solo para ejes y etiquetas de gráficos)
function fmtUSDc(n) {
  if (n == null || !isFinite(n)) return "—";
  n = n * _fx.rate; const S = _fx.sym;
  const abs = Math.abs(n), s = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${s}${S}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${s}${S}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${s}${S}${(abs / 1e3).toFixed(2)}k`;
  if (abs >= 1) return `${s}${S}${abs.toFixed(2)}`;
  if (abs === 0) return S + "0";
  if (abs >= 0.01) return `${s}${S}${abs.toFixed(4)}`;
  return `${s}${S}${abs.toExponential(2)}`;
}
function pnlColor(n) { if (!isFinite(n)) return "text-slate-400"; return n > 0 ? "text-emerald-400" : n < 0 ? "text-rose-400" : "text-slate-300"; }
function distinctColor(i) { const h = Math.round((i * 137.508) % 360); return `hsl(${h} 70% 60%)`; }

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
  // Solana
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
  const active = "seg px-3 py-1.5 text-xs rounded-md font-semibold bg-[#ECE600] text-slate-900 shadow";
  const idle = "seg px-3 py-1.5 text-xs rounded-md font-semibold text-slate-400 hover:text-slate-200";
  els.tabBtnPortfolio.className = tab === "portfolio" ? active : idle;
  els.tabBtnQuick.className = tab === "quick" ? active : idle;
  els.tabBtnProjection.className = tab === "projection" ? active : idle;
  els.tabPortfolio.classList.toggle("hidden", tab !== "portfolio");
  els.tabQuick.classList.toggle("hidden", tab !== "quick");
  els.tabProjection.classList.toggle("hidden", tab !== "projection");
  if (tab === "projection") renderHistorico();
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
  renderWalletButton();
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
  const ok1 = confirm(
    "⚠️ ¿Seguro que quieres empezar de cero?\n\n" +
    "Esto BORRARÁ tus direcciones cifradas (no se pueden recuperar sin la contraseña).\n" +
    "Después podrás definir una nueva contraseña con un portfolio vacío."
  );
  if (!ok1) return;
  const typed = prompt('Escribe "BORRAR" en mayúsculas para confirmar:');
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
    _pendingApiKeysEnc = null; _apiKeys = { graph: "", helius: "", birdeye: "" };
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
    alert("La cuenta de administrador no se puede eliminar desde la app.");
    return;
  }
  const email = state.user.email || "";
  const ok1 = confirm(
    "⚠️ ¿Eliminar tu cuenta?\n\n" +
    "Se borrarán:\n" +
    "• Tus direcciones cifradas y preferencias\n" +
    "• Tu cuenta de Firebase Auth\n\n" +
    "Esta acción es IRREVERSIBLE."
  );
  if (!ok1) return;
  const typed = prompt(`Para confirmar, escribe tu email exactamente:\n${email}`);
  if ((typed || "").trim().toLowerCase() !== email.toLowerCase()) {
    alert("Email no coincide. Cancelado.");
    return;
  }
  try {
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
        alert("Por seguridad, vuelve a iniciar sesión para confirmar el borrado.");
        const provider = new fb.authMod.GoogleAuthProvider();
        await fb.authMod.reauthenticateWithPopup(fb.auth.currentUser, provider);
        await fb.authMod.deleteUser(fb.auth.currentUser);
      } else { throw e; }
    }
    // 4) onAuthChange(null) se encarga del resto (vuelta al gate)
    alert("Tu cuenta ha sido eliminada. Hasta pronto 👋");
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
    const reg = r.registeredAt
      ? `<span class="chip bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0" title="Registrado en la app el ${new Date(r.registeredAt).toLocaleString()}">✓ Registrado</span>`
      : `<span class="chip bg-slate-700/40 text-slate-400 border border-slate-700 shrink-0" title="Aún no ha iniciado sesión en la app">Pendiente</span>`;
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
    if (data && data.registeredAt) return; // ya estaba marcado
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
    _pendingApiKeysEnc = null; _apiKeys = { graph: "", helius: "", birdeye: "" };
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
  _apiKeys = { graph: "", helius: "", birdeye: "" };
  try {
    const ref = fb.fsMod.doc(fb.db, "users", uid);
    const snap = await fb.fsMod.getDoc(ref);
    const data = snap.exists() ? snap.data() : {};
    state.prefs = {
      chains: Array.isArray(data.prefs?.chains) ? data.prefs.chains : DEFAULT_PREFS.chains.slice(),
      protocols: Array.isArray(data.prefs?.protocols) ? data.prefs.protocols : DEFAULT_PREFS.protocols.slice(),
    };
    if (Number(data.prefsVersion || 0) < 1) {
      if (!state.prefs.chains.includes("hyperevm")) state.prefs.chains.push("hyperevm");
      await fb.fsMod.setDoc(ref, { prefs: state.prefs, prefsVersion: 1 }, { merge: true }).catch(() => {});
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
function setPfManageOpen(open, persist = true) {
  els.pfManageBody.classList.toggle("hidden", !open);
  els.pfManageChev.textContent = open ? "▾" : "▸";
  if (persist) localStorage.setItem("lp:pfManageOpen", open ? "1" : "0");
}
function togglePfManage() {
  const open = els.pfManageBody.classList.contains("hidden"); // si estaba oculto, lo abrimos
  setPfManageOpen(open, true);
}
// Aplica el estado según la preferencia del usuario; si no hay pref guardada,
// se abre cuando el portfolio está vacío y se pliega cuando ya hay direcciones.
function applyPfManagePref() {
  const saved = localStorage.getItem("lp:pfManageOpen");
  if (saved === "1") setPfManageOpen(true, false);
  else if (saved === "0") setPfManageOpen(false, false);
  else setPfManageOpen(state.portfolio.length === 0, false);
}

function renderPortfolioList() {
  els.pfList.innerHTML = "";
  updatePfCount();
  applyPfManagePref();
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
    row.innerHTML = `
      <span class="drag-handle cursor-move text-slate-600 hover:text-slate-300 select-none flex-shrink-0" title="Arrastra para reordenar">⠿</span>
      ${badge}
      ${p.label ? `<span class="font-semibold">${p.label}</span>` : ""}
      <span class="font-mono text-xs text-slate-400 truncate">${shortAddr(p.address)}</span>
      <button data-copy="${p.address}" title="Copiar dirección" class="text-slate-500 hover:text-emerald-400 flex-shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </button>
      <span class="flex-1"></span>
      <button class="move-up text-xs leading-none ${idx === 0 ? "text-slate-700 cursor-default" : "text-slate-500 hover:text-slate-200"}" title="Subir" ${idx === 0 ? "disabled" : ""}>▲</button>
      <button class="move-down text-xs leading-none ${idx === state.portfolio.length - 1 ? "text-slate-700 cursor-default" : "text-slate-500 hover:text-slate-200"}" title="Bajar" ${idx === state.portfolio.length - 1 ? "disabled" : ""}>▼</button>
      <button data-rename="${p.address}" title="Renombrar" class="text-xs text-slate-500 hover:text-sky-400">✎</button>
      <button data-rm="${p.address}" class="text-xs text-slate-500 hover:text-rose-400">✕</button>`;
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

// Modal de progreso mientras se consultan las direcciones
function openAnalyzingModal(msg, showBar = true) {
  if (msg) els.analyzingMsg.textContent = msg;
  if (els.analyzingBar) {
    els.analyzingBar.style.width = "0%";
    if (els.analyzingBar.parentElement) els.analyzingBar.parentElement.classList.toggle("hidden", !showBar);
  }
  els.analyzingModal.classList.remove("hidden");
}
function updateAnalyzingModal(msg, doneCount, total) {
  if (msg) els.analyzingMsg.textContent = msg;
  if (els.analyzingBar && total > 0) els.analyzingBar.style.width = `${Math.round((doneCount / total) * 100)}%`;
}
function closeAnalyzingModal() {
  els.analyzingModal.classList.add("hidden");
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
    for (let i = 0; i < n; i++) {
      const entry = state.portfolio[i];
      if (entry.type !== type) continue;
      const r = await analyzeAddressHeadless(entry.address, entry.type);
      results[i] = { entry, items: r.items || [], status: r.status || "", timeline: r.timeline || [], analysisStatus: r.analysisStatus || null };
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
function fillSummary(prefix, items, extra = {}) {
  const $i = (id) => document.getElementById(`${prefix}-${id}`);
  const totalValue = items.reduce((s, it) => s + (it.valueUSD || 0), 0);
  const totalCollected = items.reduce((s, it) => s + (it.feesUSD || 0), 0);
  const totalPending = items.reduce((s, it) => s + (it.feesPendingUSD || 0), 0);
  const totalFees = totalCollected + totalPending;
  const lp = items.filter((it) => !it.lending);
  const lending = items.filter((it) => it.lending);
  const inRange = lp.filter((it) => it.inRange).length;
  let ilSum = 0, ilN = 0, pnlSum = 0, pnlN = 0;
  for (const it of lp) {
    if (it.ilUSD != null && isFinite(it.ilUSD)) { ilSum += it.ilUSD; ilN++; }
    if (it.pnlUSD != null && isFinite(it.pnlUSD)) { pnlSum += it.pnlUSD; pnlN++; }
  }
  const pctOf = (x) => (totalValue > 0 ? ` (${x >= 0 ? "+" : ""}${((x / totalValue) * 100).toFixed(2)}%)` : "");

  if ($i("value")) $i("value").textContent = fmtUSD(totalValue);
  if ($i("fees")) {
    $i("fees").textContent = fmtUSD(totalFees);
    if ($i("fees-sub")) $i("fees-sub").innerHTML = `<span class="text-amber-300 font-semibold">${fmtUSD(totalPending)}</span> pendientes · <span class="text-emerald-400 font-semibold">${fmtUSD(totalCollected)}</span> cobradas`;
  }
  if ($i("il")) {
    $i("il").textContent = ilN ? fmtUSD(ilSum) + pctOf(ilSum) : "—";
    $i("il").className = "text-xl font-bold mt-1 " + (ilN ? pnlColor(ilSum) : "");
    if ($i("il-sub")) $i("il-sub").textContent = ilN ? `${ilN}/${lp.length} posiciones con dato` : "requiere histórico (EVM / Birdeye en Solana)";
  }
  if ($i("pnl")) {
    $i("pnl").textContent = pnlN ? fmtUSD(pnlSum) + pctOf(pnlSum) : "—";
    $i("pnl").className = "text-xl font-bold mt-1 " + (pnlN ? pnlColor(pnlSum) : "");
    if ($i("pnl-sub")) $i("pnl-sub").textContent = pnlN ? `${pnlN}/${lp.length} posiciones con dato` : "requiere histórico (EVM / Birdeye en Solana)";
  }
  if ($i("positions")) {
    $i("positions").textContent = items.length;
    if ($i("positions-sub")) $i("positions-sub").textContent =
      `${inRange} en rango · ${lp.length - inRange} fuera` +
      (lending.length ? ` · ${lending.length} préstamo${lending.length > 1 ? "s" : ""}` : "");
  }
  if ($i("addresses") && typeof extra.addresses === "number") $i("addresses").textContent = extra.addresses;
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
function renderQuickSummary(items) {
  const wrap = document.getElementById("quick-summary");
  if (!wrap) return;
  if (!items || !items.length) { wrap.classList.add("hidden"); return; }
  wrap.classList.remove("hidden");
  fillSummary("q", items);
}
function clearQuickSummary() {
  const wrap = document.getElementById("quick-summary");
  if (wrap) wrap.classList.add("hidden");
  clearAnalysisBanner(els.quickBanner);
}

function renderPortfolio() {
  // ocultamos las posiciones cerradas en toda la vista de portfolio
  const visItems = (r) => (r.items || []).filter((it) => !it.closed);
  const all = state.results.flatMap(visItems);
  // colores estables por red/protocolo. TODAS las posiciones de la misma red usan
  // el mismo color (Ethereum siempre azul, Arbitrum azul claro, …). Para posiciones
  // de redes sin color definido, fallback al color rotativo por índice.
  let colorIdx = 0;
  const colorOf = new Map();
  for (const r of state.results) {
    for (const it of visItems(r)) {
      colorOf.set(it, venueColor(it.venue) || distinctColor(colorIdx++));
    }
  }

  // ocultar CTA en cuanto haya resultados
  if (state.results.length > 0) els.pfCta.classList.add("hidden");

  // resumen global
  els.pfSummary.classList.toggle("hidden", all.length === 0 && state.results.length === 0);
  fillSummary("g", all, { addresses: state.results.length });

  // Banner de resultado del análisis (verde si OK, rojo si hubo errores por chain/protocolo
  // en alguna de las direcciones). Agregamos errores de TODAS las direcciones y prefijamos
  // con la etiqueta de la dirección que falló para que sea claro dónde.
  if (state.results.length === 0) {
    clearAnalysisBanner(els.pfBanner);
  } else {
    const allErrors = [];
    for (const r of state.results) {
      const errs = r.analysisStatus?.errors || [];
      const label = (r.entry?.label) || shortAddr(r.entry?.address || "");
      for (const e of errs) allErrors.push({ source: `${label} · ${e.source}`, reason: e.reason });
    }
    const addrCount = state.results.length;
    const summary = `${all.length} posiciones en ${addrCount} ${addrCount === 1 ? "dirección" : "direcciones"}`;
    renderAnalysisBanner(els.pfBanner, { errors: allErrors, summary });
  }

  renderPortfolioCharts();

  // secciones por dirección
  els.pfSections.innerHTML = "";
  for (const r of state.results) {
    const items = visItems(r);
    const section = document.createElement("section");
    const subVal = items.reduce((s, it) => s + (it.valueUSD || 0), 0);
    const subFees = items.reduce((s, it) => s + (it.feesPendingUSD || 0) + (it.feesUSD || 0), 0);
    const badge = r.entry.type === "evm"
      ? `<span class="chip bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30">EVM</span>`
      : `<span class="chip bg-purple-500/15 text-purple-300 border border-purple-500/30">SOL</span>`;
    const head = document.createElement("div");
    head.className = "flex items-center gap-2 mb-2 flex-wrap";
    head.innerHTML = `
      ${badge}
      <span class="font-semibold text-base">${r.entry.label || shortAddr(r.entry.address)}</span>
      <span class="font-mono text-[11px] text-slate-500">${shortAddr(r.entry.address)}</span>
      <span class="flex-1"></span>
      <span class="text-sm text-slate-300 flex items-center gap-2">
        <span><span class="font-semibold text-slate-100">${items.length}</span> pos</span>
        <span class="text-slate-600">·</span>
        <span class="font-semibold text-slate-100">${fmtUSD(subVal)}</span>
        <span class="text-slate-600">·</span>
        <span>fees <span class="font-semibold text-emerald-400">${fmtUSD(subFees)}</span></span>
      </span>`;
    section.appendChild(head);

    if (!items.length) {
      const empty = document.createElement("div");
      // ¿el estado del engine indica un problema (auth/red/límite)? → resaltar en ámbar
      const isErr = r.status && /no se pudo|inicia sesión|no está autoriz|límite|error de red|servicio no disponible|api key/i.test(r.status);
      empty.className = `text-xs mb-4 ${isErr ? "text-amber-400" : "text-slate-500"}`;
      empty.textContent = r.status && r.status.trim() ? r.status : "Sin posiciones abiertas.";
      section.appendChild(empty);
    } else {
      const grid = document.createElement("div");
      grid.className = "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-4";
      for (const it of items) grid.appendChild(portfolioCard(it, colorOf.get(it)));
      section.appendChild(grid);
    }
    els.pfSections.appendChild(section);
  }
}

function renderPortfolioCharts() {
  const open = (r) => (r.items || []).filter((it) => !it.closed); // sin cerradas
  // valor por dirección
  const byAddr = state.results
    .map((r) => ({ label: r.entry.label || shortAddr(r.entry.address), value: open(r).reduce((s, it) => s + (it.valueUSD || 0), 0) }))
    .filter((x) => x.value > 0);
  // valor por red/protocolo
  const venueMap = new Map();
  for (const r of state.results) for (const it of open(r)) venueMap.set(it.venue, (venueMap.get(it.venue) || 0) + (it.valueUSD || 0));
  const byVenue = [...venueMap.entries()].map(([label, value]) => ({ label, value })).filter((x) => x.value > 0);
  // fees (cobradas + pendientes) por dirección
  const byFees = state.results
    .map((r) => ({ label: r.entry.label || shortAddr(r.entry.address), value: open(r).reduce((s, it) => s + (it.feesUSD || 0) + (it.feesPendingUSD || 0), 0) }))
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
            label: (c) => `${c.dataset.label}: ${fmtUSD(c.parsed.y)}`,
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
          label: (c) => `Total: ${fmtUSD(c.parsed.y)}`,
        },
      },
    },
    scales: {
      x: { type: "linear", ticks: { color: "#94a3b8", maxTicksLimit: 8, callback: dateTick({ day: "numeric", month: "short" }) }, grid: { color: "#1e293b" } },
      y: { ticks: { color: "#94a3b8", callback: (v) => fmtUSD(v) }, grid: { color: "#1e293b" } },
    },
  };
  pfCharts.timelineTotal = new Chart(els.chartFeesTimelineTotal, {
    type: "line",
    data: { datasets: [{ label: "Total fees", data, borderColor: "#10b981", backgroundColor: "rgba(16,185,129,0.08)", fill: true, stepped: "after", pointRadius: 0, borderWidth: 2 }] },
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
                    : v >= 1 ? v.toFixed(3) : v.toPrecision(3);
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
  // el color global distintivo.
  if (it.cardHTML) {
    const tpl = document.createElement("template");
    tpl.innerHTML = it.cardHTML.trim();
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
  let feesLine;
  if (it.lending) {
    feesLine = `<div class="text-emerald-400 font-semibold">${fmtUSD(it.feesUSD)} <span class="text-[10px] font-normal text-slate-400">ganado</span></div>`;
  } else {
    const hasCollected = (it.kind === "evm" || (it.kind === "sol" && it.pnlUSD != null));
    const pendStr = it.feesPendingUSD == null ? "n/d" : fmtUSD(it.feesPendingUSD);
    const collectedLine = hasCollected
      ? `<div class="text-emerald-400 font-semibold leading-tight">${fmtUSD(it.feesUSD || 0)} <span class="text-[10px] font-normal text-slate-400">cobradas</span></div>`
      : "";
    const pendingLine = `<div class="text-amber-300 font-semibold leading-tight">${pendStr} <span class="text-[10px] font-normal text-slate-400">pendientes</span></div>`;
    feesLine = collectedLine + pendingLine;
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
  } else if (d.type === "lp-wallet" && (d.app === "evm" || d.app === "sol")) {
    state.wallet[d.app] = d.address || null;
    if (d.app === state.mode) { renderWalletButton(); if (d.address) els.addr.value = d.address; }
    // si estábamos esperando para añadir esta wallet al portfolio, hazlo ahora
    if (d.address && pendingWalletAdd[d.app]) { pendingWalletAdd[d.app] = false; addWalletAddress(d.app); }
  } else if (d.type === "lp-result" && pendingReqs.has(d.reqId)) {
    const resolve = pendingReqs.get(d.reqId);
    pendingReqs.delete(d.reqId);
    resolve({ address: d.address, items: d.items || [], status: d.status, app: d.app, timeline: d.timeline || [], analysisStatus: d.analysisStatus || null });
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
    renderQuickSummary(d.items || []);
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

  // PnL e IL agregados a partir de las posiciones analizadas (incluye variación de precio).
  // Solo cuentan las posiciones que aportan el dato (EVM siempre; Solana solo con Birdeye key).
  const items = state.results.flatMap((r) => r.items || []).filter((it) => !it.lending && !it.closed);
  let pnlSum = 0, pnlN = 0, ilSum = 0, ilN = 0, valSum = 0;
  for (const it of items) {
    valSum += it.valueUSD || 0;
    if (it.pnlUSD != null && isFinite(it.pnlUSD)) { pnlSum += it.pnlUSD; pnlN++; }
    if (it.ilUSD != null && isFinite(it.ilUSD)) { ilSum += it.ilUSD; ilN++; }
  }
  const totalLP = items.length;
  const pctOf = (x) => (valSum > 0 ? ` (${x >= 0 ? "+" : ""}${((x / valSum) * 100).toFixed(2)}%)` : "");
  els.histPnl.textContent = pnlN ? fmtUSD(pnlSum) + pctOf(pnlSum) : "—";
  els.histPnl.className = "text-xl font-bold mt-1 " + (pnlN ? pnlColor(pnlSum) : "");
  els.histPnlSub.textContent = pnlN ? `${pnlN}/${totalLP} posiciones con dato` : "requiere histórico (EVM / Birdeye en Solana)";
  els.histIl.textContent = ilN ? fmtUSD(ilSum) + pctOf(ilSum) : "—";
  els.histIl.className = "text-xl font-bold mt-1 " + (ilN ? pnlColor(ilSum) : "");
  els.histIlSub.textContent = ilN ? `${ilN}/${totalLP} posiciones con dato` : "requiere histórico (EVM / Birdeye en Solana)";

  els.histNote.textContent = "La curva = aportado + fees (eventos on-chain EVM/HyperEVM/lending y transacciones Solana). PnL e IL del resumen sí incluyen variación de precio, calculados por posición.";

  const datasets = [
    { label: "Capital aportado", data: curves.aportado, borderColor: "#94a3b8", borderDash: [5, 4], pointRadius: 2, borderWidth: 1.5, stepped: "after" },
    { label: "Valor acumulado", data: curves.valor, borderColor: "#34d399", backgroundColor: "rgba(52,211,153,0.12)", pointRadius: 2, borderWidth: 2.5, fill: true, stepped: "after" },
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
            label: (c) => `${c.dataset.label}: ${fmtUSD(c.parsed.y)}`,
          },
        },
      },
      scales: {
        x: { type: "linear", ticks: { color: "#94a3b8", maxTicksLimit: 8, callback: dateTick(xFmt) }, grid: { color: "#1e293b" } },
        y: { ticks: { color: "#94a3b8", callback: (v) => fmtUSDc(v) }, grid: { color: "#1e293b" } },
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
// Settings unificados: modal en el shell con las 3 API keys (Graph / Helius /
// Birdeye). Se persisten CIFRADAS en Firestore (mismo AES-GCM + clave PBKDF2
// que el portfolio) → multi-dispositivo y nunca legibles por el servidor.
// En memoria viven en _apiKeys; el blob cifrado pendiente, en _pendingApiKeysEnc.
let _apiKeys = { graph: "", helius: "", birdeye: "" };
let _pendingApiKeysEnc = null;

function pushKeysToEngines() {
  const k = _apiKeys || {};
  const msgEvm = { type: "lp-apply-keys", app: "evm", graph: k.graph || "" };
  const msgSol = { type: "lp-apply-keys", app: "sol", helius: k.helius || "", birdeye: k.birdeye || "" };
  if (els.frameEvm?.contentWindow) els.frameEvm.contentWindow.postMessage(msgEvm, "*");
  if (els.frameSol?.contentWindow) els.frameSol.contentWindow.postMessage(msgSol, "*");
}

// Descifrar las API keys con la clave del usuario (la misma que descifra el portfolio).
// Si no hay blob cifrado y hay datos antiguos en localStorage, migra a Firestore.
async function tryDecryptApiKeys(key) {
  if (!_pendingApiKeysEnc) {
    _apiKeys = { graph: "", helius: "", birdeye: "" };
    // Migración desde la versión anterior que guardaba en localStorage
    try {
      const legacy = JSON.parse(localStorage.getItem("lp:apiKeys") || "null");
      if (legacy && (legacy.graph || legacy.helius || legacy.birdeye)) {
        _apiKeys = { graph: legacy.graph || "", helius: legacy.helius || "", birdeye: legacy.birdeye || "" };
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
    };
    return true;
  } catch { _apiKeys = { graph: "", helius: "", birdeye: "" }; return false; }
}

async function saveApiKeysToFirestore(keys, key) {
  if (!state.user || !fb.db || !key) return;
  const enc = await encryptJSON(keys, key);
  const ref = fb.fsMod.doc(fb.db, "users", state.user.uid);
  await fb.fsMod.setDoc(ref, { apiKeysEnc: enc }, { merge: true });
  _pendingApiKeysEnc = enc;
}

function openSettingsModal() {
  if (!crypto_.key) {
    setPfStatus("Desbloquea tu portfolio primero para gestionar tus API keys.", "err");
    return;
  }
  els.setGraphKey.value = _apiKeys.graph || "";
  els.setHeliusKey.value = _apiKeys.helius || "";
  els.setBirdeyeKey.value = _apiKeys.birdeye || "";
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
els.settingsOpen.onclick = openSettingsModal;
els.settingsClose.onclick = closeSettingsModal;
els.settingsCancel.onclick = closeSettingsModal;
els.settingsSave.onclick = saveSettingsModal;
els.settingsModal.addEventListener("click", (e) => { if (e.target === els.settingsModal) closeSettingsModal(); });
els.wallet.onclick = () => postToActive({ type: state.wallet[state.mode] ? "lp-disconnect-wallet" : "lp-connect-wallet" });

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
els.addRabby.onclick = () => addConnectedWallet("evm");
els.addPhantom.onclick = () => addConnectedWallet("sol");
els.autoRefresh.onchange = applyAutoRefresh;
els.refreshNow.onclick = refreshActiveTab;
els.pfManageToggle.onclick = togglePfManage;
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

  setupTipTaps(document);
  setTab("quick"); // por defecto, análisis de una dirección (como hasta ahora)
  setMode(state.mode);
  renderAuthArea();
  renderPortfolioList();
  renderPrefs();

  // intervalo de auto-actualización: el guardado, o 5 min por defecto
  els.autoRefresh.value = localStorage.getItem("lp:autoRefresh") || "300000";
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
