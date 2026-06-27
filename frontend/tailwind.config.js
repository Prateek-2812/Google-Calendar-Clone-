/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Google Calendar brand colors
        primary: {
          50:  '#e8f0fe',
          100: '#c5d8fc',
          200: '#9dbcfa',
          300: '#709ef7',
          400: '#4d86f5',
          500: '#1a73e8', // Google Blue
          600: '#1765cc',
          700: '#1256b0',
          800: '#0d4894',
          900: '#063578',
        },
        google: {
          blue:   '#4285F4',
          red:    '#EA4335',
          yellow: '#FBBC05',
          green:  '#34A853',
        },
        // Calendar event colors
        event: {
          tomato:    '#D50000',
          flamingo:  '#E67C73',
          tangerine: '#F4511E',
          banana:    '#F6BF26',
          sage:      '#33B679',
          basil:     '#0B8043',
          peacock:   '#039BE5',
          blueberry: '#3F51B5',
          lavender:  '#7986CB',
          grape:     '#8E24AA',
          graphite:  '#616161',
        },
        surface: {
          0:   '#ffffff',
          1:   '#f8f9fa',
          2:   '#f1f3f4',
          3:   '#e8eaed',
          dark: {
            0: '#202124',
            1: '#2d2e30',
            2: '#3c3d3f',
            3: '#5f6368',
          },
        },
      },
      fontFamily: {
        sans: ['Google Sans', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['Roboto Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      spacing: {
        '18': '4.5rem',
        '72': '18rem',
        '84': '21rem',
        '96': '24rem',
      },
      boxShadow: {
        'calendar': '0 1px 3px 0 rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15)',
        'modal':    '0 11px 15px -7px rgba(0,0,0,0.2), 0 24px 38px 3px rgba(0,0,0,0.14), 0 9px 46px 8px rgba(0,0,0,0.12)',
        'event':    '0 1px 2px 0 rgba(60,64,67,0.3)',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      animation: {
        'fade-in':     'fadeIn 0.15s ease-out',
        'slide-up':    'slideUp 0.2s ease-out',
        'slide-down':  'slideDown 0.2s ease-out',
        'scale-in':    'scaleIn 0.15s ease-out',
        'spin-slow':   'spin 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%':   { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      gridTemplateColumns: {
        '7':  'repeat(7, minmax(0, 1fr))',
        '24': 'repeat(24, minmax(0, 1fr))',
      },
      minHeight: {
        '20': '5rem',
        '24': '6rem',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
};
