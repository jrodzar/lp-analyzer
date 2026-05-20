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
  },
  arbitrum: {
    name: "Arbitrum",
    short: "ARB",
    color: "#28A0F0",
    subgraphId: "3V7ZY6muhxaQL5qvntX1CFXJ32W7BxXZTGTwmpH5J4t3",
    explorer: "https://arbiscan.io",
    tickField: "scalar", // tickLower/Upper son BigInt directo
    rpcUrl: "https://arb1.arbitrum.io/rpc",
  },
  optimism: {
    name: "Optimism",
    short: "OP",
    color: "#FF0420",
    subgraphId: "Cghf4LfVqPiFw6fp6Y5X5Ubc8UpmUhSfJL82zwiBFLaj",
    explorer: "https://optimistic.etherscan.io",
    nativeUsdField: "ethPriceUSD",
  },
  polygon: {
    name: "Polygon",
    short: "POL",
    color: "#8247E5",
    subgraphId: "3hCPRGf4z88VC5rsBKU5AA9FBBq5nF3jbKJG7VZCbhjm",
    explorer: "https://polygonscan.com",
    nativeUsdField: "ethPriceUSD",
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
  },
  bnb: {
    name: "BNB Chain",
    short: "BNB",
    color: "#F3BA2F",
    subgraphId: "F85MNzUGYqgSHSHRGgeVMNsdnW1KtZSVgFULumXRZTw2",
    explorer: "https://bscscan.com",
    nativeUsdField: "ethPriceUSD",
  },
  hyperevm: {
    name: "HyperEVM",
    short: "HYPER",
    color: "#97FCE4",
    subgraphId: "", // sin subgraph público todavía — pega uno propio si tienes
    explorer: "https://hyperevmscan.io",
    placeholder: true,
  },
};

const GATEWAY = "https://gateway.thegraph.com/api";
const DEFAULTS_VERSION = 7; // bump cuando cambien IDs por defecto para forzar refresh

// ============================================================================
// State
// ============================================================================

const state = {
  apiKey: localStorage.getItem("lp:apiKey") || "",
  chains: loadChainConfig(),
  // hyperevm queda fuera del default (placeholder, sin subgraph público)
  selectedChains: JSON.parse(localStorage.getItem("lp:selectedChains") || "null") || Object.keys(DEFAULT_CHAINS).filter((k) => !DEFAULT_CHAINS[k].placeholder),
  address: "",
  connectedAddress: null,
  positions: [],
  loading: false,
  error: null,
  sortBy: "value",
  hideClosed: false,
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
  if (!state.apiKey) throw new Error("Falta API key de The Graph (Settings).");
  const url = `${GATEWAY}/${state.apiKey}/subgraphs/id/${chain.subgraphId}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
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

async function rpcEthCall(rpcUrl, to, data) {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_call",
      params: [{ to, data }, "latest"],
      id: 1,
    }),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`RPC ${json.error.code}: ${json.error.message}`);
  return json.result;
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

/**
 * Para cada posición sin uncollected calculado (chains con tickField scalar),
 * obtenemos los feeGrowthOutside por RPC y recomputamos.
 */
async function backfillUncollectedFromRPC(positions, onProgress) {
  // agrupamos por pool para cachear ticks repetidos
  const tickCache = new Map(); // key: chain|pool|tickIdx → outside data
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
      try {
        const [lo, up] = await Promise.all([getTick(p.tickLower), getTick(p.tickUpper)]);
        // parcheamos raw a la forma "object variant" y recomputamos
        p.raw.tickLower = { tickIdx: String(p.tickLower), ...lo };
        p.raw.tickUpper = { tickIdx: String(p.tickUpper), ...up };
        const dec0 = Number(p.token0.decimals);
        const dec1 = Number(p.token1.decimals);
        const uc = computeUncollectedFees(p.raw, dec0, dec1);
        if (uc) {
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
  return `${sign}$${abs.toExponential(2)}`;
}

function fmtPct(n) {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
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

function feeTierLabel(bps) {
  return `${(bps / 10000).toFixed(2)}%`;
}

function shortAddr(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function pnlColor(n) {
  if (!isFinite(n)) return "text-slate-400";
  if (n > 0) return "text-emerald-400";
  if (n < 0) return "text-rose-400";
  return "text-slate-300";
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
  document.getElementById("cfg-api-key").value = state.apiKey;
  const container = document.getElementById("chain-config");
  container.innerHTML = "";
  for (const key of Object.keys(state.chains)) {
    const c = state.chains[key];
    const row = document.createElement("div");
    row.className = "space-y-1";
    const explorerUrl = `https://thegraph.com/explorer?search=uniswap+v3+${encodeURIComponent(c.name.toLowerCase().replace(" chain", ""))}`;
    const placeholderText = c.placeholder ? "sin subgraph público — pega uno propio" : "subgraph ID";
    const initialStatus = c.placeholder && !c.subgraphId ? "⚠ no configurado" : "—";
    const initialStatusClass = c.placeholder && !c.subgraphId ? "text-[10px] text-amber-400" : "text-[10px] text-slate-500";
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

  if (!state.apiKey) {
    state.apiKey = document.getElementById("cfg-api-key").value.trim();
  }
  if (!state.apiKey) {
    statusEl.textContent = "✗ falta API key arriba";
    statusEl.className = "text-[10px] text-rose-400";
    state.chains[chainKey].subgraphId = previousId;
    return;
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
    const unconfigured = !c.subgraphId;
    const btn = document.createElement("button");
    btn.title = unconfigured ? "Sin subgraph configurado — abre Settings para añadir uno" : c.name;
    btn.className = `chip border ${active ? "border-fuchsia-500 bg-fuchsia-500/15 text-fuchsia-200" : "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"}`;
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
  document.getElementById("sum-positions-sub").textContent = `${agg.open} abiertas · ${agg.closed} cerradas`;
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

function positionCard(p) {
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

    <div class="grid grid-cols-2 gap-2 text-xs">
      <div class="bg-slate-950/40 rounded-lg p-2">
        <div class="text-[10px] uppercase tracking-wide text-slate-500">Valor actual</div>
        <div class="font-semibold">${fmtUSD(p.currentValueUSD)}</div>
        <div class="text-[10px] text-slate-400 mt-0.5">${fmtToken(p.amounts.amount0, p.token0.symbol)}</div>
        <div class="text-[10px] text-slate-400">${fmtToken(p.amounts.amount1, p.token1.symbol)}</div>
      </div>
      <div class="bg-slate-950/40 rounded-lg p-2">
        <div class="text-[10px] uppercase tracking-wide text-slate-500">Fees</div>
        <div class="font-semibold text-emerald-400">${fmtUSD(p.feesUSD)}</div>
        <div class="text-[10px] text-amber-300 mt-0.5">${p.uncollectedUSD === null ? "pend: n/d" : "pend: " + fmtUSD(p.uncollectedUSD)}</div>
        <div class="text-[10px] text-slate-400">APR ~ ${isFinite(p.apr) ? p.apr.toFixed(1) + "%" : "—"}</div>
      </div>
      <div class="bg-slate-950/40 rounded-lg p-2">
        <div class="text-[10px] uppercase tracking-wide text-slate-500">IL vs HODL</div>
        <div class="font-semibold ${pnlColor(p.ilUSD)}">${fmtUSD(p.ilUSD)}</div>
        <div class="text-[10px] ${pnlColor(p.ilUSD)} mt-0.5">${fmtPct(p.ilPct)}</div>
      </div>
      <div class="bg-slate-950/40 rounded-lg p-2">
        <div class="text-[10px] uppercase tracking-wide text-slate-500">PnL neto</div>
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

function renderCharts() {
  const section = document.getElementById("charts-section");
  if (!state.positions.length) { section.classList.add("hidden"); return; }
  section.classList.remove("hidden");
  renderValueChart();
  // fees chart se renderiza tras cargar snapshots
}

function renderValueChart() {
  const top = [...state.positions]
    .sort((a, b) => b.currentValueUSD - a.currentValueUSD)
    .slice(0, 8);
  const labels = top.map((p) => `${p.token0.symbol}/${p.token1.symbol} #${p.nftId.slice(-4)}`);
  const data = top.map((p) => p.currentValueUSD);
  const bg = top.map((p) => (p.color ? p.color.line : state.chains[p.chainKey].color));

  if (charts.value) charts.value.destroy();
  charts.value = new Chart(document.getElementById("chart-value"), {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "Valor (USD)", data, backgroundColor: bg, borderRadius: 6 }],
    },
    options: chartBaseOptions(),
  });
}

// Color distinto por pool usando el ángulo áureo para máxima separación visual
function distinctColor(i) {
  const hue = Math.round((i * 137.508) % 360);
  return { line: `hsl(${hue} 70% 60%)`, fill: `hsl(${hue} 70% 60% / 0.15)` };
}

// Asigna un color estable a cada posición (mismo color en tarjetas y gráficos)
function assignColors(list) {
  list.forEach((p, i) => { p.color = distinctColor(i); });
}

function renderFeesChart(snapshotBundles) {
  const datasets = snapshotBundles.map((b, idx) => {
    const p = b.position;
    const points = b.snapshots.map((s) => {
      const f0 = Number(s.collectedFeesToken0);
      const f1 = Number(s.collectedFeesToken1);
      const usd = f0 * p.token0.priceUSD + f1 * p.token1.priceUSD;
      return { x: Number(s.timestamp) * 1000, y: usd };
    });
    const c = p.color || distinctColor(idx);
    return {
      label: `${p.token0.symbol}/${p.token1.symbol} #${p.nftId.slice(-4)}`,
      data: points,
      borderColor: c.line,
      backgroundColor: c.fill,
      tension: 0.2,
      pointRadius: 0,
      borderWidth: 2,
    };
  });
  if (charts.fees) charts.fees.destroy();
  charts.fees = new Chart(document.getElementById("chart-fees"), {
    type: "line",
    data: { datasets },
    options: chartBaseOptions({ time: true }),
  });
}

function chartBaseOptions({ time = false } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: "#cbd5e1", font: { size: 10 } } },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${fmtUSD(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      x: time
        ? { type: "linear", ticks: { color: "#94a3b8", callback: (v) => new Date(v).toISOString().slice(0, 10) }, grid: { color: "#1e293b" } }
        : { ticks: { color: "#94a3b8" }, grid: { color: "#1e293b" } },
      y: { ticks: { color: "#94a3b8", callback: (v) => fmtUSD(v) }, grid: { color: "#1e293b" } },
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
  if (!state.apiKey) { setStatus("Falta API key. Abre Settings y pega la tuya.", "err"); openSettings(); return; }
  if (!state.selectedChains.length) { setStatus("Selecciona al menos una red.", "err"); return; }

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
    assignColors(state.positions);

    const skippedNote = skipped.length ? ` (saltadas: ${skipped.map((s) => state.chains[s.chainKey].name).join(", ")})` : "";
    if (errors.length) {
      setStatus(`Algunas redes fallaron: ${errors.map((e) => `${state.chains[e.chainKey].name}`).join(", ")}.${skippedNote} Revisa la consola para detalle.`, "err");
    } else if (positions.length === 0) {
      setStatus(`Sin posiciones de Uniswap V3 para ${shortAddr(addr)} en las redes seleccionadas.${skippedNote}`, "info");
    } else {
      setStatus(`${positions.length} posiciones encontradas en ${new Set(positions.map((p) => p.chainKey)).size} red(es).${skippedNote}`, "ok");
    }

    renderAll();

    if (positions.length) {
      // snapshots para el chart de fees (en background)
      fetchSnapshotsForChart(positions).then((bundles) => {
        renderFeesChart(bundles.filter((b) => b.snapshots.length));
      });

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

  if (!state.apiKey) {
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
  style.textContent = "header{display:none!important}#addr-block{display:none!important}#input-section{margin-top:0}";
  document.head.appendChild(style);
  document.documentElement.classList.add("embedded");
  function notifyWallet() {
    const addr = (typeof state !== "undefined" && state.connectedAddress) || null;
    try { window.parent.postMessage({ type: "lp-wallet", app: "evm", address: addr }, "*"); } catch (e) {}
  }
  // Normaliza las posiciones EVM para el portfolio del shell
  function toPortfolioItems() {
    return (state.positions || []).map((p) => ({
      kind: "evm",
      venue: (state.chains[p.chainKey] && state.chains[p.chainKey].name) || p.chainKey,
      pair: `${p.token0.symbol}/${p.token1.symbol}`,
      valueUSD: p.currentValueUSD || 0,
      feesUSD: p.feesUSD || 0,
      feesPendingUSD: p.uncollectedUSD == null ? null : p.uncollectedUSD,
      ilUSD: p.ilUSD == null ? null : p.ilUSD,
      pnlUSD: p.pnlUSD == null ? null : p.pnlUSD,
      inRange: !!p.inRange,
      closed: !!p.closed,
      id: String(p.nftId || ""),
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
        .then(() => {
          const status = (document.getElementById("status-msg") || {}).textContent || "";
          window.parent.postMessage({ type: "lp-result", app: "evm", reqId: d.reqId, address: d.address, items: toPortfolioItems(), status }, "*");
        })
        .catch((err) => {
          window.parent.postMessage({ type: "lp-result", app: "evm", reqId: d.reqId, address: d.address, items: [], status: "error", error: String(err) }, "*");
        });
    }
  });
  // tras el reconect silencioso, avisar del estado al shell
  setTimeout(notifyWallet, 1500);
  try { window.parent.postMessage({ type: "lp-ready", app: "evm" }, "*"); } catch (e) {}
})();
