/**
 * NewPatient.jsx — Simulación clínica en 5 etapas
 * =================================================
 * Componente principal de MedSim. Guía al estudiante a través de un caso
 * clínico completo: entrevista → exámenes → diagnóstico → evaluación.
 *
 * FLUJO DE ETAPAS:
 *   1 → Anamnesis:     Chat con el paciente virtual
 *   2 → Exámenes:      Selección de laboratorios
 *   3 → Resultados:    Tabla con resultados de labs
 *   4 → Diagnóstico:   Formulario de diagnóstico y razonamiento
 *   5 → Evaluación:    Puntuación y retroalimentación detallada
 *
 * CONCEPTOS REACT CLAVE EN ESTE ARCHIVO:
 * ----------------------------------------
 * useState:   Estado reactivo — como una variable Python que al cambiar
 *             hace que React re-renderice el componente automáticamente.
 *
 * useEffect:  Efectos secundarios — código que corre después del render
 *             (llamadas a API, timers, suscripciones). Es como un callback
 *             que se ejecuta cuando cambian ciertas dependencias.
 *
 * useRef:     Referencia mutable que NO causa re-render. Aquí lo usamos
 *             para apuntar al fondo del chat y hacer auto-scroll.
 *
 * Renderizado condicional: JSX equivalente a if/elif/else de Python.
 *   {condicion && <Componente />}       → solo si condicion es true
 *   {condicion ? <A /> : <B />}        → ternario
 *   {items.map(item => <Item />)}       → lista de elementos
 *
 * axios:      Cliente HTTP para hacer peticiones al backend FastAPI.
 *             Similar a requests en Python. Retorna Promesas (async/await).
 */

import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { API_URL } from '../config.js'


// =============================================================================
// CONSTANTES: CATÁLOGO DE EXÁMENES DE LABORATORIO
// =============================================================================

/**
 * Catálogo de exámenes agrupados por categoría.
 * El estudiante verá estos tests en la etapa 2 y podrá seleccionarlos.
 *
 * Estructura: { "Nombre Categoría": ["test1", "test2", ...] }
 * Analogía Python: es un dict de listas, definido a nivel de módulo (como una constante).
 */
const LAB_CATALOG = {
  'Hematología': [
    'Hemograma completo',
    'Hematocrito',
    'Hemoglobina',
  ],
  'Química sanguínea': [
    'Glucosa',
    'Urea',
    'Creatinina',
    'Ácido úrico',
    'Colesterol total',
    'Triglicéridos',
    'ALT',
    'AST',
    'Bilirrubina',
  ],
  'Electrolitos': [
    'Sodio',
    'Potasio',
    'Cloro',
  ],
  'Orina': [
    'Examen de orina completo',
    'Urocultivo',
  ],
  'Inmunología': [
    'PCR',
    'VSG',
    'ANA',
    'Anti-DNA',
  ],
  'Microbiología': [
    'Hemocultivo',
    'Cultivo de esputo',
    'Gota gruesa',
  ],
  'Imágenes': [
    'Radiografía de tórax',
    'Ecografía abdominal',
    'TAC tórax',
  ],
}

/** Nombres de las 5 etapas para el stepper */
const STAGE_LABELS = ['Anamnesis', 'Exámenes', 'Resultados', 'Diagnóstico', 'Evaluación']


// =============================================================================
// FUNCIÓN AUXILIAR: DETECTAR RESULTADOS ANORMALES
// =============================================================================

/**
 * Determina si un resultado de laboratorio es anormal.
 *
 * Lógica: el backend retorna "Dentro de parámetros normales" para tests
 * que no coinciden con la enfermedad, y el valor real con unidades para
 * los tests relevantes (ej: "138 mg/dL (elevada; normal: 70–99 mg/dL)").
 *
 * También busca palabras clave de anormalidad en el texto del resultado.
 *
 * @param {string} result - El string de resultado devuelto por el backend
 * @returns {boolean} true si el resultado es anormal
 */
function isAbnormal(result) {
  if (!result) return false
  // Si el resultado es exactamente el string de "normal", no es anormal
  if (result === 'Dentro de parámetros normales') return false
  // Palabras clave que indican anormalidad en los resultados del backend
  const abnormalKeywords = [
    'elevada', 'elevado', 'alta', 'alto',
    'baja', 'bajo', 'positivo', 'anormal',
    'aumentado', 'aumentada', 'disminuido', 'disminuida',
  ]
  const lower = result.toLowerCase()
  // some() en arrays JS es como any() en Python — retorna true si al menos uno coincide
  return abnormalKeywords.some(kw => lower.includes(kw))
}


// =============================================================================
// COMPONENTE: STEPPER DE PROGRESO
// =============================================================================

/**
 * Stepper — Barra de progreso horizontal con 5 pasos numerados.
 *
 * Recibe props como parámetros (análogo a kwargs en Python):
 * @param {number} currentStage - Etapa actual (1-5)
 *
 * NOTA SOBRE PROPS: En React, los componentes reciben sus "parámetros"
 * como un objeto llamado props. Se desestructura con { currentStage }
 * directamente en la firma de la función, igual que desempaquetar un dict:
 *   Python: def stepper(current_stage): ...
 *   React:  function Stepper({ currentStage }) { ... }
 */
function Stepper({ currentStage }) {
  return (
    // Contenedor del stepper: fondo blanco, borde inferior, padding
    <div className="bg-white border-b border-gray-200 px-6 py-4 mb-6 rounded-xl shadow-sm">
      {/* flex: layout horizontal. items-center: centra verticalmente cada paso */}
      <div className="flex items-center justify-between max-w-2xl mx-auto">

        {/* STAGE_LABELS.map(): genera un círculo + etiqueta por cada paso.
            entries() da pares [índice, valor] — como enumerate() en Python. */}
        {STAGE_LABELS.map((label, index) => {
          const stepNumber = index + 1
          // ¿Este paso ya fue completado?
          const isCompleted = stepNumber < currentStage
          // ¿Este es el paso actual?
          const isCurrent = stepNumber === currentStage

          return (
            // React.Fragment: envoltorio sin elemento DOM real. Permite retornar
            // múltiples elementos desde el map sin agregar un <div> extra.
            // key es obligatorio incluso en Fragments que vienen de un map.
            <React.Fragment key={stepNumber}>

              {/* Elemento de un paso: círculo + etiqueta apilados verticalmente */}
              <div className="flex flex-col items-center gap-1">

                {/* Círculo del paso con estilos condicionales basados en el estado */}
                <div
                  className={
                    // Clases base: siempre aplicadas
                    `w-9 h-9 rounded-full flex items-center justify-center
                     text-sm font-bold transition-all duration-300 ` +
                    // Clases condicionales: cambian según el estado del paso
                    (isCompleted
                      ? 'bg-[#1A1A1A] text-white'              // Completado: negro UPN
                      : isCurrent
                        ? 'bg-[#FDBA30] text-[#1A1A1A] ring-4 ring-[#FDBA30]/30'  // Actual: dorado UPN
                        : 'bg-gray-100 text-gray-400 border-2 border-gray-200')    // Futuro: gris
                  }
                >
                  {/* Muestra ✓ si completado, o el número si no */}
                  {isCompleted ? '✓' : stepNumber}
                </div>

                {/* Etiqueta del paso: visible en pantallas medianas y grandes */}
                <span
                  className={
                    `hidden sm:block text-xs font-medium ` +
                    (isCurrent ? 'text-[#FDBA30]' : isCompleted ? 'text-[#1A1A1A]' : 'text-gray-400')
                  }
                >
                  {label}
                </span>
              </div>

              {/* Línea conectora entre pasos (no se muestra después del último) */}
              {index < STAGE_LABELS.length - 1 && (
                <div
                  className={
                    // flex-1: ocupa el espacio disponible entre los círculos
                    // h-0.5: línea delgada de 2px
                    `flex-1 h-0.5 mx-2 transition-colors duration-300 ` +
                    // Teal si el paso ya fue completado, gris si no
                    (stepNumber < currentStage ? 'bg-[#FDBA30]' : 'bg-gray-200')
                  }
                />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}


// =============================================================================
// COMPONENTE: TARJETA DEL PACIENTE
// =============================================================================

/**
 * PatientCard — Muestra el perfil demográfico del paciente.
 *
 * @param {object} patient - Objeto con name, age, sex, weight, height, backstory
 */
function PatientCard({ patient }) {
  return (
    // Tarjeta con borde dorado UPN en la izquierda — identidad visual del paciente
    <div className="bg-white rounded-xl shadow-sm border border-[#E0E0E0] border-l-4 border-l-[#FDBA30] p-4 mb-4">

      {/* Encabezado: avatar + nombre + badge de sexo */}
      <div className="flex items-center gap-3 mb-3">
        {/* Avatar emoji como placeholder de foto */}
        <span className="text-4xl" aria-label="paciente">
          {patient.sex === 'masculino' ? '👨' : '👩'}
        </span>
        <div>
          <h2 className="font-bold text-[#1A1A1A] text-lg leading-tight">{patient.name}</h2>
          {/* Capitalizar primera letra del sexo para mostrarlo */}
          <span className="badge-info capitalize">{patient.sex}</span>
        </div>
      </div>

      {/* Grid de datos demográficos: 3 columnas en pantallas medianas */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        {/* Cada dato: número grande + etiqueta pequeña */}
        {[
          { value: `${patient.age} años`, label: 'Edad' },
          { value: `${patient.weight} kg`, label: 'Peso' },
          { value: `${patient.height} cm`, label: 'Talla' },
        ].map(({ value, label }) => (
          <div key={label} className="bg-gray-50 rounded-lg p-2">
            <div className="font-semibold text-[#1A1A1A] text-sm">{value}</div>
            <div className="text-xs text-gray-400">{label}</div>
          </div>
        ))}
      </div>

      {/* Historia del paciente: cursiva para diferenciarlo de UI */}
      <p className="text-sm text-gray-600 italic leading-relaxed border-t border-gray-100 pt-3">
        "{patient.backstory}"
      </p>
    </div>
  )
}


// =============================================================================
// COMPONENTE PRINCIPAL: NewPatient
// =============================================================================

/**
 * NewPatient — Orquestador de las 5 etapas de la simulación clínica.
 *
 * Este componente gestiona TODO el estado de la simulación y delega
 * el render de cada etapa a funciones internas (renderStage1..5).
 */
function NewPatient() {
  // ===========================================================================
  // ESTADO (useState)
  // ===========================================================================
  // useState(valorInicial) retorna [valor, setter].
  // Cuando llamas al setter, React re-renderiza el componente.
  // Analogía Python: es como una propiedad de clase, pero con un observador
  // que dispara un re-render cada vez que cambia.

  /** Etapa actual del flujo (1-5) */
  const [stage, setStage] = useState(1)

  /** ID de sesión UUID devuelto por el backend */
  const [sessionId, setSessionId] = useState(null)

  /** Datos del paciente: { name, age, sex, weight, height, backstory } */
  const [patient, setPatient] = useState(null)

  /** Historial del chat: [{ role: "user"|"assistant", content: string }] */
  const [messages, setMessages] = useState([])

  /** Texto actualmente escrito en el input del chat */
  const [inputMessage, setInputMessage] = useState('')

  /** Set de nombres de tests seleccionados en la etapa 2.
   *  Usamos Set (en vez de Array) para O(1) en búsqueda/eliminación. */
  const [selectedTests, setSelectedTests] = useState(new Set())

  /** Texto de búsqueda para filtrar el catálogo de labs */
  const [searchTerm, setSearchTerm] = useState('')

  /** Resultados de laboratorio: { "nombre_test": "valor_resultado" } */
  const [labResults, setLabResults] = useState({})

  /** Diagnóstico principal escrito por el estudiante */
  const [diagnosis, setDiagnosis] = useState('')

  /** Razonamiento clínico del estudiante */
  const [reasoning, setReasoning] = useState('')

  /** Resultado de la evaluación final: { score_breakdown, total_score, correct_diagnosis, feedback } */
  const [scoreResult, setScoreResult] = useState(null)

  /** Estado de carga genérico — evita múltiples clics mientras se espera respuesta */
  const [isLoading, setIsLoading] = useState(false)

  /** Estado de carga específico para enviar mensajes (permite chatear fluidamente) */
  const [isSendingMessage, setIsSendingMessage] = useState(false)

  /** Mensaje de error global para mostrar al usuario */
  const [error, setError] = useState(null)

  // ===========================================================================
  // REFS (useRef)
  // ===========================================================================
  // useRef crea una referencia mutable que persiste entre renders pero NO causa
  // re-render cuando cambia. Aquí lo usamos para "apuntar" al final del chat
  // y hacer scroll automático cuando llega un nuevo mensaje.
  // Analogía Python: es como una variable de instancia que no notifica a nadie.

  /** Referencia al último elemento del chat para auto-scroll */
  const chatEndRef = useRef(null)

  /** Hook de React Router para navegación programática (sin clic en Link) */
  const navigate = useNavigate()


  // ===========================================================================
  // EFECTOS (useEffect)
  // ===========================================================================
  // useEffect(fn, [deps]) ejecuta fn después de cada render en que cambien deps.
  // Con [] vacío, solo corre UNA VEZ después del primer render (como __init__).
  // Analogía Python: es como un @property setter que corre código al cambiar.

  /**
   * Efecto de inicialización: llama a startSession cuando el componente
   * se monta por primera vez ([] = sin dependencias = solo al montar).
   */
  useEffect(() => {
    startSession()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // Nota: el comentario anterior suprime una advertencia del linter sobre
  // startSession en las dependencias. Es intencional: queremos que corra solo al montar.

  /**
   * Efecto de auto-scroll: cada vez que 'messages' cambia (nuevo mensaje),
   * hace scroll al final del contenedor del chat.
   *
   * scrollIntoView({ behavior: 'smooth' }) anima el scroll suavemente.
   * chatEndRef.current apunta al elemento DOM real (el div vacío al final del chat).
   */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    // El ?. (optional chaining) evita error si el ref no está montado aún.
    // Equivale a: if chatEndRef.current: chatEndRef.current.scrollIntoView(...)
  }, [messages])


  // ===========================================================================
  // FUNCIONES MANEJADORAS (HANDLERS)
  // ===========================================================================

  /**
   * startSession — Inicia una nueva sesión llamando al backend.
   * Resetea todo el estado y obtiene un nuevo paciente aleatorio.
   *
   * async/await: igual que en Python asyncio. Pausa la función hasta
   * que la promesa de axios se resuelva (o rechace).
   */
  async function startSession() {
    // Resetear todo el estado a sus valores iniciales
    setStage(1)
    setSessionId(null)
    setPatient(null)
    setMessages([])
    setInputMessage('')
    setSelectedTests(new Set())
    setSearchTerm('')
    setLabResults({})
    setDiagnosis('')
    setReasoning('')
    setScoreResult(null)
    setError(null)
    setIsLoading(true)

    try {
      // axios.post(url) hace una petición POST y retorna una promesa.
      // La respuesta tiene .data con el body JSON del servidor.
      // Analogía Python: requests.post(url).json()
      const response = await axios.post(`${API_URL}/session/start`)
      const data = response.data
      // data = { session_id: "uuid...", patient: { name, age, ... } }
      setSessionId(data.session_id)
      setPatient(data.patient)
    } catch (err) {
      // err.response?.data?.detail: ruta segura al mensaje de error de FastAPI.
      // HTTPException de FastAPI retorna { detail: "mensaje de error" }
      setError(err.response?.data?.detail || 'Error al iniciar la sesión. ¿Está corriendo el backend?')
    } finally {
      // finally: siempre se ejecuta, haya error o no (como en Python).
      // Aquí apagamos el indicador de carga.
      setIsLoading(false)
    }
  }

  /**
   * sendMessage — Envía un mensaje al paciente virtual y agrega la respuesta al chat.
   *
   * Flujo:
   * 1. Agrega el mensaje del usuario al historial local (inmediato, sin esperar API)
   * 2. Llama al backend que consulta Claude con el historial completo
   * 3. Agrega la respuesta del paciente al historial
   */
  async function sendMessage() {
    // No enviar si el input está vacío o si ya estamos esperando respuesta
    if (!inputMessage.trim() || isSendingMessage) return

    const userMsg = inputMessage.trim()

    // Limpiar el input ANTES de la llamada API — mejor UX que esperar
    setInputMessage('')
    setIsSendingMessage(true)

    // Agregar el mensaje del usuario al chat inmediatamente (optimistic update).
    // Esto da sensación de respuesta instantánea al estudiante.
    // setMessages(prev => [...prev, newMsg]): forma funcional de actualizar
    // un array de estado. "prev" es el valor actual antes de este update.
    // Es la forma correcta cuando el nuevo estado depende del anterior.
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])

    try {
      const response = await axios.post(`${API_URL}/session/chat`, {
        session_id: sessionId,
        message: userMsg,
      })
      // Agregar la respuesta del paciente al chat
      setMessages(prev => [...prev, { role: 'assistant', content: response.data.response }])
    } catch (err) {
      // Si falla, mostrar mensaje de error como burbuja del sistema
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '(Error al obtener respuesta. Por favor intenta de nuevo.)',
      }])
    } finally {
      setIsSendingMessage(false)
    }
  }

  /**
   * requestLabs — Envía los tests seleccionados al backend y avanza a etapa 3.
   */
  async function requestLabs() {
    if (selectedTests.size === 0) return
    setIsLoading(true)
    setError(null)

    try {
      const response = await axios.post(`${API_URL}/session/labs`, {
        session_id: sessionId,
        // Set no es serializable a JSON directamente.
        // Array.from() convierte el Set a un array ordinario.
        // Analogía Python: list(selected_tests)
        requested_tests: Array.from(selectedTests),
      })
      setLabResults(response.data.lab_results)
      setStage(3)
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al obtener resultados de laboratorio.')
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * submitDiagnosis — Envía el diagnóstico final y recibe la evaluación.
   * Esta es la llamada más costosa (Claude usa adaptive thinking para evaluar).
   */
  async function submitDiagnosis() {
    if (!diagnosis.trim() || !reasoning.trim()) return
    setIsLoading(true)
    setError(null)

    try {
      const response = await axios.post(`${API_URL}/session/diagnose`, {
        session_id: sessionId,
        diagnosis: diagnosis.trim(),
        reasoning: reasoning.trim(),
      })
      // response.data = { score_breakdown, total_score, correct_diagnosis, feedback }
      setScoreResult(response.data)
      setStage(5)
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al enviar el diagnóstico.')
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * toggleTest — Agrega o quita un test del Set de tests seleccionados.
   *
   * IMPORTANTE: En React, NO se muta el estado directamente (como harías en Python
   * con set.add()). Siempre se crea un NUEVO objeto para que React detecte el cambio.
   * Si muto el Set existente, React no ve diferencia y no re-renderiza.
   *
   * @param {string} testName - Nombre del test a toggle
   */
  function toggleTest(testName) {
    setSelectedTests(prev => {
      // Crear un nuevo Set copiando el anterior (spread operator: ...prev)
      const next = new Set(prev)
      if (next.has(testName)) {
        next.delete(testName)  // Quitar si ya está seleccionado
      } else {
        next.add(testName)     // Agregar si no está seleccionado
      }
      return next
    })
  }

  /**
   * handleChatKeyDown — Permite enviar mensajes con Enter (sin Shift+Enter).
   * Shift+Enter inserta un salto de línea normal.
   *
   * @param {KeyboardEvent} e - Evento de teclado del DOM
   */
  function handleChatKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      // preventDefault() evita el comportamiento por defecto (salto de línea en textarea)
      e.preventDefault()
      sendMessage()
    }
  }


  // ===========================================================================
  // RENDER DE ETAPAS
  // ===========================================================================
  // Cada función renderStageN retorna JSX para su etapa correspondiente.
  // El componente principal elige cuál llamar según el estado 'stage'.

  // ---------------------------------------------------------------------------
  // ETAPA 1: ANAMNESIS (Chat con el paciente)
  // ---------------------------------------------------------------------------
  function renderStage1() {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Panel izquierdo: datos del paciente (1/3 del ancho en desktop) */}
        <div className="lg:col-span-1">
          {/* PatientCard solo se renderiza cuando patient no es null.
              El && es renderizado condicional: si patient es null/undefined/false,
              React no renderiza nada. Si es un objeto truthy, renderiza el componente. */}
          {patient && <PatientCard patient={patient} />}

          {/* Botón para avanzar a selección de laboratorios */}
          <button
            onClick={() => setStage(2)}
            // disabled: atributo HTML que desactiva el botón.
            // En React se pasa como prop booleana: disabled={true} o solo disabled.
            disabled={messages.length === 0}
            className="btn-primary w-full mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title={messages.length === 0 ? 'Realiza al menos una pregunta al paciente' : ''}
          >
            Solicitar Exámenes →
          </button>

          {/* Hint de ayuda cuando aún no hay mensajes */}
          {messages.length === 0 && (
            <p className="text-xs text-gray-400 text-center mt-2">
              Haz al menos una pregunta al paciente para continuar
            </p>
          )}
        </div>

        {/* Panel derecho: interfaz de chat (2/3 del ancho en desktop) */}
        <div className="lg:col-span-2 flex flex-col">

          {/* Contenedor del historial de mensajes.
              overflow-y-auto: scroll vertical cuando hay muchos mensajes.
              h-[480px]: altura fija usando Tailwind JIT (Just-In-Time).
                          Las corchetes permiten valores arbitrarios: h-[480px] = height: 480px */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-y-auto h-[480px] p-4 flex flex-col gap-3">

            {/* Mensaje de bienvenida cuando el chat está vacío */}
            {messages.length === 0 && (
              <div className="flex-1 flex items-center justify-center text-center">
                <div>
                  <div className="text-5xl mb-3">💬</div>
                  <p className="text-gray-400 text-sm max-w-xs">
                    Saluda al paciente y comienza la entrevista clínica.
                    Recuerda preguntar sobre síntomas, duración, antecedentes…
                  </p>
                </div>
              </div>
            )}

            {/* Renderizar cada mensaje del historial.
                Los mensajes del estudiante (role="user") van a la derecha.
                Los del paciente (role="assistant") van a la izquierda. */}
            {messages.map((msg, i) => (
              <div
                key={i}
                // justify-end: empuja el mensaje a la derecha (mensajes del usuario)
                // justify-start: por defecto, a la izquierda (mensajes del paciente)
                className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {/* Avatar del paciente — solo para mensajes del paciente (izquierda) */}
                {msg.role === 'assistant' && (
                  <span className="text-2xl self-end flex-shrink-0" aria-label="paciente">
                    {patient?.sex === 'masculino' ? '👨' : '👩'}
                  </span>
                )}

                {/* Burbuja del mensaje con colores diferentes por rol */}
                <div
                  className={
                    `max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ` +
                    (msg.role === 'user'
                      // Mensaje del estudiante: dorado UPN, texto oscuro
                      ? 'bg-[#FDBA30] text-[#1A1A1A] rounded-br-none'
                      // Mensaje del paciente: gris claro
                      : 'bg-[#F0F0F0] text-gray-800 rounded-bl-none')
                  }
                >
                  {msg.content}
                </div>

                {/* Avatar del estudiante — solo para mensajes del estudiante (derecha) */}
                {msg.role === 'user' && (
                  <span className="text-2xl self-end flex-shrink-0" aria-label="estudiante">👨‍⚕️</span>
                )}
              </div>
            ))}

            {/* Indicador de "escribiendo..." mientras espera respuesta del paciente */}
            {isSendingMessage && (
              <div className="flex gap-2 justify-start">
                <span className="text-2xl self-end">{patient?.sex === 'masculino' ? '👨' : '👩'}</span>
                <div className="bg-gray-100 text-gray-400 px-4 py-3 rounded-2xl rounded-bl-none text-sm">
                  {/* Puntos animados con CSS: cada span tiene un delay diferente */}
                  <span className="inline-flex gap-1">
                    <span className="animate-bounce" style={{ animationDelay: '0ms' }}>●</span>
                    <span className="animate-bounce" style={{ animationDelay: '150ms' }}>●</span>
                    <span className="animate-bounce" style={{ animationDelay: '300ms' }}>●</span>
                  </span>
                </div>
              </div>
            )}

            {/* Elemento invisible al final del chat — el auto-scroll apunta aquí.
                useRef + scrollIntoView hace que el chat siempre muestre el mensaje más reciente. */}
            <div ref={chatEndRef} />
          </div>

          {/* Input del chat: campo de texto + botón enviar */}
          <div className="flex gap-2 mt-3">
            <textarea
              value={inputMessage}
              // onChange: evento que se dispara en cada tecla.
              // e.target.value contiene el texto actual del input.
              // Analogía Python: equivale a leer input() pero en tiempo real.
              onChange={e => setInputMessage(e.target.value)}
              onKeyDown={handleChatKeyDown}
              placeholder="Escribe tu pregunta al paciente… (Enter para enviar)"
              rows={2}
              disabled={isSendingMessage}
              // resize-none: evita que el usuario redimensione el textarea manualmente
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#FDBA30]
                         resize-none disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isSendingMessage}
              className="btn-primary px-5 self-end disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {/* Flecha de enviar — cambia a spinner cuando está enviando */}
              {isSendingMessage ? '⏳' : '➤'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // ETAPA 2: SELECCIÓN DE EXÁMENES DE LABORATORIO
  // ---------------------------------------------------------------------------
  function renderStage2() {
    // Filtrar el catálogo según el término de búsqueda.
    // Object.entries(obj) retorna pares [[key, value], ...] — como dict.items() en Python.
    const filteredCatalog = Object.entries(LAB_CATALOG).reduce((acc, [category, tests]) => {
      // Filtrar tests de esta categoría que contengan el término de búsqueda
      const filtered = tests.filter(test =>
        test.toLowerCase().includes(searchTerm.toLowerCase())
      )
      // Solo incluir la categoría si tiene tests que coincidan
      if (filtered.length > 0) acc[category] = filtered
      return acc
      // {}: valor inicial del acumulador (como en Python: functools.reduce(..., {}))
    }, {})

    return (
      <div className="max-w-3xl mx-auto">

        {/* Encabezado con título e instrucciones */}
        <div className="mb-4">
          <h2 className="text-xl font-bold text-[#1A1A1A] mb-1">
            Solicitar Exámenes de Laboratorio
          </h2>
          <p className="text-gray-500 text-sm">
            Selecciona los exámenes que consideres necesarios para tu diagnóstico.
          </p>
        </div>

        {/* Barra de búsqueda para filtrar tests */}
        <div className="relative mb-4">
          {/* Icono de lupa posicionado absolutamente dentro del input */}
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar examen…"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm
                       focus:outline-none focus:ring-2 focus:ring-[#FDBA30]"
          />
        </div>

        {/* Contador de seleccionados + botón para limpiar */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-500">
            {selectedTests.size > 0
              ? `${selectedTests.size} examen(es) seleccionado(s)`
              : 'Ningún examen seleccionado'}
          </span>
          {selectedTests.size > 0 && (
            <button
              onClick={() => setSelectedTests(new Set())}
              className="text-xs text-red-400 hover:text-red-600 transition-colors"
            >
              Limpiar selección ✕
            </button>
          )}
        </div>

        {/* Listado de categorías con checkboxes */}
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {Object.entries(filteredCatalog).map(([category, tests]) => (
            <div key={category} className="card !p-4">
              {/* Encabezado de categoría */}
              <h3 className="font-semibold text-[#1A1A1A] text-sm mb-2 uppercase tracking-wide">
                {category}
              </h3>
              {/* Grid de checkboxes: 2 columnas en pantallas medianas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {tests.map(test => {
                  // ¿Este test está seleccionado actualmente?
                  const isSelected = selectedTests.has(test)
                  return (
                    <label
                      key={test}
                      // cursor-pointer: muestra mano al hover, indicando que es clickeable
                      className={
                        `flex items-center gap-2 p-2 rounded-lg cursor-pointer
                         transition-colors text-sm ` +
                        (isSelected
                          ? 'bg-[#FFF3CC] text-[#1A1A1A]'  // Fondo dorado claro cuando seleccionado
                          : 'hover:bg-gray-50 text-gray-700')
                      }
                    >
                      {/* Checkbox nativo con estilos de Tailwind.
                          checked: prop controlada — el checkbox refleja selectedTests.has(test).
                          onChange: handler para actualizar el estado cuando el usuario hace click. */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleTest(test)}
                        className="accent-[#FDBA30] w-4 h-4 flex-shrink-0"
                      />
                      {test}
                    </label>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Estado vacío: no hay resultados de búsqueda */}
          {Object.keys(filteredCatalog).length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <div className="text-4xl mb-2">🔍</div>
              <p>No se encontraron exámenes con "{searchTerm}"</p>
            </div>
          )}
        </div>

        {/* Botones de navegación */}
        <div className="flex gap-3 mt-4">
          {/* Botón para volver a la etapa anterior */}
          <button
            onClick={() => setStage(1)}
            className="btn-secondary flex-1"
          >
            ← Volver al Paciente
          </button>

          {/* Botón principal para obtener resultados */}
          <button
            onClick={requestLabs}
            disabled={selectedTests.size === 0 || isLoading}
            className="btn-primary flex-2 flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '⏳ Procesando…' : `Ver Resultados (${selectedTests.size} seleccionados)`}
          </button>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // ETAPA 3: TABLA DE RESULTADOS
  // ---------------------------------------------------------------------------
  function renderStage3() {
    // Convertir el dict de resultados a un array de pares [test, resultado]
    // para poder iterarlo con map(). Object.entries() equivale a dict.items() en Python.
    const resultEntries = Object.entries(labResults)

    return (
      <div className="max-w-3xl mx-auto">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-[#1A1A1A] mb-1">Resultados de Laboratorio</h2>
          <p className="text-gray-500 text-sm">
            Los valores marcados en rojo/naranja indican resultados anormales.
          </p>
        </div>

        {/* Tabla de resultados */}
        <div className="card !p-0 overflow-hidden">
          {/* overflow-hidden: evita que los bordes redondeados de la tarjeta
              sean "sobrepasados" por el contenido de la tabla */}
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1A1A1A] text-white">
                <th className="text-left px-5 py-3 font-semibold">Examen</th>
                <th className="text-left px-5 py-3 font-semibold">Resultado</th>
                <th className="px-3 py-3 font-semibold text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {resultEntries.map(([test, result], index) => {
                const abnormal = isAbnormal(result)
                return (
                  // Filas alternadas (zebra striping) para legibilidad
                  <tr
                    key={test}
                    className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                  >
                    {/* Nombre del test */}
                    <td className="px-5 py-3 font-medium text-gray-700">{test}</td>

                    {/* Resultado: rojo/naranja si anormal, gris si normal */}
                    <td className={`px-5 py-3 ${abnormal ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                      {result}
                    </td>

                    {/* Badge de estado visual */}
                    <td className="px-3 py-3 text-center">
                      {abnormal ? (
                        // Valor anormal: círculo naranja
                        <span className="inline-block w-6 h-6 rounded-full bg-orange-100 text-orange-600
                                         text-xs flex items-center justify-center font-bold mx-auto"
                              title="Valor anormal">
                          !
                        </span>
                      ) : (
                        // Valor normal: círculo verde
                        <span className="inline-block w-6 h-6 rounded-full bg-green-100 text-green-600
                                         text-xs flex items-center justify-center mx-auto"
                              title="Dentro de parámetros normales">
                          ✓
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Leyenda */}
        <div className="flex gap-4 mt-3 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-orange-300 inline-block" />
            Valor anormal
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-green-300 inline-block" />
            Dentro de parámetros normales
          </span>
        </div>

        {/* Botones de navegación */}
        <div className="flex gap-3 mt-4">
          <button onClick={() => setStage(2)} className="btn-secondary flex-1">
            ← Agregar Más Exámenes
          </button>
          <button onClick={() => setStage(4)} className="btn-primary flex-1">
            Realizar Diagnóstico →
          </button>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // ETAPA 4: FORMULARIO DE DIAGNÓSTICO
  // ---------------------------------------------------------------------------
  function renderStage4() {
    const isFormValid = diagnosis.trim().length > 0 && reasoning.trim().length > 0

    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-[#1A1A1A] mb-1">Diagnóstico Final</h2>
          <p className="text-gray-500 text-sm">
            Basándote en la entrevista y los resultados de laboratorio, ¿cuál es tu diagnóstico?
          </p>
        </div>

        <div className="card space-y-5">

          {/* Campo: Diagnóstico principal */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Diagnóstico Principal <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={diagnosis}
              onChange={e => setDiagnosis(e.target.value)}
              placeholder="Ej: Diabetes mellitus tipo 2, Neumonía bacteriana…"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#FDBA30]"
            />
          </div>

          {/* Campo: Razonamiento clínico */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Fundamento del Diagnóstico <span className="text-red-400">*</span>
            </label>
            <textarea
              value={reasoning}
              onChange={e => setReasoning(e.target.value)}
              placeholder={
                'Explica tu razonamiento clínico:\n' +
                '• ¿Qué síntomas te llevaron a este diagnóstico?\n' +
                '• ¿Qué resultados de laboratorio lo confirman?\n' +
                '• ¿Por qué descartaste otros diagnósticos?'
              }
              rows={7}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#FDBA30] resize-none"
            />
            {/* Contador de caracteres — indicador sutil de longitud del razonamiento */}
            <div className="text-right text-xs text-gray-300 mt-1">
              {reasoning.length} caracteres
            </div>
          </div>

          {/* Botones de navegación */}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setStage(3)} className="btn-secondary flex-1">
              ← Ver Resultados
            </button>
            <button
              onClick={submitDiagnosis}
              disabled={!isFormValid || isLoading}
              className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin text-lg">⏳</span>
                  Evaluando con IA…
                </span>
              ) : (
                '✉ Enviar Diagnóstico'
              )}
            </button>
          </div>

          {/* Aviso de que la evaluación puede tardar */}
          {isLoading && (
            <p className="text-xs text-center text-gray-400">
              MedSim está evaluando tu diagnóstico con análisis profundo. Esto puede tardar ~15 segundos…
            </p>
          )}
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // ETAPA 5: RESULTADOS Y EVALUACIÓN
  // ---------------------------------------------------------------------------
  function renderStage5() {
    if (!scoreResult) return null

    const { score_breakdown, total_score, correct_diagnosis, feedback } = scoreResult

    // Categorías de evaluación con sus labels legibles y breakdowns del servidor
    const categories = [
      { key: 'history_taking',  label: 'Anamnesis',            icon: '💬' },
      { key: 'lab_selection',   label: 'Exámenes Solicitados', icon: '🔬' },
      { key: 'diagnosis',       label: 'Diagnóstico',          icon: '🩺' },
      { key: 'reasoning',       label: 'Razonamiento',         icon: '🧠' },
    ]

    // Color del score total según rango — semáforo de desempeño
    const scoreColor =
      total_score >= 80 ? 'text-green-600' :
      total_score >= 60 ? 'text-yellow-600' :
      total_score >= 40 ? 'text-orange-600' :
                          'text-red-600'

    const scoreBg =
      total_score >= 80 ? 'bg-green-50 border-green-200' :
      total_score >= 60 ? 'bg-yellow-50 border-yellow-200' :
      total_score >= 40 ? 'bg-orange-50 border-orange-200' :
                          'bg-red-50 border-red-200'

    return (
      <div className="max-w-3xl mx-auto space-y-5">

        {/* === TARJETA DE DIAGNÓSTICO: correcto vs. propuesto === */}
        <div className="card">
          <h2 className="text-xl font-bold text-[#1A1A1A] mb-4">Resultado de la Simulación</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Diagnóstico correcto */}
            <div className="bg-[#FFF3CC] border border-[#FDBA30] rounded-xl p-4">
              <div className="text-xs text-[#1A1A1A] font-semibold uppercase tracking-wide mb-1">
                Diagnóstico Correcto
              </div>
              <div className="font-bold text-[#1A1A1A] text-base">{correct_diagnosis}</div>
            </div>

            {/* Diagnóstico propuesto por el estudiante */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">
                Tu Diagnóstico
              </div>
              <div className="font-bold text-gray-700 text-base">{diagnosis}</div>
            </div>
          </div>
        </div>

        {/* === PUNTUACIÓN TOTAL === */}
        <div className={`card border-2 ${scoreBg} text-center`}>
          <div className="text-sm text-gray-500 mb-1 font-medium">Puntuación Total</div>
          <div className={`text-6xl font-bold ${scoreColor}`}>{total_score}</div>
          <div className="text-gray-400 text-sm mt-1">de 100 puntos</div>

          {/* Barra de progreso del score total */}
          <div className="mt-4 h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                total_score >= 80 ? 'bg-green-500' :
                total_score >= 60 ? 'bg-yellow-500' :
                total_score >= 40 ? 'bg-orange-500' :
                                    'bg-red-500'
              }`}
              // style.width como porcentaje — Tailwind no soporta valores dinámicos
              // como w-[${total_score}%] en build (requiere CSS inline para valores calculados)
              style={{ width: `${total_score}%` }}
            />
          </div>
        </div>

        {/* === DESGLOSE POR CATEGORÍAS === */}
        <div className="card">
          <h3 className="font-bold text-[#1A1A1A] mb-4">Desglose por Categoría</h3>
          <div className="space-y-5">
            {categories.map(({ key, label, icon }) => {
              // score_breakdown puede no tener la clave si hubo error
              const catData = score_breakdown[key] || { score: 0, feedback: 'Sin evaluación disponible.' }
              const pct = (catData.score / 25) * 100  // Porcentaje sobre 25 pts máx

              // Color de la barra según desempeño en esa categoría
              const barColor =
                catData.score >= 20 ? 'bg-green-500' :
                catData.score >= 15 ? 'bg-[#FDBA30]' :
                catData.score >= 10 ? 'bg-orange-400' :
                                      'bg-red-400'

              return (
                <div key={key}>
                  {/* Fila: icono + nombre + puntos */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-gray-700">
                      {icon} {label}
                    </span>
                    <span className="text-sm font-bold text-[#1A1A1A]">
                      {catData.score}
                      <span className="text-gray-400 font-normal">/25</span>
                    </span>
                  </div>

                  {/* Barra de progreso de la categoría */}
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Feedback textual de Claude para esta categoría */}
                  <p className="text-xs text-gray-500 leading-relaxed pl-1">
                    {catData.feedback}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* === FEEDBACK GENERAL === */}
        {feedback && (
          <div className="card bg-[#FFF3CC] border border-[#FDBA30]/40">
            <h3 className="font-bold text-[#1A1A1A] mb-2">💡 Retroalimentación General</h3>
            <p className="text-sm text-[#555555] leading-relaxed">{feedback}</p>
          </div>
        )}

        {/* === BOTONES DE ACCIÓN FINAL === */}
        <div className="flex gap-3">
          {/* Navegar al historial de sesiones */}
          <button
            onClick={() => navigate('/history')}
            className="btn-secondary flex-1"
          >
            📋 Ver en Historia
          </button>

          {/* Reiniciar: llama a startSession() que resetea todo el estado */}
          <button
            onClick={startSession}
            className="btn-primary flex-1"
          >
            🔄 Nuevo Paciente
          </button>
        </div>
      </div>
    )
  }


  // ===========================================================================
  // RENDER PRINCIPAL DEL COMPONENTE
  // ===========================================================================

  // Estado de carga inicial: aún no tenemos datos del paciente
  // Se muestra antes de que la API /session/start responda
  if (isLoading && !patient) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        {/* Spinner de carga usando animación CSS de Tailwind */}
        <div className="w-12 h-12 border-4 border-[#FDBA30] border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Generando paciente virtual…</p>
        <p className="text-gray-400 text-xs">
          MedSim está creando un caso clínico personalizado para ti.
        </p>
      </div>
    )
  }

  // Estado de error en la carga inicial (ej: backend no disponible)
  if (error && !patient) {
    return (
      <div className="max-w-md mx-auto mt-16">
        <div className="card border-2 border-red-200 bg-red-50 text-center">
          <div className="text-5xl mb-3">⚠️</div>
          <h2 className="font-bold text-red-700 mb-2">Error al iniciar la sesión</h2>
          <p className="text-red-600 text-sm mb-5">{error}</p>
          <button onClick={startSession} className="btn-primary">
            Intentar de Nuevo
          </button>
        </div>
      </div>
    )
  }

  // Render principal: Stepper + contenido de la etapa actual
  return (
    // Fragmento de React: retorna múltiples elementos sin un wrapper div extra.
    // <> ... </> es la sintaxis corta de <React.Fragment> ... </React.Fragment>
    <>
      {/* Stepper: siempre visible, muestra el progreso */}
      <Stepper currentStage={stage} />

      {/* Error no-bloqueante: se muestra sobre el contenido de la etapa */}
      {error && patient && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex justify-between items-center">
          <span>⚠️ {error}</span>
          {/* Botón para cerrar el error: setError(null) hace que desaparezca */}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-3">✕</button>
        </div>
      )}

      {/* Renderizado condicional de la etapa actual.
          Equivalente Python:
            if stage == 1: return renderStage1()
            elif stage == 2: return renderStage2()
            ... etc.

          En JSX se usa el operador ternario anidado o múltiples && evaluaciones.
          Aquí usamos una función helper para mayor claridad. */}
      {stage === 1 && renderStage1()}
      {stage === 2 && renderStage2()}
      {stage === 3 && renderStage3()}
      {stage === 4 && renderStage4()}
      {stage === 5 && renderStage5()}
    </>
  )
}

export default NewPatient
