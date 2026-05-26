// wallet.js — Conector universal de wallets (Opción C: híbrido).
//
// Estrategia: solo nos activamos cuando NO hay provider inyectado (ni
// window.ethereum ni window.solana). Cuando hay extensión / in-app browser,
// dejamos pasar al flujo existente (iframe → connectWallet/connectPhantom).
//
// Casuística que cubrimos:
//   1. Desktop con extensión          → no actuamos (flujo iframe actual)
//   2. Desktop sin extensión          → modal de WalletConnect con QR
//   3. Móvil dentro de in-app browser → no actuamos (flujo iframe actual)
//   4. Móvil sin provider             → bottom sheet con opciones:
//                                         - Deep link a app de wallet
//                                         - WalletConnect (te quedas en Safari)
//
// API pública (en window.LPWallet):
//   .available(chain)         → boolean: hay provider inyectado para ese chain
//   .needsFallback()          → boolean: estamos en escenario 2 o 4
//   .connectFallback(chain)   → Promise<{address, source} | null>
//
// shell.js consulta needsFallback() antes de delegar al iframe; si true,
// llama a connectFallback() y luego propaga la address al iframe vía postMessage.

(function () {
  "use strict";

  // ==========================================================================
  // Config — el Project ID NO es secreto (es un identificador público).
  // La seguridad real son los dominios autorizados en cloud.reown.com.
  // ==========================================================================
  const REOWN_PROJECT_ID = "65a721820e05e4d459c48725643fdada";

  const IS_MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent || ""
  );

  // ==========================================================================
  // Detección de provider inyectado
  // ==========================================================================
  function hasEvmProvider() {
    return typeof window.ethereum !== "undefined";
  }
  function hasSolProvider() {
    return typeof window.solana !== "undefined" && window.solana.isPhantom;
  }
  function available(chain) {
    return chain === "evm" ? hasEvmProvider() : hasSolProvider();
  }
  function needsFallback(chain) {
    // Si no se pasa chain, devolvemos true si AL MENOS uno necesita fallback.
    if (!chain) return !hasEvmProvider() || !hasSolProvider();
    return !available(chain);
  }

  // ==========================================================================
  // Deep links — URLs canónicas (Universal Links iOS / App Links Android)
  // ==========================================================================
  function currentUrl() {
    // URL absoluta sin fragmento, que es lo que aceptan los deep links.
    return location.origin + location.pathname + location.search;
  }
  function dlPhantom() {
    const u = encodeURIComponent(currentUrl());
    return `https://phantom.app/ul/browse/${u}?ref=${u}`;
  }
  function dlMetaMask() {
    const u = new URL(currentUrl());
    return `https://metamask.app.link/dapp/${u.host}${u.pathname}${u.search}`;
  }
  function dlTrustWallet() {
    return `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(currentUrl())}`;
  }
  function dlRainbow() {
    return `https://rnbwapp.com/open?url=${encodeURIComponent(currentUrl())}`;
  }
  function dlCoinbaseWallet() {
    return `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(currentUrl())}`;
  }

  // NOTA importante sobre Rabby Mobile: NO tiene Universal Link tipo
  // "abre tu navegador interno con esta URL" como sí tienen MetaMask y
  // Phantom. Rabby Mobile conecta a dApps exclusivamente vía WalletConnect.
  // Por eso NO aparece en la lista de deep links — el usuario con Rabby
  // Mobile debe usar el botón "WalletConnect" del fondo del bottom sheet.
  function evmWalletOptions() {
    return [
      { id: "mm",       name: "MetaMask",        icon: "🦊", url: dlMetaMask() },
      { id: "trust",    name: "Trust Wallet",    icon: "🛡️", url: dlTrustWallet() },
      { id: "rainbow",  name: "Rainbow",         icon: "🌈", url: dlRainbow() },
      { id: "coinbase", name: "Coinbase Wallet", icon: "🔵", url: dlCoinbaseWallet() },
    ];
  }
  function solWalletOptions() {
    return [
      { id: "phantom", name: "Phantom", icon: "assets/wallets/phantom.svg", url: dlPhantom() },
    ];
  }

  // ==========================================================================
  // Bottom sheet (móvil) — DOM puro, sin libs
  // ==========================================================================
  function buildOptionHTML(opt) {
    const iconHtml = opt.icon.startsWith("assets/")
      ? `<img src="${opt.icon}" alt="${opt.name}" class="w-7 h-7">`
      : `<span class="text-2xl">${opt.icon}</span>`;
    return `
      <button data-action="deeplink" data-id="${opt.id}"
              class="lpw-opt w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-700 border border-slate-700 text-left">
        <span class="w-8 h-8 flex items-center justify-center">${iconHtml}</span>
        <div class="flex-1">
          <div class="font-medium text-slate-100">${opt.name}</div>
          <div class="text-[11px] text-slate-400">Abre la app y conecta</div>
        </div>
        <span class="text-slate-500">→</span>
      </button>`;
  }

  function showMobileSheet(chain) {
    return new Promise((resolve) => {
      const opts = chain === "evm" ? evmWalletOptions() : solWalletOptions();
      const chainLabel = chain === "evm" ? "EVM" : "Solana";

      // Solo EVM tiene "nota Rabby" — para SOL Phantom sí tiene deep link.
      const rabbyHint = chain === "evm"
        ? `<p class="text-[11px] text-amber-300/80 bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-2"><strong>¿Rabby Mobile?</strong> Usa <strong>WalletConnect</strong> abajo — Rabby Mobile no abre dApps directamente, solo via WalletConnect.</p>`
        : "";

      const overlay = document.createElement("div");
      overlay.className =
        "fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center";
      overlay.innerHTML = `
        <div class="lpw-sheet bg-slate-900 border-t border-slate-700 sm:border sm:rounded-2xl rounded-t-2xl w-full sm:max-w-md p-5 space-y-3 max-h-[85vh] overflow-y-auto">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-semibold text-slate-100">Conectar wallet ${chainLabel}</h3>
            <button class="lpw-close text-slate-400 hover:text-slate-100 text-2xl leading-none">×</button>
          </div>
          <p class="text-xs text-slate-400">Pulsa una wallet para abrir su app:</p>
          <div class="space-y-2">${opts.map(buildOptionHTML).join("")}</div>
          ${rabbyHint}
          <div class="border-t border-slate-700 pt-3">
            <button data-action="wc"
                    class="lpw-opt w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left">
              <span class="w-8 h-8 flex items-center justify-center text-2xl">🔗</span>
              <div class="flex-1">
                <div class="font-medium text-slate-100">WalletConnect</div>
                <div class="text-[11px] text-slate-400">Quédate en este navegador (escanea / link) — Rabby, Frame, Ledger…</div>
              </div>
              <span class="text-slate-500">→</span>
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const cleanup = () => overlay.remove();
      overlay.onclick = (e) => {
        if (e.target === overlay) {
          cleanup();
          resolve(null);
        }
      };
      overlay.querySelector(".lpw-close").onclick = () => {
        cleanup();
        resolve(null);
      };
      overlay.querySelectorAll(".lpw-opt").forEach((btn) => {
        btn.onclick = () => {
          const action = btn.dataset.action;
          if (action === "wc") {
            cleanup();
            connectViaWalletConnect(chain).then(resolve, () => resolve(null));
          } else {
            // Deep link — el usuario sale del navegador, no podemos resolver.
            // Marcamos en sessionStorage que estaba conectando, así si vuelve
            // (no es típico en deep link) podemos mostrar feedback.
            try {
              sessionStorage.setItem("lpw:pending-connect", chain);
            } catch (_) {}
            cleanup();
            window.location.href = btn.querySelector("[data-url]")?.dataset.url
              || opts.find((o) => o.id === btn.dataset.id).url;
            // Promesa nunca resolverá (la página se descarga). Lo dejamos colgado.
          }
        };
      });
    });
  }

  // ==========================================================================
  // WalletConnect (vía Reown AppKit) — lazy load
  // ==========================================================================
  // Resolución defensiva de un export desde un módulo ESM. Reown publica las
  // clases como named exports, pero esm.sh a veces las envuelve en .default
  // dependiendo de versión / bundle. Probamos los dos caminos.
  function pickExport(mod, name) {
    return mod?.[name] || mod?.default?.[name] || (typeof mod?.default === "function" ? mod.default : null);
  }

  let _appKitPromise = null;
  async function ensureAppKit() {
    if (_appKitPromise) return _appKitPromise;
    _appKitPromise = (async () => {
      // Cargamos Reown AppKit y adapters desde esm.sh (auto-bundle deps).
      // ~250 KB total minified. Solo se descarga si el usuario llega aquí.
      const VER = "1.7.6"; // versión pinneada para estabilidad
      const [appkitMod, ethersAdapterMod, solanaAdapterMod, networksMod] = await Promise.all([
        import(`https://esm.sh/@reown/appkit@${VER}?bundle`),
        import(`https://esm.sh/@reown/appkit-adapter-ethers@${VER}?bundle`),
        import(`https://esm.sh/@reown/appkit-adapter-solana@${VER}?bundle`).catch((e) => {
          console.warn("[wallet] Solana adapter falló, sigo solo con EVM:", e);
          return null;
        }),
        import(`https://esm.sh/@reown/appkit@${VER}/networks?bundle`),
      ]);

      const createAppKit = pickExport(appkitMod, "createAppKit");
      const EthersAdapter = pickExport(ethersAdapterMod, "EthersAdapter");
      const SolanaAdapter = solanaAdapterMod ? pickExport(solanaAdapterMod, "SolanaAdapter") : null;

      // Debug: si algún constructor falta, lo logueamos antes de petar.
      if (!createAppKit || !EthersAdapter) {
        console.error("[wallet] Reown exports mal resueltos", {
          createAppKit: typeof createAppKit,
          EthersAdapter: typeof EthersAdapter,
          SolanaAdapter: typeof SolanaAdapter,
          appkitKeys: Object.keys(appkitMod || {}),
          ethersKeys: Object.keys(ethersAdapterMod || {}),
        });
        throw new Error("Reown AppKit: no pude resolver createAppKit/EthersAdapter");
      }

      const {
        mainnet, arbitrum, optimism, polygon, base, bsc,
        solana,
      } = networksMod;

      // Construir adapters defensivamente
      const adapters = [];
      try { adapters.push(new EthersAdapter()); }
      catch (e) { console.error("[wallet] EthersAdapter ctor falló:", e); }
      if (SolanaAdapter) {
        try { adapters.push(new SolanaAdapter()); }
        catch (e) { console.warn("[wallet] SolanaAdapter ctor falló, sigo solo con EVM:", e); }
      }

      const networks = [mainnet, arbitrum, optimism, polygon, base, bsc];
      if (SolanaAdapter && solana) networks.push(solana);

      const appKit = createAppKit({
        adapters,
        projectId: REOWN_PROJECT_ID,
        networks,
        defaultNetwork: mainnet,
        metadata: {
          name: "Booster Crypto LP Analyzer",
          description: "Analiza posiciones de liquidez en Uniswap V3 y Solana",
          url: location.origin,
          icons: [location.origin + "/favicon.svg"],
        },
        features: {
          analytics: false, // no enviamos analytics a Reown
          email: false,     // no usamos social/email login
          socials: false,
        },
      });
      return appKit;
    })();
    return _appKitPromise;
  }

  async function connectViaWalletConnect(chain) {
    const appKit = await ensureAppKit();
    return new Promise((resolve) => {
      // Abre el modal. AppKit detecta móvil vs desktop y muestra QR o deep links.
      const namespace = chain === "evm" ? "eip155" : "solana";
      appKit.open({ view: "Connect", namespace });

      // Escucha cambios de cuenta — cuando el handshake termina, recibimos address.
      const unsub = appKit.subscribeAccount((acc) => {
        if (acc?.isConnected && acc?.address) {
          unsub?.();
          appKit.close();
          resolve({
            address: acc.address,
            source: "walletconnect",
            chain,
          });
        }
      });

      // Si el usuario cierra el modal sin conectar, también resolvemos null.
      const unsubState = appKit.subscribeState?.((s) => {
        if (!s?.open) {
          // Pequeño delay por si el cierre coincide con un connect tardío.
          setTimeout(() => {
            const acc = appKit.getAccount?.();
            if (!acc?.isConnected) {
              unsub?.();
              unsubState?.();
              resolve(null);
            }
          }, 300);
        }
      });
    });
  }

  // ==========================================================================
  // Entry point — usado por shell.js
  // ==========================================================================
  async function connectFallback(chain) {
    // Si por alguna razón hay provider, no deberíamos estar aquí; degradamos.
    if (available(chain)) return null;

    if (IS_MOBILE) {
      // Móvil sin provider → ofrecer deep links + WalletConnect
      return showMobileSheet(chain);
    }
    // Desktop sin extensión → ir directos a WalletConnect (modal con QR)
    return connectViaWalletConnect(chain);
  }

  // ==========================================================================
  // Exposición pública
  // ==========================================================================
  window.LPWallet = {
    available,
    needsFallback,
    connectFallback,
    IS_MOBILE,
    _PROJECT_ID: REOWN_PROJECT_ID, // debug
  };
})();
