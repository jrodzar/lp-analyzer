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
//   6) Fees pendientes = feeOwedA/B (claimable; ver footer para limitación)
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
  hideClosed: false,
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
  if (!state.heliusKey) throw new Error("Falta Helius API key (Settings).");
  return `https://mainnet.helius-rpc.com/?api-key=${state.heliusKey}`;
}

async function rpc(method, params) {
  const url = rpcUrl();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`RPC HTTP ${res.status}: ${text.slice(0, 120)}`);
  }
  const json = await res.json();
  if (json.error) throw new Error(`RPC: ${json.error.message || JSON.stringify(json.error)}`);
  return json.result;
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
  // si Jupiter no lo conoce, leemos decimales del mint on-chain
  try {
    const info = await rpc("getAccountInfo", [mint, { encoding: "jsonParsed" }]);
    const dec = info?.value?.data?.parsed?.info?.decimals;
    return { symbol: mint.slice(0, 4) + "…" + mint.slice(-4), name: "Unknown", decimals: dec ?? 0, logoURI: null };
  } catch {
    return { symbol: mint.slice(0, 4) + "…" + mint.slice(-4), name: "Unknown", decimals: 0, logoURI: null };
  }
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

function fmtUSD(n) {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(2)}k`;
  if (abs >= 1) return `${sign}$${abs.toFixed(2)}`;
  if (abs >= 0.01) return `${sign}$${abs.toFixed(4)}`;
  if (abs === 0) return "$0";
  return `${sign}$${abs.toExponential(2)}`;
}

function fmtToken(n, sym) {
  if (!isFinite(n)) return `— ${sym}`;
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M ${sym}`;
  if (abs >= 1) return `${n.toFixed(4)} ${sym}`;
  if (abs >= 0.0001) return `${n.toFixed(6)} ${sym}`;
  if (abs === 0) return `0 ${sym}`;
  return `${n.toExponential(2)} ${sym}`;
}

function shortAddr(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
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
function assignColors(list) {
  list.forEach((p, i) => { p.color = distinctColor(i); });
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
  document.getElementById("sum-positions-sub").textContent = `${agg.inRange} en rango · ${agg.outRange} fuera · ${agg.closed} cerradas`;
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

function positionCard(p) {
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
        <div class="text-[11px] text-slate-400">${p.feeTier != null ? `fee ${p.feeTier.toFixed(2)}% · ` : ""}tickSpacing ${p.tickSpacing}</div>
      </div>
      ${rangeChip}
    </div>

    <div class="grid grid-cols-2 gap-2 text-xs">
      <div class="bg-slate-950/40 rounded-lg p-2">
        <div class="text-[10px] uppercase tracking-wide text-slate-500">Valor actual</div>
        <div class="font-semibold">${fmtUSD(p.currentValueUSD)}</div>
        <div class="text-[10px] text-slate-400 mt-0.5">${fmtToken(p.amounts.amount0, p.token0.symbol)}</div>
        <div class="text-[10px] text-slate-400">${fmtToken(p.amounts.amount1, p.token1.symbol)}</div>
      </div>
      <div class="bg-slate-950/40 rounded-lg p-2">
        <div class="text-[10px] uppercase tracking-wide text-slate-500">Fees pendientes</div>
        <div class="font-semibold text-emerald-400">${fmtUSD(p.feesPendingUSD)}</div>
        <div class="text-[10px] text-slate-400 mt-0.5">${fmtToken(p.feesA, p.token0.symbol)}</div>
        <div class="text-[10px] text-slate-400">${fmtToken(p.feesB, p.token1.symbol)}</div>
      </div>
    </div>

    <details class="text-xs">
      <summary class="text-slate-400 hover:text-slate-200">▾ detalles</summary>
      <div class="mt-2 space-y-1 text-slate-400">
        <div>Position NFT: <a href="https://solscan.io/token/${p.mint}" target="_blank" class="font-mono text-slate-300 hover:text-purple-300">${shortAddr(p.mint)}</a></div>
        <div>Whirlpool: <a href="https://solscan.io/account/${p.whirlpool}" target="_blank" class="font-mono text-slate-300 hover:text-purple-300">${shortAddr(p.whirlpool)}</a></div>
        <div>Rango ticks: ${p.tickLower} → ${p.tickUpper} (actual: ${p.tick})</div>
        <div>Liquidez: <span class="font-mono">${p.liquidity.toString()}</span></div>
      </div>
    </details>
  `;
  return el;
}

function renderCharts() {
  const section = document.getElementById("charts-section");
  if (!state.positions.length) { section.classList.add("hidden"); return; }
  section.classList.remove("hidden");
  renderValueChart();
}

function renderValueChart() {
  const top = [...state.positions]
    .sort((a, b) => b.currentValueUSD - a.currentValueUSD)
    .slice(0, 8);
  const labels = top.map((p) => `${p.token0.symbol}/${p.token1.symbol}`);
  const data = top.map((p) => p.currentValueUSD);
  const bg = top.map((p) => (p.color ? p.color.line : PROTOCOLS[p.protocol].color));

  if (charts.value) charts.value.destroy();
  charts.value = new Chart(document.getElementById("chart-value"), {
    type: "bar",
    data: { labels, datasets: [{ label: "Valor (USD)", data, backgroundColor: bg, borderRadius: 6 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#cbd5e1", font: { size: 10 } } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmtUSD(ctx.parsed.y)}` } },
      },
      scales: {
        x: { ticks: { color: "#94a3b8" }, grid: { color: "#1e293b" } },
        y: { ticks: { color: "#94a3b8", callback: (v) => fmtUSD(v) }, grid: { color: "#1e293b" } },
      },
    },
  });
}

// ============================================================================
// Analyze flow
// ============================================================================

async function analyze() {
  await ensureNoble();
  const addr = document.getElementById("addr-input").value.trim();
  if (!isValidSolanaAddress(addr)) { setStatus("Dirección Solana no válida (base58, 32-44 chars).", "err"); return; }
  if (!state.heliusKey) { setStatus("Falta Helius API key. Abre Settings.", "err"); openSettings(); return; }
  if (!state.selectedProtocols.length) { setStatus("Selecciona al menos un protocolo.", "err"); return; }

  state.address = addr;
  state.positions = [];
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

    if (!all.length) {
      setStatus(`Sin posiciones para ${shortAddr(addr)} en los protocolos activos.`, "info");
    } else {
      const enRango = all.filter((p) => !p.closed && p.inRange).length;
      setStatus(`${all.length} posiciones (${enRango} en rango).`, "ok");
    }
    renderAll();
  } catch (e) {
    console.error(e);
    setStatus(`Error: ${e.message}`, "err");
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
    if (!provider.__lpListenersAttached) {
      provider.on?.("accountChanged", (publicKey) => {
        if (publicKey) {
          state.connectedAddress = publicKey.toString();
          const inp = document.getElementById("addr-input");
          if (inp) inp.value = state.connectedAddress;
          renderWalletButton();
          setStatus(`Cuenta cambiada: ${shortAddr(state.connectedAddress)}`, "info");
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
async function fetchSolanaHistory(owner) {
  if (!state.heliusKey || !owner) return [];
  const priceOf = (mint) => (state.prices[mint] != null ? state.prices[mint] : (SOL_STABLES.has(mint) ? 1 : 0));
  const txs = [];
  let before = "";
  for (let page = 0; page < 10; page++) {
    const url = `https://api.helius.xyz/v0/addresses/${owner}/transactions?api-key=${state.heliusKey}&limit=100${before ? "&before=" + before : ""}`;
    let arr;
    try { const r = await fetch(url); arr = await r.json(); } catch { break; }
    if (!Array.isArray(arr) || !arr.length) break;
    txs.push(...arr);
    before = arr[arr.length - 1].signature;
    if (arr.length < 100) break;
  }
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
      const p = priceOf(t.mint); if (!p) continue;
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

  if (!state.heliusKey) {
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
  style.textContent = "header{display:none!important}#addr-block{display:none!important}#input-section{margin-top:0}";
  document.head.appendChild(style);
  document.documentElement.classList.add("embedded");
  function notifyWallet() {
    const addr = (typeof state !== "undefined" && state.connectedAddress) || null;
    try { window.parent.postMessage({ type: "lp-wallet", app: "sol", address: addr }, "*"); } catch (e) {}
  }
  // Normaliza las posiciones Solana para el portfolio del shell
  function toPortfolioItems() {
    return (state.positions || []).map((p) => ({
      kind: "sol",
      venue: (PROTOCOLS[p.protocol] && PROTOCOLS[p.protocol].name) || p.protocol,
      pair: `${p.token0.symbol}/${p.token1.symbol}`,
      valueUSD: p.currentValueUSD || 0,
      feesUSD: 0,
      feesPendingUSD: p.feesPendingUSD == null ? null : p.feesPendingUSD,
      ilUSD: null,
      pnlUSD: null,
      apr: typeof p.apr === "number" && isFinite(p.apr) ? p.apr : null,
      inRange: !!p.inRange,
      closed: !!p.closed,
      id: String(p.mint || ""),
    }));
  }
  window.addEventListener("message", (e) => {
    const d = e.data || {};
    if (d.type === "lp-analyze" && typeof d.address === "string") {
      const input = document.getElementById("addr-input");
      if (input) { input.value = d.address; if (typeof analyze === "function") analyze(); }
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
          if (!timeline.length) {
            const nowMs = Math.floor(Date.now() / 86400000) * 86400000;
            timeline = (state.positions || []).filter((p) => !p.closed).map((p) => {
              const fees = p.feesPendingUSD || 0;
              const dep = Math.max(0, (p.currentValueUSD || 0) - fees);
              return { posId: p.mint, label: `${p.token0.symbol}/${p.token1.symbol}`, flat: true, points: [{ ts: nowMs, depositedUSD: dep, withdrawnUSD: 0, feesUSD: fees }] };
            });
          }
          window.parent.postMessage({ type: "lp-result", app: "sol", reqId: d.reqId, address: d.address, items: toPortfolioItems(), status, timeline }, "*");
        })
        .catch((err) => {
          window.parent.postMessage({ type: "lp-result", app: "sol", reqId: d.reqId, address: d.address, items: [], status: "error", error: String(err) }, "*");
        });
    }
  });
  setTimeout(notifyWallet, 1500);
  try { window.parent.postMessage({ type: "lp-ready", app: "sol" }, "*"); } catch (e) {}
})();
