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
   - Reglas Firestore: `users/{uid}` solo lectura/escritura si `request.auth.uid == uid`.
2. **API keys** (se guardan en localStorage, por origen):
   - The Graph (Quick → EVM → ⚙) para Uniswap V3.
   - Helius (Quick → SOL → ⚙) para Solana RPC/DAS.

## Modelo de datos (Firestore)
```
users/{uid} → {
  portfolioEnc: { iv, ct },   // portfolio cifrado E2E (AES-GCM); addresses+labels
  encSalt,                    // salt PBKDF2 (no secreto)
  prefs:     { chains: [...], protocols: [...] },   // no sensible, en claro
  prefsVersion
}
```
**Cifrado E2E** (shell.js): el portfolio se cifra en el navegador con AES-GCM, clave
derivada por PBKDF2 de una contraseña que el usuario define y que **nunca** se envía.
El dueño del proyecto Firebase NO puede leer las direcciones (solo ve `portfolioEnc`).
Opción "recordar en este dispositivo" guarda la clave derivada en localStorage
(`lp:enckey:{uid}`). Si se pierde la contraseña, los datos cifrados no se recuperan.
Nota: Firebase Auth sigue viendo el email del usuario (identidad), pero no las wallets.

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
- Hecho: EVM (6 redes), Orca, Raydium, portfolios, login, prefs, gráficos, fees acumuladas.
- Pendiente opcional: Meteora DLMM, pools clásicos Solana, fee tier de Raydium,
  histórico/IL real en Solana (requiere indexer de pago, p.ej. Birdeye — campo ya previsto).
