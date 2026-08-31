/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // OLED Black + Orange Accent Theme
                brand: {
                    50: '#fff7ed',
                    100: '#ffedd5',
                    200: '#fed7aa',
                    300: '#fdba74',
                    400: '#fb923c',
                    500: '#f97316',
                    600: '#ea580c',
                    700: '#c2410c',
                    800: '#9a3412',
                    900: '#7c2d12',
                    950: '#431407',
                },
                // Pure OLED blacks
                oled: {
                    pure: '#000000',
                    card: '#0a0a0a',
                    elevated: '#111111',
                    hover: '#1a1a1a',
                },
                // Accent orange
                accent: {
                    DEFAULT: '#f97316',
                    light: '#fb923c',
                    dark: '#ea580c',
                    glow: 'rgba(249, 115, 22, 0.4)',
                },
            },
            boxShadow: {
                'orange-glow': '0 0 20px rgba(249, 115, 22, 0.3), 0 0 40px rgba(249, 115, 22, 0.1)',
                'orange-glow-lg': '0 0 30px rgba(249, 115, 22, 0.4), 0 0 60px rgba(249, 115, 22, 0.2)',
            },
            backgroundImage: {
                'gradient-orange': 'linear-gradient(135deg, #f97316 0%, #fb923c 50%, #fdba74 100%)',
            },
        },
    },
    plugins: [],
}
