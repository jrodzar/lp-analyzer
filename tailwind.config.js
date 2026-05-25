/** @type {import('tailwindcss').Config} */
//
// Tailwind escanea estos paths para descubrir qué clases usamos y emitir solo
// el CSS necesario. Cuando añadas un fichero nuevo con clases Tailwind, asegúrate
// de que cae bajo alguno de estos globs o las clases nuevas no se incluirán.
//
module.exports = {
  content: [
    "./*.html",
    "./*.js",
    "./evm/**/*.{html,js}",
    "./sol/**/*.{html,js}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
