#!/usr/bin/env bash
# Construye la carpeta dist/ que CF Workers Builds sube como assets al Worker.
# Solo se ejecuta en lp-analyzer-pro (CF Workers Builds). En lp-analyzer (main,
# GitHub Pages) este script existe pero NUNCA se llama — GH Pages sirve
# directamente desde la raíz del repo.
#
# Por qué dist/ y no la raíz:
#   - wrangler 4.94.0 NO honra .assetsignore de manera fiable. El log seguía
#     mostrando "Read 1793 files" tras añadir .assetsignore con patrones de
#     todo tipo (.git/, .git/**, **/.git/**).
#   - Resultado sin dist/: .git/, node_modules/, package.json, CLAUDE.md, etc
#     se subían al Worker. Cloudflare Access los bloqueaba públicamente, pero
#     cualquiera con cookie de Access podría descargar el repo privado entero.
#   - Con dist/ generado a mano controlamos al 100% qué se sube — no hay manera
#     de que se cuele un archivo no listado abajo.

set -euo pipefail

DIST="dist"
rm -rf "$DIST"
mkdir -p "$DIST/assets"

# Archivos sueltos de la raíz que SÍ van al navegador
cp index.html sw.js manifest.json favicon.svg common.js shell.js "$DIST/"

# Subcarpetas públicas
cp -r assets/. "$DIST/assets/"
cp -r evm "$DIST/"
cp -r sol "$DIST/"

# active/ solo existe en lp-analyzer-pro (módulos de management activo:
# Cobrar fees, Compound, etc). En main no existe — copiamos si la vemos.
if [ -d active ]; then
  cp -r active "$DIST/"
fi

# Compilar Tailwind directamente sobre dist/. Sobrescribe el styles.css que
# vino de copiar assets/, por si el del repo estaba obsoleto. El postinstall
# de package.json también compila pero a ./assets/styles.css (para GH Pages
# en main); aquí lo regeneramos para asegurar que el de dist/ es el bueno.
npx tailwindcss -i src/tailwind-input.css -o "$DIST/assets/styles.css" --minify

echo "✓ Built $DIST/ ($(find "$DIST" -type f | wc -l) files)"
