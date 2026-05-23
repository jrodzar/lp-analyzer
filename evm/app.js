"use strict";

// ============================================================================
// Config: redes y subgraph IDs (Uniswap V3 oficiales en la red descentralizada)
// ============================================================================

const DEFAULT_CHAINS = {
  ethereum: {
    name: "Ethereum",
    short: "ETH",
    color: "#627EEA",
    subgraphId: "5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV",
    explorer: "https://etherscan.io",
    nativeUsdField: "ethPriceUSD",
    blockscoutApi: "https://eth.blockscout.com/api",
    llamaChain: "ethereum",
    dexscreenerChain: "ethereum",
    uniNftManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
    nativeSymbol: "ETH", nativeName: "Ethereum", nativeCoingecko: "ethereum",
  },
  arbitrum: {
    name: "Arbitrum",
    short: "ARB",
    color: "#28A0F0",
    subgraphId: "3V7ZY6muhxaQL5qvntX1CFXJ32W7BxXZTGTwmpH5J4t3",
    explorer: "https://arbiscan.io",
    tickField: "scalar", // tickLower/Upper son BigInt directo
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    blockscoutApi: "https://arbitrum.blockscout.com/api",
    llamaChain: "arbitrum",
    dexscreenerChain: "arbitrum",
    uniNftManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
    nativeSymbol: "ETH", nativeName: "Ethereum", nativeCoingecko: "ethereum",
  },
  optimism: {
    name: "Optimism",
    short: "OP",
    color: "#FF0420",
    subgraphId: "Cghf4LfVqPiFw6fp6Y5X5Ubc8UpmUhSfJL82zwiBFLaj",
    explorer: "https://optimistic.etherscan.io",
    nativeUsdField: "ethPriceUSD",
    // optimism.blockscout.com NO permite CORS desde el navegador → tokens idle no
    // soportados aquí hasta que enrutemos Blockscout a través del Cloudflare Worker.
    // blockscoutApi: "https://optimism.blockscout.com/api",
    llamaChain: "optimism",
    dexscreenerChain: "optimism",
    uniNftManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
    nativeSymbol: "ETH", nativeName: "Ethereum", nativeCoingecko: "ethereum",
  },
  polygon: {
    name: "Polygon",
    short: "POL",
    color: "#8247E5",
    subgraphId: "3hCPRGf4z88VC5rsBKU5AA9FBBq5nF3jbKJG7VZCbhjm",
    explorer: "https://polygonscan.com",
    nativeUsdField: "ethPriceUSD",
    blockscoutApi: "https://polygon.blockscout.com/api",
    llamaChain: "polygon",
    dexscreenerChain: "polygon",
    uniNftManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
    nativeSymbol: "POL", nativeName: "Polygon", nativeCoingecko: "matic-network",
  },
  base: {
    name: "Base",
    short: "BASE",
    color: "#0052FF",
    subgraphId: "HMuAwufqZ1YCRmzL2SfHTVkzZovC9VL2UAKhjvRqKiR1",
    explorer: "https://basescan.org",
    schemaVariant: "native", // usa derivedNative / nativePriceUSD
    tickField: "scalar", // tickLower/Upper son Int directo
    rpcUrl: "https://mainnet.base.org",
    blockscoutApi: "https://base.blockscout.com/api",
    llamaChain: "base",
    dexscreenerChain: "base",
    uniNftManager: "0x03a520b32C04BF3bE5F46762d11A6c3A4ad0C0a4",
    nativeSymbol: "ETH", nativeName: "Ethereum", nativeCoingecko: "ethereum",
  },
  bnb: {
    name: "BNB Chain",
    short: "BNB",
    color: "#F3BA2F",
    subgraphId: "F85MNzUGYqgSHSHRGgeVMNsdnW1KtZSVgFULumXRZTw2",
    explorer: "https://bscscan.com",
    nativeUsdField: "ethPriceUSD",
    // BNB no tiene Blockscout oficial → tokens idle no soportados aún
    llamaChain: "bsc",
    dexscreenerChain: "bsc",
    uniNftManager: "0x7b8A01B39D58278b5DE7e48c8449c9f4F5170613",
    nativeSymbol: "BNB", nativeName: "BNB", nativeCoingecko: "binancecoin",
  },
  hyperevm: {
    name: "HyperEVM",
    short: "HYPER",
    color: "#97FCE4",
    subgraphId: "", // no hay subgraph público — usamos modo RPC-directo
    explorer: "https://hyperevmscan.io",
    rpcUrl: "https://rpc.hyperliquid.xyz/evm",
    rpcUrls: ["https://rpc.hyperliquid.xyz/evm", "https://hyperliquid.drpc.org", "https://rpc.hypurrscan.io"],
    tickField: "scalar",
    // Contratos HyperSwap V3 en HyperEVM mainnet
    nftManagerAddress: "0x6eda206207c09e5428f281761ddc0d300851fbc8",
    factoryAddress:    "0xb1c0fa0b789320044a6f623cfe5ebda9562602e3",
    stableAddress:     "0x24ac48bf01fd6cb1c3836d08b3edc70a9c4380ca", // USDC en HyperEVM
    // API Blockscout (gratis, sin key, sin límite de 1000 bloques) para histórico
    explorerApi:       "https://www.hyperscan.com/api",
    blockscoutApi:     "https://www.hyperscan.com/api",
    llamaChain:        "hyperliquid",
    dexscreenerChain: "hyperevm",
    nativeSymbol: "HYPE", nativeName: "Hyperliquid", nativeCoingecko: "hyperliquid",
  },
};

const GATEWAY = "https://gateway.thegraph.com/api";
// Proxy de Cloudflare (las API keys viven dentro del Worker, no aquí). Si está
// puesto, los usuarios no necesitan su propia key. Override por localStorage.
const PROXY_BASE = (localStorage.getItem("lp:proxyBase") || "https://lp-proxy.jrodzar.workers.dev").replace(/\/$/, "");
let proxyToken = ""; // ID token de Firebase, lo envía el shell (lp-set-token); requerido por el proxy
function proxyAuth(url) {
  return (PROXY_BASE && url.startsWith(PROXY_BASE) && proxyToken) ? { Authorization: `Bearer ${proxyToken}` } : {};
}
// Cache del histórico (eventos on-chain): apenas cambia → no se re-pide en cada auto-refresco
const _histCache = new Map(); // clave -> { data, ts }
const HIST_CACHE_TTL = 10 * 60 * 1000; // 10 min
const DEFAULTS_VERSION = 8; // bump cuando cambien IDs por defecto para forzar refresh

// ============================================================================
// State
// ============================================================================

const state = {
  apiKey: localStorage.getItem("lp:apiKey") || "",
  chains: loadChainConfig(),
  selectedChains: JSON.parse(localStorage.getItem("lp:selectedChains") || "null") || Object.keys(DEFAULT_CHAINS),
  address: "",
  connectedAddress: null,
  positions: [],
  loading: false,
  error: null,
  sortBy: "value",
  hideClosed: true,
};

let charts = { fees: null, value: null };

function loadChainConfig() {
  try {
    const storedVersion = Number(localStorage.getItem("lp:chainsVersion") || 0);
    // si los defaults se han actualizado, descartamos lo cacheado para coger los nuevos IDs
    if (storedVersion < DEFAULTS_VERSION) {
      localStorage.removeItem("lp:chains");
      localStorage.setItem("lp:chainsVersion", String(DEFAULTS_VERSION));
      return structuredClone(DEFAULT_CHAINS);
    }
    const stored = JSON.parse(localStorage.getItem("lp:chains") || "null");
    if (!stored) return structuredClone(DEFAULT_CHAINS);
    const merged = structuredClone(DEFAULT_CHAINS);
    for (const k of Object.keys(stored)) {
      if (merged[k]) merged[k].subgraphId = stored[k].subgraphId || merged[k].subgraphId;
    }
    return merged;
  } catch (e) {
    return structuredClone(DEFAULT_CHAINS);
  }
}

// ============================================================================
// GraphQL helpers
// ============================================================================

// Construye la query adaptada al schema de cada subgraph.
// Algunas redes (p.ej. Base con UniV3-Base) usan derivedNative/nativePriceUSD
// en lugar de derivedETH/ethPriceUSD. Usamos aliases para que el resto del
// código siempre lea derivedETH y ethPriceUSD.
function buildPositionsQuery(variant, tickField) {
  const derived = variant === "native" ? "derivedETH: derivedNative" : "derivedETH";
  const ethUsd = variant === "native" ? "ethPriceUSD: nativePriceUSD" : "ethPriceUSD";
  // tickLower/Upper: en algunos subgraphs son escalares directos, en otros objetos con tickIdx.
  // En la variante object pedimos también feeGrowthOutside* para poder calcular fees no cobradas.
  const tickSel = tickField === "scalar"
    ? "tickLower tickUpper"
    : "tickLower { tickIdx feeGrowthOutside0X128 feeGrowthOutside1X128 } tickUpper { tickIdx feeGrowthOutside0X128 feeGrowthOutside1X128 }";
  // En scalar variants los pools no exponen Tick entity con outside, así que no podemos
  // calcular uncollected. Igualmente pedimos los growth globals e inside last por si en
  // el futuro tenemos otra vía (RPC) que los use.
  return `
    query Positions($owner: String!) {
      positions(where: { owner: $owner }, first: 1000, orderBy: id) {
        id
        owner
        liquidity
        depositedToken0
        depositedToken1
        withdrawnToken0
        withdrawnToken1
        collectedFeesToken0
        collectedFeesToken1
        feeGrowthInside0LastX128
        feeGrowthInside1LastX128
        ${tickSel}
        transaction { timestamp }
        pool {
          id
          feeTier
          tick
          sqrtPrice
          token0Price
          token1Price
          totalValueLockedUSD
          feeGrowthGlobal0X128
          feeGrowthGlobal1X128
          token0 { id symbol name decimals ${derived} }
          token1 { id symbol name decimals ${derived} }
        }
      }
      bundles(first: 1) { ${ethUsd} }
    }
  `;
}

const SNAPSHOTS_QUERY = `
  query Snapshots($positionId: String!) {
    positionSnapshots(
      where: { position: $positionId }
      orderBy: timestamp
      orderDirection: asc
      first: 1000
    ) {
      timestamp
      liquidity
      depositedToken0
      depositedToken1
      withdrawnToken0
      withdrawnToken1
      collectedFeesToken0
      collectedFeesToken1
    }
  }
`;

async function gql(chainKey, query, variables) {
  const chain = state.chains[chainKey];
  if (!chain) throw new Error(`Red desconocida: ${chainKey}`);
  if (!chain.subgraphId) throw new Error(`${chain.name}: sin subgraph configurado (red RPC-only).`);
  const isDirectUrl = chain.subgraphId.startsWith("http");
  let url;
  if (isDirectUrl) url = chain.subgraphId;
  else if (state.apiKey) url = `${GATEWAY}/${state.apiKey}/subgraphs/id/${chain.subgraphId}`;   // key propia
  else if (PROXY_BASE) url = `${PROXY_BASE}/graph/${chain.subgraphId}`;                          // proxy compartido
  else throw new Error("Falta API key de The Graph (Settings) o proxy configurado.");
  // Hasta 3 intentos con backoff progresivo si el upstream/proxy devuelve 429
  // (rate limit) o 5xx (servicio temporal). Evita que un análisis grande con
  // varias direcciones × varias chains haga "stampede" y reviente el límite.
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...proxyAuth(url) },
        body: JSON.stringify({ query, variables }),
      });
    } catch (e) {
      lastErr = e;
      if (attempt < 2) { await sleep(600 * (attempt + 1)); continue; } else throw e;
    }
    if (res.status === 429 || res.status >= 500) {
      lastErr = new Error(`${chain.name}: HTTP ${res.status}`);
      if (attempt < 2) { await sleep(800 * (attempt + 1)); continue; }
      throw lastErr;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`${chain.name}: HTTP ${res.status} ${text.slice(0, 120)}`);
    }
    const json = await res.json();
    if (json.errors) {
      throw new Error(`${chain.name}: ${json.errors.map((e) => e.message).join("; ")}`);
    }
    return json.data;
  }
  throw lastErr || new Error(`${chain.name}: agotados los reintentos`);
}

// ============================================================================
// V3 math (concentrated liquidity)
// Reference: Uniswap V3 whitepaper, sections 6.2-6.3
// ============================================================================

function sqrtPriceFromTick(tick) {
  return Math.pow(1.0001, tick / 2);
}

/**
 * Devuelve los amounts de token0 y token1 que contiene la posición
 * dada su liquidez L y el tick actual del pool.
 */
function getAmountsFromLiquidity(liquidity, tick, tickLower, tickUpper, dec0, dec1) {
  const L = Number(liquidity);
  if (!L || !isFinite(L)) return { amount0: 0, amount1: 0 };
  const sqrtP = sqrtPriceFromTick(tick);
  const sqrtPa = sqrtPriceFromTick(tickLower);
  const sqrtPb = sqrtPriceFromTick(tickUpper);
  let amount0Raw = 0;
  let amount1Raw = 0;
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

function inRange(tick, tickLower, tickUpper) {
  return tick >= tickLower && tick < tickUpper;
}

// Aritmética modular 256-bit (los feeGrowth se almacenan como uint256 que pueden
// "underflowear" al restar — el EVM lo trata como módulo natural)
const Q256_MOD = 1n << 256n;
const Q256_MASK = Q256_MOD - 1n;
function sub256(a, b) {
  return (a - b + Q256_MOD) & Q256_MASK;
}

function bigIntToDecimal(bn, decimals) {
  if (bn === 0n) return 0;
  const neg = bn < 0n;
  const abs = neg ? -bn : bn;
  const s = abs.toString().padStart(decimals + 1, "0");
  const intPart = s.slice(0, s.length - decimals) || "0";
  const fracPart = decimals > 0 ? "." + s.slice(s.length - decimals) : "";
  return Number((neg ? "-" : "") + intPart + fracPart);
}

/**
 * Calcula las fees no cobradas (uncollected) de una posición V3.
 * Necesita feeGrowthOutside de los ticks lower/upper, que solo está disponible
 * cuando el subgraph expone tickLower/Upper como objeto Tick. Devuelve null si
 * no se puede calcular.
 */
function computeUncollectedFees(raw, dec0, dec1) {
  const tl = raw.tickLower;
  const tu = raw.tickUpper;
  if (!tl || typeof tl !== "object" || tl.feeGrowthOutside0X128 === undefined) return null;
  if (!tu || typeof tu !== "object" || tu.feeGrowthOutside0X128 === undefined) return null;
  const pool = raw.pool;
  if (!pool || pool.feeGrowthGlobal0X128 === undefined) return null;

  const liquidity = BigInt(raw.liquidity || "0");
  if (liquidity === 0n) return { amount0: 0, amount1: 0 };

  const global0 = BigInt(pool.feeGrowthGlobal0X128);
  const global1 = BigInt(pool.feeGrowthGlobal1X128);
  const tick = Number(pool.tick);
  const tickLowerIdx = Number(tl.tickIdx);
  const tickUpperIdx = Number(tu.tickIdx);

  const lowerOut0 = BigInt(tl.feeGrowthOutside0X128);
  const lowerOut1 = BigInt(tl.feeGrowthOutside1X128);
  const upperOut0 = BigInt(tu.feeGrowthOutside0X128);
  const upperOut1 = BigInt(tu.feeGrowthOutside1X128);
  const insideLast0 = BigInt(raw.feeGrowthInside0LastX128);
  const insideLast1 = BigInt(raw.feeGrowthInside1LastX128);

  const insideFor = (global, lowerOut, upperOut) => {
    const below = tick >= tickLowerIdx ? lowerOut : sub256(global, lowerOut);
    const above = tick < tickUpperIdx ? upperOut : sub256(global, upperOut);
    return sub256(sub256(global, below), above);
  };

  const inside0 = insideFor(global0, lowerOut0, upperOut0);
  const inside1 = insideFor(global1, lowerOut1, upperOut1);

  const fee0Raw = (liquidity * sub256(inside0, insideLast0)) >> 128n;
  const fee1Raw = (liquidity * sub256(inside1, insideLast1)) >> 128n;

  return {
    amount0: bigIntToDecimal(fee0Raw, dec0),
    amount1: bigIntToDecimal(fee1Raw, dec1),
  };
}

// ============================================================================
// RPC fallback para fees no cobradas (Arbitrum / Base)
// El subgraph en esas redes no expone Tick.feeGrowthOutside, así que leemos
// directamente del contrato Pool.ticks(int24).
// ============================================================================

const TICKS_SELECTOR = "0xf30dba93"; // keccak("ticks(int24)")[0:4]

function encodeInt24Padded(n) {
  // sign-extiende int24 a 32 bytes con two's complement
  const asInt = BigInt.asIntN(24, BigInt(n));
  const unsigned = asInt < 0n ? Q256_MOD + asInt : asInt;
  return unsigned.toString(16).padStart(64, "0");
}

// eth_call resiliente: acepta un RPC (string) o una lista (rota entre ellos) y
// reintenta con backoff ante fallos transitorios (429 / 5xx / red).
async function rpcEthCall(rpcOrList, to, data) {
  const rpcs = Array.isArray(rpcOrList) ? rpcOrList.filter(Boolean) : [rpcOrList];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const body = JSON.stringify({ jsonrpc: "2.0", method: "eth_call", params: [{ to, data }, "latest"], id: 1 });
  let lastErr;
  for (const rpc of rpcs) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(rpc, { method: "POST", headers: { "Content-Type": "application/json" }, body });
        if (res.status === 429 || res.status >= 500) {
          lastErr = new Error(`RPC HTTP ${res.status}`);
          if (attempt === 0) { await sleep(400 * (attempt + 1)); continue; } // reintento corto
          break; // agotado este endpoint → siguiente
        }
        if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
        const json = await res.json();
        if (json.error) throw new Error(`RPC ${json.error.code}: ${json.error.message}`);
        return json.result;
      } catch (e) {
        lastErr = e;
        if (attempt === 0 && /Failed to fetch|NetworkError|timeout|aborted/i.test(String(e.message))) { await sleep(400); continue; }
        break; // error no transitorio o ya reintentado → siguiente endpoint
      }
    }
  }
  throw lastErr || new Error("todos los RPC fallaron");
}

// ============================================================================
// Revert Lend — vaults ERC-4626 (lending). Lectura on-chain + histórico vía Blockscout.
// ============================================================================

const REVERT_LEND = {
  ethereum: { name: "Ethereum", vault: "0xa2754543f69dC036764bBfad16d2A74F5cD15667", rpcs: ["https://ethereum-rpc.publicnode.com", "https://eth.llamarpc.com", "https://1rpc.io/eth"], explorerApi: "https://eth.blockscout.com/api" },
  arbitrum: { name: "Arbitrum", vault: "0x74e6afef5705beb126c6d3bf46f8fad8f3e07825", rpcs: ["https://arb1.arbitrum.io/rpc", "https://arbitrum-one-rpc.publicnode.com", "https://1rpc.io/arb"], explorerApi: "https://arbitrum.blockscout.com/api" },
  base:     { name: "Base",     vault: "0x36AEAe0E411a1E28372e0d66f02E57744EbE7599", rpcs: ["https://mainnet.base.org", "https://base-rpc.publicnode.com", "https://1rpc.io/base"], explorerApi: "https://base.blockscout.com/api" },
};
const SEL_CONVERT_TO_ASSETS = "0x07a2d13a"; // convertToAssets(uint256)
const SEL_ASSET             = "0x38d52e0f"; // asset()

// eth_call probando varios RPC hasta que uno responda (resiliencia ante rate limit)
async function rpcCallFallback(rpcs, to, data) {
  let lastErr;
  for (const rpc of rpcs) {
    try { return await rpcEthCall(rpc, to, data); }
    catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("todos los RPC fallaron");
}
const EV_4626_DEPOSIT  = "0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7"; // Deposit(address,address,uint256,uint256)
const EV_4626_WITHDRAW = "0xfbde797d201c681b91056529119e0b02407c7bb96a4a2c75c01fc9667232c8db"; // Withdraw(address,address,address,uint256,uint256)

// Histórico de un lender: depositado/retirado (assets) + timestamp del primer depósito
async function fetchLendingHistory(apiBase, vault, owner, dec) {
  const cacheKey = `${apiBase}:lend:${vault}:${owner.toLowerCase()}`;
  const cached = _histCache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < HIST_CACHE_TTL) return cached.data;
  const ownerTopic = "0x" + owner.toLowerCase().replace("0x", "").padStart(64, "0");
  const word = (data, n) => BigInt("0x" + data.slice(2 + n * 64, 2 + n * 64 + 64));
  const get = async (qs) => {
    const r = await fetch(`${apiBase}?module=logs&action=getLogs&fromBlock=0&toBlock=latest&address=${vault}&${qs}`);
    const j = await r.json();
    return Array.isArray(j.result) ? j.result : [];
  };
  // Deposit: owner = topic2 ; Withdraw: owner = topic3
  const dep = await get(`topic0=${EV_4626_DEPOSIT}&topic2=${ownerTopic}&topic0_2_opr=and`);
  const wth = await get(`topic0=${EV_4626_WITHDRAW}&topic3=${ownerTopic}&topic0_3_opr=and`);
  let d = 0n, w = 0n, firstTs = null;
  const events = [];
  for (const l of dep) { d += word(l.data, 0); const ts = parseInt(l.timeStamp, 16); if (firstTs === null || ts < firstTs) firstTs = ts; events.push({ ts, type: "dep", amt: Number(word(l.data, 0)) / 10 ** dec }); }
  for (const l of wth) { w += word(l.data, 0); events.push({ ts: parseInt(l.timeStamp, 16), type: "wth", amt: Number(word(l.data, 0)) / 10 ** dec }); }
  const data = { deposited: Number(d) / 10 ** dec, withdrawn: Number(w) / 10 ** dec, firstTs, events };
  _histCache.set(cacheKey, { data, ts: Date.now() });
  return data;
}

// Serie diaria del lending: capital aportado por eventos + interés repartido linealmente
function buildLendingTimeline(events, gainsUSD, nowSec) {
  if (!events || !events.length) return [];
  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  const firstTs = sorted[0].ts;
  const span = Math.max(1, nowSec - firstTs);
  let net = 0;
  const byDay = new Map();
  for (const e of sorted) {
    net += e.type === "dep" ? e.amt : -e.amt;
    const frac = (e.ts - firstTs) / span;
    const day = Math.floor((e.ts * 1000) / 86400000) * 86400000;
    byDay.set(day, { depositedUSD: net, withdrawnUSD: 0, feesUSD: (gainsUSD || 0) * frac });
  }
  // punto final "hoy" con el interés total actual
  const today = Math.floor((nowSec * 1000) / 86400000) * 86400000;
  const lastNet = byDay.size ? [...byDay.values()].pop().depositedUSD : net;
  byDay.set(today, { depositedUSD: lastNet, withdrawnUSD: 0, feesUSD: gainsUSD || 0 });
  return [...byDay.entries()].map(([ts, v]) => ({ ts, ...v })).sort((a, b) => a.ts - b.ts);
}

// Devuelve posiciones de lending (una por red con saldo) para un owner
// ============================================================================
// Tokens "idle" — los que están en la wallet pero NO están dentro de posiciones LP.
// Blockscout v2 los devuelve listos con symbol/decimals y un exchange_rate (USD).
// Cuando exchange_rate falta, hacemos fallback batch a DefiLlama (gratis, sin key).
// ============================================================================
// Set de address (lowercase) de vaults Revert Lend, para excluirlos del listado
// de tokens idle: sus shares (rlBaseUSDC, rlEthUSDC, …) ya se cuentan como
// posición de tipo "lending" en el resumen DeFi, mostrarlos también en idle
// sería doble contar + el precio de share tokens vía DexScreener no es real
// (debería ser convertToAssets, que ya hace fetchRevertLending).
const _revertVaultsLower = new Set(
  Object.values(REVERT_LEND).map((v) => (v.vault || "").toLowerCase()).filter(Boolean)
);

async function fetchIdleTokensEVM(chainKey, address) {
  const c = state.chains[chainKey];
  if (!c || !c.blockscoutApi) return []; // chain sin soporte (p. ej. BNB / Optimism)
  if (c._noIdleSupport) return [];        // ya falló antes (CORS / red) → no reintentamos
  // Dos peticiones en paralelo:
  //   /v2/addresses/{addr}/tokens?type=ERC-20  → tokens ERC-20 con balance
  //   /v2/addresses/{addr}                     → coin_balance (nativo: ETH, HYPE, etc.)
  const urlTokens = `${c.blockscoutApi}/v2/addresses/${address}/tokens?type=ERC-20`;
  const urlAddr   = `${c.blockscoutApi}/v2/addresses/${address}`;
  let items = [], addrInfo = null;
  try {
    const [rT, rA] = await Promise.all([fetch(urlTokens), fetch(urlAddr)]);
    if (rT.ok) items = (await rT.json()).items || [];
    if (rA.ok) addrInfo = await rA.json();
  } catch (e) {
    // CORS o red caída → marcar la chain para no volver a intentar en esta sesión.
    c._noIdleSupport = true;
    return [];
  }

  // Procesar y filtrar tokens sin balance
  const tokens = [];
  const missingPrice = [];
  // 1) Balance nativo (ETH, HYPE, MATIC, BNB…) — viene en `coin_balance` (wei).
  if (addrInfo && addrInfo.coin_balance && c.nativeSymbol) {
    try {
      const raw = BigInt(addrInfo.coin_balance);
      if (raw > 0n) {
        const balance = bigIntToDecimal(raw, 18); // todos los nativos EVM usan 18 decimales
        const obj = {
          chain: chainKey,
          symbol: c.nativeSymbol,
          name: c.nativeName || c.nativeSymbol,
          address: "0x0000000000000000000000000000000000000000", // placeholder convencional
          decimals: 18,
          balance, priceUSD: null, valueUSD: null,
          logo: null, native: true,
          // marca interna para resolver precio via DefiLlama coingecko slug:
          _coingeckoSlug: c.nativeCoingecko || null,
        };
        tokens.push(obj);
        if (obj._coingeckoSlug) missingPrice.push(obj);
      }
    } catch (e) { /* parseInt falló → ignorar nativo */ }
  }
  // 2) Tokens ERC-20
  // Nota: Blockscout v2 devuelve la dirección del contrato en `token.address` en
  // unas instancias (eth.blockscout.com, base.blockscout.com…) y en `address_hash`
  // en otras (Hyperscan / hyperevm). Probamos los dos.
  for (const it of items) {
    const t = it.token || {};
    const raw = it.value != null ? BigInt(it.value) : 0n;
    const dec = Number(t.decimals || 0);
    if (raw === 0n) continue;
    const tokenAddr = (t.address || t.address_hash || "").toLowerCase();
    // Saltar shares de Revert Lend (rlBaseUSDC, rlEthUSDC…) — ya se contabilizan
    // como posición lending. Mostrarlos aquí duplica el valor y con precio
    // incorrecto (DexScreener da el precio de share, no el USDC subyacente).
    if (tokenAddr && _revertVaultsLower.has(tokenAddr)) continue;
    const balance = bigIntToDecimal(raw, dec);
    let priceUSD = null;
    if (t.exchange_rate != null && t.exchange_rate !== "") {
      const p = Number(t.exchange_rate);
      if (isFinite(p) && p > 0) priceUSD = p;
    }
    const valueUSD = priceUSD != null ? balance * priceUSD : null;
    const obj = {
      chain: chainKey, symbol: t.symbol || "?", name: t.name || "",
      address: tokenAddr, decimals: dec,
      balance, priceUSD, valueUSD, logo: t.icon_url || null,
    };
    tokens.push(obj);
    if (priceUSD == null && obj.address) missingPrice.push(obj);
  }

  // Fallback de precios via DefiLlama (1 petición batch para todos los faltantes).
  // Acepta tanto `chain:address` (ERC-20) como `coingecko:slug` (nativo).
  if (missingPrice.length) {
    try {
      const coinKeys = missingPrice.map((t) =>
        t._coingeckoSlug ? `coingecko:${t._coingeckoSlug}` : `${c.llamaChain}:${t.address}`
      ).filter(Boolean);
      if (coinKeys.length) {
        const r = await fetch(`https://coins.llama.fi/prices/current/${coinKeys.join(",")}`);
        if (r.ok) {
          const data = await r.json();
          const prices = data.coins || {};
          for (const t of missingPrice) {
            const key = t._coingeckoSlug ? `coingecko:${t._coingeckoSlug}` : `${c.llamaChain}:${t.address}`;
            const p = prices[key]?.price;
            if (typeof p === "number" && p > 0) {
              t.priceUSD = p;
              t.valueUSD = t.balance * p;
            }
          }
        }
      }
    } catch (e) { console.warn("DefiLlama prices:", e); }
  }

  // 2º fallback: DexScreener para los ERC-20 que DefiLlama no indexa todavía
  // (típico de tokens nuevos de HyperEVM como UBTC, UETH, USDT0…). DexScreener
  // tiene precios de cualquier token con pool DEX listado, gratis y sin key.
  // Endpoint batch: /tokens/v1/{chain}/{addr1,addr2,...}
  const stillMissing = tokens.filter((t) =>
    t.priceUSD == null && !t.native && t.address && t.address !== "0x0000000000000000000000000000000000000000"
  );
  if (stillMissing.length && c.dexscreenerChain) {
    try {
      const addrs = stillMissing.map((t) => t.address).join(",");
      const r = await fetch(`https://api.dexscreener.com/tokens/v1/${c.dexscreenerChain}/${addrs}`);
      if (r.ok) {
        const pairs = await r.json();
        // Cada par tiene baseToken.address y priceUsd. Si un token aparece en varios pares,
        // nos quedamos con el de más liquidez USD.
        const bestByAddr = new Map();
        for (const pair of (Array.isArray(pairs) ? pairs : [])) {
          const addr = pair?.baseToken?.address?.toLowerCase();
          const p = Number(pair?.priceUsd);
          const liq = Number(pair?.liquidity?.usd || 0);
          if (!addr || !isFinite(p) || p <= 0) continue;
          const cur = bestByAddr.get(addr);
          if (!cur || liq > cur.liq) bestByAddr.set(addr, { price: p, liq });
        }
        for (const t of stillMissing) {
          const v = bestByAddr.get(t.address.toLowerCase());
          if (v) { t.priceUSD = v.price; t.valueUSD = t.balance * v.price; }
        }
      }
    } catch (e) { console.warn("DexScreener prices:", e); }
  }

  // Limpiar marcas internas antes de devolver
  for (const t of tokens) delete t._coingeckoSlug;
  return tokens.sort((a, b) => (b.valueUSD || 0) - (a.valueUSD || 0));
}

async function fetchRevertLending(owner) {
  const now = Math.floor(Date.now() / 1000);
  const results = await Promise.all(Object.entries(REVERT_LEND).map(async ([chainKey, c]) => {
    try {
      const sharesHex = await rpcCallFallback(c.rpcs, c.vault, "0x70a08231" + encodeAddr32(owner));
      const shares = decU(sharesHex, 0);
      if (shares === 0n) return null;
      const assets = decU(await rpcCallFallback(c.rpcs, c.vault, SEL_CONVERT_TO_ASSETS + shares.toString(16).padStart(64, "0")), 0);
      const assetAddr = decAddr(await rpcCallFallback(c.rpcs, c.vault, SEL_ASSET), 0);
      const dec = Number(decU(await rpcCallFallback(c.rpcs, assetAddr, "0x313ce567"), 0));
      const symbol = decABIString(await rpcCallFallback(c.rpcs, assetAddr, "0x95d89b41")) || "?";
      const priceUSD = /usd/i.test(symbol) ? 1 : 1; // USDC/stable ≈ $1 (mejor esfuerzo)
      const currentValueUSD = (Number(assets) / 10 ** dec) * priceUSD;

      let depositedUSD = null, gainsUSD = null, openedAt = null, ageDays = null, apr = null, timelineSeries = null;
      if (c.explorerApi) {
        try {
          const h = await fetchLendingHistory(c.explorerApi, c.vault, owner, dec);
          const net = h.deposited - h.withdrawn;
          depositedUSD = net * priceUSD;
          gainsUSD = currentValueUSD - depositedUSD;
          openedAt = h.firstTs;
          ageDays = openedAt ? Math.max((now - openedAt) / 86400, 1 / 24) : null;
          apr = (depositedUSD > 0 && ageDays) ? (gainsUSD / depositedUSD) * (365 / ageDays) * 100 : null;
          timelineSeries = buildLendingTimeline(h.events, gainsUSD, now);
        } catch (e) { /* sin histórico: solo valor actual */ }
      }
      return {
        _lending: true, chainKey, chainName: c.name, vault: c.vault, asset: symbol,
        currentValueUSD, depositedUSD, gainsUSD, apr,
        ageDays: ageDays || 0, openedAt: openedAt || now,
        // campos compatibles con aggregate()/orden/portfolio
        feesUSD: gainsUSD || 0, uncollectedUSD: 0, ilUSD: 0,
        pnlUSD: gainsUSD == null ? 0 : gainsUSD,
        hodlUSD: depositedUSD || currentValueUSD,
        closed: false, inRange: true,
        timelineSeries,
      };
    } catch (e) { return null; }
  }));
  return results.filter(Boolean);
}

/**
 * Lee Pool.ticks(int24) y devuelve feeGrowthOutside0/1 X128 como strings.
 * Layout de retorno (8 campos × 32 bytes):
 *   [0] liquidityGross uint128
 *   [1] liquidityNet int128
 *   [2] feeGrowthOutside0X128 uint256  ← lo que queremos
 *   [3] feeGrowthOutside1X128 uint256  ← lo que queremos
 *   [4] tickCumulativeOutside int56
 *   [5] secondsPerLiquidityOutsideX128 uint160
 *   [6] secondsOutside uint32
 *   [7] initialized bool
 */
async function fetchTickOutsideRPC(rpcUrl, poolAddress, tickIdx) {
  const calldata = TICKS_SELECTOR + encodeInt24Padded(tickIdx);
  const hex = await rpcEthCall(rpcUrl, poolAddress, calldata);
  const body = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (body.length < 64 * 4) throw new Error(`respuesta corta de ticks(): ${body.length} chars`);
  const f0 = "0x" + body.slice(64 * 2, 64 * 3);
  const f1 = "0x" + body.slice(64 * 3, 64 * 4);
  return {
    feeGrowthOutside0X128: BigInt(f0).toString(),
    feeGrowthOutside1X128: BigInt(f1).toString(),
  };
}

// Lee feeGrowthGlobal0/1X128 del Pool on-chain. Necesario porque el subgraph va
// retrasado y mezclar global atrasado + ticks outside frescos produce fees
// subestimadas (síntoma: la app marcaba ~30% de lo que reportan Uniswap UI / Revert).
const FEE_GROWTH_GLOBAL0_SELECTOR = "0xf3058399"; // feeGrowthGlobal0X128()
const FEE_GROWTH_GLOBAL1_SELECTOR = "0x46141319"; // feeGrowthGlobal1X128()
async function fetchPoolFeeGrowthGlobalsRPC(rpcUrl, poolAddress) {
  const [hex0, hex1] = await Promise.all([
    rpcEthCall(rpcUrl, poolAddress, FEE_GROWTH_GLOBAL0_SELECTOR),
    rpcEthCall(rpcUrl, poolAddress, FEE_GROWTH_GLOBAL1_SELECTOR),
  ]);
  return {
    feeGrowthGlobal0X128: BigInt(hex0).toString(),
    feeGrowthGlobal1X128: BigInt(hex1).toString(),
  };
}

// Lee positions(tokenId) del NFT manager y devuelve los campos relevantes para
// fees pendientes. Crítico: tokensOwed0/1 acumulan las fees liquidadas pero NO
// cobradas (suceden tras cualquier increase/decrease liquidity). Si no se suman,
// el cálculo de feeGrowthInside_delta * liquidity solo refleja las fees acumuladas
// DESDE la última operación → subestimación. Era la causa de "WBTC sale a 1/3
// de Uniswap UI / Revert" en posiciones que el usuario había modificado.
const NFT_POSITIONS_SELECTOR = "0x99fbab88"; // positions(uint256)
async function fetchNftPositionDataRPC(rpcUrl, nftManager, tokenId) {
  const calldata = NFT_POSITIONS_SELECTOR + BigInt(tokenId).toString(16).padStart(64, "0");
  const hex = await rpcEthCall(rpcUrl, nftManager, calldata);
  // Layout positions(): nonce, operator, token0, token1, fee, tickLower, tickUpper,
  //   liquidity, feeGrowthInside0Last, feeGrowthInside1Last, tokensOwed0, tokensOwed1.
  return {
    liquidity: decU(hex, 7).toString(),
    feeGrowthInside0LastX128: decU(hex, 8).toString(),
    feeGrowthInside1LastX128: decU(hex, 9).toString(),
    tokensOwed0: decU(hex, 10),
    tokensOwed1: decU(hex, 11),
  };
}

/**
 * Para cada posición sin uncollected calculado (chains con tickField scalar),
 * obtenemos los feeGrowthOutside por RPC y recomputamos.
 */
async function backfillUncollectedFromRPC(positions, onProgress) {
  // agrupamos por pool para cachear ticks + feeGrowthGlobal repetidos
  const tickCache = new Map();          // key: chain|pool|tickIdx → outside data
  const poolGlobalsCache = new Map();   // key: chain|pool → { feeGrowthGlobal0X128, feeGrowthGlobal1X128 }
  let done = 0;
  const tasks = positions
    .filter((p) => p.uncollected === null && !p.closed && state.chains[p.chainKey]?.rpcUrl)
    .map(async (p) => {
      const chain = state.chains[p.chainKey];
      const rpc = chain.rpcUrl;
      const getTick = async (tickIdx) => {
        const key = `${p.chainKey}|${p.poolId}|${tickIdx}`;
        if (tickCache.has(key)) return tickCache.get(key);
        const data = await fetchTickOutsideRPC(rpc, p.poolId, tickIdx);
        tickCache.set(key, data);
        return data;
      };
      const getPoolGlobals = async () => {
        const key = `${p.chainKey}|${p.poolId}`;
        if (poolGlobalsCache.has(key)) return poolGlobalsCache.get(key);
        const data = await fetchPoolFeeGrowthGlobalsRPC(rpc, p.poolId);
        poolGlobalsCache.set(key, data);
        return data;
      };
      // Lectura ON-CHAIN completa: ticks outside + pool globals + datos del NFT
      // (incluye tokensOwed que el subgraph NO refleja en collectedFeesToken).
      const nftMgr = chain.uniNftManager;
      try {
        const [lo, up, globals, nftData] = await Promise.all([
          getTick(p.tickLower),
          getTick(p.tickUpper),
          getPoolGlobals(),
          nftMgr ? fetchNftPositionDataRPC(rpc, nftMgr, p.id) : Promise.resolve(null),
        ]);
        // Parcheamos raw con TODOS los valores frescos del RPC. Crítico: refrescar
        // también feeGrowthGlobal del pool y feeGrowthInside_Last del NFT (no solo
        // los ticks). Si dejamos cualquiera del subgraph (atrasado), el cálculo
        // subestima las fees — bug detectado comparando con Uniswap UI y Revert.
        p.raw.tickLower = { tickIdx: String(p.tickLower), ...lo };
        p.raw.tickUpper = { tickIdx: String(p.tickUpper), ...up };
        p.raw.pool = { ...p.raw.pool, ...globals };
        if (nftData) {
          p.raw.liquidity = nftData.liquidity;
          p.raw.feeGrowthInside0LastX128 = nftData.feeGrowthInside0LastX128;
          p.raw.feeGrowthInside1LastX128 = nftData.feeGrowthInside1LastX128;
        }
        const dec0 = Number(p.token0.decimals);
        const dec1 = Number(p.token1.decimals);
        const uc = computeUncollectedFees(p.raw, dec0, dec1);
        if (uc) {
          // Sumar tokensOwed (fees liquidadas tras un increase/decrease previo que
          // aún no se han cobrado). Sin esto se subestiman fees en posiciones que
          // han sido modificadas: el feeGrowthInside_delta solo cuenta lo nuevo.
          if (nftData) {
            uc.amount0 += bigIntToDecimal(nftData.tokensOwed0, dec0);
            uc.amount1 += bigIntToDecimal(nftData.tokensOwed1, dec1);
          }
          p.uncollected = uc;
          p.uncollectedUSD = uc.amount0 * p.token0.priceUSD + uc.amount1 * p.token1.priceUSD;
          p.feesTotalUSD = p.feesUSD + p.uncollectedUSD;
          p.pnlUSD = p.currentValueUSD + p.withdrawnUSD + p.feesUSD + p.uncollectedUSD - p.depositedUSD;
          const aprBase = p.currentValueUSD > 0 ? p.currentValueUSD : p.depositedUSD;
          p.apr = aprBase > 0 ? (p.feesTotalUSD / aprBase) * (365 / p.ageDays) * 100 : 0;
        }
      } catch (e) {
        console.warn(`[${p.chainKey}] RPC backfill ticks falló para ${p.id}:`, e.message || e);
      } finally {
        done++;
        if (onProgress) onProgress(done);
      }
    });
  await Promise.all(tasks);
  return tasks.length;
}

// ============================================================================
// RPC-only mode — chains without a public subgraph (e.g. HyperEVM)
// ============================================================================

const SEL_BALANCE_OF     = "0x70a08231"; // balanceOf(address)
const SEL_TOKEN_BY_INDEX = "0x2f745c59"; // tokenOfOwnerByIndex(address,uint256)
const SEL_POSITIONS_NFT  = "0x99fbab88"; // positions(uint256)
const SEL_SLOT0          = "0x3850c7bd"; // slot0()
const SEL_FEE_GROWTH_0   = "0xf3058399"; // feeGrowthGlobal0X128()
const SEL_FEE_GROWTH_1   = "0x46141319"; // feeGrowthGlobal1X128()
const SEL_TOKEN0_POOL    = "0x0dfe1681"; // token0() en pool
const SEL_TOKEN1_POOL    = "0xd21220a7"; // token1() en pool
const SEL_SYMBOL         = "0x95d89b41"; // symbol()
const SEL_DECIMALS       = "0x313ce567"; // decimals()
const SEL_GET_POOL       = "0x1698ee82"; // getPool(address,address,uint24)

function encodeAddr32(addr) { return addr.toLowerCase().replace("0x", "").padStart(64, "0"); }
function encodeU32(n)       { return BigInt(n).toString(16).padStart(64, "0"); }
function decU(hex, slot)    { const s = hex.startsWith("0x") ? hex.slice(2) : hex; return BigInt("0x" + s.slice(slot*64, slot*64+64)); }
function decI(hex, slot)    { const v = decU(hex, slot); return v >= (1n<<255n) ? Number(v-(1n<<256n)) : Number(v); }
function decAddr(hex, slot) { const s = hex.startsWith("0x") ? hex.slice(2) : hex; return ("0x"+s.slice(slot*64+24, slot*64+64)).toLowerCase(); }

function hexBytesToUtf8(hexStr) {
  const bytes = (hexStr.match(/.{2}/g) || []).map((b) => parseInt(b, 16));
  return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
}

function decABIString(hex) {
  try {
    const s = hex.startsWith("0x") ? hex.slice(2) : hex;
    if (s.length === 64) { // bytes32 encoding (old tokens)
      return hexBytesToUtf8(s.replace(/(00)+$/, "")).replace(/\0/g, "");
    }
    const off = Number(decU(hex, 0)) * 2;
    const len = Number(BigInt("0x" + s.slice(off, off+64)));
    if (!len || len > 100) return "?";
    return hexBytesToUtf8(s.slice(off + 64, off + 64 + len * 2)); // UTF-8 (símbolos como USD₮0)
  } catch { return "?"; }
}

function decodeRawPos(hex, tokenId) {
  // positions() → 12 slots: nonce, operator, token0, token1, fee, tickLower, tickUpper,
  //                           liquidity, feeGrowthInside0Last, feeGrowthInside1Last, tokensOwed0, tokensOwed1
  return {
    tokenId,
    token0:  decAddr(hex, 2),
    token1:  decAddr(hex, 3),
    fee:     Number(decU(hex, 4)),
    tickLower: decI(hex, 5),
    tickUpper: decI(hex, 6),
    liquidity: decU(hex, 7).toString(),
    feeGrowthInside0LastX128: decU(hex, 8).toString(),
    feeGrowthInside1LastX128: decU(hex, 9).toString(),
    tokensOwed0: decU(hex, 10),
    tokensOwed1: decU(hex, 11),
  };
}

/**
 * Precio USD de cada token. Detecta stables por símbolo (cualquier símbolo con "USD"
 * → $1) y precia el resto buscando un pool token/stable contra CUALQUIER stable.
 * `tokenInfos`: { [addr]: { symbol, decimals } }
 */
async function priceTokensViaPool(rpc, factoryAddr, tokenInfos) {
  const prices = {};
  const isStable = (sym) => /usd/i.test(sym || "");
  const addrs = Object.keys(tokenInfos);
  const stables = addrs.filter((a) => isStable(tokenInfos[a].symbol));
  for (const s of stables) prices[s] = 1.0;
  if (!stables.length) return prices;

  await Promise.all(addrs.map(async (addr) => {
    if (prices[addr] != null) return; // ya es stable
    for (const stable of stables) {
      let found = false;
      for (const fee of [3000, 500, 10000, 100]) {
        try {
          const [tA, tB] = addr < stable ? [addr, stable] : [stable, addr];
          const ph = await rpcEthCall(rpc, factoryAddr, SEL_GET_POOL + encodeAddr32(tA) + encodeAddr32(tB) + encodeU32(fee));
          const pool = "0x" + ph.slice(-40);
          if (/^0x0+$/.test(pool)) continue;
          const [s0h, pt0h] = await Promise.all([
            rpcEthCall(rpc, pool, SEL_SLOT0),
            rpcEthCall(rpc, pool, SEL_TOKEN0_POOL),
          ]);
          const sqrtP = decU(s0h, 0);
          if (!sqrtP) continue;
          const pt0 = decAddr(pt0h, 0);
          const decTok = tokenInfos[addr]?.decimals ?? 18;
          const decStb = tokenInfos[stable]?.decimals ?? 6;
          const sq = Number(sqrtP) / 2 ** 96;
          prices[addr] = (pt0 === addr)
            ? sq * sq * 10 ** (decTok - decStb)        // token = token0, stable = token1
            : 1 / (sq * sq * 10 ** (decStb - decTok)); // stable = token0, token = token1
          found = true;
          break;
        } catch {}
      }
      if (found) break;
    }
  }));
  return prices;
}

// Eventos del NonfungiblePositionManager para un tokenId (Uniswap V3)
const EV_INCREASE = "0x3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f";
const EV_DECREASE = "0x26f6a048ee9138f2c0ce266f322cb99228e8d619ae2bff30c67f8dcf9d2377b4";
const EV_COLLECT  = "0x40d0efd1a53d60ecbf40971b9daf7dc90178c3aadc7aab1765632738fa8b8f01";

/**
 * Reconstruye el histórico de una posición leyendo eventos vía API Blockscout
 * (sin límite de bloques). Devuelve amounts decimales y el timestamp de minteo.
 *   deposited = Σ IncreaseLiquidity; withdrawn(principal) = Σ DecreaseLiquidity
 *   collectedFees = Σ Collect − Σ DecreaseLiquidity  (Collect incluye principal + fees)
 */
async function fetchPositionHistory(apiBase, nftMgr, tokenId, dec0, dec1) {
  const cacheKey = `${apiBase}:${tokenId}`;
  const cached = _histCache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < HIST_CACHE_TTL) return cached.data;
  const topic1 = "0x" + BigInt(tokenId).toString(16).padStart(64, "0");
  const word = (data, n) => BigInt("0x" + data.slice(2 + n * 64, 2 + n * 64 + 64));
  const getLogs = async (topic0) => {
    const url = `${apiBase}?module=logs&action=getLogs&fromBlock=0&toBlock=latest&address=${nftMgr}&topic0=${topic0}&topic1=${topic1}&topic0_1_opr=and`;
    const r = await fetch(url);
    const j = await r.json();
    return Array.isArray(j.result) ? j.result : [];
  };
  const [incLogs, decLogs, colLogs] = await Promise.all([getLogs(EV_INCREASE), getLogs(EV_DECREASE), getLogs(EV_COLLECT)]);

  let inc0 = 0n, inc1 = 0n, dec0r = 0n, dec1r = 0n, col0 = 0n, col1 = 0n;
  let mintTs = null;
  const events = []; // {ts, type, a0, a1} para reconstruir la serie temporal
  for (const l of incLogs) {
    inc0 += word(l.data, 1); inc1 += word(l.data, 2);
    const ts = parseInt(l.timeStamp, 16);
    if (mintTs === null || ts < mintTs) mintTs = ts;
    events.push({ ts, type: "inc", a0: word(l.data, 1), a1: word(l.data, 2) });
  }
  for (const l of decLogs) { dec0r += word(l.data, 1); dec1r += word(l.data, 2); events.push({ ts: parseInt(l.timeStamp, 16), type: "dec", a0: word(l.data, 1), a1: word(l.data, 2) }); }
  for (const l of colLogs) { col0 += word(l.data, 1); col1 += word(l.data, 2); events.push({ ts: parseInt(l.timeStamp, 16), type: "col", a0: word(l.data, 1), a1: word(l.data, 2) }); }

  const max0 = (a, b) => (a > b ? a - b : 0n);
  const data = {
    deposited0: bigIntToDecimal(inc0, dec0),
    deposited1: bigIntToDecimal(inc1, dec1),
    withdrawn0: bigIntToDecimal(dec0r, dec0),
    withdrawn1: bigIntToDecimal(dec1r, dec1),
    collectedFees0: bigIntToDecimal(max0(col0, dec0r), dec0),
    collectedFees1: bigIntToDecimal(max0(col1, dec1r), dec1),
    mintTs, events, dec0, dec1,
  };
  _histCache.set(cacheKey, { data, ts: Date.now() });
  return data;
}

// Construye serie diaria [{ts(ms), depositedUSD, withdrawnUSD, feesUSD}] desde eventos del PositionManager
function buildTimelineFromEvents(events, dec0, dec1, p0, p1) {
  if (!events || !events.length) return [];
  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  let dep0 = 0, dep1 = 0, wd0 = 0, wd1 = 0, col0 = 0, col1 = 0;
  const byDay = new Map();
  for (const e of sorted) {
    const a0 = Number(e.a0) / 10 ** dec0, a1 = Number(e.a1) / 10 ** dec1;
    if (e.type === "inc") { dep0 += a0; dep1 += a1; }
    else if (e.type === "dec") { wd0 += a0; wd1 += a1; }
    else if (e.type === "col") { col0 += a0; col1 += a1; }
    const depositedUSD = dep0 * p0 + dep1 * p1;
    const withdrawnUSD = wd0 * p0 + wd1 * p1;
    const feesUSD = Math.max(0, (col0 - wd0)) * p0 + Math.max(0, (col1 - wd1)) * p1; // Collect − principal retirado
    const day = Math.floor((e.ts * 1000) / 86400000) * 86400000;
    byDay.set(day, { depositedUSD, withdrawnUSD, feesUSD });
  }
  return [...byDay.entries()].map(([ts, v]) => ({ ts, ...v })).sort((a, b) => a.ts - b.ts);
}

async function fetchPositionsFromRPCDirect(ownerAddress, chainKey) {
  const chain  = state.chains[chainKey];
  const rpc    = chain.rpcUrls || [chain.rpcUrl]; // lista para rotar entre endpoints
  const nftMgr = chain.nftManagerAddress;
  const factory = chain.factoryAddress;

  // 1. ¿Cuántas posiciones tiene la wallet?
  const balHex = await rpcEthCall(rpc, nftMgr, SEL_BALANCE_OF + encodeAddr32(ownerAddress));
  const balance = Number(decU(balHex, 0));
  if (!balance) return [];

  // 2. IDs de cada posición NFT
  const tokenIds = (await Promise.all(
    Array.from({length: balance}, (_, i) =>
      rpcEthCall(rpc, nftMgr, SEL_TOKEN_BY_INDEX + encodeAddr32(ownerAddress) + encodeU32(i))
        .then(h => decU(h, 0)).catch(() => null)
    )
  )).filter(Boolean);

  // 3. Datos de cada posición
  const rawPositions = (await Promise.all(
    tokenIds.map(id =>
      rpcEthCall(rpc, nftMgr, SEL_POSITIONS_NFT + encodeU32(id))
        .then(hex => decodeRawPos(hex, id)).catch(() => null)
    )
  )).filter(Boolean);

  if (!rawPositions.length) return [];

  // 4. Dirección del pool para cada combinación token0/token1/fee
  const poolKeyMap = {};
  await Promise.all([...new Set(rawPositions.map(p => `${p.token0}-${p.token1}-${p.fee}`))].map(async key => {
    const [t0, t1, fee] = key.split("-");
    const h = await rpcEthCall(rpc, factory, SEL_GET_POOL + encodeAddr32(t0) + encodeAddr32(t1) + encodeU32(fee)).catch(() => null);
    if (h) poolKeyMap[key] = ("0x" + h.slice(-40)).toLowerCase();
  }));

  // 5. Estado de cada pool (tick actual + feeGrowthGlobal para backfill)
  const poolStates = {};
  await Promise.all([...new Set(Object.values(poolKeyMap))].map(async pool => {
    if (/^0x0+$/.test(pool)) return;
    try {
      const [s0, fg0, fg1] = await Promise.all([
        rpcEthCall(rpc, pool, SEL_SLOT0),
        rpcEthCall(rpc, pool, SEL_FEE_GROWTH_0),
        rpcEthCall(rpc, pool, SEL_FEE_GROWTH_1),
      ]);
      poolStates[pool] = {
        tick: decI(s0, 1),
        sqrtPriceX96: decU(s0, 0).toString(),
        feeGrowthGlobal0X128: decU(fg0, 0).toString(),
        feeGrowthGlobal1X128: decU(fg1, 0).toString(),
      };
    } catch {}
  }));

  // 6. Info de tokens (símbolo + decimales)
  const uniqueTokens = [...new Set(rawPositions.flatMap(p => [p.token0, p.token1]))];
  const tokenInfos = {};
  await Promise.all(uniqueTokens.map(async addr => {
    try {
      const [sh, dh] = await Promise.all([rpcEthCall(rpc, addr, SEL_SYMBOL), rpcEthCall(rpc, addr, SEL_DECIMALS)]);
      tokenInfos[addr] = { id: addr, symbol: decABIString(sh), decimals: Number(decU(dh, 0)) };
    } catch { tokenInfos[addr] = { id: addr, symbol: addr.slice(0,6), decimals: 18 }; }
  }));

  // 7. Precios USD vía pools contra stables (detectados por símbolo)
  const prices = await priceTokensViaPool(rpc, factory, tokenInfos).catch(() => ({}));

  // 7.5 Histórico (depósitos/retiros/fees cobradas + fecha de minteo) vía Blockscout
  const histories = {};
  if (chain.explorerApi) {
    await Promise.all(rawPositions.map(async (raw) => {
      const d0 = tokenInfos[raw.token0]?.decimals ?? 18;
      const d1 = tokenInfos[raw.token1]?.decimals ?? 18;
      try { histories[raw.tokenId] = await fetchPositionHistory(chain.explorerApi, nftMgr, raw.tokenId, d0, d1); }
      catch (e) { /* sin histórico para esta posición */ }
    }));
  }

  // 8. Construir posiciones enriquecidas
  const now = Math.floor(Date.now() / 1000);
  const result = [];
  for (const raw of rawPositions) {
    const key = `${raw.token0}-${raw.token1}-${raw.fee}`;
    const poolAddr = poolKeyMap[key];
    if (!poolAddr || /^0x0+$/.test(poolAddr)) continue;
    const pool = poolStates[poolAddr];
    if (!pool) continue;

    const t0 = tokenInfos[raw.token0] || { id: raw.token0, symbol: "?", decimals: 18 };
    const t1 = tokenInfos[raw.token1] || { id: raw.token1, symbol: "?", decimals: 18 };
    const p0 = prices[raw.token0] || 0;
    const p1 = prices[raw.token1] || 0;
    const closed = raw.liquidity === "0";

    const cur = getAmountsFromLiquidity(raw.liquidity, pool.tick, raw.tickLower, raw.tickUpper, t0.decimals, t1.decimals);
    const currentValueUSD = cur.amount0 * p0 + cur.amount1 * p1;

    // tokensOwed = fees settled pero no cobradas (el backfill RPC añadirá las no settled)
    const owed0 = bigIntToDecimal(raw.tokensOwed0, t0.decimals);
    const owed1 = bigIntToDecimal(raw.tokensOwed1, t1.decimals);

    // Histórico (si lo hay): depósitos, retiros, fees cobradas y fecha real de minteo
    const hist = histories[raw.tokenId];
    let depositedUSD, withdrawnUSD, feesCollectedUSD, openedAt, ageDays, hodlUSD, ilUSD, ilPct, pnlUSD, apr;
    if (hist && hist.mintTs) {
      depositedUSD = hist.deposited0 * p0 + hist.deposited1 * p1;
      withdrawnUSD = hist.withdrawn0 * p0 + hist.withdrawn1 * p1;
      feesCollectedUSD = hist.collectedFees0 * p0 + hist.collectedFees1 * p1;
      openedAt = hist.mintTs;
      ageDays = Math.max((now - openedAt) / 86400, 1 / 24);
      hodlUSD = depositedUSD; // valor actual de los tokens depositados (precios actuales)
      ilUSD = (currentValueUSD + withdrawnUSD) - hodlUSD;
      ilPct = hodlUSD > 0 ? (ilUSD / hodlUSD) * 100 : 0;
      pnlUSD = currentValueUSD + withdrawnUSD + feesCollectedUSD - depositedUSD; // vs HODL
      apr = depositedUSD > 0 ? (feesCollectedUSD / depositedUSD) * (365 / ageDays) * 100 : 0;
    } else {
      depositedUSD = currentValueUSD; withdrawnUSD = 0; feesCollectedUSD = 0;
      openedAt = now - 86400; ageDays = 1; hodlUSD = currentValueUSD;
      ilUSD = null; ilPct = 0; pnlUSD = null; apr = 0;
    }

    // raw compatible con backfillUncollectedFromRPC + computeUncollectedFees
    const fakeRaw = {
      id: raw.tokenId.toString(),
      liquidity: raw.liquidity,
      tickLower: raw.tickLower,
      tickUpper: raw.tickUpper,
      feeGrowthInside0LastX128: raw.feeGrowthInside0LastX128,
      feeGrowthInside1LastX128: raw.feeGrowthInside1LastX128,
      depositedToken0: hist ? String(hist.deposited0) : "0", depositedToken1: hist ? String(hist.deposited1) : "0",
      withdrawnToken0: hist ? String(hist.withdrawn0) : "0", withdrawnToken1: hist ? String(hist.withdrawn1) : "0",
      collectedFeesToken0: hist ? String(hist.collectedFees0) : "0", collectedFeesToken1: hist ? String(hist.collectedFees1) : "0",
      transaction: { timestamp: String(openedAt) },
      pool: {
        id: poolAddr, feeTier: String(raw.fee),
        tick: String(pool.tick), sqrtPrice: pool.sqrtPriceX96,
        token0Price: "0", token1Price: "0", totalValueLockedUSD: "0",
        feeGrowthGlobal0X128: pool.feeGrowthGlobal0X128,
        feeGrowthGlobal1X128: pool.feeGrowthGlobal1X128,
        token0: { id: t0.id, symbol: t0.symbol, name: t0.symbol, decimals: String(t0.decimals), derivedETH: "0" },
        token1: { id: t1.id, symbol: t1.symbol, name: t1.symbol, decimals: String(t1.decimals), derivedETH: "0" },
      },
    };

    result.push({
      id: raw.tokenId.toString(),
      chainKey,
      nftId: raw.tokenId.toString(),
      poolId: poolAddr,
      feeTier: raw.fee,
      token0: { ...t0, priceUSD: p0 },
      token1: { ...t1, priceUSD: p1 },
      tick: pool.tick, tickLower: raw.tickLower, tickUpper: raw.tickUpper,
      inRange: inRange(pool.tick, raw.tickLower, raw.tickUpper),
      closed,
      liquidity: raw.liquidity,
      amounts: cur,
      currentValueUSD,
      depositedUSD,
      withdrawnUSD,
      feesUSD: feesCollectedUSD,      // fees cobradas reconstruidas del histórico
      uncollected: null,             // backfillUncollectedFromRPC lo calculará
      uncollectedUSD: null,
      feesTotalUSD: feesCollectedUSD + owed0 * p0 + owed1 * p1,
      hodlUSD,
      pnlUSD,
      ilUSD,
      ilPct,
      apr,
      ageDays,
      openedAt,
      raw: fakeRaw,
      _rpcOnly: true, // marca para el UI
      // serie temporal (depósitos + fees) reconstruida de eventos para el histórico
      timelineSeries: hist && hist.events ? buildTimelineFromEvents(hist.events, t0.decimals, t1.decimals, p0, p1) : null,
    });
  }
  return result;
}

// ============================================================================
// Position enrichment (computes metrics from raw subgraph data)
// ============================================================================

function enrichPosition(raw, ethPriceUSD, chainKey) {
  const pool = raw.pool;
  const t0 = pool.token0;
  const t1 = pool.token1;
  const dec0 = Number(t0.decimals);
  const dec1 = Number(t1.decimals);

  const tick = Number(pool.tick);
  // tickLower/tickUpper pueden venir como objeto { tickIdx } o como escalar
  const tickLower = Number(typeof raw.tickLower === "object" ? raw.tickLower.tickIdx : raw.tickLower);
  const tickUpper = Number(typeof raw.tickUpper === "object" ? raw.tickUpper.tickIdx : raw.tickUpper);

  const liquidity = raw.liquidity;
  const liqIsClosed = liquidity === "0" || liquidity === 0;

  // USD prices for each token (subgraph uses derivedETH + bundle.ethPriceUSD)
  const price0USD = Number(t0.derivedETH) * ethPriceUSD;
  const price1USD = Number(t1.derivedETH) * ethPriceUSD;

  // Current position composition
  const cur = getAmountsFromLiquidity(liquidity, tick, tickLower, tickUpper, dec0, dec1);
  const currentValueUSD = cur.amount0 * price0USD + cur.amount1 * price1USD;

  // Deposits / withdrawals / fees from subgraph (already decimal-adjusted)
  const deposited0 = Number(raw.depositedToken0);
  const deposited1 = Number(raw.depositedToken1);
  const withdrawn0 = Number(raw.withdrawnToken0);
  const withdrawn1 = Number(raw.withdrawnToken1);
  const fees0 = Number(raw.collectedFeesToken0);
  const fees1 = Number(raw.collectedFeesToken1);

  const depositedUSD = deposited0 * price0USD + deposited1 * price1USD;
  const withdrawnUSD = withdrawn0 * price0USD + withdrawn1 * price1USD;
  const feesUSD = fees0 * price0USD + fees1 * price1USD;

  // Fees no cobradas (claimable). Solo computable si el subgraph expone Tick.feeGrowthOutside*
  const uncollected = computeUncollectedFees(raw, dec0, dec1);
  const uncollectedUSD = uncollected ? uncollected.amount0 * price0USD + uncollected.amount1 * price1USD : null;
  const feesTotalUSD = feesUSD + (uncollectedUSD || 0);

  // HODL: si hubiéramos mantenido los tokens depositados al precio actual
  const hodlUSD = depositedUSD;

  // PnL neto (sin gas): valor actual + lo retirado + fees cobradas + fees pendientes − depositado
  const pnlUSD = currentValueUSD + withdrawnUSD + feesUSD + (uncollectedUSD || 0) - depositedUSD;

  // IL: comparación con HODL (no incluye fees, mide solo la pérdida del mecanismo LP)
  // Valor LP "puro" hoy = currentValue + withdrawn (sin fees)
  const lpValueNoFees = currentValueUSD + withdrawnUSD;
  const ilUSD = lpValueNoFees - hodlUSD;
  const ilPct = hodlUSD > 0 ? (ilUSD / hodlUSD) * 100 : 0;

  // APR estimado: (fees totales incluyendo pendientes) anualizadas / valor promedio
  const ageSec = Date.now() / 1000 - Number(raw.transaction.timestamp);
  const ageDays = Math.max(ageSec / 86400, 1 / 24);
  const aprBase = currentValueUSD > 0 ? currentValueUSD : depositedUSD;
  const apr = aprBase > 0 ? (feesTotalUSD / aprBase) * (365 / ageDays) * 100 : 0;

  return {
    id: raw.id,
    chainKey,
    nftId: raw.id, // el id del subgraph V3 == tokenId del NFT
    poolId: pool.id,
    feeTier: Number(pool.feeTier),
    token0: { ...t0, priceUSD: price0USD },
    token1: { ...t1, priceUSD: price1USD },
    tick, tickLower, tickUpper,
    inRange: inRange(tick, tickLower, tickUpper),
    closed: liqIsClosed,
    liquidity,
    amounts: cur,
    currentValueUSD,
    depositedUSD,
    withdrawnUSD,
    feesUSD,
    uncollected,           // { amount0, amount1 } | null
    uncollectedUSD,        // number | null
    feesTotalUSD,          // cobradas + pendientes
    hodlUSD,
    pnlUSD,
    ilUSD,
    ilPct,
    apr,
    ageDays,
    openedAt: Number(raw.transaction.timestamp),
    raw,
  };
}

// ============================================================================
// Fetch orchestration
// ============================================================================

async function fetchAllPositions(address) {
  const tasks = state.selectedChains.map(async (chainKey) => {
    const chain = state.chains[chainKey];
    // Modo RPC-directo para redes sin subgraph público (ej. HyperEVM)
    if (chain.nftManagerAddress) {
      if (!chain.rpcUrl) return { __skipped: true, chainKey, reason: "sin RPC configurado" };
      try {
        return await fetchPositionsFromRPCDirect(address, chainKey);
      } catch (e) {
        console.error(`[${chainKey}]`, e);
        return { __error: e.message, chainKey };
      }
    }
    if (!chain.subgraphId) {
      return { __skipped: true, chainKey, reason: "sin subgraph configurado" };
    }
    try {
      const variant = chain.schemaVariant || "eth";
      const tickField = chain.tickField || "object";
      const data = await gql(chainKey, buildPositionsQuery(variant, tickField), { owner: address.toLowerCase() });
      const ethPriceUSD = Number(data.bundles?.[0]?.ethPriceUSD || 0);
      return data.positions.map((p) => enrichPosition(p, ethPriceUSD, chainKey));
    } catch (e) {
      console.error(`[${chainKey}]`, e);
      return { __error: e.message, chainKey };
    }
  });
  const results = await Promise.all(tasks);
  const positions = [];
  const errors = [];
  const skipped = [];
  for (const r of results) {
    if (Array.isArray(r)) positions.push(...r);
    else if (r && r.__error) errors.push(r);
    else if (r && r.__skipped) skipped.push(r);
  }
  return { positions, errors, skipped };
}

async function fetchSnapshotsForChart(positions) {
  // top 5 posiciones por valor actual para no saturar
  const top = [...positions].sort((a, b) => b.currentValueUSD - a.currentValueUSD).slice(0, 5);
  const tasks = top.map(async (p) => {
    try {
      const data = await gql(p.chainKey, SNAPSHOTS_QUERY, { positionId: p.id });
      return { position: p, snapshots: data.positionSnapshots };
    } catch (e) {
      console.warn("snapshots failed", p.id, e);
      return { position: p, snapshots: [] };
    }
  });
  return Promise.all(tasks);
}

// Precio USD histórico de tokens por día vía The Graph (tokenDayDatas). Cacheado.
const _dayPriceCache = new Map(); // `${chain}:${token}:${date}` -> priceUSD | null
async function fetchTokenDayPrices(chainKey, tokenIds, dates) {
  const out = {};
  // Si ya sabemos que este subgraph no expone `tokenDayDatas` (p. ej. el de Uniswap
  // V3 en Arbitrum), no intentamos otra vez en esta sesión → consola limpia.
  const chain = state.chains[chainKey];
  if (chain && chain._noTokenDayDatas) return out;
  const toks = tokenIds.filter(Boolean).map((t) => t.toLowerCase());
  const missTok = new Set(), missDate = new Set();
  for (const tok of toks) for (const d of dates) {
    const k = `${chainKey}:${tok}:${d}`;
    if (_dayPriceCache.has(k)) { const v = _dayPriceCache.get(k); if (v != null) out[`${tok}:${d}`] = v; }
    else { missTok.add(tok); missDate.add(d); }
  }
  if (missTok.size && missDate.size) {
    const q = `query($t:[String!]!,$d:[Int!]!){ tokenDayDatas(first:1000, where:{ token_in:$t, date_in:$d }){ date token{id} priceUSD } }`;
    let data;
    try {
      data = await gql(chainKey, q, { t: [...missTok], d: [...missDate] });
    } catch (e) {
      // El subgraph de esta chain no tiene el tipo `tokenDayDatas` → marcar para no
      // volver a intentarlo. PnL/IL caerá en valores actuales en lugar de históricos.
      if (chain && /has no field|tokenDayDatas/i.test(String(e?.message))) {
        chain._noTokenDayDatas = true;
        return out;
      }
      throw e; // otros errores (auth, rate-limit, red) sí los propagamos
    }
    for (const r of (data.tokenDayDatas || [])) {
      const tok = (r.token.id || "").toLowerCase(), d = Number(r.date), v = Number(r.priceUSD);
      _dayPriceCache.set(`${chainKey}:${tok}:${d}`, isFinite(v) ? v : null);
      if (isFinite(v)) out[`${tok}:${d}`] = v;
    }
    for (const tok of missTok) for (const d of missDate) { const k = `${chainKey}:${tok}:${d}`; if (!_dayPriceCache.has(k)) _dayPriceCache.set(k, null); }
  }
  return out;
}

/**
 * Serie temporal por posición con precios HISTÓRICOS (precio de cada token en la
 * fecha de cada movimiento, vía tokenDayDatas). Reconstruye el coste base real por
 * deltas entre snapshots y fija depositedUSD/withdrawnUSD/pnlUSD en la posición.
 * Si no hay precio histórico de algún token/fecha, cae al precio actual (sin regresión).
 */
async function buildPortfolioTimeline(bundles) {
  const result = [];
  for (const b of bundles) {
    const p = b.position;
    const snaps = b.snapshots;
    if (!snaps || !snaps.length) continue;
    const sorted = [...snaps].sort((a, c) => Number(a.timestamp) - Number(c.timestamp));
    const dates = [...new Set(sorted.map((s) => Math.floor(Number(s.timestamp) / 86400) * 86400))];
    let prices = {};
    try { prices = await fetchTokenDayPrices(p.chainKey, [p.token0.id, p.token1.id], dates); } catch (e) { console.warn("tokenDayDatas", p.chainKey, e); }
    const t0 = (p.token0.id || "").toLowerCase(), t1 = (p.token1.id || "").toLowerCase();
    const priceAt = (tok, ts) => { const v = prices[`${tok}:${Math.floor(Number(ts) / 86400) * 86400}`]; return (v != null && isFinite(v)) ? v : null; };
    let pD0 = 0, pD1 = 0, pW0 = 0, pW1 = 0, pC0 = 0, pC1 = 0;
    let costBasis = 0, withdrawn = 0, fees = 0, anyHist = false, anyCur = false;
    const byDay = new Map();
    for (const s of sorted) {
      const ts = Number(s.timestamp);
      const h0 = priceAt(t0, ts), h1 = priceAt(t1, ts);
      const pr0 = h0 != null ? h0 : (p.token0.priceUSD || 0);
      const pr1 = h1 != null ? h1 : (p.token1.priceUSD || 0);
      if (h0 != null || h1 != null) anyHist = true; if (h0 == null || h1 == null) anyCur = true;
      const d0 = Number(s.depositedToken0), d1 = Number(s.depositedToken1);
      const w0 = Number(s.withdrawnToken0 || 0), w1 = Number(s.withdrawnToken1 || 0);
      const c0 = Number(s.collectedFeesToken0), c1 = Number(s.collectedFeesToken1);
      costBasis += Math.max(0, d0 - pD0) * pr0 + Math.max(0, d1 - pD1) * pr1;
      withdrawn += Math.max(0, w0 - pW0) * pr0 + Math.max(0, w1 - pW1) * pr1;
      fees      += Math.max(0, c0 - pC0) * pr0 + Math.max(0, c1 - pC1) * pr1;
      pD0 = d0; pD1 = d1; pW0 = w0; pW1 = w1; pC0 = c0; pC1 = c1;
      const day = Math.floor(ts * 1000 / 86400000) * 86400000;
      byDay.set(day, { depositedUSD: Math.max(0, costBasis - withdrawn), withdrawnUSD: withdrawn, feesUSD: fees });
    }
    if (costBasis > 0) { // fijar coste base/PnL históricos en la posición
      p.depositedUSD = costBasis;
      p.withdrawnUSD = withdrawn;
      p.pnlUSD = (p.currentValueUSD || 0) + withdrawn + fees + (p.uncollectedUSD || 0) - costBasis;
      p.histBasis = anyHist && !anyCur; // true solo si TODO se valoró con histórico
    }
    const points = [...byDay.entries()].map(([ts, v]) => ({ ts, ...v })).sort((a, c) => a.ts - c.ts);
    if (points.length) result.push({ posId: p.id, label: `${p.token0.symbol}/${p.token1.symbol}`, points });
  }
  return result;
}

// ============================================================================
// Formatting helpers
// ============================================================================

// fmtUSD, fmtUSDc y fmtPct viven en common.js (compartidos con sol/app.js).

// Traduce un error técnico a una causa legible para el usuario.
function classifyError(msg) {
  const m = String(msg || "");
  if (/\b401\b|Inicia sesión|Sesión inválida|autenticaci/i.test(m)) return { cat: "auth", text: "requiere iniciar sesión o tu propia API key" };
  if (/\b403\b|no está autorizada|no autorizado/i.test(m)) return { cat: "forbidden", text: "tu cuenta no está autorizada" };
  if (/\b429\b|Demasiadas|rate.?limit|Límite/i.test(m)) return { cat: "rate", text: "límite de peticiones alcanzado, reintenta en un momento" };
  if (/Falta API key|proxy/i.test(m)) return { cat: "config", text: "falta API key o proxy configurado" };
  if (/Failed to fetch|NetworkError|timeout|ECONN|502|503|504/i.test(m)) return { cat: "network", text: "error de red o servicio no disponible" };
  return { cat: "other", text: m.slice(0, 80) };
}

// fmtToken vive en common.js (compartido con sol/app.js).

function feeTierLabel(bps) {
  return `${(bps / 10000).toFixed(2)}%`;
}

function shortAddr(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// pnlColor vive en common.js (compartido con sol/app.js).

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
  document.getElementById("cfg-api-key").value = state.apiKey;
  const container = document.getElementById("chain-config");
  container.innerHTML = "";
  for (const key of Object.keys(state.chains)) {
    const c = state.chains[key];
    const row = document.createElement("div");
    row.className = "space-y-1";
    const isRpcOnly = !!c.nftManagerAddress;

    if (isRpcOnly) {
      // Modo RPC-directo: mostramos RPC URL (no subgraph)
      row.innerHTML = `
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full shrink-0" style="background:${c.color}"></div>
          <div class="w-20 text-xs text-slate-300 shrink-0">${c.name}</div>
          <span class="flex-1 text-[11px] text-slate-400 font-mono truncate">${c.rpcUrl || "sin RPC"}</span>
          <span class="chip border border-emerald-600/40 bg-emerald-600/10 text-emerald-300 shrink-0">RPC-only</span>
        </div>
        <div class="pl-5 text-[10px] text-slate-500">No requiere API key. Usa el contrato NonfungiblePositionManager directamente.</div>
      `;
      container.appendChild(row);
      continue;
    }

    const explorerUrl = `https://thegraph.com/explorer?search=uniswap+v3+${encodeURIComponent(c.name.toLowerCase().replace(" chain", ""))}`;
    const initialStatus = !c.subgraphId ? "⚠ no configurado" : "—";
    const initialStatusClass = !c.subgraphId ? "text-[10px] text-amber-400" : "text-[10px] text-slate-500";
    const placeholderText = c.subgraphId?.startsWith("http") ? "URL directa del subgraph" : "subgraph ID (The Graph)";
    row.innerHTML = `
      <div class="flex items-center gap-2">
        <div class="w-3 h-3 rounded-full shrink-0" style="background:${c.color}"></div>
        <div class="w-20 text-xs text-slate-300 shrink-0">${c.name}</div>
        <input data-chain="${key}" placeholder="${placeholderText}" class="cfg-subgraph flex-1 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs font-mono" value="${c.subgraphId}" />
        <button type="button" data-test="${key}" class="cfg-test text-[11px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 shrink-0">Probar</button>
      </div>
      <div class="flex items-center justify-between pl-5">
        <span data-status="${key}" class="${initialStatusClass}">${initialStatus}</span>
        <a href="${explorerUrl}" target="_blank" class="text-[10px] text-fuchsia-400 hover:underline">buscar en explorer ↗</a>
      </div>
    `;
    container.appendChild(row);
  }
  document.querySelectorAll(".cfg-test").forEach((btn) => {
    btn.onclick = () => testChain(btn.dataset.test);
  });
}

function buildTestQuery(variant) {
  const ethUsd = variant === "native" ? "ethPriceUSD: nativePriceUSD" : "ethPriceUSD";
  return `
    query Test {
      factories(first: 1) { id }
      bundles(first: 1) { ${ethUsd} }
      positions(first: 1) { id }
    }
  `;
}

async function testChain(chainKey) {
  const statusEl = document.querySelector(`[data-status="${chainKey}"]`);
  const inputEl = document.querySelector(`[data-chain="${chainKey}"]`);
  if (!statusEl || !inputEl) return;

  // use the value currently in the input (may not be saved yet)
  const previousId = state.chains[chainKey].subgraphId;
  state.chains[chainKey].subgraphId = inputEl.value.trim();

  statusEl.textContent = "probando…";
  statusEl.className = "text-[10px] text-slate-400";

  const isDirectUrl = state.chains[chainKey].subgraphId?.startsWith("http");
  if (!isDirectUrl) {
    if (!state.apiKey) state.apiKey = document.getElementById("cfg-api-key").value.trim();
    if (!state.apiKey) {
      statusEl.textContent = "✗ falta API key arriba";
      statusEl.className = "text-[10px] text-rose-400";
      state.chains[chainKey].subgraphId = previousId;
      return;
    }
  }

  try {
    const variant = state.chains[chainKey].schemaVariant || "eth";
    const data = await gql(chainKey, buildTestQuery(variant), {});
    const hasFactory = Array.isArray(data.factories) && data.factories.length >= 0;
    const hasBundle = Array.isArray(data.bundles);
    const hasPositions = Array.isArray(data.positions);
    if (hasFactory && hasBundle && hasPositions) {
      statusEl.textContent = "✓ schema compatible";
      statusEl.className = "text-[10px] text-emerald-400";
    } else {
      statusEl.textContent = "✗ schema parcial — puede dar errores";
      statusEl.className = "text-[10px] text-amber-400";
    }
  } catch (e) {
    const msg = (e.message || "").replace(`${state.chains[chainKey].name}: `, "");
    statusEl.textContent = `✗ ${msg.slice(0, 90)}`;
    statusEl.className = "text-[10px] text-rose-400";
  } finally {
    state.chains[chainKey].subgraphId = previousId;
  }
}

function saveSettings() {
  state.apiKey = document.getElementById("cfg-api-key").value.trim();
  localStorage.setItem("lp:apiKey", state.apiKey);
  document.querySelectorAll(".cfg-subgraph").forEach((inp) => {
    const key = inp.dataset.chain;
    state.chains[key].subgraphId = inp.value.trim();
  });
  const persisted = {};
  for (const k of Object.keys(state.chains)) {
    persisted[k] = { subgraphId: state.chains[k].subgraphId };
  }
  localStorage.setItem("lp:chains", JSON.stringify(persisted));
  closeSettings();
  setStatus("Settings guardadas.", "ok");
}

function resetConfig() {
  state.chains = structuredClone(DEFAULT_CHAINS);
  localStorage.removeItem("lp:chains");
  renderSettings();
}

// ============================================================================
// Chain chip UI
// ============================================================================

function renderChainChips() {
  const container = document.getElementById("chain-chips");
  container.innerHTML = "";
  for (const key of Object.keys(state.chains)) {
    const c = state.chains[key];
    const active = state.selectedChains.includes(key);
    const isRpcOnly = !!c.nftManagerAddress;
    const unconfigured = !c.subgraphId && !isRpcOnly;
    const btn = document.createElement("button");
    btn.title = unconfigured ? "Sin subgraph configurado — abre Settings para añadir uno" : c.name;
    btn.className = `chip border ${active ? "border-[#ECE600] bg-[#ECE600]/15 text-yellow-200" : "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"}`;
    btn.innerHTML = `<span class="w-2 h-2 rounded-full" style="background:${c.color}"></span>${c.name}${unconfigured ? ' <span class="text-amber-400">⚠</span>' : ""}`;
    btn.onclick = () => {
      if (active) state.selectedChains = state.selectedChains.filter((k) => k !== key);
      else state.selectedChains.push(key);
      localStorage.setItem("lp:selectedChains", JSON.stringify(state.selectedChains));
      renderChainChips();
    };
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
// Render: summary + positions + charts
// ============================================================================

function renderAll() {
  renderSummary();
  renderPositions();
  renderCharts();
}

function aggregate(positions) {
  return positions.reduce(
    (acc, p) => {
      acc.current += p.currentValueUSD || 0;
      acc.fees += p.feesUSD || 0;
      if (p.uncollectedUSD === null) acc.uncollectedUnknown++;
      else acc.uncollected += p.uncollectedUSD || 0;
      acc.il += p.ilUSD || 0;
      acc.pnl += p.pnlUSD || 0;
      acc.hodl += p.hodlUSD || 0;
      acc.deposited += p.depositedUSD || 0;
      if (p.closed) acc.closed++;
      else acc.open++;
      return acc;
    },
    { current: 0, fees: 0, uncollected: 0, uncollectedUnknown: 0, il: 0, pnl: 0, hodl: 0, deposited: 0, open: 0, closed: 0 }
  );
}

function renderSummary() {
  const section = document.getElementById("summary-section");
  if (!state.positions.length) { section.classList.add("hidden"); return; }
  section.classList.remove("hidden");
  const agg = aggregate(state.positions);
  document.getElementById("sum-positions").textContent = state.positions.length;
  document.getElementById("sum-positions-sub").textContent = state.hideClosed
    ? `${agg.open} abiertas`
    : `${agg.open} abiertas · ${agg.closed} cerradas`;
  document.getElementById("sum-current").textContent = fmtUSD(agg.current);
  const pendingSuffix = agg.uncollectedUnknown ? ` (n/d en ${agg.uncollectedUnknown})` : "";
  document.getElementById("sum-fees").textContent = `${fmtUSD(agg.fees)} +${fmtUSD(agg.uncollected)} pend${pendingSuffix}`;
  const ilEl = document.getElementById("sum-il");
  ilEl.textContent = `${fmtUSD(agg.il)} (${fmtPct(agg.hodl > 0 ? (agg.il / agg.hodl) * 100 : 0)})`;
  ilEl.className = `text-xl font-bold mt-1 ${pnlColor(agg.il)}`;
  const pnlEl = document.getElementById("sum-pnl");
  pnlEl.textContent = `${fmtUSD(agg.pnl)} (${fmtPct(agg.deposited > 0 ? (agg.pnl / agg.deposited) * 100 : 0)})`;
  pnlEl.className = `text-xl font-bold mt-1 ${pnlColor(agg.pnl)}`;
}

function renderPositions() {
  const section = document.getElementById("positions-section");
  const empty = document.getElementById("empty-state");
  if (!state.positions.length) { section.classList.add("hidden"); return; }
  empty.classList.add("hidden");
  section.classList.remove("hidden");

  const sortKey = state.sortBy;
  const sorters = {
    value: (a, b) => b.currentValueUSD - a.currentValueUSD,
    fees: (a, b) => b.feesUSD - a.feesUSD,
    pnl: (a, b) => b.pnlUSD - a.pnlUSD,
    apr: (a, b) => b.apr - a.apr,
    age: (a, b) => a.openedAt - b.openedAt,
  };
  let list = [...state.positions].sort(sorters[sortKey] || sorters.value);
  if (state.hideClosed) list = list.filter((p) => !p.closed);

  const container = document.getElementById("positions-list");
  container.innerHTML = "";
  for (const p of list) container.appendChild(positionCard(p));
}

function lendingCard(p) {
  const chain = state.chains[p.chainKey] || { name: p.chainName, explorer: "" };
  const el = document.createElement("article");
  el.className = "rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3 hover:border-slate-700 transition";
  if (p.color) el.style.borderLeft = `3px solid ${p.color.line}`;
  const gain = p.gainsUSD;
  el.innerHTML = `
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full" style="background:${p.color ? p.color.line : "#34d399"}"></span>
          <span class="text-[11px] uppercase tracking-wide text-slate-400">Revert Lend · ${p.chainName}</span>
        </div>
        <div class="font-semibold mt-0.5 truncate">${p.asset} (lending)</div>
        <div class="text-[11px] text-slate-400">${p.ageDays ? "abierto hace " + Math.round(p.ageDays) + "d" : ""}</div>
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
        <div class="font-semibold ${pnlColor(gain)}">${gain == null ? "—" : fmtUSD(gain)}</div>
        <div class="text-[10px] text-slate-400 mt-0.5">APR ~ ${p.apr == null ? "—" : p.apr.toFixed(1) + "%"}</div>
      </div>
    </div>
    <details class="text-xs">
      <summary class="text-slate-400 hover:text-slate-200">▾ detalles</summary>
      <div class="mt-2 space-y-1 text-slate-400">
        <div>Vault: <a href="${chain.explorer}/address/${p.vault}" target="_blank" class="font-mono text-slate-300 hover:text-fuchsia-300">${shortAddr(p.vault)}</a></div>
        <div>Activo: ${p.asset}</div>
      </div>
    </details>`;
  return el;
}

// Barra gráfica de rango: precio min/max + marcador del precio actual.
// price(tick) = 1.0001^tick * 10^(dec0-dec1)  (token1 por token0)
// rangeBarHTML vive en common.js (compartido con sol/app.js).

function positionCard(p) {
  if (p._lending) return lendingCard(p);
  const chain = state.chains[p.chainKey];
  const el = document.createElement("article");
  el.className = "rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3 hover:border-slate-700 transition";
  if (p.color) el.style.borderLeft = `3px solid ${p.color.line}`;

  const rangeChip = p.closed
    ? `<span class="chip bg-slate-700 text-slate-300">cerrada</span>`
    : p.inRange
      ? `<span class="chip bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">en rango</span>`
      : `<span class="chip bg-amber-500/15 text-amber-300 border border-amber-500/30">fuera de rango</span>`;

  const date = new Date(p.openedAt * 1000).toISOString().slice(0, 10);

  el.innerHTML = `
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full" style="background:${p.color ? p.color.line : chain.color}"></span>
          <span class="text-[11px] uppercase tracking-wide text-slate-400">${chain.name}</span>
          <span class="text-[11px] text-slate-500">· #${p.nftId}</span>
        </div>
        <div class="font-semibold mt-0.5 truncate">${p.token0.symbol} / ${p.token1.symbol}</div>
        <div class="text-[11px] text-slate-400">fee ${feeTierLabel(p.feeTier)} · abierta ${date} (${Math.round(p.ageDays)}d)</div>
      </div>
      ${rangeChip}
    </div>

    ${rangeBarHTML(p.tickLower, p.tickUpper, p.tick, p.token0.decimals, p.token1.decimals, p.inRange, p.closed)}

    <div class="grid grid-cols-2 gap-2 text-xs">
      <div class="bg-slate-950/40 rounded-lg p-2">
        <div class="text-[10px] uppercase tracking-wide text-slate-500">Valor actual</div>
        <div class="font-semibold">${fmtUSD(p.currentValueUSD)}</div>
        <div class="text-[10px] text-slate-400 mt-0.5">${fmtToken(p.amounts.amount0, p.token0.symbol)}</div>
        <div class="text-[10px] text-slate-400">${fmtToken(p.amounts.amount1, p.token1.symbol)}</div>
      </div>
      <div class="bg-slate-950/40 rounded-lg p-2">
        <div class="text-[10px] uppercase tracking-wide text-slate-500">Fees</div>
        <div class="font-semibold text-emerald-400 leading-tight">${fmtUSD(p.feesUSD)} <span class="text-[10px] font-normal text-slate-400">cobradas</span></div>
        <div class="text-amber-300 font-semibold leading-tight">${p.uncollectedUSD === null ? "n/d" : fmtUSD(p.uncollectedUSD)} <span class="text-[10px] font-normal text-slate-400">pendientes</span></div>
        <div class="text-[10px] text-slate-400 mt-0.5">APR fees ~ ${isFinite(p.apr) ? p.apr.toFixed(1) + "%" : "—"}</div>
      </div>
      <div class="bg-slate-950/40 rounded-lg p-2">
        <div class="text-[10px] uppercase tracking-wide text-slate-500">IL vs HODL <span class="cursor-help" title="Valor actual del LP frente a haber mantenido (HODL) los tokens depositados. Estimación; no incluye gas.">ⓘ</span></div>
        <div class="font-semibold ${pnlColor(p.ilUSD)}">${fmtUSD(p.ilUSD)}</div>
        <div class="text-[10px] ${pnlColor(p.ilUSD)} mt-0.5">${fmtPct(p.ilPct)}</div>
      </div>
      <div class="bg-slate-950/40 rounded-lg p-2">
        <div class="text-[10px] uppercase tracking-wide text-slate-500">PnL neto <span class="cursor-help" title="Valor actual + retirado + fees − depositado. Estimación; NO incluye el coste de gas.">ⓘ</span></div>
        <div class="font-semibold ${pnlColor(p.pnlUSD)}">${fmtUSD(p.pnlUSD)}</div>
        <div class="text-[10px] text-slate-400 mt-0.5">depo ${fmtUSD(p.depositedUSD)}</div>
      </div>
    </div>

    <details class="text-xs">
      <summary class="text-slate-400 hover:text-slate-200">▾ detalles</summary>
      <div class="mt-2 space-y-1 text-slate-400">
        <div>Pool: <a href="${chain.explorer}/address/${p.poolId}" target="_blank" class="font-mono text-slate-300 hover:text-fuchsia-300">${shortAddr(p.poolId)}</a></div>
        <div>Rango ticks: ${p.tickLower} → ${p.tickUpper} (actual: ${p.tick})</div>
        <div>Depositado: ${fmtToken(Number(p.raw.depositedToken0), p.token0.symbol)} + ${fmtToken(Number(p.raw.depositedToken1), p.token1.symbol)}</div>
        <div>Retirado: ${fmtToken(Number(p.raw.withdrawnToken0), p.token0.symbol)} + ${fmtToken(Number(p.raw.withdrawnToken1), p.token1.symbol)}</div>
        <div>Fees raw: ${fmtToken(Number(p.raw.collectedFeesToken0), p.token0.symbol)} + ${fmtToken(Number(p.raw.collectedFeesToken1), p.token1.symbol)}</div>
      </div>
    </details>
  `;
  return el;
}

// ============================================================================
// Charts
// ============================================================================

function setChartsCols(twoCols) {
  const sec = document.getElementById("charts-section");
  if (sec) sec.classList.toggle("lg:grid-cols-2", twoCols);
}

function renderCharts() {
  const section = document.getElementById("charts-section");
  if (!state.positions.length) { section.classList.add("hidden"); return; }
  section.classList.remove("hidden");
  setChartsCols(false); // por defecto solo "Valor por posición" a ancho completo; fees se añade si hay datos
  renderValueChart();
  // fees chart se renderiza tras cargar snapshots
}

// barValueLabels (plugin Chart.js) vive en common.js (compartido con sol/app.js).

function renderValueChart() {
  const top = [...state.positions]
    .sort((a, b) => b.currentValueUSD - a.currentValueUSD)
    .slice(0, 8);
  const labels = top.map((p) => p._lending ? `${p.asset} Lend·${p.chainName}` : `${p.token0.symbol}/${p.token1.symbol} #${p.nftId.slice(-4)}`);
  const data = top.map((p) => p.currentValueUSD);
  const bg = top.map((p) => (p.color ? p.color.line : (state.chains[p.chainKey] ? state.chains[p.chainKey].color : "#34d399")));

  const opts = chartBaseOptions();
  opts.plugins.legend.display = false;          // sin leyenda
  opts.layout = { padding: { top: 20 } };        // hueco para la etiqueta de la barra más alta

  if (charts.value) charts.value.destroy();
  charts.value = new Chart(document.getElementById("chart-value"), {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "Valor (USD)", data, backgroundColor: bg, borderRadius: 6 }],
    },
    options: opts,
    plugins: [barValueLabels],
  });
}

// Color distinto por pool usando el ángulo áureo para máxima separación visual
function distinctColor(i) {
  const hue = Math.round((i * 137.508) % 360);
  return { line: `hsl(${hue} 70% 60%)`, fill: `hsl(${hue} 70% 60% / 0.15)` };
}

// Convierte un HEX a un objeto { line, fill } compatible con el resto del código.
// fill = mismo color con 15 % alpha. Tolera tanto #RGB como #RRGGBB.
function hexToColorObj(hex) {
  let h = String(hex || "").replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return { line: `rgb(${r} ${g} ${b})`, fill: `rgb(${r} ${g} ${b} / 0.15)` };
}

// Asigna un color estable a cada posición. Mismo color para todas las posiciones de
// la MISMA red (Ethereum siempre azul morado, Arbitrum azul claro, etc.). Los lending
// (Revert) van con su color de chain igualmente. Si no hay chain → fallback rotativo.
function assignColors(list) {
  list.forEach((p, i) => {
    const chain = p.chainKey && state.chains[p.chainKey];
    p.color = (chain && hexToColorObj(chain.color)) || distinctColor(i);
  });
}

// Construye las series de fees acumuladas (igual que el portfolio): snapshots del
// subgraph para posiciones indexadas + timelineSeries reconstruidas de eventos
// (HyperEVM por RPC/Blockscout y Revert Lend). Luego las pinta.
async function updateFeesChart() {
  let series = [];
  // 1) Posiciones de subgraph → snapshots (fees cobradas acumuladas)
  const subgraphPos = (state.positions || []).filter((p) => !p._lending && !p._rpcOnly && p.id && !p.closed);
  let didHist = false;
  if (subgraphPos.length) {
    try {
      const bundles = await fetchSnapshotsForChart(subgraphPos);
      series = series.concat(await buildPortfolioTimeline(bundles.filter((b) => b.snapshots.length))); // valora con precios históricos + fija PnL
      didHist = true;
    } catch (e) { console.warn("snapshots fees chart:", e); }
  }
  // 2) HyperEVM (RPC) + lending → series ya reconstruidas de eventos on-chain
  for (const p of (state.positions || [])) {
    if (p.timelineSeries && p.timelineSeries.length) {
      const label = p._lending ? `Revert Lend ${p.chainName}` : `${p.token0.symbol}/${p.token1.symbol}`;
      series.push({ label, points: p.timelineSeries });
    }
  }
  renderFeesChart(series);
  // buildPortfolioTimeline pudo actualizar coste base/PnL históricos → refrescar tarjetas
  if (didHist) { renderSummary(); renderPositions(); }
}

// Series originales (sin filtrar) — el input del umbral re-renderiza desde aquí
let _feesChartSeries = [];

// Pinta el gráfico de "Fees acumuladas" a partir de series [{label, points:[{ts,feesUSD}]}]
// + mini-resumen + leyenda ordenada + filtro por umbral configurable + stepped lines.
function renderFeesChart(series) {
  if (Array.isArray(series)) _feesChartSeries = series;
  const all = _feesChartSeries || [];
  const panel = document.getElementById("fees-chart-panel");
  const summaryEl = document.getElementById("fees-chart-summary");
  if (summaryEl) summaryEl.classList.add("hidden");
  if (!all.length) { if (panel) panel.classList.add("hidden"); setChartsCols(false); return; }
  if (panel) panel.classList.remove("hidden");
  setChartsCols(true);

  // Total cobrado por serie (último punto = acumulado final), orden desc
  const withTotals = all.map((s) => ({
    series: s,
    total: s.points && s.points.length ? (s.points[s.points.length - 1].feesUSD || 0) : 0,
  })).sort((a, b) => b.total - a.total);

  // Umbral configurable persistido en localStorage
  const inp = document.getElementById("fees-min-threshold");
  const minThreshold = Math.max(0, Number((inp && inp.value) || 0));
  const visible = withTotals.filter((x) => x.total >= minThreshold);
  const hiddenCount = withTotals.length - visible.length;

  // Mini-resumen
  const grandTotal = withTotals.reduce((s, x) => s + x.total, 0);
  if (summaryEl && withTotals.length && grandTotal > 0) {
    const top = withTotals[0];
    const pct = (top.total / grandTotal) * 100;
    let html = `📈 <span class="text-slate-200 font-semibold">Pool top:</span> ${top.series.label} → <span class="text-emerald-300">${fmtUSD(top.total)}</span> <span class="text-slate-500">(${pct.toFixed(1)}% del total cobrado · ${fmtUSD(grandTotal)} en ${withTotals.length} ${withTotals.length === 1 ? "pool" : "pools"})</span>`;
    if (hiddenCount > 0) html += ` <span class="text-slate-500">· ${hiddenCount} ${hiddenCount === 1 ? "pool oculta" : "pools ocultas"} por umbral</span>`;
    summaryEl.innerHTML = html;
    summaryEl.classList.remove("hidden");
  }

  const datasets = visible.map((x, idx) => {
    const c = distinctColor(idx);
    return {
      label: x.series.label,
      data: (x.series.points || []).map((pt) => ({ x: pt.ts, y: pt.feesUSD || 0 })),
      borderColor: c.line,
      backgroundColor: c.fill,
      stepped: "after",
      pointRadius: 0,
      borderWidth: 2,
    };
  });
  if (charts.fees) charts.fees.destroy();
  if (!datasets.length) return; // todo filtrado por umbral
  charts.fees = new Chart(document.getElementById("chart-fees"), {
    type: "line",
    data: { datasets },
    options: chartBaseOptions({ time: true }),
  });
}

// Wire del input del umbral (una sola vez por carga del iframe)
(function _wireFeesThreshold() {
  try {
    const inp = document.getElementById("fees-min-threshold");
    if (!inp) return;
    const saved = localStorage.getItem("lp:feesMinThreshold");
    if (saved !== null) inp.value = saved;
    inp.addEventListener("input", () => {
      localStorage.setItem("lp:feesMinThreshold", String(inp.value || 0));
      renderFeesChart(null); // re-render con las series ya cargadas
    });
  } catch (e) { /* ignore */ }
})();

function chartBaseOptions({ time = false } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: "#cbd5e1", font: { size: 10 } } },
      tooltip: {
        callbacks: {
          title: time
            ? (items) => items.length ? new Date(items[0].parsed.x).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : ""
            : undefined,
          label: (ctx) => `${ctx.dataset.label}: ${fmtUSD(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      x: time
        ? { type: "linear", ticks: { color: "#94a3b8", maxTicksLimit: 8, callback: (v, i, ticks) => { const f = (x) => new Date(x).toISOString().slice(0, 10); const cur = f(v); const prev = i > 0 && ticks[i - 1] ? f(ticks[i - 1].value) : null; return cur === prev ? "" : cur; } }, grid: { color: "#1e293b" } }
        : { ticks: { color: "#94a3b8" }, grid: { color: "#1e293b" } },
      y: { ticks: { color: "#94a3b8", callback: (v) => fmtUSDc(v) }, grid: { color: "#1e293b" } },
    },
  };
}

// ============================================================================
// Main analyze flow
// ============================================================================

function isValidAddress(addr) {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

async function analyze() {
  const addr = document.getElementById("addr-input").value.trim();
  if (!isValidAddress(addr)) { setStatus("Dirección EVM no válida (0x + 40 hex).", "err"); return; }
  if (!state.selectedChains.length) { setStatus("Selecciona al menos una red.", "err"); return; }
  // Solo exigimos API key si alguna red seleccionada usa subgraph (no RPC-only)
  const needsApiKey = state.selectedChains.some(k => state.chains[k]?.subgraphId && !state.chains[k]?.nftManagerAddress);
  if (needsApiKey && !state.apiKey && !PROXY_BASE) { setStatus("Falta API key de The Graph. Abre Settings.", "err"); openSettings(); return; }

  state.address = addr;
  state.positions = [];
  setLoading(true);
  setStatus(`Consultando ${state.selectedChains.length} red(es)…`, "info");

  document.getElementById("empty-state").classList.add("hidden");
  document.getElementById("positions-section").classList.add("hidden");
  document.getElementById("summary-section").classList.add("hidden");
  document.getElementById("charts-section").classList.add("hidden");

  try {
    const { positions, errors, skipped } = await fetchAllPositions(addr);
    state.positions = positions;
    // Revert Lend (vaults ERC-4626) — se añade como posiciones de tipo "lending"
    try {
      const lending = await fetchRevertLending(addr);
      if (lending.length) state.positions.push(...lending);
    } catch (e) { console.warn("Revert Lend:", e); }
    assignColors(state.positions);

    // Tokens "idle" en wallet (no metidos en LPs) — en paralelo por cada red
    // seleccionada que tenga Blockscout. Fallback de precios via DefiLlama.
    try {
      const chainsForIdle = state.selectedChains.filter((k) => state.chains[k]?.blockscoutApi);
      const tokenLists = await Promise.all(chainsForIdle.map((k) => fetchIdleTokensEVM(k, addr)));
      state.idleTokens = tokenLists.flat();
    } catch (e) { console.warn("idle tokens:", e); state.idleTokens = []; }

    const skippedNote = skipped.length ? ` (saltadas: ${skipped.map((s) => state.chains[s.chainKey].name).join(", ")})` : "";
    const lendN = state.positions.filter((p) => p._lending).length;
    const lpN = positions.length;
    // Resumen estructurado del análisis para el shell (banner de resultado)
    state.analysisStatus = {
      ok: errors.length === 0,
      errors: errors.map((e) => ({ source: state.chains[e.chainKey]?.name || e.chainKey, reason: classifyError(e.__error).text })),
    };

    if (errors.length) {
      // Clasificar errores por causa y nombrar las redes afectadas
      const byCat = new Map();
      for (const e of errors) {
        const c = classifyError(e.__error);
        if (!byCat.has(c.text)) byCat.set(c.text, { cat: c.cat, chains: [] });
        byCat.get(c.text).chains.push(state.chains[e.chainKey].name);
      }
      const detail = [...byCat.entries()].map(([text, v]) => `${v.chains.join(", ")} (${text})`).join(" · ");
      const allAuth = [...byCat.values()].every((v) => v.cat === "auth");
      const lead = lpN > 0
        ? `${lpN} posiciones${lendN ? ` + ${lendN} lending` : ""}, pero no se pudo consultar: `
        : allAuth
          ? "Para analizar, inicia sesión o configura tu API key en Settings. Sin consultar: "
          : "No se pudo consultar: ";
      setStatus(`${lead}${detail}.${skippedNote}`, allAuth && lpN === 0 ? "info" : "err");
    } else if (state.positions.length === 0) {
      setStatus(`Sin posiciones para ${shortAddr(addr)} en las redes seleccionadas (todo consultado correctamente).${skippedNote}`, "info");
    } else {
      const lendNote = lendN ? ` + ${lendN} en Revert Lend` : "";
      setStatus(`${lpN} posiciones de LP${lendNote}.${skippedNote}`, "ok");
    }

    renderAll();

    // Gráfico de fees acumuladas: mismas series que el portfolio (snapshots del
    // subgraph + timelineSeries reconstruidas de eventos para HyperEVM/lending),
    // así también aparecen las fees de HyperEVM.
    updateFeesChart();

    if (positions.length) {
      // Backfill por RPC de fees no cobradas en chains con tickField scalar
      const pendingRPC = positions.filter((p) => p.uncollected === null && !p.closed && state.chains[p.chainKey]?.rpcUrl).length;
      if (pendingRPC > 0) {
        const baseMsg = document.getElementById("status-msg").textContent;
        backfillUncollectedFromRPC(positions, (done) => {
          setStatus(`${baseMsg} · RPC ticks ${done}/${pendingRPC}…`, "info");
        }).then((n) => {
          if (n > 0) {
            setStatus(`${baseMsg} · fees pendientes vía RPC: ${n} posiciones actualizadas.`, "ok");
            renderAll();
          }
        });
      }
    }
  } catch (e) {
    console.error(e);
    setStatus(`Error: ${e.message}`, "err");
    state.analysisStatus = { ok: false, errors: [{ source: "EVM", reason: (classifyError(e?.message) || {}).text || (e?.message || "error") }] };
  } finally {
    setLoading(false);
  }
}

// ============================================================================
// Wallet (EIP-1193: Rabby / MetaMask / cualquier wallet inyectada)
// ============================================================================

function getInjectedProvider() {
  if (typeof window === "undefined" || !window.ethereum) return null;
  // si hay varios providers (Rabby + MetaMask), preferimos Rabby
  if (Array.isArray(window.ethereum.providers) && window.ethereum.providers.length) {
    return window.ethereum.providers.find((p) => p.isRabby) || window.ethereum.providers[0];
  }
  return window.ethereum;
}

async function connectWallet() {
  const provider = getInjectedProvider();
  if (!provider) {
    setStatus("No detecté ninguna wallet inyectada. Instala Rabby (rabby.io) o MetaMask en tu navegador. Si la app está abierta dentro del preview de Claude Code, ábrela en Chrome.", "err");
    return;
  }
  try {
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    if (!accounts || !accounts[0]) throw new Error("la wallet no devolvió cuenta");
    onWalletConnected(accounts[0], provider);
  } catch (e) {
    setStatus(`Error conectando wallet: ${e.message || e}`, "err");
  }
}

function onWalletConnected(account, provider) {
  state.connectedAddress = account;
  document.getElementById("addr-input").value = account;
  renderWalletButton();
  setStatus(`Conectada: ${shortAddr(account)}. Pulsa Analizar.`, "ok");

  // listeners (solo registramos una vez)
  if (provider && !provider.__lpListenersAttached) {
    provider.on?.("accountsChanged", (accs) => {
      if (!accs || !accs.length) {
        disconnectWallet();
      } else {
        state.connectedAddress = accs[0];
        document.getElementById("addr-input").value = accs[0];
        renderWalletButton();
        setStatus(`Cuenta cambiada: ${shortAddr(accs[0])}`, "info");
      }
    });
    provider.__lpListenersAttached = true;
  }
}

function disconnectWallet() {
  // los wallets no exponen un "desconectar" estándar; limpiamos nuestro estado
  state.connectedAddress = null;
  renderWalletButton();
  setStatus("Wallet desvinculada de la app. La sesión sigue activa en la extensión.", "info");
}

function renderWalletButton() {
  const label = document.getElementById("btn-wallet-label");
  const btn = document.getElementById("btn-wallet");
  if (!label || !btn) return;
  if (state.connectedAddress) {
    label.innerHTML = `<span class="text-emerald-400">●</span> ${shortAddr(state.connectedAddress)} <span class="text-slate-500 ml-1">✕</span>`;
    btn.title = "Click para desconectar";
    btn.onclick = disconnectWallet;
  } else {
    label.textContent = "🔗 Conectar Rabby";
    btn.title = "Conectar Rabby / MetaMask";
    btn.onclick = connectWallet;
  }
}

async function trySilentReconnect() {
  const provider = getInjectedProvider();
  if (!provider) return;
  try {
    // eth_accounts no abre prompt; solo devuelve cuentas si ya hay sesión autorizada
    const accs = await provider.request({ method: "eth_accounts" });
    if (accs && accs[0]) onWalletConnected(accs[0], provider);
  } catch (e) {
    // silencioso
  }
}

// ============================================================================
// Init
// ============================================================================

function init() {
  renderChainChips();
  renderWalletButton();
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

  trySilentReconnect();

  if (!state.apiKey && !PROXY_BASE) {
    setStatus("Configura tu API key de The Graph en Settings antes de analizar.", "info");
  }
}

document.addEventListener("DOMContentLoaded", init);

// ============================================================================
// Modo embebido (cuando corre dentro del shell unificado lp-analyzer)
// ============================================================================
(function () {
  if (window.parent === window) return; // no embebido
  const style = document.createElement("style");
  // Cuando estamos embebidos: ocultamos header, input block y el summary interno
  // (el shell pinta uno propio idéntico al de Portfolio sobre el iframe).
  style.textContent = "header{display:none!important}#addr-block{display:none!important}#input-section{margin-top:0}#summary-section{display:none!important}";
  document.head.appendChild(style);
  document.documentElement.classList.add("embedded");
  function notifyWallet() {
    const addr = (typeof state !== "undefined" && state.connectedAddress) || null;
    try { window.parent.postMessage({ type: "lp-wallet", app: "evm", address: addr }, "*"); } catch (e) {}
  }
  // Normaliza las posiciones EVM para el portfolio del shell
  function toPortfolioItems() {
    return (state.positions || []).map((p) => {
      // cardHTML: la MISMA ficha que se ve en Quick (misma función positionCard/lendingCard)
      // → Portfolio y Quick siempre consistentes.
      let cardHTML = "";
      try { cardHTML = (p._lending ? lendingCard(p) : positionCard(p)).outerHTML; } catch (e) {}
      if (p._lending) {
        return {
          kind: "evm", lending: true, cardHTML,
          venue: `Revert Lend · ${p.chainName}`,
          pair: `${p.asset} (lending)`,
          valueUSD: p.currentValueUSD || 0,
          feesUSD: p.gainsUSD || 0,           // interés ganado
          feesPendingUSD: 0,
          ilUSD: null,
          pnlUSD: p.gainsUSD == null ? null : p.gainsUSD,
          apr: typeof p.apr === "number" ? p.apr : null,
          inRange: true, closed: false,
          id: p.vault || "",
        };
      }
      return {
        kind: "evm", cardHTML,
        venue: (state.chains[p.chainKey] && state.chains[p.chainKey].name) || p.chainKey,
        pair: `${p.token0.symbol}/${p.token1.symbol}`,
        valueUSD: p.currentValueUSD || 0,
        feesUSD: p.feesUSD || 0,
        feesPendingUSD: p.uncollectedUSD == null ? null : p.uncollectedUSD,
        ilUSD: p.ilUSD == null ? null : p.ilUSD,
        pnlUSD: p.pnlUSD == null ? null : p.pnlUSD,
        apr: typeof p.apr === "number" && isFinite(p.apr) ? p.apr : null,
        inRange: !!p.inRange,
        closed: !!p.closed,
        tickLower: p.tickLower, tickUpper: p.tickUpper, tick: p.tick,
        dec0: p.token0.decimals, dec1: p.token1.decimals,
        id: String(p.nftId || ""),
      };
    });
  }
  window.addEventListener("message", (e) => {
    const d = e.data || {};
    if (d.type === "lp-clear") {
      if (typeof state !== "undefined") state.positions = [];
      ["positions-section", "summary-section", "charts-section", "fees-chart-panel"].forEach((id) => { const e = document.getElementById(id); if (e) e.classList.add("hidden"); });
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
      // Las guardamos como override del proxy (lo que ya hacía openSettings/saveSettings).
      if (typeof d.graph === "string") {
        state.apiKey = d.graph;
        try { localStorage.setItem("lp:apiKey", d.graph); } catch (e) {}
      }
    } else if (d.type === "lp-analyze" && typeof d.address === "string") {
      const input = document.getElementById("addr-input");
      if (input) input.value = d.address;
      Promise.resolve(typeof analyze === "function" ? analyze() : null)
        .finally(() => {
          // Enviar al shell los items normalizados (= mismos datos que Portfolio) para
          // que pinte su resumen Quick idéntico al global. Tolera errores.
          try {
            const items = (typeof toPortfolioItems === "function") ? toPortfolioItems() : [];
            const analysisStatus = state.analysisStatus || { ok: true, errors: [] };
            const idleTokens = state.idleTokens || [];
            window.parent.postMessage({ type: "lp-summary", app: "evm", items, analysisStatus, idleTokens }, "*");
          } catch (e) {}
          try { window.parent.postMessage({ type: "lp-analyze-done", app: "evm" }, "*"); } catch (e) {}
        });
    } else if (d.type === "lp-open-settings") {
      if (typeof openSettings === "function") openSettings();
    } else if (d.type === "lp-connect-wallet") {
      if (typeof connectWallet === "function") Promise.resolve(connectWallet()).then(notifyWallet).catch(notifyWallet);
    } else if (d.type === "lp-disconnect-wallet") {
      if (typeof disconnectWallet === "function") { disconnectWallet(); notifyWallet(); }
    } else if (d.type === "lp-set-chains" && Array.isArray(d.chains)) {
      state.selectedChains = d.chains.slice();
      localStorage.setItem("lp:selectedChains", JSON.stringify(state.selectedChains));
      if (typeof renderChainChips === "function") renderChainChips();
    } else if (d.type === "lp-portfolio-analyze" && typeof d.address === "string") {
      const input = document.getElementById("addr-input");
      if (input) input.value = d.address;
      Promise.resolve(typeof analyze === "function" ? analyze() : null)
        .then(async () => {
          // Esperar backfill RPC antes de enviar resultado (Arbitrum/Base usan tickField scalar)
          const needsRPC = (state.positions || []).filter((p) => p.uncollected === null && !p.closed && state.chains[p.chainKey]?.rpcUrl);
          if (needsRPC.length > 0) await backfillUncollectedFromRPC(state.positions).catch(() => {});
          // Snapshots para línea temporal de fees
          let timeline = [];
          try {
            const toFetch = (state.positions || []).filter((p) => !p.closed).slice(0, 20);
            if (toFetch.length) {
              const bundles = await Promise.all(toFetch.map(async (p) => {
                try {
                  const data = await gql(p.chainKey, SNAPSHOTS_QUERY, { positionId: p.id });
                  return { position: p, snapshots: data.positionSnapshots || [] };
                } catch { return { position: p, snapshots: [] }; }
              }));
              timeline = await buildPortfolioTimeline(bundles);
            }
          } catch (e) { console.warn("timeline build failed:", e); }
          // añadir series propias de HyperEVM (RPC) y lending (reconstruidas de eventos)
          for (const p of (state.positions || [])) {
            if (p.timelineSeries && p.timelineSeries.length) {
              const label = p._lending ? `Revert Lend ${p.chainName}` : `${p.token0.symbol}/${p.token1.symbol}`;
              timeline.push({ posId: p.id || p.vault || label, label, points: p.timelineSeries });
            }
          }
          const status = (document.getElementById("status-msg") || {}).textContent || "";
          const analysisStatus = state.analysisStatus || { ok: true, errors: [] };
          const idleTokens = state.idleTokens || [];
          window.parent.postMessage({ type: "lp-result", app: "evm", reqId: d.reqId, address: d.address, items: toPortfolioItems(), status, timeline, analysisStatus, idleTokens }, "*");
        })
        .catch((err) => {
          window.parent.postMessage({ type: "lp-result", app: "evm", reqId: d.reqId, address: d.address, items: [], status: "error", error: String(err), idleTokens: [], analysisStatus: { ok: false, errors: [{ source: "EVM", reason: String(err) }] } }, "*");
        });
    }
  });
  // tras el reconect silencioso, avisar del estado al shell
  setTimeout(notifyWallet, 1500);
  try { window.parent.postMessage({ type: "lp-ready", app: "evm" }, "*"); } catch (e) {}
})();
