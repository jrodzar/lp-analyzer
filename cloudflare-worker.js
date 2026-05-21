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
 * 4. Pásame la URL del Worker y la pongo en PROXY_BASE de evm/app.js y sol/app.js.
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
    const fwdHeaders = { "Content-Type": "application/json" };
    const method = request.method;
    const body = method === "POST" ? await request.text() : undefined;

    try {
      if (seg[0] === "graph") {
        const id = seg.slice(1).join("/");
        if (!env.GRAPH_KEY) return json({ error: "GRAPH_KEY no configurada" }, 500, cors);
        target = `https://gateway.thegraph.com/api/${env.GRAPH_KEY}/subgraphs/id/${id}`;
      } else if (seg[0] === "helius-rpc") {
        if (!env.HELIUS_KEY) return json({ error: "HELIUS_KEY no configurada" }, 500, cors);
        target = `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_KEY}`;
      } else if (seg[0] === "helius-tx") {
        if (!env.HELIUS_KEY) return json({ error: "HELIUS_KEY no configurada" }, 500, cors);
        const owner = seg[1];
        const params = new URLSearchParams(url.search);
        params.set("api-key", env.HELIUS_KEY);
        target = `https://api.helius.xyz/v0/addresses/${owner}/transactions?${params.toString()}`;
      } else if (seg[0] === "birdeye") {
        if (!env.BIRDEYE_KEY) return json({ error: "BIRDEYE_KEY no configurada" }, 500, cors);
        const bpath = seg.slice(1).join("/");
        target = `https://public-api.birdeye.so/${bpath}${url.search}`;
        fwdHeaders["X-API-KEY"] = env.BIRDEYE_KEY;
        fwdHeaders["x-chain"] = "solana";
        fwdHeaders["accept"] = "application/json";
      } else {
        return new Response("Not found", { status: 404, headers: cors });
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

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
