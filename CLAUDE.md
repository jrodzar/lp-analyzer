# LP Analyzer — contexto del proyecto

App web (sin backend propio) para analizar posiciones de liquidez de una wallet, en
**EVM (Uniswap V3, multi-red)** y **Solana (Orca Whirlpools + Raydium CLMM)**, con
modo multiusuario por **login de Google (Firebase)** y portfolios guardados.

> Entorno del autor: Windows, **sin Node/npm**. Todo es HTML + JS servido estático.
> Las librerías se cargan por CDN. No hay build step.

## Cómo arrancar

```
python -m http.server 5180
```
Abrir `http://localhost:5180`. (En Claude Code: usar el botón de preview; hay
`.claude/launch.json` configurado para el puerto 5180.)

## Arquitectura

- **Shell** (`index.html` + `shell.js`): barra superior, pestañas **Quick** y
  **Portfolio**, login Google, gestión del portfolio, vista agregada y gráficos.
- **Engines** (en iframes), cada uno es una app completa autónoma:
  - `evm/` — Uniswap V3 vía subgraphs de The Graph (6 redes). Wallet: Rabby/MetaMask.
  - `sol/` — Orca + Raydium leyendo on-chain vía Helius RPC + DAS. Wallet: Phantom.
- El shell habla con los engines por **`postMessage`**. En modo Quick muestra el
  iframe; en modo Portfolio los usa "headless" (ocultos, siguen computando) y
  renderiza él mismo el resultado agregado.

### Protocolo postMessage (shell → engine)
- `lp-analyze {address}` — análisis visible (modo Quick).
- `lp-portfolio-analyze {reqId, address}` — análisis headless; el engine responde
  `lp-result {reqId, address, items, status}` con posiciones **normalizadas**.
- `lp-set-chains {chains}` (EVM) / `lp-set-protocols {protocols}` (SOL) — fija qué
  redes/protocolos analizar (según preferencias del usuario).
- `lp-open-settings`, `lp-connect-wallet`, `lp-disconnect-wallet`.

### Engine → shell
- `lp-ready {app}`, `lp-wallet {app, address}`, `lp-result {...}`.

### Item normalizado del portfolio
`{ kind: "evm"|"sol", venue, pair, valueUSD, feesUSD, feesPendingUSD, ilUSD, pnlUSD, inRange, closed, id }`

## Setup que el usuario hace en el navegador (no está en el código)

1. **Firebase**: Portfolio → "Configúralo aquí" → pegar `firebaseConfig`.
   - Firebase Console: habilitar **Authentication → Google**, crear **Firestore**.
   - **Reglas Firestore** (obligatorias, son la barrera real de acceso): ver sección
     "Control de acceso (whitelist de emails)" más abajo. No basta el check en JS.
2. **API keys**: por defecto **NO hacen falta** — la app usa el proxy de Cloudflare
   (ver sección "Proxy de API keys"). Cada usuario puede, opcionalmente, poner su
   propia key en Settings (se guarda en localStorage) para usar su cuota:
   - The Graph (Quick → EVM → ⚙) para Uniswap V3.
   - Helius (Quick → SOL → ⚙) para Solana RPC/DAS. Birdeye (opcional) para histórico.

## Proxy de API keys (Cloudflare Workers)

Para que los usuarios no necesiten keys, las peticiones a The Graph, Helius y Birdeye
pasan por un **Worker de Cloudflare** (`cloudflare-worker.js`) que guarda las keys como
variables de entorno y las inyecta server-side. Así las keys nunca están en el navegador.

- **Worker**: `cloudflare-worker.js` (instrucciones de despliegue dentro del archivo).
  Variables a definir en el Worker: `GRAPH_KEY`, `HELIUS_KEY`, `BIRDEYE_KEY`,
  y opcional `ALLOWED_ORIGINS`. Rutas: `/graph/{id}`, `/helius-rpc`,
  `/helius-tx/{owner}`, `/birdeye/{path}`.
- **Cliente**: constante `PROXY_BASE` en `evm/app.js` y `sol/app.js` (override por
  `localStorage["lp:proxyBase"]`). Lógica: si el usuario tiene su key → llamada directa;
  si no y hay `PROXY_BASE` → vía proxy; si no hay ninguno → error pidiendo configurar.
- Tras desplegar el Worker hay que poner su URL en `PROXY_BASE` de **ambos** engines.

## Modelo de datos (Firestore)
```
users/{uid} → {
  portfolioEnc: { iv, ct },   // portfolio cifrado E2E (AES-GCM); addresses+labels
  encSalt,                    // salt PBKDF2 (no secreto)
  prefs:     { chains: [...], protocols: [...] },   // no sensible, en claro
  prefsVersion
}
allowlist/{emailEnMinusculas} → { addedAt, addedBy }   // whitelist de acceso
```
**Cifrado E2E** (shell.js): el portfolio se cifra en el navegador con AES-GCM, clave
derivada por PBKDF2 de una contraseña que el usuario define y que **nunca** se envía.
El dueño del proyecto Firebase NO puede leer las direcciones (solo ve `portfolioEnc`).
Opción "recordar en este dispositivo" guarda la clave derivada en localStorage
(`lp:enckey:{uid}`). Si se pierde la contraseña, los datos cifrados no se recuperan.
Nota: Firebase Auth sigue viendo el email del usuario (identidad), pero no las wallets.

## Control de acceso (whitelist de emails)

Solo pueden registrarse/usar el portfolio: el **admin** (`ADMIN_EMAIL` en `shell.js`,
hoy `jrodzar@gmail.com`) y los emails de la colección **`allowlist`** de Firestore.

- **Cliente** (`shell.js`): al loguear, `checkAllowed()` mira si el email es admin o
  existe `allowlist/{email}`. Si no, **cierra sesión** y muestra aviso en el gate.
  El admin ve un botón **"👥 Accesos"** (modal) para añadir/quitar emails.
- **Servidor** (reglas Firestore): es la barrera REAL — el check en JS es burlable.

> Si cambias el admin, hazlo en **dos sitios**: `ADMIN_EMAIL` (shell.js) y `isAdmin()`
> en las reglas. La allowlist guarda solo emails (no rompe la privacidad E2E de wallets).

### Reglas Firestore a publicar (Firebase Console → Firestore → Reglas)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null
        && request.auth.token.email.lower() == 'jrodzar@gmail.com';
    }
    function allowed() {
      return request.auth != null && (
        isAdmin() ||
        exists(/databases/$(database)/documents/allowlist/$(request.auth.token.email.lower()))
      );
    }
    match /users/{uid} {
      allow read, write: if request.auth != null
        && request.auth.uid == uid && allowed();
    }
    match /allowlist/{email} {
      allow read:  if request.auth != null;   // el cliente comprueba su acceso
      allow write: if isAdmin();               // solo el admin edita la lista
    }
  }
}
```
Bootstrap: el admin entra (siempre autorizado) → "👥 Accesos" → añade emails.

## Detalles técnicos

- **EVM**: subgraphs por red con IDs editables en Settings; algunos schemas varían
  (`derivedNative`/`nativePriceUSD`, ticks escalares) → ver `evm/app.js` (DEFAULT_CHAINS,
  buildPositionsQuery). Fees = cobradas (subgraph) + no cobradas (cálculo feeGrowthInside).
- **Solana**: sin `@solana/web3.js` (su base58 falla en CDN). Se usa `@noble/hashes` +
  `@noble/curves` y se implementan a mano base58 y derivación de PDA. Decodificación
  Borsh manual de Position/Whirlpool/TickArray (Orca) y PersonalPositionState/PoolState/
  TickArrayState (Raydium). Fees pendientes calculadas desde los TickArrays. Precios USD
  vía Jupiter `lite-api.jup.ag`.
- **Color por pool**: cada posición recibe un color estable (ángulo áureo) usado en
  tarjetas y gráficos.

## Convenciones / gotchas

- **Caché de iframes**: al editar `evm/app.js` o `sol/app.js`, subir el `?v=N` del
  `<script src="app.js?v=N">` en el `index.html` correspondiente para forzar recarga.
- Los engines detectan modo embebido (`window.parent !== window`) y ocultan su propia
  cabecera e input; el shell aporta esa UI.
- No hay secretos en el repo: claves y config viven en el navegador (localStorage).

## Estado / pendientes
- Hecho: EVM (incl. HyperEVM RPC + Revert Lend), Orca, Raydium, portfolios, login,
  prefs, gráficos, fees (cobradas/pendientes), pestaña Histórico, barra de rango en
  fichas, PnL+IL real en Solana vía Birdeye histórico, control de acceso por whitelist,
  modal de progreso al analizar.
- Pendiente opcional: Meteora DLMM, pools clásicos Solana, fee tier de Raydium,
  histórico para tokens RWA que Birdeye no cubre (necesitaría otra fuente de precios),
  códigos de invitación (autoservicio).
