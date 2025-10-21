/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        black: "#0B0B0B",
        white: "#FFFFFF",
        gray: {
          50: "#FAFAFA",
          100: "#F5F5F5",
          200: "#EAEAEA",
          300: "#D4D4D4",
          400: "#A3A3A3",
          500: "#6B6B6B",
          600: "#4B4B4B",
          700: "#2B2B2B",
          800: "#171717",
          900: "#0B0B0B"
        },
        status: {
          danger: "#D9534F",
          success: "#2ECC71",
          warning: "#F0AD4E"
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
      }
    },
  },
  plugins: [],
}


