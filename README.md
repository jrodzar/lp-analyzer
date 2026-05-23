# Booster Crypto PRO — LP Analyzer

Web app para **analizar posiciones de liquidez** (LP) de una o varias wallets, multi-chain. Sin backend propio, sin instalación, sin servidor que custodie tus datos.

🔗 **App publicada:** https://jrodzar.github.io/lp-analyzer/
*(acceso restringido a los alumnos del curso Booster Crypto PRO — el registro está limitado por whitelist)*

---

## Qué hace

- **EVM** — Uniswap V3 en Ethereum, Arbitrum, Optimism, Polygon, Base y BNB Chain · **HyperEVM** (lectura on-chain directa) · **Revert Lend** (lending vaults ERC-4626).
- **Solana** — Orca Whirlpools y Raydium CLMM, leídos directamente del programa (sin SDK pesado).
- Por cada posición: **valor actual**, **fees cobradas vs pendientes**, **APR de fees**, **IL vs HODL**, **PnL neto**, **range bar** visual con tu posición dentro/fuera del rango.
- **Tokens "idle"**: además de las LPs, cada dirección muestra los tokens que están sueltos en el wallet (fuera de posiciones) con su valor en USD. Solana vía Helius DAS + Jupiter; EVM vía Blockscout + DefiLlama (sin claves extra).
- **Tres vistas**:
  1. **Quick** — análisis de una wallet.
  2. **Portfolio** — varias wallets agregadas, con drag-and-drop para ordenar.
  3. **Histórico** — evolución del capital aportado vs valor acumulado, fees y curvas IL en el tiempo (eventos on-chain reales — EVM, HyperEVM, Revert Lend, Solana vía Birdeye).
- **Multi-dispositivo**: login con Google + Firestore → tu portfolio te sigue entre PC / móvil / tablet.
- **Instalable como app (PWA)**: en Chrome aparece el botón "Instalar" en la barra; en iPhone, desde Safari → Compartir → "Añadir a pantalla de inicio". Se abre a pantalla completa, sin barra de URL.
- **Auto-actualización** configurable (5 min por defecto) y refresh manual.
- **Exportación CSV** del portfolio.

---

## Privacidad y seguridad

- 🔒 **Cifrado E2E** — tu portfolio (las direcciones que añades) se cifra en el navegador con **AES-GCM** + clave derivada por **PBKDF2** de una contraseña que solo tú conoces. Lo que se almacena en Firestore es opaco; ni el admin del proyecto puede leer tus wallets.
- 🛡️ **Control de acceso por whitelist** — el registro está restringido a emails autorizados. Las reglas de Firestore son la barrera real (no solo el check en JS). Sirve también para proteger las APIs externas de uso indiscriminado.
- 🧱 **Proxy con rate-limiting** — las API keys (The Graph, Helius, Birdeye) se guardan en un Cloudflare Worker que verifica el ID token de Firebase en cada petición, aplica rate-limit por IP y un tope diario por servicio.
- 👁️ **Solo lectura** — la app no firma transacciones jamás. Conectar Rabby/Phantom es opcional: puedes pegar las direcciones a mano.

> Si pierdes la contraseña de cifrado **no se puede recuperar**. Hay un botón "Olvidé mi contraseña → empezar de cero" que borra tus direcciones cifradas para poder volver a entrar (no recupera las que tenías).

### ⚙ Settings — usa tus propias API keys (opcional)

En Portfolio hay un botón **"⚙ Settings"** donde cualquier usuario puede pegar **sus propias claves** de The Graph, Helius y/o Birdeye:

- Si las dejas en blanco → la app usa el **proxy compartido** (lo normal, no tienes que hacer nada).
- Si pegas tu clave → la app la usa **en vez del proxy** para esa API, consumiendo de tu propia cuota.

Las claves se guardan **cifradas en Firestore** con el **mismo cifrado E2E que tus direcciones** (AES-GCM + clave PBKDF2 derivada de tu contraseña). Esto significa:
- ✅ **Multi-dispositivo**: tus claves te siguen al móvil/PC/tablet sin tener que reintroducirlas.
- ✅ **Ni el admin ni Firebase pueden leerlas** — solo tu navegador, después de desbloquear el portfolio con tu contraseña.
- ⚠️ Si pierdes la contraseña de cifrado, también pierdes acceso a las claves (igual que al resto del portfolio).

Útil si ya tienes claves propias, si el proxy se satura, o si prefieres no depender del proxy compartido.

---

## Arquitectura

```
┌────────────────────────────────────────────────────────┐
│           index.html + shell.js (SHELL)                 │
│  Login, portfolio CRUD, resúmenes agregados, histórico  │
└────────────────────┬───────────────────────────────────┘
                     │  postMessage
       ┌─────────────┴─────────────┐
       ▼                           ▼
┌──────────────┐            ┌──────────────┐
│  evm/ engine │            │  sol/ engine │
│  (Uniswap V3 │            │  (Orca +     │
│  + HyperEVM  │            │  Raydium CLMM│
│  + Revert)   │            │  + Birdeye)  │
└──────┬───────┘            └──────┬───────┘
       │                           │
       └───── Cloudflare Worker ───┘
                (API keys hidden + rate-limit + Firebase auth)
```

- **Sin Node / sin build step.** Todo es HTML + JS estático servido desde GitHub Pages. Las librerías cargan por CDN (`@noble`, Chart.js, Firebase v10 modular, Tailwind).
- Las **wallets se reconstruyen on-chain**: en EVM vía subgraphs de The Graph y RPC directo (HyperEVM, Revert); en Solana vía Helius RPC + decode Borsh manual.
- El **PnL neto** se calcula a partir de eventos históricos (mints, collects, withdraws en EVM; transacciones enriquecidas en Solana) valuados a precios del día.
- Los **fees pendientes** en Solana incluyen tanto los liquidados (`feeOwedA/B`) como los devengados pero no liquidados (calculados leyendo los tick arrays y replicando la fórmula `feeGrowthInside` on-chain).

---

## Stack

| Capa | Tech |
|---|---|
| Frontend | HTML + JS vanilla, Tailwind CSS, Chart.js |
| Auth | Firebase Auth (Google) |
| Storage | Firestore (E2E cifrado) |
| Solana | `@noble/hashes` + `@noble/curves`, base58 + PDA + Borsh manuales |
| EVM | The Graph subgraphs, JSON-RPC directo, Blockscout para HyperEVM |
| Tokens idle (EVM) | Blockscout v2 (`/api/v2/addresses/{addr}/tokens`) + DefiLlama Prices para los que falten |
| Histórico Solana | Birdeye historical_price_unix |
| Histórico EVM | tokenDayDatas del subgraph |
| Proxy | Cloudflare Workers (verificación de Firebase ID token + rate-limit por IP + cuota KV diaria) |
| Hosting | GitHub Pages (estático, `.nojekyll`) |

---

## Limitaciones honestas

- **PnL no incluye gas.** En EVM se reconstruye con eventos del subgraph; en Solana con las txs enriquecidas de Helius. Es una estimación.
- **Tokens idle en BNB Chain**: no soportados todavía (BNB no tiene una instancia oficial de Blockscout). Las posiciones LP en BNB sí se analizan normal.
- **Tokens sin histórico** (RWA, tokens nuevos) se omiten del PnL/IL en Solana porque Birdeye no tiene su precio en la fecha del depósito.
- **APIs gratuitas** — bajo carga alta pueden saturarse (rate-limits). El proxy aplica retries + rotación de endpoints donde es posible.
- **Read-only.** No hay funcionalidad para abrir/cerrar/rebalancear posiciones desde la app.

---

## ¿Quieres auto-hostarte tu propia versión?

El código es abierto, así que cualquiera puede levantar su propia instancia con su Firebase y su Cloudflare Worker:

1. **Fork** este repo.
2. **Crea un proyecto en Firebase**: habilita Google Auth + Firestore, copia las reglas de [CLAUDE.md](CLAUDE.md) y cambia el `ADMIN_EMAIL` en `shell.js` por el tuyo.
3. Embebe tu `firebaseConfig` en `shell.js` (constante `DEFAULT_FB_CONFIG`).
4. **Despliega el Cloudflare Worker** (`cloudflare-worker.js`) con tus API keys en variables de entorno y pon su URL en `PROXY_BASE` (en `evm/app.js` y `sol/app.js`).
5. **Activa GitHub Pages** apuntando a la rama `main`.

Toda la documentación de arquitectura y comandos está en [CLAUDE.md](CLAUDE.md).

---

## Disclaimer

Esta herramienta es **solo informativa**. No es asesoramiento financiero. Los números mostrados son estimaciones reconstruidas a partir de datos públicos on-chain y de APIs externas — pueden tener errores, retrasos o tokens no soportados. Comprueba siempre en el DEX original antes de tomar decisiones.

---

*Construido junto a [Claude](https://claude.com) (Anthropic) — sí, este README también 😄*
