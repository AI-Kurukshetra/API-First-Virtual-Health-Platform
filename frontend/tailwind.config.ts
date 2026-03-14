import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './store/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        primaryHover: 'var(--color-primary-hover)',
        primaryLight: 'var(--color-primary-light)',
        ink: 'var(--color-ink)',
        surface: 'var(--color-surface)',
        bg: 'var(--color-bg)',
        border: 'var(--color-border)',
        muted: 'var(--color-muted)',
        accent: 'var(--color-accent)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        info: 'var(--color-info)'
      },
      boxShadow: {
        soft: '0 10px 30px rgba(11, 31, 26, 0.08)',
        card: '0 8px 24px rgba(11, 31, 26, 0.12)'
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)']
      }
    }
  },
  plugins: []
};

export default config;
