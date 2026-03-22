/**
 * Configuración de PostCSS
 * =========================
 * PostCSS es una herramienta que procesa CSS con plugins.
 * Vite lo usa automáticamente cuando encuentra este archivo.
 *
 * Los dos plugins esenciales para Tailwind son:
 * 1. tailwindcss: genera el CSS de las clases que usas en tu código
 * 2. autoprefixer: agrega prefijos de navegador automáticamente
 *    (-webkit-, -moz-, etc.) para compatibilidad cross-browser
 *
 * Analogía Python: es como un middleware en FastAPI — procesa el CSS
 * antes de enviarlo al navegador.
 */

export default {
  plugins: {
    tailwindcss: {},   // Procesa las directivas @tailwind en index.css
    autoprefixer: {},  // Agrega prefijos de compatibilidad de navegadores
  },
}
