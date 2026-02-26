/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
    theme: {
        extend: {
            spacing: {
                '4.5': '1.125rem',
                '45': '11.25rem',
                '50': '12.5rem',
            },
        },
    },
};