/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      colors: {
        elata: {
          orange: '#D9531E',
          ink: '#1A1A1A',
          paper: '#FAF7F2',
          line: '#E5E0D6',
          muted: '#6B6B6B',
        },
      },
    },
  },
  plugins: [],
};
