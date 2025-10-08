module.exports = {
  content: ["./pages/*.{html,js}", "./index.html", "./js/*.js"],
  theme: {
    extend: {
      colors: {
        // Primary Colors - Warm Saffron Brown
        primary: {
          DEFAULT: "#8B4513", // warm saffron brown
          50: "#FDF8F3", // very light saffron
          100: "#F9E8D8", // light saffron
          200: "#F0D0B1", // medium light saffron
          300: "#E6B88A", // medium saffron
          400: "#DCA063", // medium dark saffron
          500: "#8B4513", // base saffron brown
          600: "#7A3D11", // dark saffron
          700: "#69350F", // darker saffron
          800: "#582D0D", // very dark saffron
          900: "#47250B", // deepest saffron
        },
        
        // Secondary Colors - Muted Purple
        secondary: {
          DEFAULT: "#6B5B73", // muted purple
          50: "#F7F6F8", // very light purple
          100: "#EBE8ED", // light purple
          200: "#D7D1DB", // medium light purple
          300: "#C3BAC9", // medium purple
          400: "#AFA3B7", // medium dark purple
          500: "#6B5B73", // base muted purple
          600: "#5F5267", // dark purple
          700: "#53495B", // darker purple
          800: "#47404F", // very dark purple
          900: "#3B3743", // deepest purple
        },
        
        // Accent Colors - Soft Gold
        accent: {
          DEFAULT: "#D4A574", // soft gold
          50: "#FBF8F4", // very light gold
          100: "#F5EDDF", // light gold
          200: "#EBDBBF", // medium light gold
          300: "#E1C99F", // medium gold
          400: "#D7B77F", // medium dark gold
          500: "#D4A574", // base soft gold
          600: "#C19660", // dark gold
          700: "#AE874C", // darker gold
          800: "#9B7838", // very dark gold
          900: "#886924", // deepest gold
        },
        
        // Background Colors
        background: "#FDFCFA", // warm off-white
        surface: {
          DEFAULT: "#F7F5F3", // subtle paper texture
          hover: "#F2F0EE", // surface hover state
        },
        
        // Border Colors
        border: {
          DEFAULT: "#E8E5E1", // hairline borders
          subtle: "#E8E5E1", // hairline borders
        },
        
        // Text Colors
        text: {
          primary: "#2D2A26", // rich dark brown
          secondary: "#5A5550", // medium brown
          muted: "#8B8680", // light brown
        },
        
        // Status Colors
        success: {
          DEFAULT: "#7A8471", // sage green
          50: "#F6F7F6", // very light sage
          100: "#E8EBE7", // light sage
          200: "#D1D7CF", // medium light sage
          300: "#BAC3B7", // medium sage
          400: "#A3AF9F", // medium dark sage
          500: "#7A8471", // base sage green
          600: "#6E7665", // dark sage
          700: "#626859", // darker sage
          800: "#565A4D", // very dark sage
          900: "#4A4C41", // deepest sage
        },
        
        warning: {
          DEFAULT: "#B8860B", // muted amber
          50: "#FDF9F0", // very light amber
          100: "#F9F0D6", // light amber
          200: "#F3E1AD", // medium light amber
          300: "#EDD284", // medium amber
          400: "#E7C35B", // medium dark amber
          500: "#B8860B", // base muted amber
          600: "#A6790A", // dark amber
          700: "#946C09", // darker amber
          800: "#825F08", // very dark amber
          900: "#705207", // deepest amber
        },
        
        error: {
          DEFAULT: "#A0522D", // warm sienna
          50: "#FAF6F4", // very light sienna
          100: "#F2E6DD", // light sienna
          200: "#E5CDBB", // medium light sienna
          300: "#D8B499", // medium sienna
          400: "#CB9B77", // medium dark sienna
          500: "#A0522D", // base warm sienna
          600: "#904A29", // dark sienna
          700: "#804225", // darker sienna
          800: "#703A21", // very dark sienna
          900: "#60321D", // deepest sienna
        },
      },
      
      fontFamily: {
        'crimson': ['Crimson Text', 'serif'], // Headlines
        'source': ['Source Serif 4', 'serif'], // Body text
        'inter': ['Inter', 'sans-serif'], // CTAs
        'devanagari': ['Noto Sans Devanagari', 'sans-serif'], // Sanskrit text
        'sans': ['Inter', 'sans-serif'],
        'serif': ['Source Serif 4', 'serif'],
      },
      
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.6rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1.3' }],
        '6xl': ['3.75rem', { lineHeight: '1.3' }],
      },
      
      boxShadow: {
        'subtle': '0 2px 8px rgba(45, 42, 38, 0.08)',
        'soft': '0 1px 3px rgba(45, 42, 38, 0.06)',
        'content': '0 2px 8px rgba(45, 42, 38, 0.08)',
      },
      
      transitionDuration: {
        '200': '200ms',
        '300': '300ms',
      },
      
      transitionTimingFunction: {
        'out': 'ease-out',
      },
      
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
      },
      
      animation: {
        'fade-in': 'fadeIn 300ms ease-out',
        'slide-up': 'slideUp 300ms ease-out',
      },
      
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}