/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Paleta cream/ink + cobre
        cream:   '#FAF8F4',
        ink:     '#181513',
        copper:  '#B36A2A',
        'copper-light': '#E8A46A',
        'copper-dark':  '#A05E2A',
        muted:   '#6B5F55',
        surface: '#F0EDE8',
        'surface-dark': '#1E1A17',
        // Semáforo salud financiera
        estable:  '#3F8E5A',
        atencion: '#C98330',
        riesgo:   '#A8401F',
      },
      fontFamily: {
        'display': ['Newsreader-Italic', 'serif'],
        'ui':      ['Geist', 'sans-serif'],
        'mono':    ['GeistMono', 'monospace'],
      },
    },
  },
  plugins: [],
};
