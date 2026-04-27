import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0B0F1A',
          surface: '#111827',
          surface2: '#1F2937',
          surface3: '#374151',
        },
        border: {
          DEFAULT: 'rgba(255,255,255,0.08)',
          strong: 'rgba(255,255,255,0.12)',
        },
        text: {
          DEFAULT: '#F1F5F9',
          muted: '#94A3B8',
          dim: '#64748B',
        },
        brand: {
          DEFAULT: '#3B82F6',
          violet: '#6366F1',
          deep: '#1E1B4B',
        },
        category: {
          character: '#3B82F6',
          location: '#10B981',
          event: '#F59E0B',
          item: '#EF4444',
          faction: '#8B5CF6',
        },
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)',
        'auth-gradient': 'linear-gradient(135deg, #0B0F1A 0%, #1E1B4B 50%, #0B0F1A 100%)',
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        serif: ['"Newsreader"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        sm: '8px',
        DEFAULT: '12px',
        lg: '16px',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-glow': {
          '0%,100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '0.9', transform: 'scale(1.06)' },
        },
        drift: {
          '0%,100%': { transform: 'translate(0,0)' },
          '50%': { transform: 'translate(-12px,-8px)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'pulse-glow': 'pulse-glow 4s ease-in-out infinite',
        drift: 'drift 18s ease-in-out infinite',
      },
    },
  },
  plugins: [animate],
} satisfies Config
