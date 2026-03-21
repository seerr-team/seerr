// eslint-disable-next-line @typescript-eslint/no-require-imports

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        looky: {
          bg: '#0d1326',
          surface: '#17203b',
          surface2: '#1f2b4f',
          text: '#f3f6ff',
          muted: '#aeb7d6',
          primary: '#33d1ff',
          secondary: '#ff7aa2',
          accent: '#a78bfa',
          success: '#34d399',
          warning: '#fbbf24',
          danger: '#f87171',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          'Segoe UI',
          'Roboto',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        looky: '16px',
        'looky-lg': '20px',
      },
      boxShadow: {
        looky: '0 10px 28px rgba(0,0,0,.25)',
        'looky-strong': '0 14px 34px rgba(0,0,0,.45)',
      },
      backgroundImage: {
        'looky-glow':
          'radial-gradient(1000px 640px at 0% 0%, rgba(51,209,255,.18), transparent 42%), radial-gradient(860px 620px at 100% 0%, rgba(167,139,250,.16), transparent 40%), radial-gradient(700px 500px at 50% 100%, rgba(255,122,162,.12), transparent 45%)',
      },
    },
  },
  plugins: [],
};
