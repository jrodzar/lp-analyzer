"use strict";

// ============================================================================
// Solana LP Analyzer · Phase 1 (Orca Whirlpools)
//
// Discovery:
//   1) Helius DAS getAssetsByOwner -> NFTs en la wallet
//   2) Para cada NFT, derivar Orca Position PDA = ["position", mint] @ Orca program
//   3) getMultipleAccounts -> filtrar los que tengan discriminator de Position
//   4) Decodificar Borsh, leer Whirlpool de cada uno
//   5) Calcular composición actual con sqrtPriceX64 + ticks (V3 math)
//   6) Fees pendientes = feeOwedA/B + uncollected (calculado on-chain leyendo
//      los TickArrays y reaplicando la fórmula de feeGrowthInside)
//   7) Precios USD vía Jupiter
// ============================================================================

const ORCA_WHIRLPOOL_PROGRAM = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";
const RAYDIUM_CLMM_PROGRAM = "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK";

const PROTOCOLS = {
  orca: {
    name: "Orca Whirlpools",
    color: "#FFD15C",
    enabled: true,
    impl: "v1",
  },
  raydium: {
    name: "Raydium CLMM",
    color: "#C200FB",
    enabled: true,
    impl: "v1",
  },
  meteora: {
    name: "Meteora DLMM",
    color: "#7FFFD4",
    enabled: false,
    soon: true,
  },
  classic: {
    name: "Pools clásicos",
    color: "#94A3B8",
    enabled: false,
    soon: true,
  },
};

// Jupiter lite-api (sin key, rate-limited):
//   - tokens v2: incluye decimals, symbol, name, icon, usdPrice
//   - price v3:  precios USD para mints arbitrarios
const JUPITER_TOKEN_LIST = "https://lite-api.jup.ag/tokens/v2/tag?query=verified";
const JUPITER_PRICE = "https://lite-api.jup.ag/price/v3";
// Proxy de Cloudflare (las API keys viven dentro del Worker, no aquí). Si está
// puesto, los usuarios no necesitan sus propias keys de Helius/Birdeye.
const PROXY_BASE = (localStorage.getItem("lp:proxyBase") || "https://lp-proxy.jrodzar.workers.dev").replace(/\/$/, "");
let proxyToken = ""; // ID token de Firebase, lo envía el shell (lp-set-token); requerido por el proxy
function proxyAuth(url) {
  return (PROXY_BASE && url.startsWith(PROXY_BASE) && proxyToken) ? { Authorization: `Bearer ${proxyToken}` } : {};
}

// ============================================================================
// State
// ============================================================================

const state = {
  heliusKey: localStorage.getItem("sol:heliusKey") || "",
  birdeyeKey: localStorage.getItem("sol:birdeyeKey") || "",
  selectedProtocols: JSON.parse(localStorage.getItem("sol:selectedProtocols") || "null") || ["orca", "raydium"],
  address: "",
  positions: [],
  tokenList: null, // Map<mint, { symbol, name, decimals, logoURI }>
  prices: {}, // mint -> usd price
  loading: false,
  sortBy: "value",
  hideClosed: true,
  connectedAddress: null,
};

let charts = { value: null };
let noble = null; // { sha256, ed25519 } cargado vía script type=module

// ============================================================================
// Crypto loader (@noble)
// ============================================================================

function ensureNoble() {
  if (window.SolNoble) { noble = window.SolNoble; return Promise.resolve(); }
  return new Promise((resolve) => {
    window.addEventListener("solnoble-ready", () => {
      noble = window.SolNoble;
      resolve();
    }, { once: true });
  });
}

// ============================================================================
// Base58 + PublicKey helpers (sin @solana/web3.js)
// ============================================================================

const B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const B58_MAP = (() => { const m = {}; for (let i = 0; i < B58_ALPHABET.length; i++) m[B58_ALPHABET[i]] = i; return m; })();

function base58Decode(str) {
  const bytes = [0];
  for (const ch of str) {
    const val = B58_MAP[ch];
    if (val === undefined) throw new Error(`carácter base58 inválido: ${ch}`);
    let carry = val;
    for (let j = 0; j < bytes.length; j++) { carry += bytes[j] * 58; bytes[j] = carry & 0xff; carry >>= 8; }
    while (carry) { bytes.push(carry & 0xff); carry >>= 8; }
  }
  for (let k = 0; k < str.length && str[k] === "1"; k++) bytes.push(0);
  return new Uint8Array(bytes.reverse());
}

function base58Encode(bytes) {
  const digits = [0];
  for (const b of bytes) {
    let carry = b;
    for (let j = 0; j < digits.length; j++) { carry += digits[j] << 8; digits[j] = carry % 58; carry = (carry / 58) | 0; }
    while (carry) { digits.push(carry % 58); carry = (carry / 58) | 0; }
  }
  let str = "";
  for (let k = 0; k < bytes.length && bytes[k] === 0; k++) str += "1";
  for (let q = digits.length - 1; q >= 0; q--) str += B58_ALPHABET[digits[q]];
  return str;
}

function isOnCurve(bytes32) {
  try { noble.ed25519.ExtendedPoint.fromHex(bytes32); return true; } catch { return false; }
}

const PDA_MARKER = new TextEncoder().encode("ProgramDerivedAddress");

// Deriva la PDA dado un array de seeds (Uint8Array) y el programId (Uint8Array de 32)
function findProgramAddress(seeds, programIdBytes) {
  for (let bump = 255; bump >= 0; bump--) {
    const parts = [...seeds, new Uint8Array([bump]), programIdBytes, PDA_MARKER];
    const total = parts.reduce((n, p) => n + p.length, 0);
    const buf = new Uint8Array(total);
    let off = 0;
    for (const p of parts) { buf.set(p, off); off += p.length; }
    const hash = noble.sha256(buf);
    if (!isOnCurve(hash)) return { pda: hash, bump };
  }
  throw new Error("no se encontró PDA válida");
}

// ============================================================================
// Helpers
// ============================================================================

function rpcUrl() {
  if (state.heliusKey) return `https://mainnet.helius-rpc.com/?api-key=${state.heliusKey}`; // key propia
  if (PROXY_BASE) return `${PROXY_BASE}/helius-rpc`;                                          // proxy compartido
  throw new Error("Falta Helius API key (Settings) o proxy configurado.");
}

async function rpc(method, params) {
  const url = rpcUrl();
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let lastErr;
  // reintentos con backoff ante 429/5xx (rate limit del proxy o de Helius)
  for (let attempt = 0; attempt < 4; attempt++) {
    let res;
    try { res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...proxyAuth(url) }, body }); }
    catch (e) { lastErr = e; if (attempt < 3) { await sleep(500 * (attempt + 1)); continue; } throw e; }
    if (res.status === 429 || res.status >= 500) {
      lastErr = new Error(`RPC HTTP ${res.status}`);
      if (attempt < 3) { await sleep(700 * (attempt + 1)); continue; } // backoff: 0.7s, 1.4s, 2.1s
      throw lastErr;
    }
    if (!res.ok) { const text = await res.text().catch(() => ""); throw new Error(`RPC HTTP ${res.status}: ${text.slice(0, 120)}`); }
    const json = await res.json();
    if (json.error) throw new Error(`RPC: ${json.error.message || JSON.stringify(json.error)}`);
    return json.result;
  }
  throw lastErr || new Error("RPC falló");
}

function isValidSolanaAddress(addr) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)) return false;
  try {
    return base58Decode(addr).length === 32;
  } catch { return false; }
}

// ============================================================================
// Anchor discriminator (first 8 bytes of sha256("account:<Name>"))
// ============================================================================

const discriminatorCache = new Map();
async function anchorDisc(name) {
  if (discriminatorCache.has(name)) return discriminatorCache.get(name);
  const data = new TextEncoder().encode(`account:${name}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const disc = new Uint8Array(hash).slice(0, 8);
  discriminatorCache.set(name, disc);
  return disc;
}

function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// ============================================================================
// Borsh decoders (minimal, sin lib externa)
// ============================================================================

class BorshReader {
  constructor(uint8) {
    this.buf = uint8;
    this.dv = new DataView(uint8.buffer, uint8.byteOffset, uint8.byteLength);
    this.pos = 0;
  }
  bytes(n) { const out = this.buf.subarray(this.pos, this.pos + n); this.pos += n; return out; }
  u8() { const v = this.dv.getUint8(this.pos); this.pos += 1; return v; }
  u16() { const v = this.dv.getUint16(this.pos, true); this.pos += 2; return v; }
  i32() { const v = this.dv.getInt32(this.pos, true); this.pos += 4; return v; }
  u64() { const lo = BigInt(this.dv.getUint32(this.pos, true)); const hi = BigInt(this.dv.getUint32(this.pos + 4, true)); this.pos += 8; return (hi << 32n) | lo; }
  u128() { const a = this.u64(); const b = this.u64(); return (b << 64n) | a; }
  pubkey() { return new Pubkey(this.bytes(32).slice()); }
  skip(n) { this.pos += n; }
}

class Pubkey {
  constructor(bytes) { this.bytes = bytes; this._b58 = null; }
  toBase58() { if (!this._b58) this._b58 = base58Encode(this.bytes); return this._b58; }
  toBytes() { return this.bytes; }
}

const ORCA_POSITION_SIZE_MIN = 8 + 32 + 32 + 16 + 4 + 4 + 16 + 8 + 16 + 8; // sin rewards (mínimo razonable)

async function decodeOrcaPosition(data) {
  const expectedDisc = await anchorDisc("Position");
  if (data.length < 8 || !bytesEqual(data.subarray(0, 8), expectedDisc)) return null;
  const r = new BorshReader(data);
  r.skip(8);
  const whirlpool = r.pubkey();
  const positionMint = r.pubkey();
  const liquidity = r.u128();
  const tickLowerIndex = r.i32();
  const tickUpperIndex = r.i32();
  const feeGrowthCheckpointA = r.u128();
  const feeOwedA = r.u64();
  const feeGrowthCheckpointB = r.u128();
  const feeOwedB = r.u64();
  // rewardInfos (3 x { growthInside u128, amountOwed u64 }) -> omitido para Phase 1
  return { whirlpool, positionMint, liquidity, tickLowerIndex, tickUpperIndex, feeGrowthCheckpointA, feeOwedA, feeGrowthCheckpointB, feeOwedB };
}

async function decodeWhirlpool(data) {
  const expectedDisc = await anchorDisc("Whirlpool");
  if (data.length < 8 || !bytesEqual(data.subarray(0, 8), expectedDisc)) return null;
  const r = new BorshReader(data);
  r.skip(8);
  r.pubkey();           // whirlpoolsConfig
  r.skip(1);            // whirlpoolBump [u8;1]
  const tickSpacing = r.u16();
  r.skip(2);            // tickSpacingSeed [u8;2]
  const feeRate = r.u16();
  const protocolFeeRate = r.u16();
  const liquidity = r.u128();
  const sqrtPrice = r.u128();
  const tickCurrentIndex = r.i32();
  const protocolFeeOwedA = r.u64();
  const protocolFeeOwedB = r.u64();
  const tokenMintA = r.pubkey();
  const tokenVaultA = r.pubkey();
  const feeGrowthGlobalA = r.u128();
  const tokenMintB = r.pubkey();
  const tokenVaultB = r.pubkey();
  const feeGrowthGlobalB = r.u128();
  // rewardLastUpdatedTimestamp + rewardInfos -> omitido
  return { tickSpacing, feeRate, protocolFeeRate, liquidity, sqrtPrice, tickCurrentIndex, tokenMintA, tokenMintB, tokenVaultA, tokenVaultB, feeGrowthGlobalA, feeGrowthGlobalB };
}

// ============================================================================
// TickArray decoding + fees pendientes (uncollected)
//
// Orca guarda los ticks en cuentas TickArray (88 ticks cada una). Para calcular
// las fees aún no settled de una posición necesitamos el feeGrowthOutside de su
// tickLower y tickUpper, y el feeGrowthGlobal del pool.
// ============================================================================

const TICK_ARRAY_SIZE = 88;
// Tick (Borsh, sin padding): bool(1) + i128(16) + u128(16) + u128 fgoA(16) + u128 fgoB(16) + [u128;3](48) = 113
const TICK_BYTES = 113;
const TICKARRAY_HEADER = 8 + 4; // discriminator + start_tick_index (i32)

function getTickArrayStartIndex(tickIndex, tickSpacing) {
  const ticksInArray = TICK_ARRAY_SIZE * tickSpacing;
  return Math.floor(tickIndex / ticksInArray) * ticksInArray;
}

function deriveTickArrayPda(whirlpoolBytes, startIndex, orcaProgramBytes) {
  const prefix = new TextEncoder().encode("tick_array");
  const startStr = new TextEncoder().encode(String(startIndex));
  const { pda } = findProgramAddress([prefix, whirlpoolBytes, startStr], orcaProgramBytes);
  return base58Encode(pda);
}

// Devuelve { feeGrowthOutsideA, feeGrowthOutsideB } del tick pedido dentro del array.
function decodeTickFromArray(arrayData, tickIndex, startIndex, tickSpacing) {
  const offset = Math.floor((tickIndex - startIndex) / tickSpacing);
  if (offset < 0 || offset >= TICK_ARRAY_SIZE) return null;
  const base = TICKARRAY_HEADER + offset * TICK_BYTES;
  if (base + TICK_BYTES > arrayData.length) return null;
  const r = new BorshReader(arrayData);
  r.pos = base;
  const initialized = r.u8() !== 0;
  r.skip(16); // liquidityNet i128
  r.skip(16); // liquidityGross u128
  const feeGrowthOutsideA = r.u128();
  const feeGrowthOutsideB = r.u128();
  return { initialized, feeGrowthOutsideA, feeGrowthOutsideB };
}

const U128_MASK = (1n << 128n) - 1n;
const Q64_BI = 1n << 64n;
function wrapSubU128(a, b) { return (a - b) & U128_MASK; }

// Calcula fees no recogidas (raw, en unidades base de cada token, BigInt)
function computeUncollectedFees(pos, w, lowerTick, upperTick) {
  const fgoLowerA = lowerTick?.feeGrowthOutsideA ?? 0n;
  const fgoLowerB = lowerTick?.feeGrowthOutsideB ?? 0n;
  const fgoUpperA = upperTick?.feeGrowthOutsideA ?? 0n;
  const fgoUpperB = upperTick?.feeGrowthOutsideB ?? 0n;
  const cur = w.tickCurrentIndex;

  function inside(global, fgoLower, fgoUpper) {
    const below = cur >= pos.tickLowerIndex ? fgoLower : wrapSubU128(global, fgoLower);
    const above = cur < pos.tickUpperIndex ? fgoUpper : wrapSubU128(global, fgoUpper);
    return wrapSubU128(wrapSubU128(global, below), above);
  }

  const insideA = inside(w.feeGrowthGlobalA, fgoLowerA, fgoUpperA);
  const insideB = inside(w.feeGrowthGlobalB, fgoLowerB, fgoUpperB);
  const deltaA = wrapSubU128(insideA, pos.feeGrowthCheckpointA);
  const deltaB = wrapSubU128(insideB, pos.feeGrowthCheckpointB);
  // delta puede ser enorme si wrap dio un número casi-2^128 por desalineación;
  // en la práctica delta es pequeño. Limitamos a la mitad del rango para descartar ruido.
  const HALF = 1n << 127n;
  const da = deltaA > HALF ? 0n : deltaA;
  const db = deltaB > HALF ? 0n : deltaB;
  const uncollectedA = (pos.liquidity * da) / Q64_BI;
  const uncollectedB = (pos.liquidity * db) / Q64_BI;
  return { uncollectedA, uncollectedB };
}

// Lee todos los TickArrays necesarios para un conjunto de posiciones.
// Devuelve Map<pdaBase58, Uint8Array(arrayData)>
async function fetchTickArrays(positions, whirlpoolsMap, orcaProgramBytes) {
  const needed = new Map(); // pda -> { whirlpoolBytes, startIndex }
  for (const rp of positions) {
    const w = whirlpoolsMap.get(rp.position.whirlpool.toBase58());
    if (!w) continue;
    const whirlpoolBytes = rp.position.whirlpool.toBytes();
    for (const tickIdx of [rp.position.tickLowerIndex, rp.position.tickUpperIndex]) {
      const start = getTickArrayStartIndex(tickIdx, w.tickSpacing);
      const pda = deriveTickArrayPda(whirlpoolBytes, start, orcaProgramBytes);
      if (!needed.has(pda)) needed.set(pda, { start });
    }
  }
  const pdaList = [...needed.keys()];
  const map = new Map();
  for (let i = 0; i < pdaList.length; i += 100) {
    const chunk = pdaList.slice(i, i + 100);
    const accounts = await rpc("getMultipleAccounts", [chunk, { encoding: "base64" }]);
    const values = accounts?.value || [];
    for (let j = 0; j < chunk.length; j++) {
      const v = values[j];
      if (!v || !v.data) continue;
      map.set(chunk[j], Uint8Array.from(atob(v.data[0]), (c) => c.charCodeAt(0)));
    }
  }
  return map;
}

// ============================================================================
// V3 math (Orca usa sqrtPriceX64, no X96)
// ============================================================================

// sqrtPriceX64 (u128 BigInt) -> price ratio float
function sqrtPriceX64ToFloat(sqrtPriceX64) {
  // dividir por 2^64 con precisión: usar Number tras escalar
  // sqrtPriceX64 cabe en ~2^128, no en Number. Hacemos en BigInt y luego pasamos a float.
  const denom = 1n << 64n;
  // pasamos a float dividiendo en dos pasos para mantener precisión
  const intPart = sqrtPriceX64 / denom;
  const fracPart = sqrtPriceX64 % denom;
  return Number(intPart) + Number(fracPart) / 2 ** 64;
}

function sqrtPriceFromTick(tick) {
  return Math.pow(1.0001, tick / 2);
}

/**
 * Calcula amount0/amount1 dada la liquidez (u128 BigInt) y ticks.
 * Misma fórmula que Uniswap V3 pero usando sqrtPrice float derivado del X64.
 */
function getAmountsFromLiquidity(liquidity, sqrtP, tickLower, tickUpper, dec0, dec1) {
  const L = Number(liquidity);
  if (!isFinite(L) || L === 0) return { amount0: 0, amount1: 0 };
  const sqrtPa = sqrtPriceFromTick(tickLower);
  const sqrtPb = sqrtPriceFromTick(tickUpper);
  let amount0Raw = 0, amount1Raw = 0;
  if (sqrtP <= sqrtPa) {
    amount0Raw = L * (sqrtPb - sqrtPa) / (sqrtPa * sqrtPb);
  } else if (sqrtP < sqrtPb) {
    amount0Raw = L * (sqrtPb - sqrtP) / (sqrtP * sqrtPb);
    amount1Raw = L * (sqrtP - sqrtPa);
  } else {
    amount1Raw = L * (sqrtPb - sqrtPa);
  }
  return {
    amount0: amount0Raw / Math.pow(10, dec0),
    amount1: amount1Raw / Math.pow(10, dec1),
  };
}

function inRange(tick, lo, hi) { return tick >= lo && tick < hi; }

// ============================================================================
// Token metadata + prices (Jupiter)
// ============================================================================

async function ensureTokenList() {
  if (state.tokenList) return state.tokenList;
  try {
    const res = await fetch(JUPITER_TOKEN_LIST);
    if (!res.ok) throw new Error(`Jupiter list HTTP ${res.status}`);
    const arr = await res.json();
    const map = new Map();
    // Formato Jupiter v2: cada token tiene { id, symbol, name, decimals, icon, usdPrice }
    for (const t of (arr || [])) {
      if (!t.id) continue;
      map.set(t.id, {
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
        logoURI: t.icon,
      });
      // aprovechamos el usdPrice que viene incluido
      if (typeof t.usdPrice === "number") state.prices[t.id] = t.usdPrice;
    }
    state.tokenList = map;
    return map;
  } catch (e) {
    console.warn("Jupiter token list fallback (sin tokens conocidos):", e);
    state.tokenList = new Map();
    return state.tokenList;
  }
}

async function fetchTokenInfoFallback(mint) {
  // 1) Decimales on-chain — siempre fiable
  let decimals = 0;
  try {
    const info = await rpc("getAccountInfo", [mint, { encoding: "jsonParsed" }]);
    decimals = info?.value?.data?.parsed?.info?.decimals ?? 0;
  } catch {}
  // 2) Helius DAS getAsset para name/symbol/logo — funciona con cualquier mint
  // indexado (incluye xStocks, RWAs, tokens recientes que Jupiter no lista).
  // Sin esto, tokens no-verificados quedaban como "xxx…yyy / Unknown" y la
  // heurística xStock (símbolo TSLAx + name "xStock") no podía detectarlos.
  let symbol = mint.slice(0, 4) + "…" + mint.slice(-4);
  let name = "Unknown";
  let logoURI = null;
  try {
    const asset = await rpc("getAsset", { id: mint });
    const ti = asset?.token_info;
    const md = asset?.content?.metadata;
    if (ti?.symbol) symbol = ti.symbol;
    else if (md?.symbol) symbol = md.symbol;
    if (md?.name) name = md.name;
    if (typeof ti?.decimals === "number") decimals = ti.decimals;
    logoURI = asset?.content?.links?.image || asset?.content?.files?.[0]?.uri || null;
  } catch {}
  return { symbol, name, decimals, logoURI };
}

async function getTokenMeta(mint) {
  const list = await ensureTokenList();
  if (list.has(mint)) return list.get(mint);
  const fallback = await fetchTokenInfoFallback(mint);
  list.set(mint, fallback);
  return fallback;
}

async function fetchPricesUSD(mints) {
  if (!mints.length) return;
  // Solo consultamos los que aún no tenemos en cache (ahorra rate limit)
  const unique = [...new Set(mints)].filter((m) => state.prices[m] === undefined);
  if (!unique.length) return;
  // price v3 admite hasta 50 mints por llamada
  const chunks = [];
  for (let i = 0; i < unique.length; i += 50) chunks.push(unique.slice(i, i + 50));
  for (const chunk of chunks) {
    try {
      const res = await fetch(`${JUPITER_PRICE}?ids=${chunk.join(",")}`);
      if (!res.ok) continue;
      const json = await res.json();
      // v3 devuelve { mint: { usdPrice, decimals, ... } } directo, sin envoltorio data
      for (const mint of chunk) {
        const p = json?.[mint]?.usdPrice;
        if (typeof p === "number") state.prices[mint] = p;
      }
    } catch (e) {
      console.warn("Jupiter price chunk failed:", e);
    }
  }
}

// ============================================================================
// Orca position discovery
// ============================================================================

// ============================================================================
// Jupiter Lend — detección de vault-share tokens (jlUSDC, jlSOL, jlUSDT…).
// Helius DAS los devuelve como FungibleToken con name="jupiter lend USDC" etc.
// Los sacamos del listado idle y los presentamos como posición de lending
// (equivalente a Revert Lend en EVM). El valor en USD ya viene en token_info
// (Jupiter price feed) → balance × price = principal + interés acumulado.
// ============================================================================
const JUPITER_LEND_NAME_RX = /^jupiter\s+lend\s+/i;
const JUPITER_LEND_COLOR_HEX = "#22d3ee"; // cyan-400 (cercano a la marca Jupiter)

function isJupiterLendToken(t) {
  if (!t || !t.name) return false;
  return JUPITER_LEND_NAME_RX.test(t.name);
}

function buildJupiterLendPosition(t) {
  // Extraer activo subyacente: "jupiter lend USDC" → "USDC". Fallback al
  // símbolo: jlUSDC → USDC.
  let asset = "?";
  const m = (t.name || "").match(/jupiter\s+lend\s+(\S+)/i);
  if (m) asset = m[1].toUpperCase();
  else if (/^jl\w+/i.test(t.symbol || "")) asset = t.symbol.replace(/^jl/i, "").toUpperCase();
  const currentValueUSD = t.valueUSD || 0;
  return {
    _lending: true,
    protocol: "jupiter-lend",
    chainName: "Solana",
    mint: t.address, // mint del share token (jlUSDC)
    asset, // símbolo del subyacente (USDC, SOL…)
    shares: t.balance,
    sharePrice: t.priceUSD || null,
    currentValueUSD,
    // No tenemos histórico de depósito sin escanear todas las txs del owner.
    // Para una primera iteración mostramos solo el valor actual; PnL/APR se
    // quedan en null (la card lo refleja con "—").
    depositedUSD: null,
    gainsUSD: null,
    apr: null,
    feesUSD: 0,
    feesPendingUSD: 0,
    feesCollectedUSD: 0,
    ilUSD: null,
    pnlUSD: null,
    inRange: true, closed: false,
    ageDays: 0, openedAt: 0,
    color: hexToColorObj(JUPITER_LEND_COLOR_HEX),
    // Shims para code paths que esperan token0/token1 (charts, history loop, etc.).
    token0: { symbol: asset, decimals: t.decimals || 0, priceUSD: null },
    token1: { symbol: "lending", decimals: 0, priceUSD: null },
    amounts: { amount0: t.balance || 0, amount1: 0 },
    logo: t.logo || null,
  };
}

// Lista los tokens fungibles "sueltos" (idle) de la wallet — los que NO están dentro
// de posiciones LP. Helius DAS los devuelve junto con precios USD vía Jupiter en
// `token_info.price_info`. Incluimos también SOL nativo con su balance.
// Devuelve [{ chain, symbol, name, address, decimals, balance, priceUSD, valueUSD, logo }]
async function fetchIdleTokens(ownerAddr) {
  try {
    const assets = await rpc("getAssetsByOwner", {
      ownerAddress: ownerAddr,
      page: 1,
      limit: 1000,
      displayOptions: { showFungible: true, showNativeBalance: true },
    });
    const out = [];
    // 1) SOL nativo (no es un mint, viene aparte en nativeBalance)
    const nb = assets?.nativeBalance;
    if (nb && nb.lamports && nb.lamports > 0) {
      const balance = Number(nb.lamports) / 1e9;
      const priceUSD = typeof nb.price_per_sol === "number" ? nb.price_per_sol : null;
      out.push({
        chain: "solana", symbol: "SOL", name: "Solana",
        address: "So11111111111111111111111111111111111111112", decimals: 9,
        balance, priceUSD, valueUSD: priceUSD != null ? balance * priceUSD : null,
        logo: null, native: true,
      });
    }
    // 2) Fungibles SPL
    for (const a of (assets?.items || [])) {
      if (a.interface !== "FungibleToken" && a.interface !== "FungibleAsset") continue;
      const ti = a.token_info || {};
      const rawBalance = ti.balance != null ? Number(ti.balance) : 0;
      const decimals = ti.decimals != null ? Number(ti.decimals) : 0;
      if (!rawBalance) continue;
      const balance = rawBalance / Math.pow(10, decimals);
      const priceUSD = ti.price_info?.price_per_token ?? null;
      const valueUSD = priceUSD != null ? balance * priceUSD : null;
      out.push({
        chain: "solana",
        symbol: ti.symbol || a.content?.metadata?.symbol || a.id?.slice(0, 4),
        name: a.content?.metadata?.name || ti.symbol || "",
        address: a.id,
        decimals,
        balance, priceUSD, valueUSD,
        logo: a.content?.links?.image || a.content?.files?.[0]?.uri || null,
      });
    }
    return out.sort((a, b) => (b.valueUSD || 0) - (a.valueUSD || 0));
  } catch (e) {
    console.warn("fetchIdleTokens (Solana):", e);
    return [];
  }
}

// Lista NFTs (supply 1) de la wallet vía Helius DAS — compartido entre protocolos.
async function fetchWalletNftCandidates(ownerAddr) {
  setStatus("Listando NFTs de la wallet vía Helius DAS…", "info");
  const assets = await rpc("getAssetsByOwner", {
    ownerAddress: ownerAddr,
    page: 1,
    limit: 1000,
    displayOptions: { showFungible: false, showNativeBalance: false },
  });
  const items = assets?.items || [];
  return items.filter((a) => {
    const supply = a.token_info?.supply;
    return supply === 1 || supply === "1";
  });
}

async function findOrcaPositions(candidates) {
  const orcaProgramBytes = base58Decode(ORCA_WHIRLPOOL_PROGRAM);
  if (!candidates.length) return [];

  setStatus(`Derivando PDAs de Orca para ${candidates.length} NFTs…`, "info");

  // Derivar PDA por cada mint y batch fetch
  const seed = new TextEncoder().encode("position");
  const pdas = [];
  for (const c of candidates) {
    try {
      const mintBytes = base58Decode(c.id);
      if (mintBytes.length !== 32) continue;
      const { pda } = findProgramAddress([seed, mintBytes], orcaProgramBytes);
      pdas.push({ mint: c.id, pda: base58Encode(pda), asset: c });
    } catch (e) {
      // mint inválida, skip
    }
  }

  // getMultipleAccounts admite hasta 100 por llamada
  const chunks = [];
  for (let i = 0; i < pdas.length; i += 100) chunks.push(pdas.slice(i, i + 100));
  const positions = [];
  const expectedDisc = await anchorDisc("Position");

  for (const chunk of chunks) {
    const accounts = await rpc("getMultipleAccounts", [chunk.map((p) => p.pda), { encoding: "base64" }]);
    const values = accounts?.value || [];
    for (let i = 0; i < chunk.length; i++) {
      const v = values[i];
      if (!v || !v.data) continue;
      const [b64] = v.data;
      const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      if (raw.length < 8 || !bytesEqual(raw.subarray(0, 8), expectedDisc)) continue;
      const decoded = await decodeOrcaPosition(raw);
      if (decoded) {
        positions.push({ ...chunk[i], position: decoded });
      }
    }
  }

  return positions;
}

// ============================================================================
// Raydium CLMM (mismo patrón que Orca, layouts distintos)
// ============================================================================

function i32BeBytes(n) {
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setInt32(0, n, false); // big-endian
  return buf;
}

const RAY_TICK_ARRAY_SIZE = 60;
const RAY_TICK_BYTES = 168; // TickState packed
const RAY_TICKARRAY_HEADER = 8 + 32 + 4; // disc + pool_id + start_tick_index

function getRaydiumTickArrayStartIndex(tickIndex, tickSpacing) {
  const ticksInArray = RAY_TICK_ARRAY_SIZE * tickSpacing;
  return Math.floor(tickIndex / ticksInArray) * ticksInArray;
}

function deriveRaydiumTickArrayPda(poolBytes, startIndex, programBytes) {
  const prefix = new TextEncoder().encode("tick_array");
  const { pda } = findProgramAddress([prefix, poolBytes, i32BeBytes(startIndex)], programBytes);
  return base58Encode(pda);
}

function decodeRaydiumTick(arrayData, tickIndex, startIndex, tickSpacing) {
  const offset = Math.floor((tickIndex - startIndex) / tickSpacing);
  if (offset < 0 || offset >= RAY_TICK_ARRAY_SIZE) return null;
  const base = RAY_TICKARRAY_HEADER + offset * RAY_TICK_BYTES;
  if (base + 68 > arrayData.length) return null;
  const r = new BorshReader(arrayData);
  r.pos = base + 4 + 16 + 16; // skip tick(i32) + liquidityNet(i128) + liquidityGross(u128)
  const feeGrowthOutsideA = r.u128();
  const feeGrowthOutsideB = r.u128();
  return { feeGrowthOutsideA, feeGrowthOutsideB };
}

async function decodeRaydiumPosition(data) {
  const expectedDisc = await anchorDisc("PersonalPositionState");
  if (data.length < 8 || !bytesEqual(data.subarray(0, 8), expectedDisc)) return null;
  const r = new BorshReader(data);
  r.skip(8);  // disc
  r.skip(1);  // bump [u8;1]
  const nftMint = r.pubkey();
  const poolId = r.pubkey();
  const tickLowerIndex = r.i32();
  const tickUpperIndex = r.i32();
  const liquidity = r.u128();
  const feeGrowthInside0Last = r.u128();
  const feeGrowthInside1Last = r.u128();
  const tokenFeesOwed0 = r.u64();
  const tokenFeesOwed1 = r.u64();
  return { nftMint, poolId, tickLowerIndex, tickUpperIndex, liquidity, feeGrowthInside0Last, feeGrowthInside1Last, tokenFeesOwed0, tokenFeesOwed1 };
}

async function decodeRaydiumPool(data) {
  const expectedDisc = await anchorDisc("PoolState");
  if (data.length < 8 || !bytesEqual(data.subarray(0, 8), expectedDisc)) return null;
  const r = new BorshReader(data);
  // offsets exactos del struct PoolState
  r.pos = 73; const tokenMint0 = r.pubkey();   // @73
  const tokenMint1 = r.pubkey();               // @105
  const tokenVault0 = r.pubkey();              // @137
  const tokenVault1 = r.pubkey();              // @169
  r.pos = 233;
  const mintDecimals0 = r.u8();                // @233
  const mintDecimals1 = r.u8();                // @234
  const tickSpacing = r.u16();                 // @235
  const liquidity = r.u128();                  // @237
  const sqrtPriceX64 = r.u128();               // @253
  const tickCurrent = r.i32();                 // @269
  r.skip(4);                                   // padding3 + padding4 @273
  const feeGrowthGlobal0 = r.u128();           // @277
  const feeGrowthGlobal1 = r.u128();           // @293
  return { tokenMint0, tokenMint1, tokenVault0, tokenVault1, mintDecimals0, mintDecimals1, tickSpacing, liquidity, sqrtPriceX64, tickCurrent, feeGrowthGlobal0, feeGrowthGlobal1 };
}

async function findRaydiumPositions(candidates) {
  const programBytes = base58Decode(RAYDIUM_CLMM_PROGRAM);
  if (!candidates.length) return [];

  setStatus(`Derivando PDAs de Raydium para ${candidates.length} NFTs…`, "info");
  const seed = new TextEncoder().encode("position");
  const pdas = [];
  for (const c of candidates) {
    try {
      const mintBytes = base58Decode(c.id);
      if (mintBytes.length !== 32) continue;
      const { pda } = findProgramAddress([seed, mintBytes], programBytes);
      pdas.push({ mint: c.id, pda: base58Encode(pda), asset: c });
    } catch (e) { /* skip */ }
  }

  const chunks = [];
  for (let i = 0; i < pdas.length; i += 100) chunks.push(pdas.slice(i, i + 100));
  const positions = [];
  const expectedDisc = await anchorDisc("PersonalPositionState");

  for (const chunk of chunks) {
    const accounts = await rpc("getMultipleAccounts", [chunk.map((p) => p.pda), { encoding: "base64" }]);
    const values = accounts?.value || [];
    for (let i = 0; i < chunk.length; i++) {
      const v = values[i];
      if (!v || !v.data) continue;
      const raw = Uint8Array.from(atob(v.data[0]), (c) => c.charCodeAt(0));
      if (raw.length < 8 || !bytesEqual(raw.subarray(0, 8), expectedDisc)) continue;
      const decoded = await decodeRaydiumPosition(raw);
      if (decoded) positions.push({ ...chunk[i], position: decoded });
    }
  }
  return positions;
}

async function fetchRaydiumPools(positions) {
  const unique = [...new Set(positions.map((p) => p.position.poolId.toBase58()))];
  const chunks = [];
  for (let i = 0; i < unique.length; i += 100) chunks.push(unique.slice(i, i + 100));
  const map = new Map();
  for (const chunk of chunks) {
    const accounts = await rpc("getMultipleAccounts", [chunk, { encoding: "base64" }]);
    const values = accounts?.value || [];
    for (let i = 0; i < chunk.length; i++) {
      const v = values[i];
      if (!v || !v.data) continue;
      const raw = Uint8Array.from(atob(v.data[0]), (c) => c.charCodeAt(0));
      const decoded = await decodeRaydiumPool(raw);
      if (decoded) map.set(chunk[i], decoded);
    }
  }
  return map;
}

async function fetchRaydiumTickArrays(positions, poolsMap, programBytes) {
  const needed = new Map();
  for (const rp of positions) {
    const pool = poolsMap.get(rp.position.poolId.toBase58());
    if (!pool) continue;
    const poolBytes = rp.position.poolId.toBytes();
    for (const tickIdx of [rp.position.tickLowerIndex, rp.position.tickUpperIndex]) {
      const start = getRaydiumTickArrayStartIndex(tickIdx, pool.tickSpacing);
      const pda = deriveRaydiumTickArrayPda(poolBytes, start, programBytes);
      if (!needed.has(pda)) needed.set(pda, true);
    }
  }
  const pdaList = [...needed.keys()];
  const map = new Map();
  for (let i = 0; i < pdaList.length; i += 100) {
    const chunk = pdaList.slice(i, i + 100);
    const accounts = await rpc("getMultipleAccounts", [chunk, { encoding: "base64" }]);
    const values = accounts?.value || [];
    for (let j = 0; j < chunk.length; j++) {
      const v = values[j];
      if (!v || !v.data) continue;
      map.set(chunk[j], Uint8Array.from(atob(v.data[0]), (c) => c.charCodeAt(0)));
    }
  }
  return map;
}

async function enrichRaydiumPositions(rawPositions) {
  if (!rawPositions.length) return [];
  const programBytes = base58Decode(RAYDIUM_CLMM_PROGRAM);

  setStatus(`Leyendo ${new Set(rawPositions.map((p) => p.position.poolId.toBase58())).size} pools de Raydium…`, "info");
  const poolsMap = await fetchRaydiumPools(rawPositions);

  const mints = new Set();
  for (const rp of rawPositions) {
    const pool = poolsMap.get(rp.position.poolId.toBase58());
    if (!pool) continue;
    mints.add(pool.tokenMint0.toBase58());
    mints.add(pool.tokenMint1.toBase58());
  }

  setStatus("Cargando metadatos y precios (Raydium)…", "info");
  await ensureTokenList();
  const metaMap = new Map();
  for (const mint of mints) metaMap.set(mint, await getTokenMeta(mint));
  await fetchPricesUSD([...mints]);

  setStatus("Leyendo tick arrays de Raydium…", "info");
  let tickArrays = new Map();
  try {
    tickArrays = await fetchRaydiumTickArrays(rawPositions, poolsMap, programBytes);
  } catch (e) {
    console.warn("Raydium tick arrays fallo (fees solo settled):", e);
  }

  const enriched = [];
  for (const rp of rawPositions) {
    const p = rp.position;
    const poolAddr = p.poolId.toBase58();
    const pool = poolsMap.get(poolAddr);
    if (!pool) continue;

    const mintA = pool.tokenMint0.toBase58();
    const mintB = pool.tokenMint1.toBase58();
    const tokA = metaMap.get(mintA) || { symbol: shortAddr(mintA), decimals: pool.mintDecimals0 };
    const tokB = metaMap.get(mintB) || { symbol: shortAddr(mintB), decimals: pool.mintDecimals1 };
    // Raydium da los decimales en el pool: preferimos esos si la metadata no los trae
    const dec0 = tokA.decimals ?? pool.mintDecimals0;
    const dec1 = tokB.decimals ?? pool.mintDecimals1;
    const priceA = state.prices[mintA] || 0;
    const priceB = state.prices[mintB] || 0;

    const sqrtP = sqrtPriceX64ToFloat(pool.sqrtPriceX64);
    const amounts = getAmountsFromLiquidity(p.liquidity, sqrtP, p.tickLowerIndex, p.tickUpperIndex, dec0, dec1);
    const currentValueUSD = amounts.amount0 * priceA + amounts.amount1 * priceB;

    // Fees: uncollected via tick arrays + token_fees_owed
    let uncollectedA = 0n, uncollectedB = 0n;
    const poolBytes = p.poolId.toBytes();
    const startLower = getRaydiumTickArrayStartIndex(p.tickLowerIndex, pool.tickSpacing);
    const startUpper = getRaydiumTickArrayStartIndex(p.tickUpperIndex, pool.tickSpacing);
    const lowerArr = tickArrays.get(deriveRaydiumTickArrayPda(poolBytes, startLower, programBytes));
    const upperArr = tickArrays.get(deriveRaydiumTickArrayPda(poolBytes, startUpper, programBytes));
    if (lowerArr && upperArr) {
      const lowerTick = decodeRaydiumTick(lowerArr, p.tickLowerIndex, startLower, pool.tickSpacing);
      const upperTick = decodeRaydiumTick(upperArr, p.tickUpperIndex, startUpper, pool.tickSpacing);
      // reutilizamos computeUncollectedFees con shapes compatibles
      const posCompat = {
        tickLowerIndex: p.tickLowerIndex, tickUpperIndex: p.tickUpperIndex, liquidity: p.liquidity,
        feeGrowthCheckpointA: p.feeGrowthInside0Last, feeGrowthCheckpointB: p.feeGrowthInside1Last,
      };
      const wCompat = { tickCurrentIndex: pool.tickCurrent, feeGrowthGlobalA: pool.feeGrowthGlobal0, feeGrowthGlobalB: pool.feeGrowthGlobal1 };
      const unc = computeUncollectedFees(posCompat, wCompat, lowerTick, upperTick);
      uncollectedA = unc.uncollectedA;
      uncollectedB = unc.uncollectedB;
    }

    const feesA = Number(p.tokenFeesOwed0 + uncollectedA) / Math.pow(10, dec0);
    const feesB = Number(p.tokenFeesOwed1 + uncollectedB) / Math.pow(10, dec1);
    const feesPendingUSD = feesA * priceA + feesB * priceB;

    const closed = p.liquidity === 0n;
    const inR = inRange(pool.tickCurrent, p.tickLowerIndex, p.tickUpperIndex);

    enriched.push({
      protocol: "raydium",
      id: rp.pda,
      mint: rp.mint,
      whirlpool: poolAddr,
      vaults: [pool.tokenVault0.toBase58(), pool.tokenVault1.toBase58()],
      feeTier: null, // Raydium guarda la fee en amm_config; lo omitimos por ahora
      tickSpacing: pool.tickSpacing,
      tickLower: p.tickLowerIndex,
      tickUpper: p.tickUpperIndex,
      tick: pool.tickCurrent,
      liquidity: p.liquidity,
      closed,
      inRange: inR,
      token0: { mint: mintA, symbol: tokA.symbol, decimals: dec0, priceUSD: priceA },
      token1: { mint: mintB, symbol: tokB.symbol, decimals: dec1, priceUSD: priceB },
      amounts,
      currentValueUSD,
      feesA, feesB, feesPendingUSD,
    });
  }
  return enriched;
}

async function fetchWhirlpoolsFor(positions) {
  const unique = [...new Set(positions.map((p) => p.position.whirlpool.toBase58()))];
  const chunks = [];
  for (let i = 0; i < unique.length; i += 100) chunks.push(unique.slice(i, i + 100));
  const map = new Map();
  for (const chunk of chunks) {
    const accounts = await rpc("getMultipleAccounts", [chunk, { encoding: "base64" }]);
    const values = accounts?.value || [];
    for (let i = 0; i < chunk.length; i++) {
      const v = values[i];
      if (!v || !v.data) continue;
      const raw = Uint8Array.from(atob(v.data[0]), (c) => c.charCodeAt(0));
      const decoded = await decodeWhirlpool(raw);
      if (decoded) map.set(chunk[i], decoded);
    }
  }
  return map;
}

// ============================================================================
// Enrichment (junta position + whirlpool + metadatos + precios)
// ============================================================================

async function enrichOrcaPositions(rawPositions) {
  if (!rawPositions.length) return [];

  // Fetch whirlpools en batch
  setStatus(`Leyendo ${new Set(rawPositions.map((p) => p.position.whirlpool.toBase58())).size} pools…`, "info");
  const whirlpoolsMap = await fetchWhirlpoolsFor(rawPositions);

  // Recopilar mints únicos
  const mints = new Set();
  for (const rp of rawPositions) {
    const w = whirlpoolsMap.get(rp.position.whirlpool.toBase58());
    if (!w) continue;
    mints.add(w.tokenMintA.toBase58());
    mints.add(w.tokenMintB.toBase58());
  }

  setStatus("Cargando metadatos y precios de tokens…", "info");
  await ensureTokenList();
  // metadata de cada mint (los que falten en la lista verificada se resuelven on-chain)
  const metaMap = new Map();
  for (const mint of mints) {
    metaMap.set(mint, await getTokenMeta(mint));
  }
  await fetchPricesUSD([...mints]);

  // TickArrays para calcular fees no recogidas (uncollected)
  setStatus("Leyendo tick arrays para fees pendientes…", "info");
  const orcaProgramBytes = base58Decode(ORCA_WHIRLPOOL_PROGRAM);
  let tickArrays = new Map();
  try {
    tickArrays = await fetchTickArrays(rawPositions, whirlpoolsMap, orcaProgramBytes);
  } catch (e) {
    console.warn("No se pudieron leer tick arrays (fees solo mostrarán lo settled):", e);
  }

  const enriched = [];
  for (const rp of rawPositions) {
    const p = rp.position;
    const wAddr = p.whirlpool.toBase58();
    const w = whirlpoolsMap.get(wAddr);
    if (!w) continue;

    const mintA = w.tokenMintA.toBase58();
    const mintB = w.tokenMintB.toBase58();
    const tokA = metaMap.get(mintA);
    const tokB = metaMap.get(mintB);
    const priceA = state.prices[mintA] || 0;
    const priceB = state.prices[mintB] || 0;

    const sqrtP = sqrtPriceX64ToFloat(w.sqrtPrice);
    // sqrtP corresponde a precio de B en términos de A en el pool (sin ajustar por decimales)
    // El cálculo de amounts a partir de liquidity necesita la sqrtP *no normalizada* —
    // así que la usamos directamente con la fórmula V3.
    const amounts = getAmountsFromLiquidity(
      p.liquidity, sqrtP, p.tickLowerIndex, p.tickUpperIndex,
      tokA.decimals || 0, tokB.decimals || 0,
    );

    const currentValueUSD = amounts.amount0 * priceA + amounts.amount1 * priceB;

    // Fees pendientes = feeOwed (settled) + uncollected (calculado de los tick arrays)
    let uncollectedA = 0n, uncollectedB = 0n;
    const whirlpoolBytes = p.whirlpool.toBytes();
    const startLower = getTickArrayStartIndex(p.tickLowerIndex, w.tickSpacing);
    const startUpper = getTickArrayStartIndex(p.tickUpperIndex, w.tickSpacing);
    const lowerArr = tickArrays.get(deriveTickArrayPda(whirlpoolBytes, startLower, orcaProgramBytes));
    const upperArr = tickArrays.get(deriveTickArrayPda(whirlpoolBytes, startUpper, orcaProgramBytes));
    if (lowerArr && upperArr) {
      const lowerTick = decodeTickFromArray(lowerArr, p.tickLowerIndex, startLower, w.tickSpacing);
      const upperTick = decodeTickFromArray(upperArr, p.tickUpperIndex, startUpper, w.tickSpacing);
      const unc = computeUncollectedFees(p, w, lowerTick, upperTick);
      uncollectedA = unc.uncollectedA;
      uncollectedB = unc.uncollectedB;
    }

    // total raw (settled + uncollected), en unidades base del token
    const feesA = Number(p.feeOwedA + uncollectedA) / Math.pow(10, tokA.decimals || 0);
    const feesB = Number(p.feeOwedB + uncollectedB) / Math.pow(10, tokB.decimals || 0);
    const feesPendingUSD = feesA * priceA + feesB * priceB;

    const closed = p.liquidity === 0n;
    const inR = inRange(w.tickCurrentIndex, p.tickLowerIndex, p.tickUpperIndex);

    enriched.push({
      protocol: "orca",
      id: rp.pda,
      mint: rp.mint,
      whirlpool: wAddr,
      vaults: [w.tokenVaultA.toBase58(), w.tokenVaultB.toBase58()],
      feeTier: w.feeRate / 10000, // bps a %
      tickSpacing: w.tickSpacing,
      tickLower: p.tickLowerIndex,
      tickUpper: p.tickUpperIndex,
      tick: w.tickCurrentIndex,
      liquidity: p.liquidity,
      closed,
      inRange: inR,
      token0: { mint: mintA, ...tokA, priceUSD: priceA },
      token1: { mint: mintB, ...tokB, priceUSD: priceB },
      amounts,
      currentValueUSD,
      feesA, feesB, feesPendingUSD,
    });
  }
  return enriched;
}

// ============================================================================
// Formatting helpers
// ============================================================================

// fmtUSD, fmtUSDc y fmtToken viven en common.js (compartidos con evm/app.js).

function shortAddr(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

// pnlColor y fmtPct viven en common.js (compartidos con evm/app.js).

// Traduce un error técnico a una causa legible para el usuario.
function classifyError(msg) {
  const m = String(msg || "");
  if (/\b401\b|Inicia sesión|Sesión inválida|autenticaci/i.test(m)) return "Para analizar, inicia sesión o configura tu Helius API key en Settings.";
  if (/\b403\b|no está autorizada|no autorizado/i.test(m)) return "Tu cuenta no está autorizada.";
  if (/\b429\b|Demasiadas|rate.?limit|Límite/i.test(m)) return "Límite de peticiones alcanzado. Reintenta en un momento.";
  if (/Falta Helius|proxy/i.test(m)) return "Falta Helius API key o proxy configurado (abre Settings).";
  if (/Failed to fetch|NetworkError|timeout|502|503|504/i.test(m)) return "Error de red o servicio no disponible. Reintenta en un momento.";
  return `Error: ${m.slice(0, 100)}`;
}

// ============================================================================
// Settings UI
// ============================================================================

function openSettings() {
  document.getElementById("settings-overlay").classList.remove("hidden");
  document.getElementById("settings-panel").classList.remove("hidden");
  renderSettings();
}

function closeSettings(e) {
  if (e && e.target && e.target.id !== "settings-overlay") return;
  document.getElementById("settings-overlay").classList.add("hidden");
  document.getElementById("settings-panel").classList.add("hidden");
}

function renderSettings() {
  document.getElementById("cfg-helius-key").value = state.heliusKey;
  document.getElementById("cfg-birdeye-key").value = state.birdeyeKey;
  const container = document.getElementById("protocol-config");
  container.innerHTML = "";
  for (const [key, p] of Object.entries(PROTOCOLS)) {
    const row = document.createElement("div");
    row.className = "flex items-center gap-2 text-xs";
    const status = p.enabled
      ? `<span class="chip bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">activo</span>`
      : `<span class="chip bg-slate-700 text-slate-400">próximamente</span>`;
    row.innerHTML = `
      <div class="w-3 h-3 rounded-full shrink-0" style="background:${p.color}"></div>
      <div class="flex-1 text-slate-300">${p.name}</div>
      ${status}
    `;
    container.appendChild(row);
  }
}

function saveSettings() {
  state.heliusKey = document.getElementById("cfg-helius-key").value.trim();
  state.birdeyeKey = document.getElementById("cfg-birdeye-key").value.trim();
  localStorage.setItem("sol:heliusKey", state.heliusKey);
  localStorage.setItem("sol:birdeyeKey", state.birdeyeKey);
  closeSettings();
  setStatus("Settings guardadas.", "ok");
}

// ============================================================================
// Protocol chips
// ============================================================================

function renderProtocolChips() {
  const container = document.getElementById("protocol-chips");
  container.innerHTML = "";
  for (const [key, p] of Object.entries(PROTOCOLS)) {
    const active = state.selectedProtocols.includes(key);
    const disabled = !p.enabled;
    const btn = document.createElement("button");
    btn.title = disabled ? "Próximamente" : p.name;
    btn.disabled = disabled;
    const baseCls = disabled
      ? "chip border border-slate-800 bg-slate-900 text-slate-500 cursor-not-allowed"
      : active
        ? "chip border border-[#ECE600] bg-[#ECE600]/15 text-yellow-200"
        : "chip border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700";
    btn.className = baseCls;
    btn.innerHTML = `<span class="w-2 h-2 rounded-full" style="background:${p.color}"></span>${p.name}${disabled ? " <span class=\"text-amber-400\">⚠</span>" : ""}`;
    if (!disabled) {
      btn.onclick = () => {
        if (active) state.selectedProtocols = state.selectedProtocols.filter((k) => k !== key);
        else state.selectedProtocols.push(key);
        localStorage.setItem("sol:selectedProtocols", JSON.stringify(state.selectedProtocols));
        renderProtocolChips();
      };
    }
    container.appendChild(btn);
  }
}

// ============================================================================
// Status / loading
// ============================================================================

function setStatus(msg, kind) {
  const el = document.getElementById("status-msg");
  if (!msg) { el.classList.add("hidden"); el.textContent = ""; return; }
  el.classList.remove("hidden");
  const palette = {
    ok: "text-emerald-400",
    err: "text-rose-400",
    info: "text-slate-300",
  }[kind || "info"];
  el.className = `mt-3 text-sm ${palette}`;
  el.textContent = msg;
}

function setLoading(loading) {
  state.loading = loading;
  const btn = document.getElementById("btn-analyze");
  btn.disabled = loading;
  btn.textContent = loading ? "Analizando…" : "Analizar";
}

// ============================================================================
// Render
// ============================================================================

function aggregate(positions) {
  return positions.reduce((acc, p) => {
    acc.current += p.currentValueUSD || 0;
    acc.fees += p.feesPendingUSD || 0;
    if (p.closed) acc.closed++;
    else if (p.inRange) acc.inRange++;
    else acc.outRange++;
    return acc;
  }, { current: 0, fees: 0, inRange: 0, outRange: 0, closed: 0 });
}

// Color distinto y estable por pool (mismo color en tarjetas y gráficos)
function distinctColor(i) {
  const hue = Math.round((i * 137.508) % 360);
  return { line: `hsl(${hue} 70% 60%)`, fill: `hsl(${hue} 70% 60% / 0.15)` };
}
function hexToColorObj(hex) {
  let h = String(hex || "").replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return { line: `rgb(${r} ${g} ${b})`, fill: `rgb(${r} ${g} ${b} / 0.15)` };
}
// Mismo color para todas las posiciones del MISMO protocolo (Orca amarillo, Raydium
// magenta). Si no hay protocolo conocido → fallback rotativo.
function assignColors(list) {
  list.forEach((p, i) => {
    if (p.color) return; // ya viene precomputado (p. ej. Jupiter Lend)
    const proto = p.protocol && PROTOCOLS[p.protocol];
    p.color = (proto && hexToColorObj(proto.color)) || distinctColor(i);
  });
}

function renderAll() {
  renderSummary();
  renderPositions();
  renderCharts();
}

function renderSummary() {
  const section = document.getElementById("summary-section");
  if (!state.positions.length) { section.classList.add("hidden"); return; }
  section.classList.remove("hidden");
  const agg = aggregate(state.positions);
  document.getElementById("sum-positions").textContent = state.positions.length;
  document.getElementById("sum-positions-sub").textContent = state.hideClosed
    ? `${agg.inRange} en rango · ${agg.outRange} fuera`
    : `${agg.inRange} en rango · ${agg.outRange} fuera · ${agg.closed} cerradas`;
  document.getElementById("sum-current").textContent = fmtUSD(agg.current);
  document.getElementById("sum-fees").textContent = fmtUSD(agg.fees);
  document.getElementById("sum-range").textContent = `${agg.inRange}/${state.positions.length - agg.closed || 0}`;
}

function renderPositions() {
  const section = document.getElementById("positions-section");
  const empty = document.getElementById("empty-state");
  if (!state.positions.length) { section.classList.add("hidden"); return; }
  empty.classList.add("hidden");
  section.classList.remove("hidden");

  const sorters = {
    value: (a, b) => b.currentValueUSD - a.currentValueUSD,
    fees: (a, b) => b.feesPendingUSD - a.feesPendingUSD,
  };
  let list = [...state.positions].sort(sorters[state.sortBy] || sorters.value);
  if (state.hideClosed) list = list.filter((p) => !p.closed);

  const container = document.getElementById("positions-list");
  container.innerHTML = "";
  for (const p of list) container.appendChild(positionCard(p));
}

// rangeBarHTML vive en common.js (compartido con evm/app.js).

// Devuelve { url, label } con el enlace a la web para gestionar la posición.
// - Orca: deep-link `/pools/<whirlpool>` (patrón usado por DexScreener/Birdeye).
// - Raydium: portfolio (`/portfolio/`). Probamos deep-links por pool ID
//   (`?token=<pool>` y `?search=<pool>` sobre `/liquidity-pools/`) leyendo
//   el frontend V3 público pero NO funcionan en la web desplegada — verificado
//   por el usuario. El portfolio sí carga y muestra las posiciones del wallet
//   conectado, así que es el enlace fiable.
// - Jupiter Lend → página general (no expone deep-link por vault).
function managementLinkSol(p) {
  if (p._lending) {
    if (p.protocol === "jupiter-lend") return { url: "https://jup.ag/lend", label: "Jupiter Lend" };
    return null;
  }
  if (p.protocol === "orca") {
    return p.whirlpool
      ? { url: `https://www.orca.so/pools/${p.whirlpool}`, label: "Orca" }
      : { url: "https://www.orca.so/portfolio", label: "Orca" };
  }
  if (p.protocol === "raydium") {
    return { url: "https://raydium.io/portfolio/", label: "Raydium" };
  }
  return null;
}

function managementFooterHTML(link) {
  if (!link) return "";
  return `
    <div class="flex justify-end pt-1">
      <a href="${link.url}" target="_blank" rel="noopener noreferrer"
         class="text-[11px] text-purple-300 hover:text-purple-200 inline-flex items-center gap-1">
        Gestionar en ${link.label} ↗
      </a>
    </div>`;
}

// Card de lending (Jupiter Lend en Solana). Mismo layout que la de Revert Lend
// del lado EVM para que la vista Portfolio sea consistente entre cadenas.
function lendingCard(p) {
  const el = document.createElement("article");
  el.className = "rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3 hover:border-slate-700 transition";
  if (p.color) el.style.borderLeft = `3px solid ${p.color.line}`;
  const gain = p.gainsUSD;
  const protoLabel = p.protocol === "jupiter-lend" ? "Jupiter Lend" : (p.protocol || "Lending");
  const shareSymbol = p.protocol === "jupiter-lend" ? `jl${p.asset}` : "shares";
  const sharesTxt = p.shares != null ? fmtToken(p.shares, shareSymbol) : "";
  el.innerHTML = `
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full" style="background:${p.color ? p.color.line : "#22d3ee"}"></span>
          <span class="text-[11px] uppercase tracking-wide text-slate-400">${protoLabel} · ${p.chainName || "Solana"}</span>
        </div>
        <div class="font-semibold mt-0.5 truncate">${p.asset} (lending)</div>
        <div class="text-[11px] text-slate-400">${sharesTxt}</div>
      </div>
      <span class="chip bg-sky-500/15 text-sky-300 border border-sky-500/30">préstamo</span>
    </div>
    <div class="grid grid-cols-2 gap-2 text-xs">
      <div class="bg-slate-950/40 rounded-lg p-2">
        <div class="text-[10px] uppercase tracking-wide text-slate-500">Valor actual</div>
        <div class="font-semibold">${fmtUSD(p.currentValueUSD)}</div>
        <div class="text-[10px] text-slate-400 mt-0.5">depo ${p.depositedUSD == null ? "—" : fmtUSD(p.depositedUSD)}</div>
      </div>
      <div class="bg-slate-950/40 rounded-lg p-2">
        <div class="text-[10px] uppercase tracking-wide text-slate-500">Ganancias (interés)</div>
        <div class="font-semibold ${gain == null ? "" : pnlColor(gain)}">${gain == null ? "—" : fmtUSD(gain)}</div>
        <div class="text-[10px] text-slate-400 mt-0.5">APR ~ ${p.apr == null
          ? (p._aprTooEarly ? `— <span class="text-slate-500">(esperando ≥ 1 día)</span>` : "—")
          : p.apr.toFixed(1) + "%"}</div>
      </div>
    </div>
    <details class="text-xs">
      <summary class="text-slate-400 hover:text-slate-200">▾ detalles</summary>
      <div class="mt-2 space-y-1 text-slate-400">
        <div>Vault token: <a href="https://solscan.io/token/${p.mint}" target="_blank" class="font-mono text-slate-300 hover:text-fuchsia-300">${shortAddr(p.mint)}</a></div>
        <div>Activo subyacente: ${p.asset}</div>
        ${p._priceFromOnchain
          ? `<div class="text-emerald-300">Precio share on-chain: <span class="font-semibold">${fmtUSD(p.sharePrice)}</span>${p._heliusSharePrice != null ? ` <span class="text-slate-500">(Jupiter feed daba ${fmtUSD(p._heliusSharePrice)})</span>` : ""}</div>`
          : p._priceFromTx
            ? `<div class="text-amber-300">Precio share corregido: <span class="font-semibold">${fmtUSD(p.sharePrice)}</span> <span class="text-slate-500">(derivado on-chain de tu última operación; Jupiter daba ${fmtUSD(p._heliusSharePrice)})</span></div>`
            : (p.sharePrice != null ? `<div>Precio share: ${fmtUSD(p.sharePrice)}</div>` : "")}
        ${p.ageDays ? `<div>Abierto hace ~${Math.round(p.ageDays)}d (primer depósito: ${new Date((p.openedAt || 0) * 1000).toLocaleDateString("es-ES")})</div>` : ""}
        ${p.withdrawnUSD ? `<div>Total retirado: ${fmtUSD(p.withdrawnUSD)}</div>` : ""}
        <div class="text-[10px] text-slate-500 mt-1">${p._priceFromOnchain
          ? "Valor actual leído directamente del vault on-chain de Jupiter Lend (campo token_exchange_price del Lending account). Coste base reconstruido del histórico de transacciones del owner."
          : p.pnlBasis === "tx-scan"
            ? (p._priceFromTx
                ? "Coste base, interés y precio share reconstruidos del histórico de transacciones del owner (verdad on-chain — el price feed de Jupiter/Helius no cuadraba con el último depósito real)."
                : "Coste base e interés reconstruidos del histórico de transacciones (Helius). Precio share del feed de Jupiter (Helius).")
            : "Histórico de depósitos no disponible (sin Helius). Valor actual = shares × precio Jupiter."}</div>
      </div>
    </details>
    ${managementFooterHTML(managementLinkSol(p))}`;
  return el;
}

function positionCard(p) {
  if (p._lending) return lendingCard(p);
  const proto = PROTOCOLS[p.protocol];
  const el = document.createElement("article");
  el.className = "rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3 hover:border-slate-700 transition";
  if (p.color) el.style.borderLeft = `3px solid ${p.color.line}`;

  const rangeChip = p.closed
    ? `<span class="chip bg-slate-700 text-slate-300">cerrada</span>`
    : p.inRange
      ? `<span class="chip bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">en rango</span>`
      : `<span class="chip bg-amber-500/15 text-amber-300 border border-amber-500/30">fuera de rango</span>`;

  el.innerHTML = `
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full" style="background:${p.color ? p.color.line : proto.color}"></span>
          <span class="text-[11px] uppercase tracking-wide text-slate-400">${proto.name}</span>
        </div>
        <div class="font-semibold mt-0.5 truncate">${p.token0.symbol} / ${p.token1.symbol}</div>
        ${p.feeTier != null ? `<div class="text-[11px] text-slate-400">fee ${p.feeTier.toFixed(2)}%</div>` : ""}
      </div>
      ${rangeChip}
    </div>

    ${rangeBarHTML(p.tickLower, p.tickUpper, p.tick, p.token0.decimals, p.token1.decimals, p.inRange, p.closed)}

    <div class="grid grid-cols-2 gap-2 text-xs">
      <div class="bg-slate-950/40 rounded-lg p-2">
        <div class="text-[10px] uppercase tracking-wide text-slate-500">Valor actual</div>
        <div class="font-semibold">${fmtUSD(p.currentValueUSD)}</div>
        ${(() => {
          const v0 = (p.amounts.amount0 || 0) * (p.token0.priceUSD || 0);
          const v1 = (p.amounts.amount1 || 0) * (p.token1.priceUSD || 0);
          const tot = v0 + v1;
          const pct0 = tot > 0 ? (v0 / tot) * 100 : 0;
          const pct1 = tot > 0 ? (v1 / tot) * 100 : 0;
          return `
            <div class="text-[10px] text-slate-400 mt-0.5">${fmtToken(p.amounts.amount0, p.token0.symbol)} <span class="text-slate-500">(${pct0.toFixed(1)}%)</span></div>
            <div class="text-[10px] text-slate-400">${fmtToken(p.amounts.amount1, p.token1.symbol)} <span class="text-slate-500">(${pct1.toFixed(1)}%)</span></div>
          `;
        })()}
      </div>
      <div class="bg-slate-950/40 rounded-lg p-2">
        <div class="text-[10px] uppercase tracking-wide text-slate-500">Fees</div>
        ${p.pnlBasis === "birdeye" ? `<div class="font-semibold text-emerald-400 leading-tight">${fmtUSD(p.feesCollectedUSD || 0)} <span class="text-[10px] font-normal text-slate-400">cobradas</span></div>` : ""}
        <div class="font-semibold text-amber-300 leading-tight">${fmtUSD(p.feesPendingUSD)} <span class="text-[10px] font-normal text-slate-400">pendientes</span></div>
        <div class="text-[10px] text-slate-400 mt-0.5">APR fees ~ ${(p.apr != null && isFinite(p.apr)) ? p.apr.toFixed(1) + "%" : "—"}</div>
        <div class="text-[10px] text-slate-400">${fmtToken(p.feesA, p.token0.symbol)}</div>
        <div class="text-[10px] text-slate-400">${fmtToken(p.feesB, p.token1.symbol)}</div>
      </div>
      ${p.pnlBasis === "birdeye" ? (() => {
        const src = p.pnlUsedYahoo ? "Birdeye + Yahoo Finance (fallback xStocks)" : "Birdeye";
        return `
      <div class="bg-slate-950/40 rounded-lg p-2">
        <div class="text-[10px] uppercase tracking-wide text-slate-500">IL vs HODL <span class="cursor-help" title="Valor actual del LP frente a haber mantenido (HODL) los tokens depositados. Estimación con precios históricos de ${src}; no incluye gas.">ⓘ</span></div>
        <div class="font-semibold ${pnlColor(p.ilUSD)}">${fmtUSD(p.ilUSD)}</div>
        <div class="text-[10px] ${pnlColor(p.ilUSD)} mt-0.5">${fmtPct(p.ilPct)}</div>
      </div>
      <div class="bg-slate-950/40 rounded-lg p-2">
        <div class="text-[10px] uppercase tracking-wide text-slate-500">PnL neto <span class="cursor-help" title="Valor actual + retirado + fees − depositado, con precios históricos de ${src}. Estimación: fees y retiros se separan por heurística y NO incluye gas.">ⓘ</span></div>
        <div class="font-semibold ${pnlColor(p.pnlUSD)}">${fmtUSD(p.pnlUSD)}</div>
        ${pnlInBaseHTML(p.pnlUSD, p.token0.symbol, p.token1.symbol, p.token0.priceUSD, p.token1.priceUSD)}
        <div class="text-[10px] text-slate-400 mt-0.5">depo ${fmtUSD(p.depositedUSD)}</div>
        ${pnlBreakdownHTML(p.pnlUSD, p.ilUSD, (p.feesCollectedUSD || 0) + (p.feesPendingUSD || 0))}
      </div>`;
      })() : ""}
    </div>

    <details class="text-xs">
      <summary class="text-slate-400 hover:text-slate-200">▾ detalles</summary>
      <div class="mt-2 space-y-1 text-slate-400">
        <div>Position NFT: <a href="https://solscan.io/token/${p.mint}" target="_blank" class="font-mono text-slate-300 hover:text-purple-300">${shortAddr(p.mint)}</a></div>
        <div>Whirlpool: <a href="https://solscan.io/account/${p.whirlpool}" target="_blank" class="font-mono text-slate-300 hover:text-purple-300">${shortAddr(p.whirlpool)}</a></div>
        <div>Rango ticks: ${p.tickLower} → ${p.tickUpper} (actual: ${p.tick})</div>
        <div>tickSpacing: ${p.tickSpacing} <span class="text-[10px] text-slate-500">(granularidad mínima del rango — saltos de ${(p.tickSpacing * 0.01).toFixed(2)}% de precio)</span></div>
        <div>Liquidez: <span class="font-mono">${p.liquidity.toString()}</span></div>
        ${p.pnlBasis === "birdeye" ? `
        <div class="pt-1 mt-1 border-t border-slate-800">Depositado (coste): ${fmtUSD(p.depositedUSD)}</div>
        <div>Retirado: ${fmtUSD(p.withdrawnUSD)} · Fees cobradas: ${fmtUSD(p.feesCollectedUSD)}</div>
        <div>Valor HODL hoy: ${fmtUSD(p.hodlUSD)}</div>
        <div class="text-[10px] text-slate-500">PnL/IL con precios históricos de ${p.pnlUsedYahoo
          ? `Birdeye + <span class="text-amber-300">Yahoo Finance</span> (fallback xStocks: la acción subyacente como proxy del xToken)`
          : "Birdeye"} (estimación; fees vs retiros por heurística).</div>` : ""}
      </div>
    </details>
    ${managementFooterHTML(managementLinkSol(p))}
  `;
  return el;
}

function renderCharts() {
  const section = document.getElementById("charts-section");
  if (!state.positions.length) { section.classList.add("hidden"); return; }
  section.classList.remove("hidden");
  renderValueChart();
}

// barValueLabels (plugin Chart.js) vive en common.js (compartido con evm/app.js).

function renderValueChart() {
  const top = [...state.positions]
    .sort((a, b) => b.currentValueUSD - a.currentValueUSD)
    .slice(0, 8);
  const labels = top.map((p) => p._lending ? `${p.asset} (lending)` : `${p.token0.symbol}/${p.token1.symbol}`);
  const data = top.map((p) => p.currentValueUSD);
  const bg = top.map((p) => (p.color ? p.color.line : (PROTOCOLS[p.protocol] && PROTOCOLS[p.protocol].color) || "#22d3ee"));

  if (charts.value) charts.value.destroy();
  charts.value = new Chart(document.getElementById("chart-value"), {
    type: "bar",
    data: { labels, datasets: [{ label: "Valor (USD)", data, backgroundColor: bg, borderRadius: 6 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 20 } },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmtUSD(ctx.parsed.y)}` } },
      },
      scales: {
        x: { ticks: { color: "#94a3b8" }, grid: { color: "#1e293b" } },
        y: { ticks: { color: "#94a3b8", callback: (v) => fmtUSDc(v) }, grid: { color: "#1e293b" } },
      },
    },
    plugins: [barValueLabels],
  });
}

// ============================================================================
// Analyze flow
// ============================================================================

async function analyze() {
  await ensureNoble();
  const addr = document.getElementById("addr-input").value.trim();
  if (!isValidSolanaAddress(addr)) { setStatus("Dirección Solana no válida (base58, 32-44 chars).", "err"); return; }
  if (!state.heliusKey && !PROXY_BASE) { setStatus("Falta Helius API key. Abre Settings.", "err"); openSettings(); return; }
  if (!state.selectedProtocols.length) { setStatus("Selecciona al menos un protocolo.", "err"); return; }

  state.address = addr;
  state.positions = [];
  // el cache de transacciones (histórico) se reutiliza por TTL; no se invalida aquí
  setLoading(true);
  setStatus("Analizando…", "info");

  document.getElementById("empty-state").classList.add("hidden");
  document.getElementById("positions-section").classList.add("hidden");
  document.getElementById("summary-section").classList.add("hidden");
  document.getElementById("charts-section").classList.add("hidden");

  try {
    let all = [];
    // Una sola llamada DAS compartida por todos los protocolos basados en NFT
    const candidates = await fetchWalletNftCandidates(addr);

    if (state.selectedProtocols.includes("orca")) {
      const rawOrca = await findOrcaPositions(candidates);
      const enrichedOrca = await enrichOrcaPositions(rawOrca);
      all = all.concat(enrichedOrca);
    }
    if (state.selectedProtocols.includes("raydium")) {
      const rawRay = await findRaydiumPositions(candidates);
      const enrichedRay = await enrichRaydiumPositions(rawRay);
      all = all.concat(enrichedRay);
    }
    // (Meteora / clásicos: pendientes)

    state.positions = all;
    assignColors(state.positions);

    // Tokens "idle" — los que están en la wallet pero no están metidos en LPs.
    // Reusa la misma respuesta de Helius (showFungible) + Jupiter via token_info.price_info.
    state.idleTokens = await fetchIdleTokens(addr).catch(() => []);

    // Jupiter Lend: los vault-share tokens (jlUSDC, jlSOL…) NO son idle, son
    // posiciones de lending. Los sacamos del listado idle y los añadimos a
    // state.positions como `_lending: true` (mismo patrón que Revert Lend en EVM).
    const jlTokens = (state.idleTokens || []).filter(isJupiterLendToken);
    if (jlTokens.length) {
      state.idleTokens = state.idleTokens.filter((t) => !isJupiterLendToken(t));
      for (const t of jlTokens) state.positions.push(buildJupiterLendPosition(t));
      // Reconstruir coste base / interés / APR escaneando las txs del owner
      // (silencioso: si falla, la card sigue funcionando con depo/gains "—").
      try { await enrichJupiterLendCost(addr); } catch (e) { console.warn("enrichJupiterLendCost:", e); }
      // Leer el ratio share→underlying directo del vault on-chain — la verdad
      // exacta en este instante, sin lag del feed de Helius/Jupiter. Re-calcula
      // currentValueUSD + gainsUSD + apr con el sharePrice on-chain. Se ejecuta
      // DESPUÉS de enrichJupiterLendCost porque depende de depositedUSD para
      // recomputar las ganancias.
      try { await enrichJupiterLendFromVault(); } catch (e) { console.warn("enrichJupiterLendFromVault:", e); }
    }

    // PnL real + IL vs HODL con precios históricos (Birdeye, vía key propia o proxy)
    let beWarn = "";
    let beError = null;
    if (all.length && (state.birdeyeKey || PROXY_BASE)) {
      setStatus("Calculando PnL e IL con históricos de Birdeye…", "info");
      try { await enrichSolanaPnL(addr); } catch (e) { console.warn("enrichSolanaPnL:", e); }
      const st = state._beStats || {};
      if (st.ok === 0 && (st.denied > 0)) {
        beWarn = " ⚠ Tu plan de Birdeye no permite precios históricos (o la key es inválida): PnL/IL no disponible.";
        beError = "el plan no permite histórico (o key inválida)";
      } else if (st.ok === 0 && st.rate > 0) {
        beWarn = " ⚠ Birdeye limitó las peticiones (rate limit): PnL/IL incompleto, reintenta en un momento.";
        beError = "rate limit";
      } else if (st.ok === 0 && st.error > 0) {
        beWarn = " ⚠ No se pudo obtener histórico de Birdeye: PnL/IL no disponible.";
        beError = "error de petición";
      } else if (st.partial > 0) {
        beWarn = ` ⚠ ${st.partial} posición(es) sin histórico completo (ni en Birdeye ni en Yahoo Finance — típico de tokens nuevos o depósitos pre-IPO): PnL/IL omitido en ellas.`;
      }
    }

    state.analysisStatus = {
      ok: !beError,
      errors: beError ? [{ source: "Birdeye", reason: beError }] : [],
    };

    if (!all.length) {
      setStatus(`Sin posiciones para ${shortAddr(addr)} en los protocolos activos.`, "info");
    } else {
      const enRango = all.filter((p) => !p.closed && p.inRange).length;
      setStatus(`${all.length} posiciones (${enRango} en rango).${beWarn}`, beWarn ? "err" : "ok");
    }
    renderAll();
  } catch (e) {
    console.error(e);
    setStatus(classifyError(e && e.message), "err");
    state.analysisStatus = { ok: false, errors: [{ source: "Solana", reason: classifyError(e?.message) || (e?.message || "error") }] };
  } finally {
    setLoading(false);
  }
}

// ============================================================================
// Phantom wallet (Solana)
// ============================================================================

function getPhantom() {
  if (window.phantom?.solana?.isPhantom) return window.phantom.solana;
  if (window.solana?.isPhantom) return window.solana;
  return null;
}

async function connectPhantom() {
  const provider = getPhantom();
  if (!provider) {
    setStatus("No se detectó Phantom. Instálalo o desbloquéalo.", "err");
    return;
  }
  try {
    const resp = await provider.connect();
    const pk = resp.publicKey.toString();
    state.connectedAddress = pk;
    const input = document.getElementById("addr-input");
    if (input) input.value = pk;
    renderWalletButton();
    setStatus(`Conectada: ${shortAddr(pk)}. Pulsa Analizar.`, "ok");
    // Notificar al shell (si estamos embebidos) tras la conexión inicial.
    window.__notifySolWallet?.();
    if (!provider.__lpListenersAttached) {
      provider.on?.("accountChanged", (publicKey) => {
        if (publicKey) {
          state.connectedAddress = publicKey.toString();
          const inp = document.getElementById("addr-input");
          if (inp) inp.value = state.connectedAddress;
          renderWalletButton();
          setStatus(`Cuenta cambiada: ${shortAddr(state.connectedAddress)}`, "info");
          // El usuario cambió de cuenta directamente en la extensión Phantom
          // — propagamos al shell para que actualice "Phantom conectada
          // 0x..." y los botones de "Añadir wallet conectada" con la nueva.
          window.__notifySolWallet?.();
        } else {
          disconnectPhantom();
        }
      });
      provider.__lpListenersAttached = true;
    }
  } catch (e) {
    setStatus("Conexión cancelada.", "info");
  }
}

function disconnectPhantom() {
  const provider = getPhantom();
  try { provider?.disconnect?.(); } catch (e) {}
  state.connectedAddress = null;
  renderWalletButton();
  setStatus("Wallet desvinculada de la app.", "info");
  // Notificar al shell para que muestre "Phantom no conectada" y deshabilite
  // los botones de "Añadir wallet conectada".
  window.__notifySolWallet?.();
}

function renderWalletButton() {
  const label = document.getElementById("btn-wallet-label");
  const btn = document.getElementById("btn-wallet");
  if (!label || !btn) return;
  if (state.connectedAddress) {
    label.innerHTML = `<span class="text-emerald-400">●</span> ${shortAddr(state.connectedAddress)} <span class="text-slate-500 ml-1">✕</span>`;
    btn.title = "Click para desconectar";
    btn.onclick = disconnectPhantom;
  } else {
    label.textContent = "👻 Conectar Phantom";
    btn.title = "Conectar Phantom";
    btn.onclick = connectPhantom;
  }
}

async function trySilentReconnectPhantom() {
  const provider = getPhantom();
  if (!provider) return;
  try {
    // onlyIfTrusted no abre prompt; reconecta si ya autorizaste antes
    const resp = await provider.connect({ onlyIfTrusted: true });
    if (resp?.publicKey) {
      state.connectedAddress = resp.publicKey.toString();
      const inp = document.getElementById("addr-input");
      if (inp) inp.value = state.connectedAddress;
      renderWalletButton();
      // Notifica al shell también en la reconexión silenciosa al cargar.
      window.__notifySolWallet?.();
    }
  } catch (e) { /* silencioso */ }
}

// ============================================================================
// Histórico real de Solana (Orca/Raydium) vía Helius Enhanced Transactions API.
// Reconstruye, a nivel de wallet, el capital aportado y fees en el tiempo:
//   tx con source RAYDIUM/ORCA → transfers del owner: envía = depósito, recibe = fee/retiro.
// ============================================================================
const SOL_STABLES = new Set([
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
]);
// Descarga (y cachea) las transacciones enriquecidas de Helius para un owner.
const TX_CACHE_TTL = 10 * 60 * 1000; // el histórico de transacciones casi no cambia → cache 10 min
async function fetchEnhancedTxs(owner) {
  if ((!state.heliusKey && !PROXY_BASE) || !owner) return [];
  // Reutiliza el histórico reciente (no se re-pide en cada auto-refresco)
  if (state._txCache && state._txCache.owner === owner && (Date.now() - state._txCache.ts) < TX_CACHE_TTL) return state._txCache.txs;
  const txs = [];
  let before = "";
  for (let page = 0; page < 10; page++) {
    const bef = before ? "&before=" + before : "";
    const url = state.heliusKey
      ? `https://api.helius.xyz/v0/addresses/${owner}/transactions?api-key=${state.heliusKey}&limit=100${bef}`
      : `${PROXY_BASE}/helius-tx/${owner}?limit=100${bef}`;
    let arr;
    try { const r = await fetch(url, { headers: { ...proxyAuth(url) } }); arr = await r.json(); } catch { break; }
    if (!Array.isArray(arr) || !arr.length) break;
    txs.push(...arr);
    before = arr[arr.length - 1].signature;
    if (arr.length < 100) break;
  }
  state._txCache = { owner, txs, ts: Date.now() };
  return txs;
}

// ============================================================================
// xStocks fallback: para acciones tokenizadas (TSLAx, MSTRx, NVDAx, CRCLx…)
// que Birdeye no cubre históricamente, usamos el precio del subyacente en
// Stooq (vía proxy /stock). Detección heurística: símbolo `[A-Z]+x` y name
// que mencione "xStock" o "Backed" (Backed Finance es el emisor).
// ============================================================================
const XSTOCK_SYMBOL_RX = /^([A-Z]{1,8})x$/;
function detectXStockTicker(meta) {
  if (!meta) return null;
  const sym = String(meta.symbol || "");
  const name = String(meta.name || "");
  const m = sym.match(XSTOCK_SYMBOL_RX);
  if (!m) return null;
  // Confirmamos con el name para evitar falsos positivos (cualquier token que
  // por casualidad acabe en `x` en mayúsculas no es xStock).
  if (!/xstock|backed/i.test(name)) return null;
  return m[1].toLowerCase(); // "TSLA" → "tsla"
}

// Precio histórico de la acción subyacente de un xStock vía proxy → Stooq.
// Devuelve null si no hay proxy, ticker no se reconoce o Stooq no devuelve dato.
// Cacheado en memoria por (ticker, día) — la KV del Worker hace el cache real.
async function xstockPriceAt(ticker, unixSec) {
  if (!PROXY_BASE || !ticker || !unixSec) return null;
  if (!state._xstockCache) state._xstockCache = new Map();
  const dayStr = new Date(unixSec * 1000).toISOString().slice(0, 10);
  const cacheKey = `${ticker}:${dayStr}`;
  if (state._xstockCache.has(cacheKey)) return state._xstockCache.get(cacheKey);
  const url = `${PROXY_BASE}/stock/${encodeURIComponent(ticker)}/${dayStr}`;
  try {
    const r = await fetch(url, { headers: { ...proxyAuth(url) } });
    if (!r.ok) { state._xstockCache.set(cacheKey, null); return null; }
    const j = await r.json();
    const price = typeof j.price === "number" ? j.price : null;
    state._xstockCache.set(cacheKey, price);
    return price;
  } catch (e) {
    state._xstockCache.set(cacheKey, null);
    return null;
  }
}

// Precio USD histórico de un token en un instante (unix segundos) vía Birdeye.
// Cachea por (mint, día) para minimizar llamadas. Stables → 1.
// Fallback xStocks: si Birdeye no lo cubre y el token es un xStock conocido
// (símbolo `[A-Z]+x`, name "xStock"/"Backed"), usa Stooq via /stock.
async function birdeyePriceAt(mint, unixSec) {
  if (SOL_STABLES.has(mint)) return 1;
  if ((!state.birdeyeKey && !PROXY_BASE) || !mint || !unixSec) return null;
  if (!state._beStats) state._beStats = { ok: 0, denied: 0, rate: 0, error: 0, partial: 0 };
  if (!state._bePriceCache) state._bePriceCache = new Map();
  const dayKey = mint + ":" + Math.floor(unixSec / 86400);
  if (state._bePriceCache.has(dayKey)) return state._bePriceCache.get(dayKey);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const qs = `address=${mint}&unixtime=${unixSec}`;
  const url = state.birdeyeKey
    ? `https://public-api.birdeye.so/defi/historical_price_unix?${qs}`              // key propia
    : `${PROXY_BASE}/birdeye/defi/historical_price_unix?${qs}`;                     // proxy (añade X-API-KEY)
  const headers = state.birdeyeKey
    ? { "X-API-KEY": state.birdeyeKey, "x-chain": "solana", accept: "application/json" }
    : { accept: "application/json", ...proxyAuth(url) };
  let price = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(url, { headers });
      if (r.status === 429) {
        // rate limit: espera (backoff) y reintenta antes de rendirse
        if (attempt < 3) { await sleep(700 * (attempt + 1)); continue; }
        state._beStats.rate++; break;
      }
      if (r.status === 401 || r.status === 403) { state._beStats.denied++; break; } // key inválida o plan sin histórico
      let j = null; try { j = await r.json(); } catch (e) {}
      const v = j && j.data && j.data.value;
      if (typeof v === "number" && isFinite(v)) { price = v; state._beStats.ok++; }
      else if (j && j.success === false) { state._beStats.denied++; }
      else { state._beStats.error++; }
      break;
    } catch (e) {
      if (attempt < 3) { await sleep(500); continue; }
      state._beStats.error++;
    }
  }
  // Fallback xStocks: si Birdeye no lo tiene y el token parece xStock (TSLAx,
  // MSTRx, NVDAx, CRCLx…), usa el precio histórico de la acción subyacente
  // vía Yahoo Finance (proxy /stock).
  if (price == null) {
    const meta = state.tokenList && state.tokenList.get(mint);
    const ticker = detectXStockTicker(meta);
    if (ticker) {
      const stockPrice = await xstockPriceAt(ticker, unixSec);
      if (stockPrice != null) {
        price = stockPrice;
        // Contamos como "ok" para que los banners de PnL no se disparen por
        // un fallo de Birdeye que sí resolvió la fuente alternativa.
        state._beStats.ok++;
        // Track per mint para que la card refleje "Birdeye + Yahoo fallback"
        // en lugar de solo "Birdeye". Visible al usuario en el details note.
        if (!state._yahooFallbackMints) state._yahooFallbackMints = new Set();
        state._yahooFallbackMints.add(mint);
        // Debug log: imprime cada vez que el fallback Yahoo resuelve un precio
        // que Birdeye no pudo. Útil para verificar la fuente de cada precio sin
        // tocar la UI. Formato compacto, una línea con styling ámbar.
        const dateStr = new Date(unixSec * 1000).toISOString().slice(0, 10);
        const sym = (meta && meta.symbol) || "?";
        console.log(
          `%c[xStock-fallback]%c ${sym} → ${ticker.toUpperCase()} %c$${stockPrice.toFixed(2)}%c @ ${dateStr} (mint ${mint.slice(0, 6)}…${mint.slice(-4)})`,
          "color:#fbbf24;font-weight:bold",
          "color:inherit",
          "color:#fbbf24",
          "color:#94a3b8",
        );
      }
    }
  }
  state._bePriceCache.set(dayKey, price);
  return price;
}

// Calcula PnL real + IL vs HODL por posición usando precios históricos (Birdeye).
// Reconstruye el coste base a partir de las transferencias depósito/retiro/fee.
async function enrichSolanaPnL(owner) {
  state._beStats = { ok: 0, denied: 0, rate: 0, error: 0, partial: 0 };
  state._yahooFallbackMints = new Set(); // reset por análisis
  if ((!state.birdeyeKey && !PROXY_BASE) || !owner || !(state.positions || []).length) return;
  const txs = await fetchEnhancedTxs(owner);
  if (!txs.length) return;

  // mapa vault -> posición
  const vaultToPos = new Map();
  for (const p of state.positions) for (const v of (p.vaults || [])) if (v) vaultToPos.set(v, p.mint);
  if (!vaultToPos.size) return; // sin atribución por pool no podemos calcular fiable

  const SRC = new Set(["RAYDIUM", "ORCA", "WHIRLPOOL"]);
  // eventos por posición: { ts, mint, amount(ui), dir: 'in'|'out' }
  const perPos = new Map();
  for (const tx of txs) {
    if (!SRC.has(tx.source)) continue;
    const ts = tx.timestamp || 0;
    for (const t of (tx.tokenTransfers || [])) {
      let counterparty = null, dir = null;
      if (t.fromUserAccount === owner) { counterparty = t.toTokenAccount; dir = "out"; }   // a pool = depósito
      else if (t.toUserAccount === owner) { counterparty = t.fromTokenAccount; dir = "in"; } // del pool = retiro/fee
      else continue;
      const posId = counterparty && vaultToPos.get(counterparty);
      if (!posId) continue;
      if (!perPos.has(posId)) perPos.set(posId, []);
      perPos.get(posId).push({ ts, mint: t.mint, amount: t.tokenAmount || 0, dir });
    }
  }

  const curPrice = (mint) => (state.prices[mint] != null ? state.prices[mint] : (SOL_STABLES.has(mint) ? 1 : 0));

  for (const p of state.positions) {
    const evs = perPos.get(p.mint);
    if (!evs || !evs.length) continue;
    evs.sort((a, b) => a.ts - b.ts);
    let costBasisUSD = 0, withdrawnUSD = 0, feesCollectedUSD = 0;
    let cumDep = 0, cumWd = 0, incomplete = false;
    const netAmt = new Map(); // mint -> cantidad neta de principal (depósito - retiro)
    for (const e of evs) {
      if (e.amount <= 0) continue; // transferencias informativas sin importe
      const hp = await birdeyePriceAt(e.mint, e.ts);
      if (hp == null) {
        // sin precio histórico de esta pata: la reconstrucción queda incompleta.
        // Cuando ni Birdeye ni el fallback Yahoo (xStocks) resuelven el precio,
        // típicamente porque el token es muy nuevo o la fecha es pre-IPO. No
        // falseamos: marcamos `incomplete` y la posición se omite del PnL.
        incomplete = true;
        continue;
      }
      const usd = e.amount * hp;
      if (e.dir === "out") {
        costBasisUSD += usd; cumDep += usd;
        netAmt.set(e.mint, (netAmt.get(e.mint) || 0) + e.amount);
      } else {
        // heurística: importe grande respecto al principal vivo = retiro; pequeño = fee
        if (usd > 0.05 * Math.max(cumDep - cumWd, 1)) {
          withdrawnUSD += usd; cumWd += usd;
          netAmt.set(e.mint, (netAmt.get(e.mint) || 0) - e.amount);
        } else {
          feesCollectedUSD += usd;
        }
      }
    }
    // Si falta el histórico de alguna pata, el coste base es poco fiable → no mostramos PnL/IL.
    if (incomplete) { state._beStats.partial++; continue; }
    if (costBasisUSD <= 0) continue; // no pudimos reconstruir nada útil

    // HODL: lo que valdrían hoy los tokens netos depositados
    let hodlUSD = 0;
    for (const [mint, amt] of netAmt) hodlUSD += Math.max(0, amt) * curPrice(mint);

    const pendFees = p.feesPendingUSD || 0;
    // antigüedad desde el primer depósito → APR de fees anualizado
    const firstDep = evs.find((e) => e.dir === "out");
    const openedAt = firstDep ? firstDep.ts : null;
    const ageDays = openedAt ? Math.max((Date.now() / 1000 - openedAt) / 86400, 1 / 24) : null;
    p.depositedUSD = costBasisUSD;
    p.withdrawnUSD = withdrawnUSD;
    p.feesCollectedUSD = feesCollectedUSD;
    p.hodlUSD = hodlUSD;
    p.ilUSD = (p.currentValueUSD || 0) - hodlUSD;
    p.ilPct = hodlUSD > 0 ? (p.ilUSD / hodlUSD) * 100 : null;
    p.pnlUSD = (p.currentValueUSD || 0) + withdrawnUSD + feesCollectedUSD + pendFees - costBasisUSD;
    p.openedAt = openedAt;
    p.ageDays = ageDays;
    p.apr = (ageDays && costBasisUSD > 0) ? ((feesCollectedUSD + pendFees) / costBasisUSD) * (365 / ageDays) * 100 : null;
    p.pnlBasis = "birdeye";
    // Marca si alguna pata de esta LP usó el fallback Yahoo (xStock) → la card
    // mostrará "Birdeye + Yahoo fallback" en lugar de solo "Birdeye".
    const yh = state._yahooFallbackMints;
    p.pnlUsedYahoo = !!(yh && ((p.token0?.mint && yh.has(p.token0.mint)) || (p.token1?.mint && yh.has(p.token1.mint))));
  }

  // Resumen de fuentes al final del análisis. Visible en consola para que el
  // usuario pueda verificar de dónde salió cada precio sin tocar la UI.
  const st = state._beStats || {};
  const yhCount = (state._yahooFallbackMints || new Set()).size;
  const bgColor = yhCount > 0 ? "#fbbf24" : "#34d399";
  console.log(
    `%c[PnL-sources]%c Birdeye OK: ${st.ok - yhCount} · Yahoo fallback (xStocks): ${yhCount} mint(s) · failures: ${st.denied + st.error + st.rate} · partial pos: ${st.partial}`,
    `color:${bgColor};font-weight:bold`,
    "color:#94a3b8",
  );
}

// Reconstruye coste base / interés / APR de posiciones Jupiter Lend a partir
// de las txs del owner. Estrategia: por cada transferencia de un mint jl-* en
// el que el owner es origen o destino, busca en el mismo tx la transferencia
// del underlying (USDC/USDT/SOL…) en dirección opuesta — eso da el USD pagado
// en el depósito o recibido en el retiro.
//
// Requisitos:
//   - Helius (key o proxy) para fetchEnhancedTxs.
//   - underlying = stable (USDC/USDT) → precio = $1, sin Birdeye.
//   - underlying = non-stable (SOL, etc.) → Birdeye histórico si está, si no
//     fallback al precio actual (puede ser inexacto en depósitos antiguos).
async function enrichJupiterLendCost(owner) {
  const jl = (state.positions || []).filter((p) => p._lending && p.protocol === "jupiter-lend");
  if (!jl.length || (!state.heliusKey && !PROXY_BASE) || !owner) return;
  let txs = [];
  try { txs = await fetchEnhancedTxs(owner); } catch (e) { console.warn("enrichJupiterLendCost:", e); return; }
  if (!txs.length) return;

  const jlMints = new Set(jl.map((p) => p.mint));
  const events = new Map(jl.map((p) => [p.mint, { dep: [], wd: [] }]));
  const now = Math.floor(Date.now() / 1000);

  for (const tx of txs) {
    const ts = tx.timestamp || 0;
    if (!ts) continue;
    const tts = tx.tokenTransfers || [];
    for (const t of tts) {
      if (!jlMints.has(t.mint)) continue;
      const isIn = t.toUserAccount === owner;
      const isOut = t.fromUserAccount === owner;
      if (!isIn && !isOut) continue;
      // Contraparte: otra transferencia del owner, mint != jl, dirección opuesta
      const wantDir = isIn ? "out" : "in";
      let underlying = null;
      for (const u of tts) {
        if (u === t) continue;
        if (u.mint === t.mint) continue;
        const uIn = u.toUserAccount === owner;
        const uOut = u.fromUserAccount === owner;
        const uDir = uIn ? "in" : (uOut ? "out" : null);
        if (uDir !== wantDir) continue;
        const amt = u.tokenAmount || 0;
        if (amt <= 0) continue;
        underlying = { mint: u.mint, amount: amt };
        break;
      }
      if (!underlying) continue;
      // Precio del underlying en ese instante. Stables = $1. Resto: Birdeye
      // histórico (si está) → precio actual como fallback.
      let priceUSD = null;
      if (SOL_STABLES.has(underlying.mint)) priceUSD = 1;
      else {
        try { priceUSD = await birdeyePriceAt(underlying.mint, ts); } catch (e) {}
        if (priceUSD == null) priceUSD = state.prices[underlying.mint] || null;
      }
      if (priceUSD == null) continue;
      const usd = underlying.amount * priceUSD;
      const jlAmt = t.tokenAmount || 0; // shares jl movidas en este mismo tx
      const bucket = events.get(t.mint);
      if (isIn) bucket.dep.push({ ts, usd, jl: jlAmt });
      else      bucket.wd.push({ ts, usd, jl: jlAmt });
    }
  }

  // Stable assets cuyo share price (en USD) crece monotónicamente con el
  // interés; cualquier movimiento ≠ interés del feed Helius/Jupiter es un bug.
  // Para non-stables (jlSOL, jlBTC…) NO podemos comparar así, porque el cambio
  // de precio del subyacente domina el USD del share legítimamente.
  const STABLE_LENDING_ASSETS = new Set(["USDC", "USDT", "USDS", "DAI", "PYUSD", "USDH", "USDR"]);
  const MAX_REALISTIC_LENDING_APR = 0.30; // 30% APR — generoso para stable lending

  for (const p of jl) {
    const { dep, wd } = events.get(p.mint) || { dep: [], wd: [] };
    if (!dep.length) continue;
    const depositedUSD = dep.reduce((s, e) => s + e.usd, 0);
    const withdrawnUSD = wd.reduce((s, e) => s + e.usd, 0);

    // Derivar share price real on-chain del evento MÁS RECIENTE: USD pagado /
    // jl recibido. Esto es literalmente la verdad on-chain en ese instante.
    const allEvs = [...dep, ...wd].sort((a, b) => b.ts - a.ts);
    let derivedPrice = null, derivedFromTs = null;
    for (const e of allEvs) {
      if (e.jl > 0 && e.usd > 0) {
        derivedPrice = e.usd / e.jl;
        derivedFromTs = e.ts;
        break;
      }
    }

    // Override del precio Helius cuando es claramente irreal:
    //
    //   1) Helius < derivado × 0.95  →  imposible (interés solo sube, nunca
    //      baja). Helius está reportando un precio antiguo/stale → usar derivado.
    //
    //   2) Para STABLE lending (jlUSDC, jlUSDT…): si el precio Helius implica
    //      un APR anualizado desde el último depósito > 30%, también es bug
    //      del feed (los vaults USDC no rinden tanto). Usar derivado.
    //
    //   3) Para NON-STABLE (jlSOL, jlBTC…): NO comparamos, porque la subida/
    //      bajada del USD del subyacente puede mover la share USD muchísimo de
    //      forma legítima. Confiamos en Helius siempre.
    if (derivedPrice && p.sharePrice && derivedFromTs) {
      const ageSec = Math.max(now - derivedFromTs, 1);
      const ageDays = ageSec / 86400;
      const isStable = STABLE_LENDING_ASSETS.has(p.asset);
      // (1a) Helius MUY por debajo del derivado (claramente stale, cualquier asset)
      const heliusTooLowGeneral = p.sharePrice < derivedPrice * 0.95;
      // (1b) Para STABLE lending: cualquier sharePrice de Helius por debajo del
      //      derivado on-chain es imposible. Los vaults de stables (USDC/USDT/…)
      //      tienen share price monotónicamente creciente; si Helius reporta
      //      un valor MÁS BAJO que el del último depósito del propio usuario,
      //      el feed está stale. Sin esto, mostraríamos "pérdidas" en
      //      posiciones de stable lending recién abiertas, que es absurdo.
      const heliusTooLowForStable = isStable && p.sharePrice < derivedPrice;
      // (2) Stable + APR irreal desde el último evento (Helius reportando ALTO)
      let heliusTooHigh = false;
      if (isStable && p.sharePrice > derivedPrice) {
        const annualizedReturn = Math.pow(p.sharePrice / derivedPrice, 365 / ageDays) - 1;
        heliusTooHigh = annualizedReturn > MAX_REALISTIC_LENDING_APR;
      }
      if (heliusTooLowGeneral || heliusTooLowForStable || heliusTooHigh) {
        p._heliusSharePrice = p.sharePrice;
        p._heliusValueUSD = p.currentValueUSD;
        p.sharePrice = derivedPrice;
        p.currentValueUSD = (p.shares || 0) * derivedPrice;
        p._priceFromTx = true;
        p._priceFromTs = derivedFromTs;
      }
    }

    // gains = lo que tienes ahora + lo que retiraste − lo que pusiste (interés
    // acumulado real, no afectado por retiros parciales).
    const gainsUSD = (p.currentValueUSD || 0) + withdrawnUSD - depositedUSD;
    const openedAt = Math.min(...dep.map((e) => e.ts));
    const ageDays = Math.max((now - openedAt) / 86400, 1 / 24);
    const netInvested = Math.max(depositedUSD - withdrawnUSD, 0);
    // Sanity guard: extrapolar APR sobre ventanas < 1 día da ruido absurdo
    // (cualquier $1 de ganancia × 365 días se vuelve cientos de %). Marcamos
    // null y la card lo muestra como "— (esperando ≥ 1 día)".
    const apr = (netInvested > 0 && ageDays >= 1)
      ? (gainsUSD / netInvested) * (365 / ageDays) * 100
      : null;
    p.depositedUSD = depositedUSD;
    p.withdrawnUSD = withdrawnUSD;
    p.gainsUSD = gainsUSD;
    p.feesUSD = gainsUSD;            // shim para shell.js (suma feesUSD a "Fees acumuladas")
    p.feesCollectedUSD = gainsUSD;
    p.pnlUSD = gainsUSD;
    p.openedAt = openedAt;
    p.ageDays = ageDays;
    p.apr = apr;
    p._aprTooEarly = (netInvested > 0 && ageDays < 1); // para la card
    p.pnlBasis = "tx-scan";
  }
}

// ============================================================================
// Jupiter Lend — leer el ratio share→underlying directo del vault on-chain.
// ============================================================================
// Por qué: el `price_info.price_per_token` que devuelve Helius/Jupiter para
// jlUSDC/jlSOL/etc se actualiza con retraso (horas a días). Para posiciones
// recién abiertas, eso muestra "0 ganancias" o incluso pérdidas falsas porque
// el feed reporta un sharePrice por debajo del que el usuario mismo pagó.
// La verdad on-chain vive en la cuenta `Lending` del programa Jupiter Lend
// (jup3YeL8QhtSx1e253b2FDvsMNC87fDrgQZivbrndc9), que contiene un campo
// `token_exchange_price` (u64, escalado 1e12) que es la ratio exacta:
//
//   underlying_amount = shares * token_exchange_price / 1e12
//
// El layout viene del IDL público del SDK @jup-ag/lend-read:
//   discriminator: [135, 199, 82, 16, 249, 131, 182, 241]
//   offsets tras discriminator:
//     0..32   mint (underlying — USDC para jlUSDC)
//     32..64  f_token_mint (= jlUSDC mint)
//     64..66  lending_id (u16)
//     66..67  decimals (u8) — del fToken (= del underlying)
//     67..99  rewards_rate_model (pubkey)
//     99..107 liquidity_exchange_price (u64) — sin rewards
//     107..115 token_exchange_price (u64) — CON rewards, este es el que usamos
//     ...
//
// Cómo encontramos la Lending account dado un jl* mint sin escanear: el
// mintAuthority del fToken mint apunta a la Lending account (porque el
// programa Lending mintea/quema fTokens). Lo leemos del campo de
// SPL Token Mint (offset 0..4 flag, 4..36 pubkey).
async function enrichJupiterLendFromVault() {
  const jl = (state.positions || []).filter((p) => p._lending && p.protocol === "jupiter-lend");
  if (!jl.length) return;

  const LENDING_PROGRAM = "jup3YeL8QhtSx1e253b2FDvsMNC87fDrgQZivbrndc9";
  const LENDING_DISC = new Uint8Array([135, 199, 82, 16, 249, 131, 182, 241]);

  // Pedimos TODAS las Lending accounts del programa con un filtro memcmp
  // por discriminator. Hay ~10-30 (una por asset soportado); ~200 bytes cada
  // una → respuesta total <10KB. Una sola llamada en vez de adivinar la PDA
  // desde el lado del cliente.
  //
  // Por qué este enfoque y no via mintAuthority: el mintAuthority del fToken
  // mint NO siempre es la propia Lending account — depende de cómo el
  // programa inicializa el mint. Escanear el programa es robusto a cualquier
  // configuración interna.
  const discB58 = base58Encode(LENDING_DISC);
  let progAccs = [];
  try {
    progAccs = await rpc("getProgramAccounts", [
      LENDING_PROGRAM,
      {
        encoding: "base64",
        filters: [{ memcmp: { offset: 0, bytes: discB58 } }],
      },
    ]) || [];
  } catch (e) {
    console.warn("getProgramAccounts Jupiter Lend failed:", e?.message || e);
    return;
  }

  // Decodificar todas y construir un map: fTokenMint → { underlyingMint, decimals, tokenExchangePrice }
  const fTokenMap = new Map();
  for (const a of progAccs) {
    const dataField = a?.account?.data;
    if (!dataField) continue;
    const data = Uint8Array.from(atob(dataField[0]), (c) => c.charCodeAt(0));
    if (data.length < 8 + 115) continue;
    if (!bytesEqual(data.subarray(0, 8), LENDING_DISC)) continue;

    const r = new BorshReader(data);
    r.skip(8); // discriminator
    const underlyingMint = r.pubkey().toBase58();
    const fTokenMint = r.pubkey().toBase58();
    r.skip(2);  // lending_id
    const decimals = r.u8();
    r.skip(32); // rewards_rate_model
    r.skip(8);  // liquidity_exchange_price
    const tokenExchangePrice = r.u64(); // u64 LE, escalado 1e12
    fTokenMap.set(fTokenMint, { underlyingMint, decimals, tokenExchangePrice });
  }

  if (!fTokenMap.size) {
    console.warn("Jupiter Lend: 0 Lending accounts found via getProgramAccounts");
    return;
  }

  // Aplicar a cada posición del usuario buscando su mint en el map
  for (const p of jl) {
    const lending = fTokenMap.get(p.mint);
    if (!lending) continue;

    // ratio = tokenExchangePrice / 1e12 → underlying_human / shares_human
    // (las decimales del fToken == decimales del underlying según el IDL, así
    // que la ratio en raw también funciona en human-readable sin re-scaling)
    const sharesHuman = p.shares || 0;
    if (sharesHuman <= 0) continue;
    const ratio = Number(lending.tokenExchangePrice) / 1e12;
    const assetsHuman = sharesHuman * ratio;

    // USD value: necesitamos el precio del underlying.
    // USDC/USDT/... = $1 (stables); resto usa state.prices o falla silenciosa.
    let underlyingPrice = state.prices[lending.underlyingMint];
    if (underlyingPrice == null && SOL_STABLES.has(lending.underlyingMint)) underlyingPrice = 1;
    if (underlyingPrice == null || underlyingPrice <= 0) continue;

    const currentValueUSD = assetsHuman * underlyingPrice;
    if (!isFinite(currentValueUSD) || currentValueUSD <= 0) continue;

    // Guardamos lo que reportaba Helius/Jupiter para mostrarlo en detalles
    // (solo si no lo hizo ya enrichJupiterLendCost via _priceFromTx).
    if (!p._priceFromTx && p._heliusSharePrice == null) {
      p._heliusSharePrice = p.sharePrice;
      p._heliusValueUSD = p.currentValueUSD;
    }
    p.sharePrice = currentValueUSD / sharesHuman;
    p.currentValueUSD = currentValueUSD;
    p._priceFromOnchain = true;
    delete p._priceFromTx; // el on-chain sustituye al derivado-de-tx

    // Re-calcular gainsUSD/apr ahora que tenemos el valor real on-chain
    if (p.depositedUSD != null) {
      const withdrawn = p.withdrawnUSD || 0;
      p.gainsUSD = currentValueUSD + withdrawn - p.depositedUSD;
      p.feesUSD = p.gainsUSD;
      p.feesCollectedUSD = p.gainsUSD;
      p.pnlUSD = p.gainsUSD;
      const ageDays = p.ageDays || 0;
      const netInvested = Math.max(p.depositedUSD - withdrawn, 0);
      p.apr = (netInvested > 0 && ageDays >= 1)
        ? (p.gainsUSD / netInvested) * (365 / ageDays) * 100
        : null;
      p._aprTooEarly = (netInvested > 0 && ageDays < 1);
    }
  }
}

async function fetchSolanaHistory(owner) {
  if ((!state.heliusKey && !PROXY_BASE) || !owner) return [];
  const priceOf = (mint) => (state.prices[mint] != null ? state.prices[mint] : (SOL_STABLES.has(mint) ? 1 : 0));
  const txs = await fetchEnhancedTxs(owner);
  // mapa vault (cuenta de token del pool) -> posición, para atribuir cada transferencia
  const vaultToPos = new Map();
  for (const p of (state.positions || [])) {
    const label = `${p.token0.symbol}/${p.token1.symbol}`;
    for (const v of (p.vaults || [])) if (v) vaultToPos.set(v, { posId: p.mint, label });
  }
  const hasVaultMap = vaultToPos.size > 0;

  const SRC = new Set(["RAYDIUM", "ORCA", "WHIRLPOOL"]);
  // acumular eventos por posición (o agregado si no hay mapa de vaults)
  const perPos = new Map(); // posId -> { label, events: [{ts, net}] }
  const pushEvent = (posId, label, ts, net) => {
    if (!perPos.has(posId)) perPos.set(posId, { label, events: [] });
    perPos.get(posId).events.push({ ts, net });
  };
  for (const tx of txs) {
    if (!SRC.has(tx.source)) continue;
    const ts = tx.timestamp || 0;
    // agregado por tx para el fallback
    let aggSent = 0, aggRecv = 0;
    for (const t of (tx.tokenTransfers || [])) {
      let p = await birdeyePriceAt(t.mint, ts); // precio histórico (cacheado por mint+día)
      if (p == null) p = priceOf(t.mint);        // fallback al precio actual si no hay histórico
      if (!p) continue;
      const usd = (t.tokenAmount || 0) * p;
      let counterparty = null, net = 0;
      if (t.fromUserAccount === owner) { counterparty = t.toTokenAccount; net = usd; aggSent += usd; }       // depósito
      else if (t.toUserAccount === owner) { counterparty = t.fromTokenAccount; net = -usd; aggRecv += usd; } // recibido (fees/retiro)
      else continue;
      if (hasVaultMap && counterparty && vaultToPos.has(counterparty)) {
        const pos = vaultToPos.get(counterparty);
        pushEvent(pos.posId, pos.label, ts, net);
      }
    }
    if (!hasVaultMap) {
      const net = aggSent - aggRecv;
      if (Math.abs(net) >= 1e-9) pushEvent("sol-agg", "Solana (Orca/Raydium)", ts, net);
    }
  }

  const series = [];
  for (const [posId, rec] of perPos) {
    rec.events.sort((a, b) => a.ts - b.ts);
    let cumDep = 0, cumWd = 0, cumFees = 0;
    const byDay = new Map();
    for (const e of rec.events) {
      if (e.net > 0) {
        cumDep += e.net; // depósito
      } else {
        const r = -e.net; // importe recibido del pool
        // heurística: recibir un importe grande vs lo depositado = retiro de principal;
        // un importe pequeño = cobro de fees (las posiciones abiertas cobran fees sueltas)
        if (r > 0.05 * Math.max(cumDep - cumWd, 1)) cumWd += r; // retiro de principal
        else cumFees += r;                                      // fee cobrada
      }
      const day = Math.floor((e.ts * 1000) / 86400000) * 86400000;
      byDay.set(day, { depositedUSD: Math.max(0, cumDep - cumWd), withdrawnUSD: cumWd, feesUSD: cumFees });
    }
    const points = [...byDay.entries()].map(([ts, v]) => ({ ts, ...v })).sort((a, b) => a.ts - b.ts);
    if (points.length) series.push({ posId, label: rec.label, points });
  }
  return series;
}

// ============================================================================
// Init
// ============================================================================

async function init() {
  renderProtocolChips();
  renderWalletButton();
  trySilentReconnectPhantom();
  document.getElementById("btn-settings").onclick = openSettings;
  document.getElementById("btn-analyze").onclick = analyze;
  document.getElementById("addr-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") analyze();
  });
  document.getElementById("sort-by").addEventListener("change", (e) => {
    state.sortBy = e.target.value;
    renderPositions();
  });
  document.getElementById("hide-closed").addEventListener("change", (e) => {
    state.hideClosed = e.target.checked;
    renderPositions();
  });

  await ensureNoble();

  if (!state.heliusKey && !PROXY_BASE) {
    setStatus("Configura tu Helius API key en Settings antes de analizar.", "info");
  } else {
    setStatus("Listo. Pega una dirección Solana y pulsa Analizar.", "info");
  }
}

document.addEventListener("DOMContentLoaded", init);

// ============================================================================
// Modo embebido (cuando corre dentro del shell unificado lp-analyzer)
// ============================================================================
(function () {
  if (window.parent === window) return; // no embebido
  const style = document.createElement("style");
  // Embebido: ocultamos header, input block y summary interno (el shell pinta uno
  // idéntico al de Portfolio sobre el iframe).
  style.textContent = "header{display:none!important}#addr-block{display:none!important}#input-section{margin-top:0}#summary-section{display:none!important}";
  document.head.appendChild(style);
  document.documentElement.classList.add("embedded");
  function notifyWallet() {
    const addr = (typeof state !== "undefined" && state.connectedAddress) || null;
    try { window.parent.postMessage({ type: "lp-wallet", app: "sol", address: addr }, "*"); } catch (e) {}
  }
  // Expuesto en window para que handlers fuera del IIFE (connectPhantom,
  // accountChanged, disconnectPhantom, trySilentReconnectPhantom) puedan
  // notificar al shell sin romper el encapsulamiento. Permite que cualquier
  // cambio de cuenta desde la extensión Phantom se refleje en la UI del
  // shell automáticamente.
  window.__notifySolWallet = notifyWallet;
  // Normaliza las posiciones Solana para el portfolio del shell
  function toPortfolioItems() {
    return (state.positions || []).map((p) => {
      const cardHTML = (() => { try { return positionCard(p).outerHTML; } catch (e) { return ""; } })();
      if (p._lending) {
        const protoName = p.protocol === "jupiter-lend" ? "Jupiter Lend" : (p.protocol || "Lending");
        return {
          kind: "sol", lending: true, cardHTML,
          venue: `${protoName} · ${p.chainName || "Solana"}`,
          pair: `${p.asset} (lending)`,
          valueUSD: p.currentValueUSD || 0,
          feesUSD: p.gainsUSD || 0,        // interés acumulado (si lo conocemos)
          feesPendingUSD: 0,
          ilUSD: null,
          pnlUSD: p.gainsUSD == null ? null : p.gainsUSD,
          apr: typeof p.apr === "number" ? p.apr : null,
          inRange: true, closed: false,
          id: String(p.mint || ""),
        };
      }
      return {
        kind: "sol", cardHTML,
        venue: (PROTOCOLS[p.protocol] && PROTOCOLS[p.protocol].name) || p.protocol,
        pair: `${p.token0.symbol}/${p.token1.symbol}`,
        valueUSD: p.currentValueUSD || 0,
        feesUSD: p.feesCollectedUSD || 0,
        feesPendingUSD: p.feesPendingUSD == null ? null : p.feesPendingUSD,
        ilUSD: p.ilUSD == null ? null : p.ilUSD,
        pnlUSD: p.pnlUSD == null ? null : p.pnlUSD,
        apr: typeof p.apr === "number" && isFinite(p.apr) ? p.apr : null,
        inRange: !!p.inRange,
        closed: !!p.closed,
        tickLower: p.tickLower, tickUpper: p.tickUpper, tick: p.tick,
        dec0: p.token0.decimals, dec1: p.token1.decimals,
        id: String(p.mint || ""),
      };
    });
  }
  window.addEventListener("message", (e) => {
    const d = e.data || {};
    if (d.type === "lp-clear") {
      if (typeof state !== "undefined") state.positions = [];
      ["positions-section", "summary-section", "charts-section"].forEach((id) => { const e = document.getElementById(id); if (e) e.classList.add("hidden"); });
      const es = document.getElementById("empty-state"); if (es) es.classList.remove("hidden");
      const sm = document.getElementById("status-msg"); if (sm) sm.classList.add("hidden");
      const inp = document.getElementById("addr-input"); if (inp) inp.value = "";
    } else if (d.type === "lp-set-token") {
      proxyToken = d.token || "";
    } else if (d.type === "lp-set-fx") {
      if (typeof setCurrency === "function") setCurrency(d.rate, d.sym);
      if (typeof renderAll === "function" && (state.positions || []).length) renderAll();
    } else if (d.type === "lp-apply-keys") {
      // El shell envía las API keys que configura el admin en su modal de Settings.
      if (typeof d.helius === "string") {
        state.heliusKey = d.helius;
        try { localStorage.setItem("sol:heliusKey", d.helius); } catch (e) {}
      }
      if (typeof d.birdeye === "string") {
        state.birdeyeKey = d.birdeye;
        try { localStorage.setItem("sol:birdeyeKey", d.birdeye); } catch (e) {}
      }
    } else if (d.type === "lp-analyze" && typeof d.address === "string") {
      const input = document.getElementById("addr-input");
      if (input) input.value = d.address;
      Promise.resolve(typeof analyze === "function" ? analyze() : null)
        .finally(() => {
          // Mismos items normalizados que Portfolio → el shell pinta su resumen Quick
          // con la misma plantilla y queda idéntico al global.
          try {
            const items = (typeof toPortfolioItems === "function") ? toPortfolioItems() : [];
            const analysisStatus = state.analysisStatus || { ok: true, errors: [] };
            const idleTokens = state.idleTokens || [];
            window.parent.postMessage({ type: "lp-summary", app: "sol", items, analysisStatus, idleTokens }, "*");
          } catch (e) {}
          try { window.parent.postMessage({ type: "lp-analyze-done", app: "sol" }, "*"); } catch (e) {}
        });
    } else if (d.type === "lp-open-settings") {
      if (typeof openSettings === "function") openSettings();
    } else if (d.type === "lp-connect-wallet") {
      if (typeof connectPhantom === "function") Promise.resolve(connectPhantom()).then(notifyWallet).catch(notifyWallet);
    } else if (d.type === "lp-disconnect-wallet") {
      if (typeof disconnectPhantom === "function") { disconnectPhantom(); notifyWallet(); }
    } else if (d.type === "lp-set-protocols" && Array.isArray(d.protocols)) {
      state.selectedProtocols = d.protocols.slice();
      localStorage.setItem("sol:selectedProtocols", JSON.stringify(state.selectedProtocols));
      if (typeof renderProtocolChips === "function") renderProtocolChips();
    } else if (d.type === "lp-portfolio-analyze" && typeof d.address === "string") {
      const input = document.getElementById("addr-input");
      if (input) input.value = d.address;
      Promise.resolve(typeof analyze === "function" ? analyze() : null)
        .then(async () => {
          const status = (document.getElementById("status-msg") || {}).textContent || "";
          // Histórico real (Helius enhanced txs); si falla, serie "plana" con el valor actual
          let timeline = [];
          try { timeline = await fetchSolanaHistory(d.address); } catch (e) { console.warn("sol history:", e); }
          const nowMs = Math.floor(Date.now() / 86400000) * 86400000;
          const haveSeriesFor = new Set(timeline.map((s) => s.posId));
          // Series para Jupiter Lend: si tenemos openedAt (tx-scan ok) → 2 puntos
          // (depo en su día + valor hoy con interés). Si no, plana en hoy.
          for (const p of (state.positions || [])) {
            if (p.closed || !p._lending) continue;
            if (haveSeriesFor.has(p.mint)) continue;
            const dep = p.depositedUSD != null ? p.depositedUSD : (p.currentValueUSD || 0);
            const gain = p.gainsUSD || 0;
            const label = `${p.asset} (lending)`;
            if (p.openedAt) {
              const openedDay = Math.floor((p.openedAt * 1000) / 86400000) * 86400000;
              if (openedDay < nowMs) {
                timeline.push({ posId: p.mint, label, flat: false, points: [
                  { ts: openedDay, depositedUSD: dep, withdrawnUSD: 0, feesUSD: 0 },
                  { ts: nowMs,     depositedUSD: dep, withdrawnUSD: 0, feesUSD: gain },
                ] });
                haveSeriesFor.add(p.mint);
                continue;
              }
            }
            timeline.push({ posId: p.mint, label, flat: true, points: [{ ts: nowMs, depositedUSD: dep, withdrawnUSD: 0, feesUSD: gain }] });
            haveSeriesFor.add(p.mint);
          }
          // LPs sin histórico real → serie plana (compat con comportamiento anterior).
          for (const p of (state.positions || [])) {
            if (p.closed || p._lending) continue;
            if (haveSeriesFor.has(p.mint)) continue;
            const fees = p.feesPendingUSD || 0;
            const dep = Math.max(0, (p.currentValueUSD || 0) - fees);
            timeline.push({ posId: p.mint, label: `${p.token0.symbol}/${p.token1.symbol}`, flat: true, points: [{ ts: nowMs, depositedUSD: dep, withdrawnUSD: 0, feesUSD: fees }] });
          }
          const analysisStatus = state.analysisStatus || { ok: true, errors: [] };
          const idleTokens = state.idleTokens || [];
          window.parent.postMessage({ type: "lp-result", app: "sol", reqId: d.reqId, address: d.address, items: toPortfolioItems(), status, timeline, analysisStatus, idleTokens }, "*");
        })
        .catch((err) => {
          window.parent.postMessage({ type: "lp-result", app: "sol", reqId: d.reqId, address: d.address, items: [], status: "error", error: String(err), idleTokens: [], analysisStatus: { ok: false, errors: [{ source: "Solana", reason: String(err) }] } }, "*");
        });
    }
  });
  setTimeout(notifyWallet, 1500);
  try { window.parent.postMessage({ type: "lp-ready", app: "sol" }, "*"); } catch (e) {}
})();
