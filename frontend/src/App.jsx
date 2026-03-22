/**
 * App.jsx — Componente raíz de la aplicación MedSim
 * ====================================================
 * Este es el componente principal que define la estructura global de la app:
 * - El Router (gestión de navegación por URL)
 * - El Navbar (barra de navegación persistente en todas las páginas)
 * - Las Rutas (qué componente renderizar según la URL actual)
 *
 * CONCEPTOS CLAVE DE REACT:
 * --------------------------
 * - Componente: función que retorna JSX (HTML-like syntax).
 *   Es la unidad básica de React. Analogía Python: es una clase con un método
 *   __repr__ que devuelve HTML.
 *
 * - JSX: sintaxis que parece HTML pero es JavaScript.
 *   <div className="foo"> compila a React.createElement('div', {className: 'foo'})
 *   Importante: usa className (no class) porque class es palabra reservada en JS.
 *
 * - Props: parámetros que recibe un componente (como kwargs en Python).
 *   <Navbar titulo="MedSim" /> pasa {titulo: "MedSim"} al componente Navbar.
 *
 * CONCEPTOS CLAVE DE REACT ROUTER:
 * ----------------------------------
 * React Router permite tener una SPA (Single Page Application) con múltiples
 * "páginas" sin recargar el navegador. Intercepta los cambios de URL y renderiza
 * el componente correspondiente.
 *
 * - BrowserRouter: el contexto que habilita la navegación por URL real (/history, /new-patient).
 *   Analogía: es como el app = FastAPI() que registra las rutas.
 *
 * - Routes + Route: define qué componente renderizar para cada URL.
 *   <Route path="/history" element={<History />} /> es como @app.get("/history")
 *
 * - Link / NavLink: versiones de <a href="..."> que NO recargan la página.
 *   NavLink agrega automáticamente una clase "active" cuando la URL coincide.
 *
 * - Navigate: redirección programática (como response.redirect() en FastAPI).
 *
 * ÁRBOL DE COMPONENTES:
 * ----------------------
 * <App>
 *   <BrowserRouter>
 *     <div layout>
 *       <Navbar />          ← siempre visible
 *       <main content>
 *         <Routes>
 *           /               → redirige a /new-patient
 *           /new-patient    → <NewPatient />
 *           /history        → <History />
 *         </Routes>
 *       </main>
 *     </div>
 *   </BrowserRouter>
 * </App>
 */

// Importaciones de React Router DOM
// BrowserRouter: proveedor de contexto de navegación (usa la History API del navegador)
// Routes: contenedor que evalúa las rutas hijas y renderiza la que coincide
// Route: define la relación URL → componente
// NavLink: link de navegación con soporte para estilos "activo"
// Navigate: componente para redirecciones declarativas
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'

// Importar las páginas de la aplicación
// Cada página es un componente React independiente
import NewPatient from './pages/NewPatient.jsx'
import History from './pages/History.jsx'


// =============================================================================
// COMPONENTE NAVBAR
// =============================================================================

/**
 * Navbar — Barra de navegación superior persistente
 *
 * Este componente es funcional (función pura que retorna JSX).
 * No tiene estado propio ni side effects — solo renderiza HTML.
 *
 * Diseño: navy oscuro (#1e2a9e aprox.) con texto blanco.
 * Los links de navegación usan NavLink para resaltar la página activa.
 */
function Navbar() {
  return (
    // <nav>: elemento semántico HTML5 para barras de navegación.
    // Las clases de Tailwind:
    //   bg-navy-800: fondo azul navy oscuro (definido en tailwind.config.js)
    //   shadow-md:   sombra media para separar visualmente el navbar del contenido
    //   sticky top-0: el navbar se queda fijo en la parte superior al hacer scroll
    //   z-50: z-index alto para que el navbar esté sobre el contenido al hacer scroll
    <nav className="bg-navy-800 shadow-md sticky top-0 z-50">

      {/* Contenedor interno con ancho máximo y centrado horizontal.
          max-w-6xl: limita el ancho a ~72rem para no estirar el contenido en pantallas grandes.
          mx-auto:   centra el contenedor horizontalmente (margin: 0 auto).
          px-4 sm:px-6: padding horizontal (más en pantallas medianas en adelante).
          h-16:      altura fija de 4rem (64px) para el navbar. */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">

        {/* === LOGO / NOMBRE DE LA APP === */}
        {/* flex items-center: alinea el icono y el texto verticalmente en el centro.
            gap-2: espacio de 0.5rem entre el icono y el texto. */}
        <div className="flex items-center gap-2">
          {/* Icono de estetoscopio como emoji — simple y reconocible */}
          <span className="text-2xl" aria-label="estetoscopio">🩺</span>

          {/* Nombre de la app: blanco, negrita, tamaño grande.
              tracking-tight: reduce ligeramente el espaciado entre letras (más compacto y moderno). */}
          <span className="text-white font-bold text-xl tracking-tight">
            MedSim
          </span>

          {/* Subtítulo descriptivo: visible solo en pantallas medianas (sm:block).
              En móvil se oculta (hidden) para no saturar el navbar pequeño.
              border-l: línea divisoria izquierda como separador visual. */}
          <span className="hidden sm:block text-navy-200 text-sm border-l border-navy-600 pl-2 ml-1">
            Simulador Clínico
          </span>
        </div>

        {/* === LINKS DE NAVEGACIÓN === */}
        {/* flex gap-1: los links se muestran en fila con pequeño espacio entre ellos */}
        <div className="flex gap-1">

          {/* NavLink vs Link:
              - Link: simplemente navega a la URL al hacer click (sin estilos especiales)
              - NavLink: igual que Link, PERO agrega la clase "active" automáticamente
                cuando la URL actual coincide con el 'to'. Esto permite aplicar
                estilos diferentes al link de la página actual.

              La prop 'className' en NavLink acepta una FUNCIÓN que recibe
              {isActive} — true si la URL actual coincide con este link.
              Esto es un patrón único de NavLink (no disponible en Link normal). */}

          <NavLink
            to="/new-patient"
            className={({ isActive }) =>
              // Clases base: siempre aplicadas (texto blanco, padding, borde redondeado,
              //              fuente media, transición suave de colores)
              `text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors duration-200 ` +
              // Clases condicionales: diferentes según si el link está activo o no
              // isActive=true: fondo teal (página actual resaltada)
              // isActive=false: hover con fondo navy ligeramente más claro
              (isActive
                ? 'bg-teal-500 text-white'           // Estado activo: teal sólido
                : 'hover:bg-navy-700 text-navy-100')  // Estado inactivo: hover sutil
            }
          >
            {/* Icono + texto del link. El + es una convención visual para "nuevo" */}
            <span className="mr-1.5">＋</span>
            Nuevo Paciente
          </NavLink>

          <NavLink
            to="/history"
            className={({ isActive }) =>
              `text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors duration-200 ` +
              (isActive
                ? 'bg-teal-500 text-white'
                : 'hover:bg-navy-700 text-navy-100')
            }
          >
            {/* Icono de lista para "Historia de casos" */}
            <span className="mr-1.5">📋</span>
            Historia
          </NavLink>
        </div>
      </div>
    </nav>
  )
}


// =============================================================================
// COMPONENTE PRINCIPAL App
// =============================================================================

/**
 * App — Componente raíz de la aplicación
 *
 * Estructura el layout global y configura React Router.
 * Todos los demás componentes viven dentro de este árbol.
 *
 * NOTA: En React, los componentes deben empezar con mayúscula (App, Navbar, etc.)
 * para distinguirlos de los elementos HTML nativos (div, nav, main, etc.).
 */
function App() {
  return (
    // BrowserRouter: proveedor de contexto de navegación.
    // DEBE envolver toda la app para que NavLink, Routes y useNavigate funcionen.
    // Usa la History API del navegador (pushState) para cambiar URLs sin recargar.
    // Analogía Python: es como el lifespan context manager de FastAPI —
    // configura el entorno antes de que todo lo demás funcione.
    <BrowserRouter>

      {/* Layout principal: ocupa al menos el 100% del viewport vertical.
          min-h-screen: min-height: 100vh — asegura que el footer (si lo hubiera)
          siempre esté al fondo aunque el contenido sea corto.
          flex flex-col: layout vertical (navbar arriba, contenido abajo). */}
      <div className="min-h-screen flex flex-col bg-gray-50">

        {/* Navbar: siempre visible, independiente de la ruta actual.
            En React Router, los componentes FUERA de <Routes> se renderizan
            siempre, sin importar la URL. Perfecto para navbar y footer. */}
        <Navbar />

        {/* Área de contenido principal: crece para ocupar el espacio disponible.
            flex-1: en un flex container, hace que este elemento tome todo el
                    espacio sobrante (empuja el footer al fondo si existiera).
            py-8: padding vertical de 2rem arriba y abajo.
            px-4 sm:px-6: padding horizontal (responsive). */}
        <main className="flex-1 py-8 px-4 sm:px-6">

          {/* Contenedor centrado para el contenido.
              max-w-6xl mx-auto: limita el ancho y centra el contenido,
              igual que en el Navbar, para consistencia visual. */}
          <div className="max-w-6xl mx-auto">

            {/* Routes: el "router" que evalúa la URL actual y renderiza
                el primer <Route> que coincida.
                Análogo a un if/elif/else basado en la URL:
                  if url == "/": redirect to "/new-patient"
                  elif url == "/new-patient": render <NewPatient />
                  elif url == "/history": render <History />  */}
            <Routes>

              {/* Ruta raíz: redirige automáticamente a /new-patient.
                  Navigate con replace={true} reemplaza la entrada en el historial
                  del navegador (evita que el botón "atrás" vuelva a /).
                  Analogía FastAPI: response.redirect("/new-patient") */}
              <Route
                path="/"
                element={<Navigate to="/new-patient" replace />}
              />

              {/* Ruta /new-patient: renderiza el componente NewPatient.
                  Todo el contenido de esta página vive en NewPatient.jsx */}
              <Route
                path="/new-patient"
                element={<NewPatient />}
              />

              {/* Ruta /history: renderiza el componente History.
                  Muestra el historial de sesiones completadas. */}
              <Route
                path="/history"
                element={<History />}
              />

            </Routes>
          </div>
        </main>

        {/* Footer: información legal/institucional mínima.
            mt-auto: empuja el footer al fondo si el contenido es corto
                     (funciona en conjunto con flex-col en el div padre).
            border-t: línea divisoria superior sutil. */}
        <footer className="border-t border-gray-200 bg-white py-4 px-6 mt-auto">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">

            {/* Texto izquierdo: créditos de la app */}
            <p className="text-xs text-gray-400">
              MedSim — Simulador Clínico
            </p>

          </div>
        </footer>

      </div>
    </BrowserRouter>
  )
}

// Exportación por defecto: permite importar este componente con cualquier nombre.
// Convención: los archivos de componentes usan export default.
// Analogía Python: es como exponer una clase/función en __init__.py
export default App
