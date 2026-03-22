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
        // Paleta de marca UPN (Universidad Privada del Norte)
        upn: {
          gold:        '#FDBA30',  // Dorado principal — botones, estados activos
          'gold-dark': '#E5A520',  // Dorado oscuro — hover de botones
          'gold-light':'#FFF3CC',  // Dorado muy claro — fondos de tarjetas activas
          dark:        '#1A1A1A',  // Negro UPN — navbar, footer, headers de tabla
          darker:      '#111111',  // Negro más oscuro — hover de elementos oscuros
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
