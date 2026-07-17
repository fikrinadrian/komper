/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/client/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#111c35',
        navy: '#172348',
        cream: '#f7f5ee',
        coral: '#ff6b54',
        mint: '#29c3a2',
        mist: '#e7edf4',
      },
      boxShadow: {
        panel: '0 24px 80px -36px rgba(17, 28, 53, 0.35)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
