/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './pages/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                background: '#111827',
                card: '#1f2937',
                border: '#374151',
                primary: '#f9fafb',
                secondary: '#9ca3af',
                accent: '#0077b5',
                cta: '#1d4ed8',
                success: '#10b981',
                warning: '#f59e0b',
                error: '#ef4444',
            },
        },
    },
    plugins: [],
}