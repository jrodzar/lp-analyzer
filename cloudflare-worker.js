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
 */

const DEFAULT_ALLOWED = [
  "https://jrodzar.github.io",
  "http://localhost:5180",
  "http://127.0.0.1:5180",
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGINS
      ? env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
      : DEFAULT_ALLOWED;
    const corsOrigin = allowed.includes(origin) ? origin : allowed[0];
    const cors = {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    // Defensa básica anti-abuso: solo orígenes permitidos (si mandan Origin)
    if (origin && !allowed.includes(origin)) {
      return new Response("Origin not allowed", { status: 403, headers: cors });
    }

    const seg = url.pathname.replace(/^\/+/, "").split("/");
    let target = null;
    let service = null; // "graph" | "helius" | "birdeye" → para el tope diario
    const fwdHeaders = { "Content-Type": "application/json" };
    const method = request.method;
    const body = method === "POST" ? await request.text() : undefined;

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
