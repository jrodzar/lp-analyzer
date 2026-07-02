/**
 * LP Analyzer — proxy en Cloudflare Workers.
 *
 * Oculta tus API keys (viven como variables del Worker, NO en el navegador) y
 * reenvía las peticiones a The Graph, Helius y Birdeye. Así los usuarios de la
 * app no necesitan ninguna key.
 *
 * ── Despliegue (todo desde el navegador, sin Node) ───────────────────────────
 * 1. dash.cloudflare.com → Workers & Pages → Create → Worker. Ponle un nombre
 *    (p. ej. "lp-proxy") y Deploy. Te dará una URL: https://lp-proxy.<sub>.workers.dev
 * 2. Edit code → pega TODO este archivo → Deploy.
 * 3. Settings → Variables and Secrets → añade (tipo "Secret"):
 *      GRAPH_KEY     = tu API key de The Graph
 *      HELIUS_KEY    = tu API key de Helius
 *      BIRDEYE_KEY   = tu API key de Birdeye   (opcional)
 *      ETHERSCAN_KEY = tu API key de Etherscan V2 (opcional; failover de getLogs
 *                      EVM. 1 key gratis cubre Ethereum/Arbitrum/Polygon/HyperEVM.
 *                      Base/BNB son de pago en Etherscan → usan thirdweb, ver abajo)
 *      THIRDWEB_CLIENT_ID = client id GRATIS de thirdweb.com (opcional; failover de
 *                      getLogs para Base/BNB, que Etherscan no cubre gratis. Crear en
 *                      thirdweb.com → Projects → Create → copiar Client ID)
 *    (opcional) ALLOWED_ORIGINS = "https://jrodzar.github.io,http://localhost:5180"
 *    (opcional) DAILY_LIMIT_GRAPH / DAILY_LIMIT_HELIUS / DAILY_LIMIT_BIRDEYE (números)
 * 4. Pásame la URL del Worker y la pongo en PROXY_BASE de evm/app.js y sol/app.js.
 *
 * ── Rate-limiting (proteger tus cuotas) ──────────────────────────────────────
 * Capa 1 (por IP): Settings → Bindings → "Rate limiting" → crea uno llamado RL
 *   (p. ej. 100 peticiones / 60 s). El código lo usa si existe (env.RL).
 * Capa 2 (tope diario por servicio): Settings → Bindings → "KV namespace" →
 *   crea uno y enlázalo con el nombre QUOTA. Topes por defecto: Graph 5000,
 *   Helius 5000, Birdeye 2000 al día (ajustables con las env DAILY_LIMIT_*).
 * Ambas capas son OPCIONALES: si no creas los bindings, el proxy funciona igual,
 * solo que sin límites.
 *
 * Rutas que expone:
 *   POST /graph/{subgraphId}      -> gateway.thegraph.com (GraphQL)
 *   POST /helius-rpc              -> mainnet.helius-rpc.com (JSON-RPC + DAS)
 *   GET  /helius-tx/{owner}?...   -> api.helius.xyz Enhanced Transactions
 *   GET  /birdeye/{path}?...      -> public-api.birdeye.so (añade X-API-KEY)
 *   GET  /evm/{chain}/{path}?... -> explorador EVM (Blockscout/Hyperscan) con
 *        timeout + failover de getLogs a Etherscan V2 + caché KV del histórico
 *   GET  /stock/{ticker}/{YYYY-MM-DD} -> Yahoo Finance daily close (cierre
 *        más cercano ≤ fecha pedida). Sin key. Cacheado en KV indefinidamente
 *        (price) o 24h (null). Pensado como fallback de Birdeye para xStocks
 *        (TSLAx, MSTRx, NVDAx, CRCLx…) cuyo histórico Birdeye no cubre.
 */

const DEFAULT_ALLOWED = [
  "https://jrodzar.github.io",
  "http://localhost:5180",
  "http://127.0.0.1:5180",
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGINS
      ? env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
      : DEFAULT_ALLOWED;
    const corsOrigin = allowed.includes(origin) ? origin : allowed[0];
    const cors = {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    // Defensa básica anti-abuso: solo orígenes permitidos (si mandan Origin)
    if (origin && !allowed.includes(origin)) {
      return new Response("Origin not allowed", { status: 403, headers: cors });
    }

    // ── Identidad: solo usuarios autenticados y autorizados (Firebase + allowlist) ──
    const PROJECT_ID = env.FIREBASE_PROJECT_ID || "lp-analyzer-jrodzar";
    const ADMIN_EMAIL = (env.ADMIN_EMAIL || "jrodzar@gmail.com").toLowerCase();
    const authz = request.headers.get("Authorization") || "";
    const idToken = authz.startsWith("Bearer ") ? authz.slice(7) : null;
    if (!idToken) return json({ error: "Inicia sesión para usar el servicio." }, 401, cors);
    const payload = await verifyFirebaseToken(idToken, PROJECT_ID);
    if (!payload || !payload.email) return json({ error: "Sesión inválida o expirada. Vuelve a iniciar sesión." }, 401, cors);
    if (!(await isEmailAllowed(payload.email, idToken, PROJECT_ID, ADMIN_EMAIL))) {
      return json({ error: "Tu cuenta no está autorizada." }, 403, cors);
    }

    const seg = url.pathname.replace(/^\/+/, "").split("/");
    let target = null;
    let service = null; // "graph" | "helius" | "birdeye" → para el tope diario
    const fwdHeaders = { "Content-Type": "application/json" };
    const method = request.method;
    const body = method === "POST" ? await request.text() : undefined;

    // ── Ruta especial /stock: no proxy genérico, sino fetch + parse CSV de
    // Stooq + cache KV indefinida. Sirve como fallback histórico de xStocks
    // (TSLAx, MSTRx…) que Birdeye no cubre. Auth aplicada arriba; aplicamos
    // RL por IP igual que las otras rutas. Sin tope diario propio: los hits
    // van casi siempre a cache KV.
    if (seg[0] === "stock") {
      if (env.RL) {
        const ip = request.headers.get("cf-connecting-ip") || "anon";
        try {
          const { success } = await env.RL.limit({ key: ip });
          if (!success) return json({ error: "Demasiadas peticiones. Espera un momento." }, 429, cors);
        } catch (e) { /* binding falla → no bloqueamos */ }
      }
      return await handleStockRequest(seg, cors, env);
    }

    // ── Ruta /evm: proxy de exploradores EVM (Blockscout/Hyperscan) con timeout
    // server-side + failover de getLogs a Etherscan V2 + caché KV del histórico.
    // Auth ya aplicada arriba; RL por IP igual que las demás. Additiva: no toca
    // las rutas existentes (nada la llama hasta que el cliente la enrute).
    if (seg[0] === "evm") {
      if (env.RL) {
        const ip = request.headers.get("cf-connecting-ip") || "anon";
        try {
          const { success } = await env.RL.limit({ key: ip });
          if (!success) return json({ error: "Demasiadas peticiones. Espera un momento." }, 429, cors);
        } catch (e) { /* binding falla → no bloqueamos */ }
      }
      return await handleEvmExplorer(seg, url, cors, env, ctx);
    }

    try {
      if (seg[0] === "graph") {
        const id = seg.slice(1).join("/");
        if (!env.GRAPH_KEY) return json({ error: "GRAPH_KEY no configurada" }, 500, cors);
        target = `https://gateway.thegraph.com/api/${env.GRAPH_KEY}/subgraphs/id/${id}`;
        service = "graph";
      } else if (seg[0] === "helius-rpc") {
        if (!env.HELIUS_KEY) return json({ error: "HELIUS_KEY no configurada" }, 500, cors);
        target = `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_KEY}`;
        service = "helius";
      } else if (seg[0] === "helius-tx") {
        if (!env.HELIUS_KEY) return json({ error: "HELIUS_KEY no configurada" }, 500, cors);
        const owner = seg[1];
        const params = new URLSearchParams(url.search);
        params.set("api-key", env.HELIUS_KEY);
        target = `https://api.helius.xyz/v0/addresses/${owner}/transactions?${params.toString()}`;
        service = "helius";
      } else if (seg[0] === "birdeye") {
        if (!env.BIRDEYE_KEY) return json({ error: "BIRDEYE_KEY no configurada" }, 500, cors);
        const bpath = seg.slice(1).join("/");
        target = `https://public-api.birdeye.so/${bpath}${url.search}`;
        fwdHeaders["X-API-KEY"] = env.BIRDEYE_KEY;
        fwdHeaders["x-chain"] = "solana";
        fwdHeaders["accept"] = "application/json";
        service = "birdeye";
      } else {
        return new Response("Not found", { status: 404, headers: cors });
      }

      // ── Capa 1: rate-limit por IP (binding nativo de Cloudflare "RL", opcional) ──
      if (env.RL) {
        const ip = request.headers.get("cf-connecting-ip") || "anon";
        try {
          const { success } = await env.RL.limit({ key: ip });
          if (!success) return json({ error: "Demasiadas peticiones. Espera un momento." }, 429, cors);
        } catch (e) { /* si el binding falla, no bloqueamos */ }
      }

      // ── Capa 2: tope diario global por servicio (KV "QUOTA", opcional) ──
      const dailyLimit = Number(env[`DAILY_LIMIT_${service.toUpperCase()}`] || DEFAULT_DAILY[service] || 0);
      if (env.QUOTA && dailyLimit > 0) {
        const ok = await checkAndIncDaily(env.QUOTA, service, dailyLimit);
        if (!ok) return json({ error: `Límite diario alcanzado para ${service}. Inténtalo mañana.` }, 429, cors);
      }

      const upstream = await fetch(target, { method, headers: fwdHeaders, body });
      const buf = await upstream.arrayBuffer();
      const headers = new Headers(cors);
      headers.set("Content-Type", upstream.headers.get("Content-Type") || "application/json");
      return new Response(buf, { status: upstream.status, headers });
    } catch (e) {
      return json({ error: String(e) }, 502, cors);
    }
  },
};

// Topes diarios por servicio por defecto (sobreescribibles con env DAILY_LIMIT_*)
const DEFAULT_DAILY = { graph: 5000, helius: 5000, birdeye: 2000 };

// Contador diario en KV. El plan gratuito de KV solo permite ~1000 escrituras/día,
// así que NO escribimos en cada petición: usamos muestreo (1 escritura cada SAMPLE
// peticiones, sumando SAMPLE), lo que mantiene el contador aproximado sin agotar la
// cuota de KV. Además es a prueba de fallos: si KV da error (p. ej. límite diario),
// devolvemos true (permitir) para NO romper la app.
async function checkAndIncDaily(kv, service, limit) {
  const SAMPLE = 25;
  const date = new Date().toISOString().slice(0, 10);
  const key = `q:${service}:${date}`;
  try {
    const cur = parseInt((await kv.get(key)) || "0", 10) || 0;
    if (cur >= limit) return false; // tope alcanzado
    if (Math.random() < 1 / SAMPLE) {
      await kv.put(key, String(cur + SAMPLE), { expirationTtl: 172800 });
    }
    return true;
  } catch (e) {
    return true; // cualquier error de KV → permitir, nunca bloquear por el contador
  }
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// ── /stock/{ticker}/{YYYY-MM-DD} ─────────────────────────────────────────────
// Cierre diario de la acción `ticker` para la fecha dada o el día hábil más
// cercano ≤ fecha. Sirve como fuente de precio histórico para xStocks
// (TSLAx → TSLA, MSTRx → MSTR, NVDAx → NVDA, CRCLx → CRCL…) que Birdeye no
// cubre históricamente.
//
// Fuente: Yahoo Finance v8 chart endpoint (sin key, JSON, fiable). Stooq
// fue descartado tras añadir captcha + API-key obligatorios server-side.
//
// Cache (KV `QUOTA` si está): clave `stock:{ticker}:{date}`.
//   - hits (price != null): TTL infinito (los cierres no cambian).
//   - misses (price = null): TTL 24 h (por si la fecha era pre-IPO o el
//     ticker aún no se reconoce y luego sí).
// ── EVM explorer proxy + failover ────────────────────────────────────────────
// Blockscout/Hyperscan keyless por chain. Etherscan V2 (chainid) SOLO como failover
// de getLogs y SOLO en chains de su tier GRATIS (Base/BNB/Optimism son de pago).
const EVM_BLOCKSCOUT = {
  ethereum: "https://eth.blockscout.com/api",
  arbitrum: "https://arbitrum.blockscout.com/api",
  polygon:  "https://polygon.blockscout.com/api",
  base:     "https://base.blockscout.com/api",
  hyperevm: "https://www.hyperscan.com/api",
};
const EVM_ETHERSCAN_FREE = { ethereum: 1, arbitrum: 42161, polygon: 137, hyperevm: 999 };
// Chains que Etherscan NO cubre gratis (Base/BNB) → failover de getLogs a thirdweb Insight.
const EVM_THIRDWEB_CHAINID = { base: 8453, bnb: 56 };

async function fetchTimeout(u, ms, opts) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(u, { ...(opts || {}), signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}
function rawJson(text, cors) {
  return new Response(text, { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
}
async function sha256hex(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// thirdweb Insight: failover de getLogs para chains sin Etherscan-free (Base/BNB),
// cuyo Blockscout va degradado. Lee address + topic0..3 del query estilo Blockscout y
// consulta /v1/events/{address} (historia completa, pagina por resultados). Normaliza
// al shape Blockscout/Etherscan {status,message,result:[{address,topics,data,blockNumber,
// timeStamp,transactionHash,logIndex,...}]} que el cliente ya parsea. Devuelve el JSON
// string, o null si falla (→ se cae a Blockscout). Requiere env.THIRDWEB_CLIENT_ID.
async function fetchThirdwebLogs(chain, search, env) {
  const cid = EVM_THIRDWEB_CHAINID[chain];
  const p = new URLSearchParams((search || "").replace(/^\?/, ""));
  const address = (p.get("address") || "").toLowerCase();
  if (!cid || !/^0x[0-9a-f]{40}$/.test(address)) return null;
  const endpoint = `https://${cid}.insight.thirdweb.com/v1/events/${address}`;
  const result = [];
  for (let page = 0; page < 10; page++) {            // tope 10 páginas (10k eventos) de seguridad
    const q = new URLSearchParams();
    q.set("chain_id", String(cid));
    for (let i = 0; i < 4; i++) { const t = p.get("topic" + i); if (t) q.set("filter_topic_" + i, t); }
    q.set("sort_by", "block_number");
    q.set("sort_order", "asc");
    q.set("limit", "1000");
    q.set("page", String(page));
    const r = await fetchTimeout(`${endpoint}?${q.toString()}`, 10000, { headers: { "x-client-id": env.THIRDWEB_CLIENT_ID } });
    if (!r.ok) return null;
    let j; try { j = JSON.parse(await r.text()); } catch (e) { return null; }
    const items = j && Array.isArray(j.data) ? j.data : null;
    if (items == null) return null;
    for (const e of items) {
      result.push({
        address: e.address,
        topics: Array.isArray(e.topics) ? e.topics : [],
        data: e.data || "0x",
        blockNumber: "0x" + Number(e.block_number).toString(16),
        timeStamp: "0x" + Number(e.block_timestamp).toString(16),
        transactionHash: e.transaction_hash,
        logIndex: "0x" + Number(e.log_index || 0).toString(16),
        transactionIndex: "0x" + Number(e.transaction_index || 0).toString(16),
        gasPrice: "0x0", gasUsed: "0x0",
      });
    }
    if (items.length < 1000) break;                  // última página (devolvió menos del límite)
  }
  return JSON.stringify({ status: "1", message: "OK", result });
}

// /evm/{chain}/{pathTrasBase}?{query}. El cliente manda la MISMA URL que ya
// construye para Blockscout, pero tras "/evm/{chain}/" en vez del host. Primario:
// Blockscout con timeout 12 s; si falla/timeout o un getLogs trae result NO-array
// (vacío de los días malos), failover de getLogs a Etherscan V2 (mismo shape, solo
// chains free). Cachea logs/transfers en KV 10 min (el histórico casi no cambia) →
// reanálisis y otros usuarios van instantáneos, esquivando la lentitud de Blockscout.
async function handleEvmExplorer(seg, url, cors, env, ctx) {
  const chain = seg[1] || "";
  const base = EVM_BLOCKSCOUT[chain];
  if (!base) return json({ error: "EVM chain no soportada: " + chain }, 400, cors);
  const extraPath = seg.slice(2).join("/");   // lo que va tras "{base}"
  const search = url.search || "";            // incluye el "?"
  const target = base + (extraPath ? "/" + extraPath : "") + search;

  const isLogs = /[?&]action=getLogs(&|$)/.test(search);
  const isTransfers = /token-transfers/.test(extraPath);
  // tokens idle (/v2/addresses/{a}/tokens) + addr-info (/v2/addresses/{a}) → también
  // se cachean (TTL corto): son la MAYORÍA de las llamadas y no cambian cada segundo.
  const isBalances = /^v2\/addresses\//.test(extraPath) && !isTransfers;
  const cacheable = isLogs || isTransfers || isBalances;
  // TTLs ORIGINALES restaurados (jul 2026): el bump ×3 de jun 2026 era un workaround del
  // tope GRATUITO de KV (1000 PUT/día); con Workers Paid (1M PUT/día, activado 2026-07-02)
  // ya no hace falta y prima la FRESCURA del histórico (cobros/adds visibles en ≤10min).
  //   · getLogs Base/BNB (thirdweb): 30min (histórico estable, query cara → mantener caliente).
  //   · resto getLogs/transfers: 10min (eventos pasados casi inmutables).
  //   · balances/idle: 2min (no cambian segundo a segundo).
  const cacheTtl = (isLogs && EVM_THIRDWEB_CHAINID[chain]) ? 1800 : (isLogs || isTransfers) ? 600 : 120;
  const cacheKey = cacheable ? "evm:" + chain + ":" + (await sha256hex(extraPath + search)) : null;

  // 1) Caché KV
  if (cacheKey && env.QUOTA) {
    try { const c = await env.QUOTA.get(cacheKey); if (c) return rawJson(c, cors); } catch (e) {}
  }

  let bodyText = null, okData = false, deferred = false;

  // 2a) getLogs de Base/BNB: su Blockscout va degradado y Etherscan los cobra → thirdweb
  //     Insight. Las queries CON datos responden ~1s; las VACÍAS (escaneo completo sin
  //     hallazgos) son lentas/variables (3-15s). Para no atascar el análisis: CARRERA de
  //     3.5s — si thirdweb responde rápido (caso con datos) lo servimos YA; si tarda,
  //     devolvemos vacío al instante y COMPLETAMOS en background (ctx.waitUntil → caché),
  //     de modo que el SIGUIENTE análisis lo tenga cacheado (TTL 30min). Una vez en caché,
  //     instantáneo. UNA sola petición a thirdweb (se reutiliza la misma promesa).
  if (isLogs && EVM_THIRDWEB_CHAINID[chain] && env.THIRDWEB_CLIENT_ID) {
    const twPromise = fetchThirdwebLogs(chain, search, env).catch(() => null);
    const winner = await Promise.race([twPromise, new Promise((res) => setTimeout(() => res("__t__"), 3500))]);
    if (winner && winner !== "__t__") {
      bodyText = winner; okData = true;                 // respondió rápido → servir (+ caché normal abajo)
    } else {
      if (ctx && ctx.waitUntil && cacheKey && env.QUOTA) {
        ctx.waitUntil(twPromise.then((tw) => tw && env.QUOTA.put(cacheKey, tw, { expirationTtl: cacheTtl })).catch(() => {}));
      }
      bodyText = JSON.stringify({ status: "1", message: "OK", result: [] }); // vacío temporal (NO se cachea)
      deferred = true;
    }
  }

  // 2b) Blockscout con timeout server-side (primario salvo que thirdweb resolviera o quede
  //     diferido). Más corto (7s) en chains CON failover Etherscan; 12s en Base/BNB. Para
  //     getLogs validamos que result sea array (si no → fallo → failover).
  if (!okData && !deferred) {
    const bsTimeout = EVM_ETHERSCAN_FREE[chain] ? 7000 : 12000;
    try {
      const r = await fetchTimeout(target, bsTimeout);
      if (r.ok) {
        bodyText = await r.text();
        if (isLogs) { try { okData = Array.isArray(JSON.parse(bodyText).result); } catch (e) { okData = false; } }
        else okData = true;
      }
    } catch (e) { /* timeout/red → failover */ }
  }

  // 2c) Failover de getLogs → Etherscan V2 (mismos params + chainid + apikey; mismo
  //    shape {status,message,result:[...]} que ya consume el cliente). Solo free.
  if (!okData && !deferred && isLogs && EVM_ETHERSCAN_FREE[chain] && env.ETHERSCAN_KEY) {
    try {
      const p = new URLSearchParams(search.replace(/^\?/, ""));
      p.set("chainid", String(EVM_ETHERSCAN_FREE[chain]));
      p.set("apikey", env.ETHERSCAN_KEY);
      const r2 = await fetchTimeout("https://api.etherscan.io/v2/api?" + p.toString(), 12000);
      if (r2.ok) {
        const t2 = await r2.text();
        try { if (Array.isArray(JSON.parse(t2).result)) { bodyText = t2; okData = true; } } catch (e) {}
      }
    } catch (e) {}
  }

  if (bodyText == null) return json({ error: "explorer EVM no disponible (" + chain + ")" }, 502, cors);
  // Cachear SOLO respuestas válidas (no errores ni getLogs vacíos/no-array).
  if (cacheKey && okData && env.QUOTA) {
    try { await env.QUOTA.put(cacheKey, bodyText, { expirationTtl: cacheTtl }); } catch (e) {}
  }
  return rawJson(bodyText, cors);
}

async function handleStockRequest(seg, cors, env) {
  const ticker = (seg[1] || "").toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
  const dateStr = seg[2] || "";
  if (!ticker || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return json({ error: "Bad request: /stock/{ticker}/{YYYY-MM-DD}" }, 400, cors);
  }
  const cacheKey = `stock:${ticker.toLowerCase()}:${dateStr}`;

  // 1) Cache KV
  if (env.QUOTA) {
    try {
      const cached = await env.QUOTA.get(cacheKey, { type: "json" });
      if (cached) return json(cached, 200, cors);
    } catch (e) { /* miss → seguimos */ }
  }

  // 2) Yahoo Finance: ventana ±14 días para captar fines de semana / festivos.
  // Endpoint: /v8/finance/chart/{TICKER}?period1=<unix>&period2=<unix>&interval=1d
  // Devuelve { chart: { result: [{ timestamp: [...], indicators: { quote: [{ close: [...] }] } }] } }
  const target = new Date(dateStr + "T00:00:00Z");
  const targetUnix = Math.floor(target.getTime() / 1000);
  const period1 = targetUnix - 14 * 86400;
  const period2 = targetUnix + 7 * 86400;
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${period1}&period2=${period2}&interval=1d`;
  let result = { price: null, date_used: null, source: "yahoo", ticker };
  try {
    const r = await fetch(yahooUrl, {
      headers: {
        // Yahoo a veces bloquea fetches sin UA. UA de browser estándar.
        "User-Agent": "Mozilla/5.0 (compatible; lp-analyzer-proxy)",
        "Accept": "application/json",
      },
    });
    if (r.ok) {
      const j = await r.json().catch(() => null);
      const data = j && j.chart && j.chart.result && j.chart.result[0];
      const ts = data && data.timestamp;
      const closes = data && data.indicators && data.indicators.quote && data.indicators.quote[0] && data.indicators.quote[0].close;
      if (Array.isArray(ts) && Array.isArray(closes) && ts.length === closes.length) {
        // Yahoo devuelve timestamps al inicio del día de mercado (~9:30 ET).
        // Para el matching usamos el día calendario UTC del timestamp.
        let best = null;
        for (let i = 0; i < ts.length; i++) {
          const close = closes[i];
          if (typeof close !== "number" || !isFinite(close)) continue;
          const day = new Date(ts[i] * 1000).toISOString().slice(0, 10);
          if (day <= dateStr) {
            if (!best || day > best.day) best = { day, close };
          }
        }
        // Si no hay día ≤ fecha (depo pre-IPO p. ej.), best-effort con el más antiguo > fecha
        if (!best) {
          for (let i = 0; i < ts.length; i++) {
            const close = closes[i];
            if (typeof close !== "number" || !isFinite(close)) continue;
            const day = new Date(ts[i] * 1000).toISOString().slice(0, 10);
            if (!best || day < best.day) best = { day, close };
          }
        }
        if (best) result = { price: best.close, date_used: best.day, source: "yahoo", ticker };
      } else if (j && j.chart && j.chart.error) {
        result.error = j.chart.error.code || "yahoo_error";
      }
    } else {
      result.error = `yahoo_http_${r.status}`;
    }
  } catch (e) {
    result.error = String(e);
  }

  // 3) Cache: hits forever, misses 24h
  if (env.QUOTA) {
    try {
      if (result.price != null) {
        await env.QUOTA.put(cacheKey, JSON.stringify(result));
      } else {
        await env.QUOTA.put(cacheKey, JSON.stringify(result), { expirationTtl: 86400 });
      }
    } catch (e) {}
  }
  return json(result, 200, cors);
}

// ── Verificación del ID token de Firebase (JWT RS256 firmado por Google) ──────
let _jwksCache = { keys: null, exp: 0 };
async function getGoogleJwks() {
  if (_jwksCache.keys && Date.now() < _jwksCache.exp) return _jwksCache.keys;
  const r = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
  const j = await r.json();
  _jwksCache = { keys: j.keys || [], exp: Date.now() + 3600 * 1000 }; // cache 1 h
  return _jwksCache.keys;
}
function b64urlToBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64urlToStr(s) { return new TextDecoder().decode(b64urlToBytes(s)); }

async function verifyFirebaseToken(token, projectId) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const header = JSON.parse(b64urlToStr(parts[0]));
    const payload = JSON.parse(b64urlToStr(parts[1]));
    if (header.alg !== "RS256" || !header.kid) return null;
    const now = Math.floor(Date.now() / 1000);
    if (payload.aud !== projectId) return null;
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
    if (!payload.exp || payload.exp < now) return null;
    if (!payload.sub) return null;
    const jwks = await getGoogleJwks();
    const jwk = jwks.find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const data = new TextEncoder().encode(parts[0] + "." + parts[1]);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(parts[2]), data);
    return ok ? payload : null;
  } catch (e) { return null; }
}

// ── ¿Email autorizado? admin siempre; resto, doc en la colección allowlist ────
const _allowCache = new Map(); // email -> expira(ms)
async function isEmailAllowed(email, idToken, projectId, adminEmail) {
  email = (email || "").toLowerCase();
  if (!email) return false;
  if (email === adminEmail) return true;
  const c = _allowCache.get(email);
  if (c && Date.now() < c) return true;
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/allowlist/${encodeURIComponent(email)}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
    if (r.status === 200) { _allowCache.set(email, Date.now() + 5 * 60 * 1000); return true; } // cache 5 min
    return false;
  } catch (e) { return false; }
}
