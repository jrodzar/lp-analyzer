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
  // cifrado E2E
  encModal: $("enc-modal"), encTitle: $("enc-title"), encDesc: $("enc-desc"),
  encPass: $("enc-pass"), encPass2: $("enc-pass2"), encRemember: $("enc-remember"),
  encWarn: $("enc-warn"), encAck: $("enc-ack"), encErr: $("enc-err"), encSubmit: $("enc-submit"),
  encCancel: $("enc-cancel"), changePass: $("change-pass"),
  // login
  loginGate: $("login-gate"), loginBtn: $("login-btn"), portfolioArea: $("portfolio-area"),
  // portfolio crud
  pfLabel: $("pf-label"), pfAddress: $("pf-address"), pfAdd: $("pf-add"), pfAddErr: $("pf-add-err"),
  pfList: $("pf-list"), analyzeAll: $("analyze-all"), pfStatus: $("pf-status"),
  addRabby: $("add-rabby"), addPhantom: $("add-phantom"),
  analyzingModal: $("analyzing-modal"), analyzingMsg: $("analyzing-msg"), analyzingBar: $("analyzing-bar"),
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
  const active = "seg px-3 py-1.5 text-xs rounded-md font-semibold bg-[#ECE600] text-slate-900 shadow";
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
  const active = "seg px-3 py-1.5 text-xs rounded-md font-semibold bg-[#ECE600] text-slate-900 shadow";
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

// intenta descifrar el portfolio guardado con una key; devuelve true/false (y rellena state.portfolio)
let _pendingEnc = null; // blob cifrado cargado de Firestore pendiente de descifrar
async function tryDecryptPortfolio(key) {
  if (!_pendingEnc) { state.portfolio = []; return true; }
  try { state.portfolio = await decryptJSON(_pendingEnc, key); if (!Array.isArray(state.portfolio)) state.portfolio = []; return true; }
  catch { return false; }
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
    renderPrefs();
    pushPrefsToEngines();
    const unlocked = await ensureUnlocked(user.uid); // pide contraseña si hace falta
    if (!unlocked) setPfStatus("Introduce tu contraseña de cifrado para ver tu portfolio.", "err");
    renderPortfolioList();
  } else {
    els.loginGate.classList.remove("hidden");
    els.portfolioArea.classList.add("hidden");
    state.portfolio = [];
    crypto_.key = null; _pendingEnc = null;
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
  _pendingEnc = null; _legacyPortfolio = null; crypto_.key = null;
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

// Modal de progreso mientras se consultan las direcciones
function openAnalyzingModal(msg) {
  if (msg) els.analyzingMsg.textContent = msg;
  if (els.analyzingBar) els.analyzingBar.style.width = "0%";
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
  const n = state.portfolio.length;
  openAnalyzingModal(`Analizando direcciones (0/${n})…`);
  try {
    for (let i = 0; i < n; i++) {
      const entry = state.portfolio[i];
      const label = entry.label || shortAddr(entry.address);
      const msg = `Analizando ${label} (${i + 1}/${n})…`;
      setPfStatus(msg);
      updateAnalyzingModal(msg, i, n);
      const r = await analyzeAddressHeadless(entry.address, entry.type);
      state.results.push({ entry, items: r.items || [], status: r.status || "", timeline: r.timeline || [] });
      updateAnalyzingModal(msg, i + 1, n);
      renderPortfolio();
    }
    const total = state.results.reduce((acc, r) => acc + r.items.length, 0);
    setPfStatus(`Listo. ${total} posiciones en ${state.results.length} direcciones.`, "ok");
  } finally {
    closeAnalyzingModal();
    els.analyzeAll.disabled = false;
    els.analyzeAll.textContent = "Analizar todo";
  }
}

// ============================================================================
// Render portfolio: resumen global + secciones por dirección
// ============================================================================

function renderPortfolio() {
  // ocultamos las posiciones cerradas en toda la vista de portfolio
  const visItems = (r) => (r.items || []).filter((it) => !it.closed);
  const all = state.results.flatMap(visItems);
  // colores globales estables por posición
  let colorIdx = 0;
  const colorOf = new Map();
  for (const r of state.results) for (const it of visItems(r)) colorOf.set(it, distinctColor(colorIdx++));

  // resumen global
  els.pfSummary.classList.toggle("hidden", all.length === 0 && state.results.length === 0);
  const totalValue = all.reduce((s, it) => s + (it.valueUSD || 0), 0);
  const totalCollected = all.reduce((s, it) => s + (it.feesUSD || 0), 0);
  const totalPending = all.reduce((s, it) => s + (it.feesPendingUSD || 0), 0);
  const totalFees = totalCollected + totalPending;
  // separar LP de préstamos para clasificar bien (un préstamo no tiene "rango")
  const lp = all.filter((it) => !it.lending);
  const lending = all.filter((it) => it.lending);
  const inRange = lp.filter((it) => it.inRange).length;
  els.gValue.textContent = fmtUSD(totalValue);
  els.gFees.textContent = fmtUSD(totalFees);
  els.gFeesSub.innerHTML = `<span class="text-amber-300 font-semibold">${fmtUSD(totalPending)}</span> pendientes · <span class="text-emerald-400 font-semibold">${fmtUSD(totalCollected)}</span> cobradas`;
  els.gPositions.textContent = all.length;
  els.gPositionsSub.textContent =
    `${inRange} en rango · ${lp.length - inRange} fuera` +
    (lending.length ? ` · ${lending.length} préstamo${lending.length > 1 ? "s" : ""}` : "");
  els.gAddresses.textContent = state.results.length;

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
      empty.className = "text-xs text-slate-500 mb-4";
      empty.textContent = r.status && r.status !== "ok" ? `Sin posiciones abiertas (${r.status}).` : "Sin posiciones abiertas.";
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
  let pnlSum = 0, pnlN = 0, ilSum = 0, ilN = 0;
  for (const it of items) {
    if (it.pnlUSD != null && isFinite(it.pnlUSD)) { pnlSum += it.pnlUSD; pnlN++; }
    if (it.ilUSD != null && isFinite(it.ilUSD)) { ilSum += it.ilUSD; ilN++; }
  }
  const totalLP = items.length;
  els.histPnl.textContent = pnlN ? fmtUSD(pnlSum) : "—";
  els.histPnl.className = "text-xl font-bold mt-1 " + (pnlN ? pnlColor(pnlSum) : "");
  els.histPnlSub.textContent = pnlN ? `${pnlN}/${totalLP} posiciones con dato` : "requiere histórico (EVM / Birdeye en Solana)";
  els.histIl.textContent = ilN ? fmtUSD(ilSum) : "—";
  els.histIl.className = "text-xl font-bold mt-1 " + (ilN ? pnlColor(ilSum) : "");
  els.histIlSub.textContent = ilN ? `${ilN}/${totalLP} posiciones con dato` : "requiere histórico (EVM / Birdeye en Solana)";

  els.histNote.textContent = "La curva = aportado + fees (eventos on-chain EVM/HyperEVM/lending y transacciones Solana). PnL e IL del resumen sí incluyen variación de precio, calculados por posición.";

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
els.encSubmit.onclick = handleEncSubmit;
els.encCancel.onclick = () => closeEncModal(null);
els.encPass.addEventListener("keydown", (e) => { if (e.key === "Enter") handleEncSubmit(); });
els.encPass2.addEventListener("keydown", (e) => { if (e.key === "Enter") handleEncSubmit(); });
els.changePass.onclick = () => {
  if (!crypto_.key) { setPfStatus("Desbloquea tu portfolio primero.", "err"); return; }
  openEncModal("change");
};
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
