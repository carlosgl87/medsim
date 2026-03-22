/**
 * Configuración de Vite (bundler/dev server para React)
 * ======================================================
 * Vite es el equivalente moderno de webpack/create-react-app.
 * Es mucho más rápido porque usa ES modules nativos del navegador
 * en modo desarrollo (no necesita re-compilar todo el proyecto en cada cambio).
 *
 * Analogía Python: es como uvicorn pero para el frontend —
 * sirve los archivos durante desarrollo con hot-reload instantáneo.
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // plugins: lista de plugins que extienden las capacidades de Vite.
  // @vitejs/plugin-react agrega soporte para JSX (la sintaxis de componentes React)
  // y el fast refresh (HMR: recarga solo el componente modificado sin perder el estado).
  plugins: [react()],

  // server: configuración del servidor de desarrollo
  server: {
    port: 5173,  // Puerto donde correrá el frontend (http://localhost:5173)
    open: true,  // Abre el navegador automáticamente al correr 'npm run dev'
  },
})
