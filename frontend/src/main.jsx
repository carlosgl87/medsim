/**
 * main.jsx — Punto de entrada de la aplicación React
 * ====================================================
 * Este archivo es el equivalente al bloque `if __name__ == "__main__":` en Python.
 * Es el primer archivo que ejecuta Vite cuando arranca la app.
 *
 * Su única responsabilidad es:
 * 1. Importar los estilos globales (Tailwind CSS)
 * 2. Obtener el elemento #root del HTML
 * 3. Montar el componente raíz <App /> dentro de ese elemento
 *
 * A partir de aquí, React toma el control y gestiona toda la UI.
 */

// Importar React y ReactDOM
// React: la librería principal (necesaria para JSX en React 17+, opcional en 18+)
// ReactDOM: el puente entre los componentes React y el DOM real del navegador
import React from 'react'
import ReactDOM from 'react-dom/client'

// Importar el componente raíz de la aplicación
// App.jsx contiene el layout base, el Router y las rutas principales
import App from './App.jsx'

// Importar los estilos globales que incluyen las directivas de Tailwind CSS
// IMPORTANTE: este import hace que PostCSS procese el CSS y lo inyecte en el HTML
import './index.css'

// ReactDOM.createRoot(): crea un "root" de React en el elemento #root del HTML.
// Esta es la API de React 18 (Concurrent Mode).
// En React 17 era ReactDOM.render() — el nuevo createRoot es más eficiente.
//
// document.getElementById('root') obtiene el <div id="root"> de index.html.
// Es como hacer querySelector('#root') pero semánticamente más claro.
ReactDOM.createRoot(document.getElementById('root')).render(
  // React.StrictMode: modo de desarrollo que detecta problemas potenciales.
  // - Renderiza los componentes dos veces (solo en desarrollo) para detectar side effects
  // - Advierte sobre APIs obsoletas
  // - No afecta el comportamiento en producción
  // Analogía Python: es como correr tu código con python -W all (todos los warnings)
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
