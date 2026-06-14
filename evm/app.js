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
  positions: [],
  loading: false,
  error: null,
  sortBy: "value",
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

// Como buildPositionsQuery pero por LISTA DE IDS (sin filtro de owner): así
// recuperamos posiciones QUEMADAS (owner=0x0) para reconstruir las cerradas que
// el usuario tuvo y quemó. Mismos campos que la query por owner.
function buildPositionsByIdsQuery(variant, tickField) {
  const derived = variant === "native" ? "derivedETH: derivedNative" : "derivedETH";
  const ethUsd = variant === "native" ? "ethPriceUSD: nativePriceUSD" : "ethPriceUSD";
  const tickSel = tickField === "scalar"
    ? "tickLower tickUpper"
    : "tickLower { tickIdx feeGrowthOutside0X128 feeGrowthOutside1X128 } tickUpper { tickIdx feeGrowthOutside0X128 feeGrowthOutside1X128 }";
  return `
    query PositionsByIds($ids: [String!]!) {
      positions(where: { id_in: $ids }, first: 1000, orderBy: id) {
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
      transaction { id }
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

// eth_getBalance resiliente (lista de RPC, mismo backoff que rpcEthCall). Lee el
// saldo NATIVO en directo de la cadena (sin el retraso del caché del explorer).
// Devuelve el hex del balance. Lanza si todos los RPC fallan.
async function rpcGetBalance(rpcOrList, address) {
  const rpcs = Array.isArray(rpcOrList) ? rpcOrList.filter(Boolean) : [rpcOrList].filter(Boolean);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const body = JSON.stringify({ jsonrpc: "2.0", method: "eth_getBalance", params: [address, "latest"], id: 1 });
  let lastErr;
  for (const rpc of rpcs) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(rpc, { method: "POST", headers: { "Content-Type": "application/json" }, body });
        if (res.status === 429 || res.status >= 500) { lastErr = new Error(`RPC HTTP ${res.status}`); if (attempt === 0) { await sleep(400); continue; } break; }
        if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
        const json = await res.json();
        if (json.error) throw new Error(`RPC ${json.error.code}: ${json.error.message}`);
        return json.result;
      } catch (e) {
        lastErr = e;
        if (attempt === 0 && /Failed to fetch|NetworkError|timeout|aborted/i.test(String(e.message))) { await sleep(400); continue; }
        break;
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
  // 1) Balance nativo (ETH, HYPE, MATIC, BNB…). Preferimos el RPC en VIVO
  // (eth_getBalance) en vez del `coin_balance` del explorer, que va con retraso
  // (cachea el balance y no refleja la actividad reciente). Fallback al explorer
  // si el RPC falla. Read-only.
  if (c.nativeSymbol) {
    let raw = null;
    try { const hex = await rpcGetBalance(c.rpcUrls || c.rpcUrl, address); if (hex) raw = BigInt(hex); }
    catch (e) { /* RPC caído → caemos al coin_balance del explorer */ }
    if (raw == null && addrInfo && addrInfo.coin_balance) { try { raw = BigInt(addrInfo.coin_balance); } catch (e) { raw = null; } }
    try {
      if (raw != null && raw > 0n) {
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
    events.push({ ts, type: "inc", a0: word(l.data, 1), a1: word(l.data, 2), tx: l.transactionHash });
  }
  for (const l of decLogs) { dec0r += word(l.data, 1); dec1r += word(l.data, 2); events.push({ ts: parseInt(l.timeStamp, 16), type: "dec", a0: word(l.data, 1), a1: word(l.data, 2), tx: l.transactionHash }); }
  for (const l of colLogs) { col0 += word(l.data, 1); col1 += word(l.data, 2); events.push({ ts: parseInt(l.timeStamp, 16), type: "col", a0: word(l.data, 1), a1: word(l.data, 2), tx: l.transactionHash }); }

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
      deposited0: hist ? hist.deposited0 : 0,
      deposited1: hist ? hist.deposited1 : 0,
      // cantidades de fees cobradas por token (NETAS de principal). Para el valor
      // realizable se agrupan como un cobro único en openedAt (los eventos col
      // crudos incluyen principal, así que no sirven por evento).
      collectedFees0: hist ? hist.collectedFees0 : 0,
      collectedFees1: hist ? hist.collectedFees1 : 0,
      raw: fakeRaw,
      _rpcOnly: true, // marca para el UI
      // serie temporal (depósitos + fees) reconstruida de eventos para el histórico
      timelineSeries: hist && hist.events ? buildTimelineFromEvents(hist.events, t0.decimals, t1.decimals, p0, p1) : null,
      // eventos crudos inc/dec/col para el acordeón de logs (HyperEVM no tiene
      // subgraph → eventLogHTML los clasifica vía classifyRpcEvents en vez de
      // classifyEvents(snapshots)).
      _rpcEvents: hist && hist.events ? hist.events : null,
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
    deposited0,
    deposited1,
    // cantidades de fees cobradas por token (para el valor realizable; buildPortfolioTimeline
    // afina con cobros reales por snapshot cuando los hay).
    collectedFees0: fees0,
    collectedFees1: fees1,
    raw,
  };
}

// ============================================================================
// Fetch orchestration
// ============================================================================

// ────────────────────────────────────────────────────────────────────────────
// Reconstrucción de posiciones QUEMADAS (NFT burned) — recupera sus fees cobradas.
// El descubrimiento normal (positions where owner) no las ve porque al quemar el
// owner pasa a 0x0. Enumeramos los tokenIds que el owner recibió (logs Transfer
// del explorer) y consultamos el subgraph por id_in SIN filtro de owner.
// ERC-721 Transfer(from,to,tokenId): misma firma que ERC-20 pero los 3 indexados → tokenId en topics[3].
const EV_ERC721_TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

async function fetchReceivedTokenIds(apiBase, nftMgr, owner) {
  const ownerTopic = "0x" + owner.toLowerCase().replace("0x", "").padStart(64, "0");
  const url = `${apiBase}?module=logs&action=getLogs&fromBlock=0&toBlock=latest&address=${nftMgr}&topic0=${EV_ERC721_TRANSFER}&topic2=${ownerTopic}&topic0_2_opr=and`;
  const r = await fetch(url); const j = await r.json();
  const ids = new Set();
  if (Array.isArray(j.result)) for (const l of j.result) { const t3 = (l.topics && l.topics[3]) || ""; if (/^0x[0-9a-fA-F]+$/.test(t3)) { try { ids.add(BigInt(t3).toString()); } catch (e) {} } }
  return ids;
}

// Chains con subgraph + explorer (blockscoutApi): Ethereum/Arbitrum/Polygon/Base.
async function reconstructBurnedSubgraph(chainKey, owner, openIds) {
  const chain = state.chains[chainKey];
  if (!chain.blockscoutApi || !chain.uniNftManager || !chain.subgraphId) return [];
  let received;
  try { received = await fetchReceivedTokenIds(chain.blockscoutApi, chain.uniNftManager, owner); }
  catch (e) { console.warn(`[${chainKey}] recon getLogs:`, e.message); return []; }
  const candidates = [...received].filter((id) => !openIds.has(id));
  if (!candidates.length) return [];
  const variant = chain.schemaVariant || "eth";
  const tickField = chain.tickField || "object";
  const out = [];
  for (let i = 0; i < candidates.length; i += 200) {
    let data;
    try { data = await gql(chainKey, buildPositionsByIdsQuery(variant, tickField), { ids: candidates.slice(i, i + 200) }); }
    catch (e) { console.warn(`[${chainKey}] recon gql:`, e.message); continue; }
    const ethPriceUSD = Number(data.bundles?.[0]?.ethPriceUSD || 0);
    for (const raw of (data.positions || [])) {
      if (!/^0x0+$/.test(String(raw.owner || "").toLowerCase())) continue; // SOLO quemadas (owner 0x0); las vendidas/transferidas tienen otro owner
      try { const p = enrichPosition(raw, ethPriceUSD, chainKey); p.reconstructed = true; p.closed = true; out.push(p); } catch (e) {}
    }
  }
  if (out.length) console.log(`[evm-recon] ${chainKey}: ${out.length} posición(es) quemada(s) reconstruida(s)`);
  return out;
}

// HyperEVM (RPC-only, sin subgraph): best-effort. Los logs Increase/Decrease/Collect
// NO llevan las direcciones de los tokens → resolvemos el par parseando los Transfer
// ERC-20 (from=owner) de la 1ª tx de depósito. Si no se resuelve, se omite la posición.
async function reconstructBurnedHyperEVM(chainKey, owner, openIds) {
  const chain = state.chains[chainKey];
  if (!chain.blockscoutApi || !chain.nftManagerAddress || !chain.rpcUrl) return [];
  const nftMgr = chain.nftManagerAddress;
  const rpc = chain.rpcUrls || chain.rpcUrl;
  const rpcOne = typeof rpc === "string" ? rpc : (rpc[0] || chain.rpcUrl);
  let received;
  try { received = await fetchReceivedTokenIds(chain.blockscoutApi, nftMgr, owner); }
  catch (e) { console.warn(`[${chainKey}] recon getLogs:`, e.message); return []; }
  const candidates = [...received].filter((id) => !openIds.has(id)).slice(0, 40); // tope de seguridad
  if (!candidates.length) return [];
  const ownerTopic = "0x" + owner.toLowerCase().replace("0x", "").padStart(64, "0");
  const out = [];
  for (const tokenId of candidates) {
    try {
      // ¿quemada? ownerOf revierte; si devuelve otra dirección → transferida/vendida → omitir.
      try {
        const oh = await rpcEthCall(rpc, nftMgr, "0x6352211e" + BigInt(tokenId).toString(16).padStart(64, "0"));
        if (!/^0x0+$/.test("0x" + (oh || "").slice(-40))) continue; // alguien la posee → no es burn nuestro
      } catch (e) { /* revert → quemada */ }
      // 1ª tx Increase → resolver el par desde sus Transfer ERC-20 (from=owner)
      const h0 = await fetchPositionHistory(chain.blockscoutApi, nftMgr, tokenId, 18, 18);
      const incs = (h0.events || []).filter((e) => e.type === "inc").sort((a, b) => a.ts - b.ts);
      if (!incs.length || !incs[0].tx) continue;
      const rcpt = await fetch(rpcOne, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [incs[0].tx] }) }).then((x) => x.json());
      const toks = [];
      for (const l of (rcpt?.result?.logs || [])) {
        const tps = l.topics || [];
        if (tps.length !== 3 || (tps[0] || "").toLowerCase() !== EV_ERC721_TRANSFER) continue; // ERC-20 Transfer (3 topics)
        if ((tps[1] || "").toLowerCase() !== ownerTopic) continue;                              // from = owner (depósito)
        const a = (l.address || "").toLowerCase();
        if (a && !toks.includes(a)) toks.push(a);
      }
      if (toks.length < 2) continue; // par no resuelto → omitir
      const [a0, a1] = toks[0] < toks[1] ? [toks[0], toks[1]] : [toks[1], toks[0]]; // token0 = dirección menor (orden del pool)
      const meta = async (a) => { let sym = a.slice(0, 6), dec = 18; try { sym = decABIString(await rpcEthCall(rpc, a, SEL_SYMBOL)) || sym; } catch (e) {} try { dec = Number(decU(await rpcEthCall(rpc, a, SEL_DECIMALS), 0)); } catch (e) {} return { symbol: sym, decimals: dec }; };
      const t0 = await meta(a0), t1 = await meta(a1);
      const hist = await fetchPositionHistory(chain.blockscoutApi, nftMgr, tokenId, t0.decimals, t1.decimals);
      const prices = await priceTokensViaPool(rpc, chain.factoryAddress, { [a0]: { symbol: t0.symbol, decimals: t0.decimals }, [a1]: { symbol: t1.symbol, decimals: t1.decimals } }).catch(() => ({}));
      const p0 = prices[a0] || 0, p1 = prices[a1] || 0;
      const feesUSD = hist.collectedFees0 * p0 + hist.collectedFees1 * p1;
      const depositedUSD = hist.deposited0 * p0 + hist.deposited1 * p1;
      const withdrawnUSD = hist.withdrawn0 * p0 + hist.withdrawn1 * p1;
      out.push({
        id: String(tokenId), chainKey, nftId: String(tokenId), poolId: "",
        reconstructed: true, closed: true, inRange: false,
        token0: { id: a0, symbol: t0.symbol, decimals: t0.decimals, priceUSD: p0 },
        token1: { id: a1, symbol: t1.symbol, decimals: t1.decimals, priceUSD: p1 },
        tick: null, tickLower: null, tickUpper: null, feeTier: null,
        amounts: { amount0: 0, amount1: 0 }, liquidity: "0",
        currentValueUSD: 0, feesUSD, uncollected: null, uncollectedUSD: null,
        feesTotalUSD: feesUSD, depositedUSD, withdrawnUSD,
        // cantidades de fees por token (NETAS) → valor realizable (enrichRealizableFeesEVM)
        collectedFees0: hist.collectedFees0, collectedFees1: hist.collectedFees1,
        hodlUSD: depositedUSD, pnlUSD: null, ilUSD: null, ilPct: null, apr: null,
        ageDays: hist.mintTs ? Math.max(0, (Date.now() / 1000 - hist.mintTs) / 86400) : 0,
        openedAt: hist.mintTs || 0, _rpcOnly: true,
      });
    } catch (e) { /* best-effort: omitir esta candidata */ }
  }
  if (out.length) console.log(`[evm-recon] ${chainKey} (HyperEVM): ${out.length} quemada(s) reconstruida(s)`);
  return out;
}

async function fetchAllPositions(address) {
  const tasks = state.selectedChains.map(async (chainKey) => {
    const chain = state.chains[chainKey];
    // Modo RPC-directo para redes sin subgraph público (ej. HyperEVM)
    if (chain.nftManagerAddress) {
      if (!chain.rpcUrl) return { __skipped: true, chainKey, reason: "sin RPC configurado" };
      try {
        const open = await fetchPositionsFromRPCDirect(address, chainKey);
        const arr = Array.isArray(open) ? open : [];
        // Reconstruir quemadas (best-effort) de esta chain RPC-only → fees cobradas.
        const openIds = new Set(arr.map((p) => String(p.nftId)));
        const recon = await reconstructBurnedHyperEVM(chainKey, address, openIds).catch(() => []);
        return arr.concat(recon);
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
      const open = data.positions.map((p) => enrichPosition(p, ethPriceUSD, chainKey));
      // Reconstruir posiciones quemadas (NFT burned) de esta chain → fees cobradas.
      const openIds = new Set(open.map((p) => String(p.id)));
      const recon = await reconstructBurnedSubgraph(chainKey, address, openIds).catch(() => []);
      return open.concat(recon);
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

// ============================================================================
// DefiLlama historical prices — fallback cuando tokenDayDatas del subgraph
// no tiene datos (subgraphs antiguos, o tokens sin liquidez tracked en V3).
// ============================================================================
// API: POST https://coins.llama.fi/batchHistorical
//   body: { coins: { "<chain>:<addr>": [ts1, ts2, ...] }, searchWidth: "600" }
//   resp: { coins: { "<chain>:<addr>": { prices: [{ timestamp, price }] } } }
// Free, sin auth. searchWidth=600s busca el precio más cercano dentro de
// ±10min del timestamp pedido.
const DEFILLAMA_CHAIN_PREFIX = {
  ethereum: "ethereum",
  arbitrum: "arbitrum",
  optimism: "optimism",
  polygon: "polygon",
  base: "base",
  bnb: "bsc", // DefiLlama usa "bsc" para Binance Smart Chain
  // hyperevm: no soportado por DefiLlama en este momento
};

async function fetchDefiLlamaPrices(chainKey, tokenIds, dates) {
  const out = {};
  const prefix = DEFILLAMA_CHAIN_PREFIX[chainKey];
  if (!prefix) return out;
  const toks = tokenIds.filter(Boolean).map((t) => t.toLowerCase());
  if (!toks.length || !dates.length) return out;

  // GET /prices/historical/{timestamp}/{coins} — single timestamp, multiple
  // coins por request. El batch POST devolvía 400 con cualquier formato que
  // probamos (la API parece haber cambiado de forma silenciosa). Este
  // endpoint GET es público, simple, devuelve { coins: { "<chain>:<addr>":
  // { price, decimals, symbol, timestamp, confidence } } } y funciona
  // perfectamente (verificado con curl manual).
  //
  // Una request por fecha. Paralelizamos 3 a la vez para no hacer
  // stampede a la API.
  const coinsParam = toks.map((t) => `${prefix}:${t}`).join(",");
  const limit = 3;
  let firstFail = null;
  for (let i = 0; i < dates.length; i += limit) {
    const batch = dates.slice(i, i + limit);
    await Promise.all(batch.map(async (date) => {
      try {
        const res = await fetch(`https://coins.llama.fi/prices/historical/${date}/${coinsParam}?searchWidth=4h`);
        if (!res.ok) {
          if (!firstFail) firstFail = `HTTP ${res.status}`;
          return;
        }
        const data = await res.json();
        for (const [coinKey, info] of Object.entries(data.coins || {})) {
          const tok = (coinKey.split(":")[1] || "").toLowerCase();
          const v = Number(info?.price);
          if (isFinite(v)) out[`${tok}:${date}`] = v;
        }
      } catch (e) {
        if (!firstFail) firstFail = e?.message || String(e);
      }
    }));
  }
  if (firstFail && Object.keys(out).length === 0) {
    console.warn(`[defillama] ${chainKey}: ${firstFail}`);
  }
  return out;
}

// ── Indicador idle ("¿buen momento para pasar a USDC?") — EVM ────────────────
// entryPx = precio medio de entrada (coste base histórico de los depósitos, precio
// DefiLlama al minteo) + range30d (serie de 30d de DefiLlama, 1 llamada/token). Se
// adjuntan a state.idleTokens; la UI compartida (shell.js) pinta badge + termómetro.
// Nativos (ETH/HYPE, addr 0x0) y HyperEVM no están en DefiLlama → se omiten (degrada
// limpio: si falta la entrada sale solo el termómetro y viceversa).
const _evmRange30dCache = new Map();
// Rango 30d por clave DefiLlama (`${chain}:${addr}` para ERC-20, `coingecko:${id}`
// para nativos). 1 llamada/clave, cacheada por día. Devuelve {min,max}|null.
async function defiLlamaRange30d(coinKey) {
  if (!coinKey) return null;
  const cacheKey = `${coinKey}:${Math.floor(Date.now() / 86400000)}`;
  if (_evmRange30dCache.has(cacheKey)) return _evmRange30dCache.get(cacheKey);
  let res = null;
  try {
    const start = Math.floor(Date.now() / 1000) - 30 * 86400;
    const r = await fetch(`https://coins.llama.fi/chart/${coinKey}?start=${start}&span=30&period=1d&searchWidth=600`);
    if (r.ok) {
      const j = await r.json();
      const c = j && j.coins && j.coins[coinKey];
      const series = c && c.prices;
      if (Array.isArray(series)) {
        const vals = series.map((p) => p && p.price).filter((v) => typeof v === "number" && isFinite(v) && v > 0);
        if (vals.length >= 2) res = { min: Math.min(...vals), max: Math.max(...vals) };
      }
    }
  } catch (e) { res = null; }
  _evmRange30dCache.set(cacheKey, res);
  return res;
}

function _isStableEVMSym(sym) {
  const s = (sym || "").toUpperCase();
  return s.startsWith("USD") || s.startsWith("EUR") || ["DAI", "FRAX", "MIM", "TUSD", "LUSD", "GUSD", "USDD"].includes(s);
}
// Nativos por símbolo → id de CoinGecko (DefiLlama acepta `coingecko:<id>`), para
// que ETH/HYPE/BNB/POL idle tengan termómetro aunque no estén en DefiLlama por addr.
const _NATIVE_CG = { ETH: "ethereum", WETH: "ethereum", HYPE: "hyperliquid", BNB: "binancecoin", WBNB: "binancecoin", POL: "polygon-ecosystem-token", MATIC: "matic-network", AVAX: "avalanche-2" };
// Token envuelto del nativo por chain (lowercase) — para anclar la "entrada" del
// idle NATIVO (ETH/HYPE, addr 0x0) a la entrada del wrapped (WETH/WHYPE) que sí
// depositan las posiciones; son el mismo activo 1:1.
const _WRAPPED_NATIVE = { ethereum: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", arbitrum: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", optimism: "0x4200000000000000000000000000000000000006", base: "0x4200000000000000000000000000000000000006", polygon: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270", bnb: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", hyperevm: "0x5555555555555555555555555555555555555555" };
// id de CoinGecko del NATIVO por chain — para el precio HISTÓRICO del wrapped-native
// (WHYPE/WETH) en chains que DefiLlama no cubre por dirección (HyperEVM) → la entrada.
const _NATIVE_CG_BY_CHAIN = { ethereum: "ethereum", arbitrum: "ethereum", optimism: "ethereum", base: "ethereum", polygon: "polygon-ecosystem-token", bnb: "binancecoin", hyperevm: "hyperliquid" };
// Precio histórico de un nativo vía DefiLlama por clave coingecko (chains sin soporte
// por dirección, p.ej. HyperEVM → coingecko:hyperliquid). 0 si falla.
async function defiLlamaHistCoingecko(cgId, ts) {
  try {
    const r = await fetch(`https://coins.llama.fi/prices/historical/${ts}/coingecko:${cgId}?searchWidth=4h`);
    if (!r.ok) return 0;
    const j = await r.json();
    const v = j && j.coins && j.coins[`coingecko:${cgId}`] && j.coins[`coingecko:${cgId}`].price;
    return (typeof v === "number" && isFinite(v)) ? v : 0;
  } catch (e) { return 0; }
}

async function enrichIdleIndicatorsEVM(owner) {
  const idle = state.idleTokens || [];
  if (!idle.length) return;
  // 1) Precio medio de ENTRADA por token desde los depósitos de las posiciones,
  //    a precio histórico DefiLlama del minteo. Usa p.deposited0/1 + p.openedAt →
  //    cubre RPC-direct Y subgraph (Arbitrum/Base), sin depender de explorerApi.
  const entryAgg = {}; // `${chainKey}:${addrLower}` -> {usd, amt}
  for (const p of (state.positions || [])) {
    if (p._lending || p.reconstructed || !p.openedAt) continue;
    if (!(p.deposited0 > 0) && !(p.deposited1 > 0)) continue;
    const onLlama = !!DEFILLAMA_CHAIN_PREFIX[p.chainKey];
    const px = onLlama ? await fetchDefiLlamaPrices(p.chainKey, [p.token0.id, p.token1.id], [p.openedAt]).catch(() => ({})) : {};
    const wrapped = (_WRAPPED_NATIVE[p.chainKey] || "").toLowerCase();
    const cgNative = _NATIVE_CG_BY_CHAIN[p.chainKey];
    let cgHist; // precio histórico del nativo (coingecko), perezoso
    const add = async (tk, amt) => {
      if (!(amt > 0) || !tk || !tk.id) return;
      const addr = tk.id.toLowerCase();
      let hp = onLlama ? px[`${addr}:${p.openedAt}`] : 0;
      // Fallback: el wrapped-native en chains sin DefiLlama por dirección (p.ej. WHYPE
      // en HyperEVM) usa el histórico del nativo vía coingecko → habilita "vs entrada".
      if (!(hp > 0) && addr === wrapped && cgNative) {
        if (cgHist === undefined) cgHist = await defiLlamaHistCoingecko(cgNative, p.openedAt);
        hp = cgHist;
      }
      if (!(hp > 0)) return;
      const k = `${p.chainKey}:${addr}`;
      const a = entryAgg[k] || (entryAgg[k] = { usd: 0, amt: 0 });
      a.usd += amt * hp; a.amt += amt;
    };
    await add(p.token0, p.deposited0); await add(p.token1, p.deposited1);
  }
  // 2) Adjuntar entryPx + range30d a los idle no-stable con valor. Nativos
  //    (ETH/HYPE/…) usan clave coingecko: para el rango (no tienen entrada).
  for (const t of idle) {
    if (_isStableEVMSym(t.symbol) || (t.valueUSD || 0) < 0.25) continue;
    const addr = (t.address || "").toLowerCase();
    const isNative = !addr || /^0x0+$/.test(addr) || t.native;
    let coinKey = null;
    if (isNative) {
      const cg = _NATIVE_CG[(t.symbol || "").toUpperCase()];
      if (cg) coinKey = `coingecko:${cg}`;
      // ETH/HYPE nativo ≈ su wrapped (WETH/WHYPE, 1:1): si depositaste el wrapped
      // en una posición, ancla la "entrada" del idle nativo a esa entrada.
      const wrapped = _WRAPPED_NATIVE[t.chain];
      if (wrapped) { const ea = entryAgg[`${t.chain}:${wrapped}`]; if (ea && ea.amt > 0 && ea.usd > 0) t.entryPx = ea.usd / ea.amt; }
    } else {
      const prefix = DEFILLAMA_CHAIN_PREFIX[t.chain];
      if (prefix) coinKey = `${prefix}:${addr}`;
      // Fallback termómetro: el WRAPPED-native (WHYPE) en chains que DefiLlama no
      // cubre por dirección (HyperEVM) usa la clave coingecko del nativo, igual que
      // el nativo (HYPE). Si no, WHYPE se quedaba sin rango 30d aunque HYPE sí.
      if (!coinKey && addr === (_WRAPPED_NATIVE[t.chain] || "").toLowerCase()) {
        const cg = _NATIVE_CG_BY_CHAIN[t.chain];
        if (cg) coinKey = `coingecko:${cg}`;
      }
      const ea = entryAgg[`${t.chain}:${addr}`];
      if (ea && ea.amt > 0 && ea.usd > 0) t.entryPx = ea.usd / ea.amt;
    }
    if (coinKey) { const rg = await defiLlamaRange30d(coinKey).catch(() => null); if (rg) t.range30d = rg; }
  }
}

// ============================================================================
// FEES COBRADAS A VALOR REALIZABLE (parte A wallet + parte B por posición)
// ============================================================================
// Modelo (igual que Solana): el valor de las fees cobradas de un token =
//   · lo que SIGUES teniendo idle  → a precio de HOY
//   · lo que VENDISTE a un stable  → al precio del día del swap (el USDC recibido)
// FIFO por token: los cobros (collect) alimentan el inventario; los swaps
// token→stable lo consumen (topado a lo cobrado, para que vender principal no
// infle las fees); el resto se valora a precio actual. Sustituye al feesUSD
// actual (que el subgraph valora "al cobrar" y HyperEVM "a hoy").

// Valora el inventario de fees de un token combinando cobros y swaps a stable.
function valueRealizableFeesForToken(events, currentPrice) {
  const evs = events.slice().sort((a, b) => (a.ts || 0) - (b.ts || 0));
  let inv = 0, realized = 0;
  for (const e of evs) {
    if (e.type === "collect") inv += e.amount;
    else if (e.amount > 0) { // swap token→stable
      const feePart = Math.min(e.amount, inv);
      if (feePart > 0) realized += feePart * (e.usdcOut / e.amount);
      inv -= feePart;
    }
  }
  return realized + inv * (currentPrice || 0);
}

// Detecta swaps token→stable del histórico COMPLETO de transfers ERC-20 del owner
// (Blockscout v2), agrupando por tx: si en una tx el owner ENVÍA un fee-token y
// RECIBE neto un stable → venta de ese token a USDC al precio de ese día.
// Devuelve { [addrLower]: [{ amountIn, usdcOut, ts }] }. Solo chains con blockscoutApi.
async function fetchOwnerSwapsEVM(chainKey, owner, feeTokenSet) {
  const c = state.chains[chainKey];
  if (!c || !c.blockscoutApi || !feeTokenSet || !feeTokenSet.size) return {};
  const ownerL = owner.toLowerCase();
  const MAX_PAGES = 20; // tope para acotar coste; se avisa si se trunca
  const base = `${c.blockscoutApi}/v2/addresses/${owner}/token-transfers?type=ERC-20`;
  let url = base;
  const byTx = new Map(); // txHash -> { ts, delta:{addr:amount}, sym:{addr:symbol} }
  let truncated = false;
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const r = await fetch(url);
      if (!r.ok) break;
      const j = await r.json();
      const items = j.items || [];
      for (const it of items) {
        const tk = it.token || {};
        const addr = (tk.address || tk.address_hash || "").toLowerCase();
        if (!addr) continue;
        const dec = Number(tk.decimals || 0);
        const rawVal = (it.total && it.total.value != null) ? it.total.value : it.value;
        if (rawVal == null) continue;
        let amt;
        try { amt = bigIntToDecimal(BigInt(rawVal), dec); } catch { amt = Number(rawVal) / 10 ** dec; }
        if (!isFinite(amt) || amt === 0) continue;
        const from = ((it.from && (it.from.hash || it.from)) || "").toLowerCase();
        const to = ((it.to && (it.to.hash || it.to)) || "").toLowerCase();
        const dir = (to === ownerL) ? 1 : (from === ownerL ? -1 : 0);
        if (!dir) continue;
        const txHash = it.tx_hash || it.transaction_hash || it.hash;
        if (!txHash) continue;
        let e = byTx.get(txHash);
        if (!e) { e = { ts: 0, delta: {}, sym: {} }; byTx.set(txHash, e); }
        e.delta[addr] = (e.delta[addr] || 0) + dir * amt;
        e.sym[addr] = tk.symbol || "";
        const ts = it.timestamp ? Math.floor(new Date(it.timestamp).getTime() / 1000) : 0;
        if (ts && (!e.ts || ts < e.ts)) e.ts = ts;
      }
      const np = j.next_page_params;
      if (!np) break;
      if (page === MAX_PAGES - 1) { truncated = true; break; }
      url = `${base}&${new URLSearchParams(np).toString()}`;
    }
  } catch (e) { console.warn(`[realizable-evm] transfers ${chainKey}:`, e?.message || e); }
  if (truncated) console.warn(`[realizable-evm] ${chainKey}: histórico de transfers truncado a ${MAX_PAGES} págs; algún swap antiguo de fees podría no detectarse.`);
  // ── LIMITACIONES CONOCIDAS del modelo realizable (documentadas para el futuro) ──
  // Una "venta" SOLO se detecta cuando el owner RECIBE un stable neto en la tx. NO se
  // reconocen como realización a precio de venta (quedan "retenidas" a precio de HOY):
  //   1) COMPOUND (re-depositar la fee al pool/posición): no recibes stable.
  //   2) MOVER la fee a OTRA WALLET: tampoco recibes stable → no es swap. Sigue
  //      valorada a precio de hoy en ESTA wallet (sobreestima si fue a un tercero; no
  //      se distingue "mi otra wallet" de un pago externo). Si la vendes desde la otra
  //      wallet, este análisis no lo ve.
  //   3) Swaps cuyo leg sea el NATIVO (ETH→…) no son transfers ERC-20 → no se ven.
  // MEJORA FUTURA: (a) lista de "direcciones propias" → transfers a ellas = movimiento
  // interno; (b) compound como evento explícito de fee.
  const swaps = {};
  for (const [, e] of byTx) {
    let stableIn = 0;
    for (const a in e.delta) if (_isStableEVMSym(e.sym[a]) && e.delta[a] > 0) stableIn += e.delta[a];
    if (stableIn <= 0) continue;
    let bestAddr = null, bestOut = 0;
    for (const a in e.delta) {
      if (_isStableEVMSym(e.sym[a])) continue;
      const out = -e.delta[a];
      if (out > 0 && feeTokenSet.has(a) && out > bestOut) { bestOut = out; bestAddr = a; }
    }
    if (bestAddr) (swaps[bestAddr] = swaps[bestAddr] || []).push({ amountIn: bestOut, usdcOut: stableIn, ts: e.ts });
  }
  return swaps;
}

// Parte A (total wallet) + parte B (por posición: reescribe feesUSD y recalcula
// PnL/APR). Debe ejecutarse DESPUÉS de buildPortfolioTimeline (que fija feesUSD).
async function enrichRealizableFeesEVM(owner) {
  state._feesRealizableUSD = null;
  const positions = (state.positions || []).filter((p) => !p._lending);
  if (!positions.length) return;
  // 1) Precio HOY + símbolo por token (clave chainKey:addr)
  const priceByTok = {}, symByTok = {};
  for (const p of positions) {
    for (const t of [p.token0, p.token1]) {
      if (!t || !t.id) continue;
      const k = `${p.chainKey}:${t.id.toLowerCase()}`;
      if (priceByTok[k] == null && typeof t.priceUSD === "number") priceByTok[k] = t.priceUSD;
      if (!symByTok[k]) symByTok[k] = t.symbol || "";
    }
  }
  // 2) Fees cobradas por token (wallet) + asegurar _feeAmtByToken por posición.
  //    Cobros reales (subgraph con snapshots) o lump en openedAt (resto / HyperEVM).
  const feeCollectsByTok = {}; // k -> [{amount, ts}]
  for (const p of positions) {
    if (!p._feeAmtByToken) {
      const m = {};
      if ((p.collectedFees0 || 0) > 0 && p.token0?.id) m[p.token0.id.toLowerCase()] = p.collectedFees0;
      if ((p.collectedFees1 || 0) > 0 && p.token1?.id) m[p.token1.id.toLowerCase()] = p.collectedFees1;
      p._feeAmtByToken = m;
    }
    let collects = p._feeCollects;
    if (!collects || !collects.length) {
      collects = [];
      const ts = p.openedAt || 0;
      for (const addr in p._feeAmtByToken) collects.push({ addr, amount: p._feeAmtByToken[addr], ts });
    }
    for (const c of collects) (feeCollectsByTok[`${p.chainKey}:${c.addr}`] = feeCollectsByTok[`${p.chainKey}:${c.addr}`] || []).push({ amount: c.amount, ts: c.ts });
  }
  // 3) Swaps token→stable por chain (solo con blockscoutApi)
  const chains = [...new Set(positions.map((p) => p.chainKey))];
  const swapsByTok = {};
  await Promise.all(chains.map(async (chainKey) => {
    const c = state.chains[chainKey];
    if (!c || !c.blockscoutApi) return;
    const feeSet = new Set();
    for (const k in feeCollectsByTok) {
      if (!k.startsWith(chainKey + ":")) continue;
      if (!_isStableEVMSym(symByTok[k])) feeSet.add(k.slice(chainKey.length + 1));
    }
    if (!feeSet.size) return;
    const sw = await fetchOwnerSwapsEVM(chainKey, owner, feeSet).catch(() => ({}));
    for (const addr in sw) swapsByTok[`${chainKey}:${addr}`] = sw[addr];
  }));
  // 4) Valor realizable por token
  const realizableByTok = {}, collectedTotalByTok = {};
  for (const k in feeCollectsByTok) {
    collectedTotalByTok[k] = feeCollectsByTok[k].reduce((s, c) => s + c.amount, 0);
    let v;
    if (_isStableEVMSym(symByTok[k])) { v = collectedTotalByTok[k]; } // stable ≈ $1
    else {
      const events = [];
      for (const c of feeCollectsByTok[k]) events.push({ type: "collect", amount: c.amount, ts: c.ts });
      for (const s of (swapsByTok[k] || [])) events.push({ type: "swap", amount: s.amountIn, usdcOut: s.usdcOut, ts: s.ts });
      v = valueRealizableFeesForToken(events, priceByTok[k] || 0);
    }
    realizableByTok[k] = v;
  }
  // 5) Re-atribuir por posición + recomputar PnL/APR
  for (const p of positions) {
    if (!p._feeAmtByToken || !Object.keys(p._feeAmtByToken).length) continue;
    let rf = 0, any = false;
    for (const addr in p._feeAmtByToken) {
      const k = `${p.chainKey}:${addr}`;
      const tot = collectedTotalByTok[k];
      if (tot > 0) { rf += (p._feeAmtByToken[addr] / tot) * (realizableByTok[k] || 0); any = true; }
    }
    if (!any) continue;
    p._feesAtCollectUSD = p.feesUSD; // referencia "al cobrar" para el tooltip
    p.feesUSD = rf;
    p.feesCollectedUSD = rf; // shim para shell.js
    p._feesRealizable = true;
    const pend = p.uncollectedUSD || 0;
    p.feesTotalUSD = rf + pend;
    // Recalcular PnL/APR SOLO si ya tenían valor fiable. Las reconstruidas quemadas
    // de HyperEVM dejan PnL como estaba (null): su depo/retiro es aproximado.
    if (p.pnlUSD != null) {
      p.pnlUSD = (p.currentValueUSD || 0) + (p.withdrawnUSD || 0) + rf + pend - (p.depositedUSD || 0);
      const aprBase = p.depositedUSD > 0 ? p.depositedUSD : (p.currentValueUSD || 0);
      if (p.ageDays && aprBase > 0) p.apr = ((rf + pend) / aprBase) * (365 / p.ageDays) * 100;
    }
  }
  // 6) Total wallet = Σ fees (realizable donde se pudo, original donde no)
  state._feesRealizableUSD = positions.reduce((s, p) => s + (p.feesUSD || 0), 0);
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
    let tokenDayDatasFailed = false;
    try { prices = await fetchTokenDayPrices(p.chainKey, [p.token0.id, p.token1.id], dates); }
    catch (e) { tokenDayDatasFailed = true; console.warn(`[tokenDayDatas] ${p.chainKey} #${p.nftId} fallo:`, e?.message || e); }
    const expectedKeys = dates.length * 2; // 2 tokens × N días
    let priceSource = "subgraph";
    // Fallback a DefiLlama si el subgraph devolvió poco o nada (típico de
    // subgraphs antiguos que ya no indexan tokenDayDatas recientes).
    // DefiLlama tiene precios históricos gratis y sin rate limit para los
    // tokens principales en las chains EVM más usadas.
    if (Object.keys(prices).length < expectedKeys / 2) {
      const llama = await fetchDefiLlamaPrices(p.chainKey, [p.token0.id, p.token1.id], dates);
      // Merge: el subgraph (si tenía algo) tiene preferencia; rellenamos huecos con DefiLlama.
      let added = 0;
      for (const [k, v] of Object.entries(llama)) {
        if (!(k in prices)) { prices[k] = v; added++; }
      }
      if (added > 0) {
        priceSource = Object.keys(prices).length > added ? "subgraph+defillama" : "defillama";
        console.log(`[priceAt] ${p.chainKey} #${p.nftId}: subgraph dio ${Object.keys(prices).length - added}/${expectedKeys}, DefiLlama añadió ${added} → total ${Object.keys(prices).length}/${expectedKeys}`);
      } else if (Object.keys(prices).length < expectedKeys) {
        console.log(`[priceAt] ${p.chainKey} #${p.nftId}: ${Object.keys(prices).length}/${expectedKeys} precios diarios (DefiLlama tampoco tenía datos)`);
      }
    }
    const t0 = (p.token0.id || "").toLowerCase(), t1 = (p.token1.id || "").toLowerCase();
    const priceAt = (tok, ts) => { const v = prices[`${tok}:${Math.floor(Number(ts) / 86400) * 86400}`]; return (v != null && isFinite(v)) ? v : null; };
    let pD0 = 0, pD1 = 0, pW0 = 0, pW1 = 0, pC0 = 0, pC1 = 0;
    let costBasis = 0, withdrawn = 0, fees = 0, anyHist = false, anyCur = false;
    const byDay = new Map();
    const feeCollects = []; // cobros reales por token+ts (para el valor realizable)
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
      const dC0 = Math.max(0, c0 - pC0), dC1 = Math.max(0, c1 - pC1);
      if (dC0 > 0 && t0) feeCollects.push({ addr: t0, amount: dC0, ts });
      if (dC1 > 0 && t1) feeCollects.push({ addr: t1, amount: dC1, ts });
      pD0 = d0; pD1 = d1; pW0 = w0; pW1 = w1; pC0 = c0; pC1 = c1;
      const day = Math.floor(ts * 1000 / 86400000) * 86400000;
      byDay.set(day, { depositedUSD: Math.max(0, costBasis - withdrawn), withdrawnUSD: withdrawn, feesUSD: fees });
    }
    if (costBasis > 0) { // fijar coste base/PnL históricos en la posición
      p.depositedUSD = costBasis;
      p.withdrawnUSD = withdrawn;
      p.pnlUSD = (p.currentValueUSD || 0) + withdrawn + fees + (p.uncollectedUSD || 0) - costBasis;
      // Tres estados explícitos para la card:
      //   "full"  → todo histórico (📜 visible, tooltip "dinero real ganado")
      //   "mixed" → algunos snapshots históricos + algunos current (tooltip "parcial")
      //   "none"  → tokenDayDatas no devolvió nada → todo es current
      //             (caso típico: rate limit en el proxy, o subgraph sin
      //             tokenDayDatas para esos tokens en esas fechas)
      p.histBasis = anyHist && !anyCur ? "full"
                  : anyHist           ? "mixed"
                  :                     "none";
      // Sobrescribe feesUSD (que enrichPosition había puesto = raw × precio
      // ACTUAL) con el valor histórico real: sum de las fees cobradas en
      // cada intervalo entre snapshots, valoradas al precio que tenían los
      // tokens EN EL MOMENTO de cada cobro. Refleja el USD real que ganaste,
      // no el valor actual si los tokens han subido/bajado desde entonces.
      // (Si histBasis === "none", `fees` será aritméticamente ≈ feesUSD
      // original — todos los precios cayeron al actual — así que sobrescribir
      // no cambia nada visible.)
      p.feesUSD = fees;
      p.feesCollectedUSD = fees; // shim para shell.js
    }
    // Cobros reales por token (para el valor realizable). Si los hubo, fijan también
    // _feeAmtByToken con los totales por token (pC0/pC1 = acumulado final).
    if (feeCollects.length) {
      p._feeCollects = feeCollects;
      const m = {};
      if (pC0 > 0 && t0) m[t0] = pC0;
      if (pC1 > 0 && t1) m[t1] = pC1;
      p._feeAmtByToken = m;
    }
    const points = [...byDay.entries()].map(([ts, v]) => ({ ts, ...v })).sort((a, c) => a.ts - c.ts);
    if (points.length) result.push({ posId: p.id, label: `${p.token0.symbol}/${p.token1.symbol}`, points, closed: !!p.closed });
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
  // Las cerradas SIEMPRE cuentan en los totales del resumen.
  const agg = aggregate(state.positions);
  document.getElementById("sum-positions").textContent = state.positions.length;
  document.getElementById("sum-positions-sub").textContent = agg.closed
    ? `${agg.open} abiertas · ${agg.closed} cerradas`
    : `${agg.open} abiertas`;
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
  const list = [...state.positions].sort(sorters[sortKey] || sorters.value);
  // Las cerradas (liquidez retirada) van a una sección colapsada aparte para no
  // estorbar; siguen contando en todos los cálculos (resumen, histórico…).
  const openList = list.filter((p) => !p.closed);
  const closedList = list.filter((p) => p.closed);

  const container = document.getElementById("positions-list");
  container.innerHTML = "";
  for (const p of openList) container.appendChild(positionCard(p));

  const closedSection = document.getElementById("closed-section");
  const closedContainer = document.getElementById("closed-list");
  if (closedContainer) closedContainer.innerHTML = "";
  if (closedSection) {
    if (closedList.length) {
      const totVal = closedList.reduce((s, p) => s + (p.currentValueUSD || 0), 0);
      const totFees = closedList.reduce((s, p) => s + (p.feesUSD || 0), 0);
      const cnt = document.getElementById("closed-count");
      if (cnt) cnt.textContent = `${closedList.length} · ${fmtUSD(totVal)} · ${fmtUSD(totFees)} fees`;
      for (const p of closedList) closedContainer.appendChild(positionCard(p));
      closedSection.classList.remove("hidden");
    } else {
      closedSection.classList.add("hidden");
    }
  }
}

// Devuelve { url, label } con el enlace a la web para gestionar la posición
// (Revert para Uniswap V3 en mainnet/arbitrum/op/poly/base/bnb, Hyperswap web
// para HyperEVM, Revert Lend para lending). Si no hay web conocida → null.
function managementLinkEVM(p) {
  if (p._lending) {
    return { url: "https://revert.finance/#/lending", label: "Revert Lend" };
  }
  if (p.chainKey === "hyperevm") {
    return { url: `https://app.hyperswap.exchange/#/pool/${p.nftId}`, label: "Hyperswap" };
  }
  return { url: `https://revert.finance/#/uniswap-position/${p.chainKey}/${p.nftId}`, label: "Revert" };
}

// HTML del footer "Gestionar en <plataforma> ↗" para insertar al final de cada card.
function managementFooterHTML(link) {
  if (!link) return "";
  return `
    <div class="flex justify-end pt-1">
      <a href="${link.url}" target="_blank" rel="noopener noreferrer"
         class="text-[11px] text-fuchsia-300 hover:text-fuchsia-200 inline-flex items-center gap-1">
        Gestionar en ${link.label} ↗
      </a>
    </div>`;
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
        <div class="text-[11px] text-slate-400">${p.ageDays ? `abierta ${new Date(p.openedAt * 1000).toISOString().slice(0, 10)} (${Math.round(p.ageDays)}d)` : ""}</div>
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
    </details>
    ${managementFooterHTML(managementLinkEVM(p))}`;
  return el;
}

// Barra gráfica de rango: precio min/max + marcador del precio actual.
// price(tick) = 1.0001^tick * 10^(dec0-dec1)  (token1 por token0)
// rangeBarHTML vive en common.js (compartido con sol/app.js).

// ============================================================================
// Log de eventos por posición (Deposit / Withdraw / Fee Collect / Compound)
// ============================================================================
// Convierte la lista de PositionSnapshots (cumulative) del subgraph en una
// lista de eventos discretos (delta entre snapshots consecutivos).
// Cada snapshot del subgraph se crea por una interacción (Mint/Burn/Collect),
// así que comparar contra el anterior nos da el "movimiento" de esa tx.
//
// Heurística de clasificación:
//   - Si subieron tanto `depositedToken*` como `collectedFeesToken*` en la
//     misma tx → es un Fee Compound (cobro + redepósito en una sola tx).
//   - Si subió solo `depositedToken*` → Deposit (capital aportado).
//   - Si subió solo `withdrawnToken*` → Withdraw (capital retirado).
//   - Si subió solo `collectedFeesToken*` → Fee Collect (cobro a wallet).
function classifyEvents(snapshots) {
  if (!snapshots || !snapshots.length) return [];
  const events = [];
  let pD0 = 0, pD1 = 0, pW0 = 0, pW1 = 0, pC0 = 0, pC1 = 0;
  for (const s of snapshots) {
    const d0 = Number(s.depositedToken0), d1 = Number(s.depositedToken1);
    const w0 = Number(s.withdrawnToken0 || 0), w1 = Number(s.withdrawnToken1 || 0);
    const c0 = Number(s.collectedFeesToken0), c1 = Number(s.collectedFeesToken1);
    const dDep0 = d0 - pD0, dDep1 = d1 - pD1;
    const dWdr0 = w0 - pW0, dWdr1 = w1 - pW1;
    const dCol0 = c0 - pC0, dCol1 = c1 - pC1;
    const isDep = dDep0 > 0 || dDep1 > 0;
    const isWdr = dWdr0 > 0 || dWdr1 > 0;
    const isCol = dCol0 > 0 || dCol1 > 0;
    const txHash = s.transaction?.id || "";
    const ts = Number(s.timestamp);
    if (isDep && isCol) {
      // Compound = cobro + redepósito en la misma tx. El "amount" del
      // evento es lo cobrado/redepositado (= los fees, no el total deposit).
      events.push({ ts, type: "compound", amount0: dCol0, amount1: dCol1, txHash });
    } else if (isDep) {
      events.push({ ts, type: "deposit", amount0: dDep0, amount1: dDep1, txHash });
    } else if (isWdr) {
      events.push({ ts, type: "withdraw", amount0: dWdr0, amount1: dWdr1, txHash });
    } else if (isCol) {
      events.push({ ts, type: "collect", amount0: dCol0, amount1: dCol1, txHash });
    }
    pD0 = d0; pD1 = d1; pW0 = w0; pW1 = w1; pC0 = c0; pC1 = c1;
  }
  return events;
}

// Variante para redes SIN subgraph (HyperEVM): clasifica los eventos crudos
// inc/dec/col del PositionManager (leídos por RPC, `p._rpcEvents`) al mismo
// shape que `classifyEvents` → reusa el render de eventLogHTML.
// Agrupa por tx porque un retiro on-chain = DecreaseLiquidity + Collect en la
// misma tx, y el Collect incluye principal + fees → fee = max(0, col − dec).
function classifyRpcEvents(rpcEvents, dec0, dec1) {
  if (!rpcEvents || !rpcEvents.length) return [];
  const toN = (v, d) => Number(v) / 10 ** d;
  const sub = (a, b) => (a > b ? a - b : 0n);
  const byTx = new Map();
  for (const e of rpcEvents) {
    const k = (e.tx || e.ts) + "";
    const g = byTx.get(k) || { ts: e.ts, tx: e.tx || "", inc0: 0n, inc1: 0n, dec0: 0n, dec1: 0n, col0: 0n, col1: 0n };
    if (e.type === "inc") { g.inc0 += e.a0; g.inc1 += e.a1; }
    else if (e.type === "dec") { g.dec0 += e.a0; g.dec1 += e.a1; }
    else if (e.type === "col") { g.col0 += e.a0; g.col1 += e.a1; }
    if (e.ts < g.ts) g.ts = e.ts;
    byTx.set(k, g);
  }
  const out = [];
  for (const g of byTx.values()) {
    const fee0 = sub(g.col0, g.dec0), fee1 = sub(g.col1, g.dec1);
    const hasInc = g.inc0 > 0n || g.inc1 > 0n;
    const hasFee = fee0 > 0n || fee1 > 0n;
    // Compound = en la MISMA tx se cobran fees (col − dec > 0) Y se aporta
    // liquidez (inc). Es una re-inversión de fees, no un depósito suelto + un
    // cobro suelto. El "amount" del evento es lo cobrado/reinvertido (las fees).
    if (hasInc && hasFee) {
      out.push({ ts: g.ts, type: "compound", amount0: toN(fee0, dec0), amount1: toN(fee1, dec1), txHash: g.tx });
      continue;
    }
    if (hasInc) out.push({ ts: g.ts, type: "deposit", amount0: toN(g.inc0, dec0), amount1: toN(g.inc1, dec1), txHash: g.tx });
    if (g.dec0 > 0n || g.dec1 > 0n) out.push({ ts: g.ts, type: "withdraw", amount0: toN(g.dec0, dec0), amount1: toN(g.dec1, dec1), txHash: g.tx });
    if (hasFee) out.push({ ts: g.ts, type: "collect", amount0: toN(fee0, dec0), amount1: toN(fee1, dec1), txHash: g.tx });
  }
  return out.sort((a, b) => a.ts - b.ts);
}

// Devuelve HTML para el accordion de logs. Usa snapshots del subgraph si los
// hay; si no (HyperEVM RPC-only) cae a los eventos crudos inc/dec/col.
function eventLogHTML(p) {
  const events = (p._snapshots && p._snapshots.length)
    ? classifyEvents(p._snapshots)
    : classifyRpcEvents(p._rpcEvents, Number(p.token0.decimals), Number(p.token1.decimals));
  if (!events.length) return "";

  // Cash flows = movimientos de capital (deposit/withdraw, no fees)
  // Fees = eventos de fees: "Fee Collect" (cobro simple) + "Fee Compound"
  // (cobro + re-inversión en la misma tx). La columna "Tipo" distingue ambos;
  // la pestaña se llama "Fees" porque agrupa los dos (antes decía
  // "Compoundings", lo que era falso para un cobro simple).
  const cashFlows = events.filter((e) => e.type === "deposit" || e.type === "withdraw");
  const compounds = events.filter((e) => e.type === "compound" || e.type === "collect");

  const chain = state.chains[p.chainKey] || {};
  const explorer = chain.explorer || "";
  const uid = `log-${p.chainKey}-${p.nftId}`;

  const typeLabel = {
    deposit:  `<span class="text-emerald-300 font-semibold">Deposit</span>`,
    withdraw: `<span class="text-rose-300 font-semibold">Withdraw</span>`,
    compound: `<span class="text-fuchsia-300 font-semibold">Fee Compound</span>`,
    collect:  `<span class="text-cyan-300 font-semibold">Fee Collect</span>`,
  };

  const fmtDate = (ts) => {
    // dd/mm/aaaa HH:mm (24h)
    const d = new Date(ts * 1000);
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
      + " " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false });
  };
  const fmtAmt = (n) => {
    if (!n || !isFinite(n)) return "—";
    if (n >= 1) return n.toFixed(4);
    if (n >= 0.0001) return n.toFixed(6);
    return n.toExponential(2);
  };
  const fmtTx = (h) => h
    ? `<a href="${explorer}/tx/${h}" target="_blank" class="font-mono text-fuchsia-300 hover:underline">${h.slice(0, 6)}…${h.slice(-4)}</a>`
    : `<span class="text-slate-600">—</span>`;

  const tableFor = (evts, emptyMsg) => {
    if (!evts.length) return `<div class="text-xs text-slate-500 italic py-3 text-center">${emptyMsg}</div>`;
    return `
      <div class="overflow-x-auto -mx-1 mt-1">
        <table class="text-[11px] w-full min-w-[420px]">
          <thead>
            <tr class="text-slate-500 text-left">
              <th class="px-2 py-1 font-medium whitespace-nowrap">Fecha</th>
              <th class="px-2 py-1 font-medium">Tipo</th>
              <th class="px-2 py-1 font-medium text-right">${p.token0.symbol}</th>
              <th class="px-2 py-1 font-medium text-right">${p.token1.symbol}</th>
              <th class="px-2 py-1 font-medium text-right">Tx</th>
            </tr>
          </thead>
          <tbody>
            ${evts.map((e) => `
              <tr class="border-t border-slate-800">
                <td class="px-2 py-1 text-slate-400 whitespace-nowrap">${fmtDate(e.ts)}</td>
                <td class="px-2 py-1 whitespace-nowrap">${typeLabel[e.type] || e.type}</td>
                <td class="px-2 py-1 font-mono text-slate-300 text-right">${fmtAmt(e.amount0)}</td>
                <td class="px-2 py-1 font-mono text-slate-300 text-right">${fmtAmt(e.amount1)}</td>
                <td class="px-2 py-1 text-right">${fmtTx(e.txHash)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  };

  return `
    <details class="text-xs">
      <summary class="text-slate-400 hover:text-slate-200">📜 logs (${events.length})</summary>
      <div class="mt-2">
        <div class="flex gap-1 border-b border-slate-800 mb-1 text-[11px]">
          <button data-tab-btn="cashflows" data-uid="${uid}" class="px-3 py-1.5 border-b-2 border-emerald-400 text-emerald-300 font-semibold">Cash flows (${cashFlows.length})</button>
          <button data-tab-btn="compounds" data-uid="${uid}" class="px-3 py-1.5 border-b-2 border-transparent text-slate-400 hover:text-slate-200">Fees (${compounds.length})</button>
        </div>
        <div data-tab-panel="cashflows" data-uid="${uid}">${tableFor(cashFlows, "Sin depósitos ni retiros registrados.")}</div>
        <div data-tab-panel="compounds" data-uid="${uid}" class="hidden">${tableFor(compounds, "Sin compounds ni cobros de fees registrados.")}</div>
      </div>
    </details>
  `;
}

// Ficha compacta para posiciones reconstruidas SIN datos de pool/tick (HyperEVM
// quemadas: el par se resolvió desde la 1ª tx, no hay tick/rango). Las
// reconstruidas de subgraph SÍ tienen tick → usan la ficha completa.
function reconstructedCardEvm(p) {
  const chain = state.chains[p.chainKey] || { name: p.chainKey, color: "#a78bfa" };
  const el = document.createElement("article");
  el.className = "rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3";
  el.style.borderLeft = "3px solid #a78bfa";
  el.dataset.reconstructed = "1";
  el.innerHTML = `
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full" style="background:${chain.color || "#a78bfa"}"></span>
          <span class="text-[11px] uppercase tracking-wide text-slate-400">${chain.name}</span>
          ${p.nftId ? `<span class="text-[11px] text-slate-500">· #${p.nftId}</span>` : ""}
        </div>
        <div class="font-semibold mt-0.5 flex items-center gap-1.5 min-w-0"><span class="truncate">${p.token0.symbol} / ${p.token1.symbol}</span>${poolPairChartHTML(p)}</div>
      </div>
      <div class="flex flex-col items-end gap-1 shrink-0">
        <span class="chip bg-slate-700 text-slate-300">cerrada</span>
        <span class="chip bg-violet-500/15 text-violet-300 border border-violet-500/30" title="Posición reconstruida del histórico on-chain (NFT quemado). Par resuelto desde la 1ª tx; fees e importes aproximados.">≈ reconstruida</span>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-2 text-xs">
      <div class="bg-slate-950/40 rounded-lg p-2">
        <div class="text-[10px] uppercase tracking-wide text-slate-500">Fees cobradas (aprox.)</div>
        <div class="font-semibold text-emerald-400">${fmtUSD(p.feesUSD || 0)}</div>
      </div>
      <div class="bg-slate-950/40 rounded-lg p-2">
        <div class="text-[10px] uppercase tracking-wide text-slate-500">Depositado / Retirado</div>
        <div class="font-semibold">${fmtUSD(p.depositedUSD || 0)} <span class="text-[10px] font-normal text-slate-400">depo</span></div>
        <div class="text-[10px] text-slate-400">${fmtUSD(p.withdrawnUSD || 0)} retirado</div>
      </div>
    </div>
    <div class="text-[10px] text-slate-500">Reconstruida del histórico on-chain (NFT quemado). Par resuelto desde la 1ª tx; importes aproximados.</div>
  `;
  return el;
}

function positionCard(p) {
  if (p._lending) return lendingCard(p);
  if (p.reconstructed && p.tick == null) return reconstructedCardEvm(p);
  const chain = state.chains[p.chainKey];
  const el = document.createElement("article");
  el.className = "rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3 hover:border-slate-700 transition";
  if (p.color) el.style.borderLeft = `3px solid ${p.color.line}`;

  const stateChip = p.closed
    ? `<span class="chip bg-slate-700 text-slate-300">cerrada</span>`
    : p.inRange
      ? `<span class="chip bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">en rango</span>`
      : `<span class="chip bg-amber-500/15 text-amber-300 border border-amber-500/30">fuera de rango</span>`;
  const reconChip = p.reconstructed
    ? `<span class="chip bg-violet-500/15 text-violet-300 border border-violet-500/30" title="Posición reconstruida del histórico on-chain (el NFT se quemó al cerrar). Fees cobradas e importes desde el subgraph; valor actual = 0.">≈ reconstruida</span>`
    : "";
  const rangeChip = reconChip ? `<div class="flex flex-col items-end gap-1 shrink-0">${stateChip}${reconChip}</div>` : stateChip;

  const date = new Date(p.openedAt * 1000).toISOString().slice(0, 10);

  el.innerHTML = `
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full" style="background:${p.color ? p.color.line : chain.color}"></span>
          <span class="text-[11px] uppercase tracking-wide text-slate-400">${chain.name}</span>
          <span class="text-[11px] text-slate-500">· #${p.nftId}</span>
        </div>
        <div class="font-semibold mt-0.5 flex items-center gap-1.5 min-w-0"><span class="truncate">${p.token0.symbol} / ${p.token1.symbol}</span>${poolPairChartHTML(p)}</div>
        <div class="text-[11px] text-slate-400">fee ${feeTierLabel(p.feeTier)} · abierta ${date} (${Math.round(p.ageDays)}d)</div>
      </div>
      ${rangeChip}
    </div>

    ${rangeBarHTML(p.tickLower, p.tickUpper, p.tick, p.token0.decimals, p.token1.decimals, p.inRange, p.closed, p.token0.symbol, p.token1.symbol)}

    <div class="grid grid-cols-2 gap-2 text-xs">
      <div class="bg-slate-950/40 rounded-lg p-2">
        <div class="text-[10px] uppercase tracking-wide text-slate-500">Valor actual</div>
        <div class="font-semibold">${fmtUSD(p.currentValueUSD)}</div>
        ${(() => {
          // % de cada token sobre el valor del pool. En concentrated liquidity
          // la composición cambia con el precio: posición en rango ≈ 50/50,
          // cerca del borde puede ir 90/10, fuera del rango 100% de un lado.
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
        <div class="text-[10px] uppercase tracking-wide text-slate-500">Fees <span class="cursor-help" title="${p._feesRealizable
          ? "Fees cobradas a VALOR REALIZABLE: lo que sigues teniendo idle valorado a precio de HOY + lo que vendiste a USDC valorado al precio del día del swap. 'Pendientes' usa precio actual."
          : p.histBasis === "full"
          ? "Fees cobradas valoradas con el precio de cada token EN EL MOMENTO de cada cobro (tokenDayDatas del subgraph). Refleja el dinero real ganado, no afectado por movimientos de precio posteriores."
          : p.histBasis === "mixed"
            ? "Fees cobradas valoradas parcialmente con precios históricos del subgraph y parcialmente con el precio actual (algunas fechas concretas no tenían dato histórico). 'Pendientes' siempre usa precio actual."
            : p.histBasis === "none"
              ? "Fees cobradas valoradas con el precio ACTUAL (tokenDayDatas no devolvió datos — el proxy puede haber saturado por rate limit, o el subgraph no expone precios para esos tokens). 'Pendientes' usa precio actual."
              : "Fees cobradas valoradas con el precio ACTUAL de los tokens (no se pudo cargar el histórico — posición sin snapshots, HyperEVM RPC-only, o error de red). NO refleja lo que valían cuando se cobraron. 'Pendientes' usa precio actual."}">ⓘ</span>${p._feesRealizable ? " <span title='Valor realizable'>💵</span>" : p.histBasis === "full" ? " <span title='Cálculo histórico'>📜</span>" : ""}</div>
        <div class="font-semibold text-emerald-400 leading-tight"${p._feesRealizable ? ` title="Valor ACTUAL de las fees cobradas (retenidas a precio de hoy + vendidas a USDC al precio del swap)${p._feesAtCollectUSD != null ? ` · al cobrar: ${fmtUSD(p._feesAtCollectUSD)}` : ""}"` : ""}>${fmtUSD(p.feesUSD)} <span class="text-[10px] font-normal text-slate-400">cobradas</span></div>
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
        ${pnlInBaseHTML(p.pnlUSD, p.token0.symbol, p.token1.symbol, p.token0.priceUSD, p.token1.priceUSD)}
        <div class="text-[10px] text-slate-400 mt-0.5">depo ${fmtUSD(p.depositedUSD)}</div>
        ${pnlBreakdownHTML(p.pnlUSD, p.ilUSD, (p.feesUSD || 0) + (p.uncollectedUSD || 0))}
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
    ${eventLogHTML(p)}
    ${managementFooterHTML(managementLinkEVM(p))}
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
  const subgraphPos = (state.positions || []).filter((p) => !p._lending && !p._rpcOnly && p.id);
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

    // Indicador idle "¿buen momento para pasar a USDC?" (entrada + rango 30d).
    // best-effort: nunca rompe el análisis si DefiLlama / histórico fallan.
    try { await enrichIdleIndicatorsEVM(addr); } catch (e) { console.warn("[idle-indicator-evm]", e); }

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
// Init
// ============================================================================

function init() {
  renderChainChips();
  document.getElementById("btn-settings").onclick = openSettings;
  document.getElementById("btn-analyze").onclick = analyze;
  document.getElementById("addr-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") analyze();
  });
  document.getElementById("sort-by").addEventListener("change", (e) => {
    state.sortBy = e.target.value;
    renderPositions();
  });

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
        reconstructed: !!p.reconstructed,
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
    } else if (d.type === "lp-invalidate-hist") {
      // Tras un cobro/compound, el módulo active/ (solo en [pro]) pide invalidar
      // el caché del histórico de una posición (clave `${apiBase}:${tokenId}`)
      // para que el siguiente análisis relea los eventos on-chain y muestre el
      // cobro nuevo en los logs sin esperar a que expire HIST_CACHE_TTL (10 min).
      // Si no viene tokenId, limpia todo el caché de histórico. En [main] nadie
      // envía este mensaje (no hay módulos active), así que es no-op.
      try {
        if (d.tokenId != null) {
          const suffix = ":" + String(d.tokenId);
          for (const k of [..._histCache.keys()]) if (k.endsWith(suffix)) _histCache.delete(k);
        } else {
          _histCache.clear();
        }
      } catch (_) {}
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
            // Incluimos también las cerradas (tienen snapshots históricos); siempre
            // cuentan en el Histórico (cada serie va tagueada con `closed`).
            // Solo posiciones LP de subgraph con id: las de lending (Revert Lend, sin
            // `id`, usan `vault`) y las RPC-only (HyperEVM, sin subgraph) no tienen
            // positionSnapshots → pedirlas daba warnings "#undefined"/"sin subgraph"
            // y peticiones fallidas. Su histórico ya viene por `timelineSeries`.
            const toFetch = (state.positions || [])
              .filter((p) => !p._lending && !p._rpcOnly && p.id && state.chains[p.chainKey]?.subgraphId)
              .slice(0, 20);
            if (toFetch.length) {
              const bundles = await Promise.all(toFetch.map(async (p) => {
                try {
                  const data = await gql(p.chainKey, SNAPSHOTS_QUERY, { positionId: p.id });
                  const snaps = data.positionSnapshots || [];
                  // Stash en la posición para que positionCard pueda renderizar
                  // el accordion de logs sin tener que volver a consultar.
                  p._snapshots = snaps;
                  return { position: p, snapshots: snaps };
                } catch (e) {
                  // Surface in console — antes era catch silencioso → la card
                  // mostraba "actual" sin pista del error de fondo.
                  console.warn(`[snapshots] failed for ${p.chainKey} #${p.nftId}:`, e?.message || e);
                  return { position: p, snapshots: [] };
                }
              }));
              const withSnaps = bundles.filter((b) => b.snapshots.length).length;
              console.log(`[timeline] ${withSnaps}/${bundles.length} posiciones con snapshots`);
              timeline = await buildPortfolioTimeline(bundles);
              // Diagnóstico final: cuántas terminaron con histBasis seteado
              const full   = bundles.filter((b) => b.position.histBasis === "full").length;
              const mixed  = bundles.filter((b) => b.position.histBasis === "mixed").length;
              const none   = bundles.filter((b) => b.position.histBasis === "none").length;
              const undef  = bundles.filter((b) => b.position.histBasis === undefined).length;
              console.log(`[timeline] histBasis: ${full} full · ${mixed} mixed · ${none} none (todo current por tokenDayDatas vacío) · ${undef} sin timeline (sin snapshots)`);
            }
          } catch (e) { console.warn("timeline build failed:", e); }
          // añadir series propias de HyperEVM (RPC) y lending (reconstruidas de eventos)
          for (const p of (state.positions || [])) {
            if (p.timelineSeries && p.timelineSeries.length) {
              const label = p._lending ? `Revert Lend ${p.chainName}` : `${p.token0.symbol}/${p.token1.symbol}`;
              timeline.push({ posId: p.id || p.vault || label, label, points: p.timelineSeries, closed: !!p.closed });
            }
          }
          // Fees cobradas a valor REALIZABLE (parte A+B). Después del timeline,
          // que es quien fija feesUSD por posición. best-effort: nunca rompe.
          try { await enrichRealizableFeesEVM(d.address); } catch (e) { console.warn("[realizable-evm]", e); }
          const status = (document.getElementById("status-msg") || {}).textContent || "";
          const analysisStatus = state.analysisStatus || { ok: true, errors: [] };
          const idleTokens = state.idleTokens || [];
          window.parent.postMessage({ type: "lp-result", app: "evm", reqId: d.reqId, address: d.address, items: toPortfolioItems(), status, timeline, analysisStatus, idleTokens, feesRealizableUSD: state._feesRealizableUSD }, "*");
        })
        .catch((err) => {
          window.parent.postMessage({ type: "lp-result", app: "evm", reqId: d.reqId, address: d.address, items: [], status: "error", error: String(err), idleTokens: [], analysisStatus: { ok: false, errors: [{ source: "EVM", reason: String(err) }] } }, "*");
        });
    }
  });
  try { window.parent.postMessage({ type: "lp-ready", app: "evm" }, "*"); } catch (e) {}
})();
