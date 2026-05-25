/** @type {import('tailwindcss').Config} */
//
// Tailwind escanea estos paths para descubrir qué clases usamos y emitir solo
// el CSS necesario. Cuando añadas un fichero nuevo con clases Tailwind, asegúrate
// de que cae bajo alguno de estos globs o las clases nuevas no se incluirán.
//
// `active/**/*` solo existe en el repo privado lp-analyzer-pro. Tailwind ignora
// silenciosamente los globs sin matches, así que el mismo config sirve para
// ambos repos: en main produce un CSS, en pro produce un CSS más amplio que
// incluye las clases de los módulos active/*.
//
module.exports = {
  content: [
    "./*.html",
    "./*.js",
    "./evm/**/*.{html,js}",
    "./sol/**/*.{html,js}",
    "./active/**/*.{html,js}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
