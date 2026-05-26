#!/usr/bin/env bash
# Construye una carpeta dist/ que contiene SOLO los archivos públicos servidos
# al navegador, excluyendo .git/, node_modules/, package.json, CLAUDE.md, etc.
#
# Pensado para targets de deploy que leen de un directorio explícito (ej.
# wrangler.jsonc con `assets.directory: "./dist"`), en lugar de la raíz del
# repo. GitHub Pages NO lo usa — sirve directamente desde la raíz.
#
# Por qué dist/ explícito y no .assetsignore:
#   wrangler 4.94 no honra .assetsignore de manera fiable. El log seguía
#   subiendo .git/ y node_modules/ a pesar de añadirlos al .assetsignore con
#   patrones de todo tipo (.git/, .git/**, **/.git/**). Generar dist/ a mano
#   da control 100% sobre qué se sube.

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

# Carpetas opcionales que pueden existir en forks/variantes del repo
for opt in active; do
  [ -d "$opt" ] && cp -r "$opt" "$DIST/"
done

# Compilar Tailwind directamente sobre dist/. Sobrescribe el styles.css que
# vino de copiar assets/, por si el del repo estaba obsoleto. El postinstall
# de package.json también compila pero a ./assets/styles.css (para GH Pages);
# aquí lo regeneramos para asegurar que el de dist/ es el bueno.
npx tailwindcss -i src/tailwind-input.css -o "$DIST/assets/styles.css" --minify

echo "✓ Built $DIST/ ($(find "$DIST" -type f | wc -l) files)"
