/**
 * Tailwind config — отражает inline-конфиг, который раньше сидел в base.html
 * для CDN-режима. Сборка через standalone-бинарь (см. README).
 */
module.exports = {
  content: [
    './templates/**/*.html',
    './static/js/**/*.js',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT:  'rgb(var(--color-bg) / <alpha-value>)',
          surface:  'rgb(var(--color-bg-surface) / <alpha-value>)',
          surface2: 'rgb(var(--color-bg-surface2) / <alpha-value>)',
          surface3: 'rgb(var(--color-bg-surface3) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--color-border) / 0.08)',
          strong:  'rgb(var(--color-border) / 0.12)',
        },
        text: {
          DEFAULT: 'rgb(var(--color-text) / <alpha-value>)',
          muted:   'rgb(var(--color-text-muted) / <alpha-value>)',
          dim:     'rgb(var(--color-text-dim) / <alpha-value>)',
        },
        brand: {
          DEFAULT: 'rgb(var(--color-brand) / <alpha-value>)',
          violet:  'rgb(var(--color-brand-violet) / <alpha-value>)',
          deep:    'rgb(var(--color-brand-deep) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans:  ['Space Grotesk', 'system-ui', 'sans-serif'],
        // 'serif' указывает на display-шрифт текущего сеттинга через CSS-переменную.
        serif: ['var(--font-display)', 'Newsreader', 'Georgia', 'serif'],
        mono:  ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, rgb(var(--color-brand)) 0%, rgb(var(--color-brand-violet)) 100%)',
        'auth-gradient':  'linear-gradient(135deg, rgb(var(--color-bg)) 0%, rgb(var(--color-brand-deep)) 50%, rgb(var(--color-bg)) 100%)',
      },
      keyframes: {
        'fade-in': {
          '0%':   { opacity: 0, transform: 'translateY(4px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        'pulse-glow': {
          '0%,100%': { opacity: 0.4, transform: 'scale(1)' },
          '50%':     { opacity: 0.9, transform: 'scale(1.06)' },
        },
      },
      animation: {
        'fade-in':    'fade-in 0.3s ease-out',
        'pulse-glow': 'pulse-glow 4s ease-in-out infinite',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
