/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      colors: {
        // Primary accent: Teal
        accent: {
          50:  '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e'
        }
      },
      animation: {
        'check-bounce': 'checkBounce 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97)',
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite'
      },
      keyframes: {
        checkBounce: {
          '0%':   { transform: 'scale(1)' },
          '30%':  { transform: 'scale(1.25)' },
          '60%':  { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)' }
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%':   { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.5' }
        }
      }
    }
  },
  plugins: []
}
