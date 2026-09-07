import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './storage/framework/views/*.php',
        './resources/views/**/*.blade.php',
    ],

    theme: {
        extend: {
            fontFamily: {
                sans: ['Figtree', ...defaultTheme.fontFamily.sans],
            },
            colors: {
                // Pink/rose accent palette — repaints every existing
                // bg-brand-*/text-brand-*/border-brand-* usage app-wide.
                brand: {
                    50: '#fdf2f8',
                    100: '#fce7f3',
                    200: '#fbcfe8',
                    300: '#f9a8d4',
                    400: '#f472b6',
                    500: '#ec4899',
                    600: '#db2777',
                    700: '#be185d',
                    800: '#9d174d',
                    900: '#831843',
                },
                // Pre-existing gap found while retheming: bg-ok-100/text-ok-800/border-ok-300
                // were used in app.blade.php, stat-tile.blade.php, and medicines/index.blade.php
                // but never defined anywhere — those classes were rendering unstyled. Emerald
                // scale, standard Tailwind values, added here rather than left broken.
                ok: {
                    50: '#ecfdf5',
                    100: '#d1fae5',
                    200: '#a7f3d0',
                    300: '#6ee7b7',
                    400: '#34d399',
                    500: '#10b981',
                    600: '#059669',
                    700: '#047857',
                    800: '#065f46',
                    900: '#064e3b',
                },
            },
            borderRadius: {
                '2xl': '1rem',
            },
        },
    },

    plugins: [forms],
};
