/** @type {import('tailwindcss').Config} */
module.exports = {
	// This tells Tailwind to scan all HTML files for classes
	content: [
		'./*.html',       // Scans files in the root (index.html, etc.)
		'./**/*.html'   // Scans files in subfolders (box/index.html, etc.)
	],
	theme: {
		extend: {
			fontFamily: {
				sans: ['Inter', 'sans-serif']
			},
			colors: {
				'tots-red': '#cc0000',
				'tots-green': '#008000',
				'tots-light': '#fcebeb',
				'marine-blue': '#003366'
			}
		}
	},
	plugins: [],
}