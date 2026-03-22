/**
 * Configuración de Tailwind CSS
 * ==============================
 * Tailwind es un framework CSS "utility-first": en vez de escribir clases como
 * .btn-primary { background: blue; padding: 8px; }, usas clases atómicas directamente
 * en el HTML/JSX: <button className="bg-blue-600 px-4 py-2">.
 *
 * Este archivo le dice a Tailwind qué archivos escanear para saber qué clases
 * CSS generar. Solo genera el CSS de las clases que realmente usas (tree-shaking).
 *
 * Analogía Python: es como tener un linter que solo importa las funciones
 * que realmente usas en tu código.
 */

/** @type {import('tailwindcss').Config} */
export default {
  // content: lista de archivos donde Tailwind buscará clases CSS.
  // Si usas una clase en un archivo no listado aquí, NO será incluida en el build.
  content: [
    "./index.html",           // El HTML raíz del proyecto
    "./src/**/*.{js,jsx}",   // Todos los archivos JS y JSX en src/ (recursivamente)
  ],

  theme: {
    // extend: agrega valores personalizados SIN reemplazar los defaults de Tailwind.
    // Por ejemplo, agrega navy y teal como colores adicionales al sistema de colores
    // estándar (que ya incluye blue-500, teal-400, etc.)
    extend: {
      colors: {
        // Navy blue: color primario para navbar, botones principales, headers
        // Analogía: es nuestro "color corporativo" del sistema de diseño
        navy: {
          50:  '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d5ff',
          300: '#a5b8ff',
          400: '#7a91ff',
          500: '#4f66f7',
          600: '#3347e0',
          700: '#2635c5',
          800: '#1e2a9e',  // Azul navy oscuro — navbar principal
          900: '#1a2480',  // Azul navy más oscuro — hover states
          950: '#111660',
        },
        // Teal: color secundario/acento para elementos interactivos, links activos
        // Evoca colores médicos/hospitalarios (similar al verde quirófano)
        teal: {
          50:  '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',  // Teal principal — botones secundarios, accents
          600: '#0d9488',  // Teal oscuro — hover states
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
      },
      // fontFamily: agrega fuentes personalizadas
      // Inter es una fuente sans-serif moderna, muy usada en aplicaciones médicas
      // y SaaS por su legibilidad en pantalla
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },

  // plugins: extensiones de Tailwind (formularios, tipografía, etc.)
  // Por ahora no necesitamos plugins adicionales
  plugins: [],
}
