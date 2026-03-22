/**
 * History.jsx — Historial de simulaciones clínicas completadas
 * =============================================================
 * Carga el historial de sesiones del backend y muestra una grilla de tarjetas.
 * Al hacer click en una tarjeta, abre un panel lateral con el detalle completo.
 *
 * ESTRUCTURA DEL COMPONENTE:
 * --------------------------
 * Funciones helper puras (sin estado, sin JSX):
 *   getInitials(name)       - "María García López" → "MG"
 *   formatDate(isoString)   - "2026-03-22T..." → "22 mar 2026, 10:30"
 *   getScoreStyle(score)    - 85 → { bg, text, border, label }
 *   isAbnormal(result)      - "138 mg/dL (elevada)" → true
 *
 * Sub-componentes (reciben props, retornan JSX):
 *   ScoreBadge              - pastilla de color según puntaje
 *   InitialsAvatar          - círculo con iniciales del nombre
 *   SessionCard             - tarjeta del historial (clickeable)
 *   SessionModal            - panel lateral con detalle completo
 *
 * Componente principal:
 *   History                 - gestiona el estado global, carga datos, renderiza
 *
 * CONCEPTOS REACT EN ESTE ARCHIVO:
 * ----------------------------------
 * useState:       variables reactivas — al cambiar, React re-renderiza el componente
 * useEffect:      código que corre después del render (aquí: carga inicial de datos)
 * Props:          parámetros que el padre pasa al hijo (como kwargs en Python)
 * Conditional rendering: JSX equivalente a if/else, muestra u oculta partes de la UI
 * Modal/overlay:  panel fijo sobre el contenido, controlado por estado booleano
 * Escape key:     useEffect con event listener para cerrar modal con tecla Escape
 */

import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import { API_URL } from '../config.js'


// =============================================================================
// FUNCIONES HELPER PURAS (sin estado, sin JSX)
// =============================================================================
// Son funciones JavaScript ordinarias. Las definimos fuera del componente porque:
// 1. No necesitan acceso al estado interno del componente
// 2. No se re-crean en cada render (mejor performance)
// 3. Son más fáciles de leer y testear de forma aislada
// Analogía Python: funciones de módulo, no métodos de instancia.

/**
 * Extrae las iniciales de un nombre completo para mostrarlas en el avatar.
 * Toma la primera letra del primer nombre y la primera del segundo apellido.
 *
 * @param {string} name - Nombre completo, ej: "María García López"
 * @returns {string} Iniciales en mayúsculas, ej: "MG"
 *
 * @example
 * getInitials("Carlos Rodríguez Pérez") → "CR"
 * getInitials("Ana")                    → "AN"  (primera + segunda letra si hay una sola palabra)
 */
function getInitials(name) {
  if (!name) return '??'
  // split(' ') divide el string por espacios — como str.split(' ') en Python
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length === 1) {
    // Si solo hay una palabra, usar las dos primeras letras
    return parts[0].substring(0, 2).toUpperCase()
  }
  // Primera letra del primer nombre + primera letra del primer apellido (segunda palabra)
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

/**
 * Formatea una fecha ISO 8601 a un string legible en español.
 *
 * @param {string} isoString - Fecha en formato ISO, ej: "2026-03-22T10:30:00.000"
 * @returns {string} Fecha formateada, ej: "22 mar 2026, 10:30"
 */
function formatDate(isoString) {
  if (!isoString) return '—'
  try {
    // Intl.DateTimeFormat: API nativa del navegador para formatear fechas
    // según locale e idioma. No requiere librería externa (como Moment.js).
    // Analogía Python: datetime.strftime() pero configurable por locale.
    return new Intl.DateTimeFormat('es-PE', {
      day: '2-digit',
      month: 'short',  // "mar", "abr", etc.
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoString))
  } catch {
    return isoString.slice(0, 10)  // Fallback: solo la fecha YYYY-MM-DD
  }
}

/**
 * Retorna el estilo visual (clases Tailwind) según el puntaje numérico.
 * Implementa el semáforo de colores: verde > 75, amarillo 50-74, rojo < 50.
 *
 * @param {number|null} score - Puntaje de 0 a 100
 * @returns {object} { bg, text, border, ring, label, barColor }
 */
function getScoreStyle(score) {
  if (score === null || score === undefined) {
    return {
      bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200',
      ring: 'ring-gray-200', label: 'Sin puntaje', barColor: 'bg-gray-300',
    }
  }
  if (score >= 75) {
    return {
      bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200',
      ring: 'ring-green-200', label: 'Excelente', barColor: 'bg-green-500',
    }
  }
  if (score >= 50) {
    return {
      bg: 'bg-[#FFF3CC]', text: 'text-[#1A1A1A]', border: 'border-[#FDBA30]',
      ring: 'ring-[#FDBA30]', label: 'Regular', barColor: 'bg-[#FDBA30]',
    }
  }
  return {
    bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200',
    ring: 'ring-red-200', label: 'Insuficiente', barColor: 'bg-red-500',
  }
}

/**
 * Determina si un resultado de laboratorio es anormal.
 * El backend retorna "Dentro de parámetros normales" para valores normales
 * y el valor real con unidades para los anormales.
 *
 * @param {string} result - String de resultado del backend
 * @returns {boolean}
 */
function isAbnormal(result) {
  if (!result || result === 'Dentro de parámetros normales') return false
  const keywords = ['elevada','elevado','alta','alto','baja','bajo','positivo','anormal','aumentado','disminuido']
  const lower = result.toLowerCase()
  return keywords.some(kw => lower.includes(kw))
}


// =============================================================================
// SUB-COMPONENTE: ScoreBadge
// =============================================================================

/**
 * ScoreBadge — Pastilla con el puntaje coloreada según rango.
 *
 * CONCEPTO: Props desestructuradas
 * La firma function ScoreBadge({ score }) es equivalente a:
 *   function ScoreBadge(props) { const score = props.score; ... }
 * Es como Python: def badge(score): ...
 * El padre pasa el valor con: <ScoreBadge score={85} />
 *
 * @param {number|null} score - Puntaje de 0 a 100
 */
function ScoreBadge({ score }) {
  const style = getScoreStyle(score)
  return (
    // inline-flex: como flex pero el elemento se comporta como inline (no ocupa toda la fila)
    // ring-2: sombra/borde exterior sutil para resaltar la pastilla
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold
                      border ${style.bg} ${style.text} ${style.border}`}>
      {/* Círculo relleno como indicador de color adicional */}
      <span className={`w-2 h-2 rounded-full ${style.barColor}`} />
      {score !== null && score !== undefined ? `${score} pts` : '—'}
    </span>
  )
}


// =============================================================================
// SUB-COMPONENTE: InitialsAvatar
// =============================================================================

/**
 * InitialsAvatar — Círculo de color con las iniciales del nombre.
 * Usado cuando no hay foto del paciente.
 *
 * @param {string} name  - Nombre completo para extraer iniciales
 * @param {string} size  - Tamaño Tailwind: 'sm' | 'lg' (default: 'lg')
 */
function InitialsAvatar({ name, size = 'lg' }) {
  const initials = getInitials(name)

  // Dimensiones según el tamaño solicitado
  const sizeClasses = size === 'sm'
    ? 'w-9 h-9 text-sm'
    : 'w-14 h-14 text-xl'

  return (
    // rounded-full: círculo perfecto
    // flex-shrink-0: evita que se comprima en layouts flex
    // select-none: evita que las iniciales se seleccionen al hacer clic
    <div className={`${sizeClasses} rounded-full bg-[#1A1A1A] text-white font-bold
                     flex items-center justify-center flex-shrink-0 select-none`}>
      {initials}
    </div>
  )
}


// =============================================================================
// SUB-COMPONENTE: SessionCard
// =============================================================================

/**
 * SessionCard — Tarjeta clickeable de una sesión en la grilla del historial.
 *
 * CONCEPTO: Callback como prop
 * El padre (History) pasa la función onSelect como prop.
 * Cuando el usuario hace click, la tarjeta llama a onSelect(session.session_id).
 * Esto permite que el padre controle qué sesión mostrar en el modal.
 * Analogía Python: pasar una función callback como argumento.
 *
 * @param {object}   session  - Datos de la sesión (del endpoint GET /history)
 * @param {function} onSelect - Callback que recibe el session_id al hacer click
 */
function SessionCard({ session, onSelect }) {
  const scoreStyle = getScoreStyle(session.total_score)

  // ¿El diagnóstico del estudiante coincide con el correcto?
  // Comparación insensible a mayúsculas y espacios extra
  const diagnosisMatch = session.student_diagnosis &&
    session.student_diagnosis.trim().toLowerCase() ===
    session.correct_diagnosis?.trim().toLowerCase()

  return (
    // onClick: manejador de click nativo del DOM.
    // En React se usa camelCase (onClick, onChange, onKeyDown) en vez de HTML's onclick.
    // Cuando el usuario hace click, llamamos onSelect con el ID de esta sesión.
    //
    // cursor-pointer: el cursor cambia a mano, indicando que es clickeable
    // hover:shadow-md + hover:-translate-y-0.5: efecto de "levantar" la tarjeta al pasar el mouse
    // transition-all duration-200: anima TODOS los cambios CSS en 200ms
    // ring-2 + ring-offset-2: al hover, agrega un borde exterior en el color del puntaje
    <div
      onClick={() => onSelect(session.session_id)}
      className={`bg-white rounded-xl border-2 ${scoreStyle.border} shadow-sm p-5
                  cursor-pointer group
                  hover:shadow-md hover:-translate-y-0.5
                  transition-all duration-200
                  hover:ring-2 hover:ring-offset-2 ${scoreStyle.ring}`}
      // role + tabIndex: accesibilidad — hace que la tarjeta sea navegable con Tab
      // y activable con Enter/Space como si fuera un botón
      role="button"
      tabIndex={0}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onSelect(session.session_id)}
      aria-label={`Ver detalle de ${session.patient_name}`}
    >
      {/* Fila superior: avatar + nombre + badge de puntaje */}
      <div className="flex items-start justify-between gap-3 mb-4">

        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar con iniciales — min-w-0 en el padre evita overflow en flex */}
          <InitialsAvatar name={session.patient_name} />

          <div className="min-w-0">
            {/* truncate: recorta el texto con "..." si es demasiado largo para el contenedor */}
            <h3 className="font-bold text-[#1A1A1A] truncate text-base leading-tight">
              {session.patient_name}
            </h3>
            {/* Categoría de la enfermedad en badge pequeño */}
            <span className="text-xs text-gray-400 capitalize">
              {session.disease_category || 'Medicina Interna'}
            </span>
          </div>
        </div>

        {/* Badge de puntaje en la esquina superior derecha */}
        <ScoreBadge score={session.total_score} />
      </div>

      {/* Fila media: datos demográficos del paciente */}
      <div className="flex gap-3 text-sm text-gray-500 mb-4">
        <span className="flex items-center gap-1">
          {/* Ternario inline: condicion ? valorSiTrue : valorSiFalse
              Equivalente Python: '👨' if sex == 'masculino' else '👩' */}
          {session.patient_sex === 'masculino' ? '👨' : '👩'}
          <span className="capitalize">{session.patient_sex}</span>
        </span>
        {session.patient_age && (
          <span>{session.patient_age} años</span>
        )}
        <span className="ml-auto text-xs text-gray-400">{formatDate(session.date)}</span>
      </div>

      {/* Diagnósticos: correcto vs. el del estudiante */}
      <div className="space-y-2 text-sm">

        {/* Diagnóstico correcto */}
        <div className="flex items-start gap-2">
          <span className="text-[#FDBA30] flex-shrink-0 font-bold text-xs mt-0.5">DX✓</span>
          <span className="text-gray-600 leading-tight">{session.correct_diagnosis || '—'}</span>
        </div>

        {/* Diagnóstico del estudiante con indicador de match */}
        <div className="flex items-start gap-2">
          <span className="text-gray-400 flex-shrink-0 font-bold text-xs mt-0.5">TU</span>
          <span className={`leading-tight ${diagnosisMatch ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
            {session.student_diagnosis || '—'}
          </span>
          {/* Solo mostrar el tick verde si el diagnóstico coincide */}
          {diagnosisMatch && <span className="text-green-500 flex-shrink-0">✓</span>}
        </div>
      </div>

      {/* Indicador de "Ver detalle →" que aparece al hover */}
      <div className="mt-4 text-xs text-[#FDBA30] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
        Ver detalle completo →
      </div>
    </div>
  )
}


// =============================================================================
// SUB-COMPONENTE: SessionModal
// =============================================================================

/**
 * SessionModal — Panel lateral deslizante con el detalle completo de una sesión.
 *
 * CONCEPTO: Modal / Overlay
 * Un modal es una capa que se superpone sobre el contenido principal.
 * Se implementa con position: fixed que ancla el elemento al viewport (ventana),
 * ignorando el scroll de la página. El fondo semitransparente (backdrop) señaliza
 * que el contenido debajo no es interactivo.
 *
 * CONCEPTO: Escape key con useEffect
 * Para cerrar con Escape, usamos useEffect para agregar un event listener al
 * documento. IMPORTANTE: el cleanup del efecto (return function) elimina el
 * listener cuando el componente se desmonta, evitando memory leaks.
 *
 * @param {object}   detail     - Datos completos de la sesión (GET /session/{id})
 * @param {boolean}  isLoading  - true mientras se cargan los datos del detalle
 * @param {function} onClose    - Callback para cerrar el modal
 */
function SessionModal({ detail, isLoading, onClose }) {
  // useEffect para capturar la tecla Escape y cerrar el modal.
  // El array de dependencias [onClose] hace que el efecto se re-registre
  // si onClose cambia (aunque en este caso no cambia, es buena práctica).
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    // addEventListener: agrega un listener de teclado al documento completo
    document.addEventListener('keydown', handleKeyDown)

    // CLEANUP: función que retorna el useEffect — se ejecuta cuando el componente
    // se desmonta (el modal se cierra). Esencial para evitar memory leaks.
    // Analogía Python: es como el bloque finally de un context manager.
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Bloquear el scroll del body mientras el modal está abierto.
  // Sin esto, el usuario puede scrollear el fondo, lo que se siente raro.
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Categorías de evaluación — misma estructura que en NewPatient.jsx
  const scoreCategories = [
    { key: 'history_taking',  label: 'Anamnesis',            icon: '💬' },
    { key: 'lab_selection',   label: 'Exámenes Solicitados', icon: '🔬' },
    { key: 'diagnosis',       label: 'Diagnóstico',          icon: '🩺' },
    { key: 'reasoning',       label: 'Razonamiento',         icon: '🧠' },
  ]

  return (
    // BACKDROP (fondo semitransparente)
    // fixed inset-0: position:fixed + top/right/bottom/left = 0 → cubre todo el viewport
    // z-50: z-index 50 — encima de todo el resto (navbar tiene z-50, usamos z-40 para backdrop)
    // bg-black/50: fondo negro con 50% de opacidad (sintaxis moderna de Tailwind)
    // flex justify-end: alinea el panel al lado derecho del backdrop
    //
    // onClick en el backdrop (no en el panel) cierra el modal al hacer click fuera.
    // Este patrón se llama "dismiss on outside click".
    <div
      className="fixed inset-0 z-40 bg-black/50 flex justify-end"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Detalle de sesión"
    >
      {/* PANEL LATERAL
          e.stopPropagation(): evita que el click DENTRO del panel llegue al backdrop
          y cierre el modal accidentalmente.
          Analogía Python: es como llamar a event.stopPropagation() en JavaScript del DOM. */}
      <div
        className="relative bg-white h-full w-full max-w-2xl overflow-y-auto shadow-2xl
                   flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* === HEADER DEL MODAL === */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="font-bold text-[#1A1A1A] text-lg">Detalle de Sesión</h2>
          {/* Botón cerrar: × en esquina superior derecha */}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center
                       text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Cerrar detalle"
          >
            ✕
          </button>
        </div>

        {/* === CONTENIDO DEL MODAL === */}
        <div className="flex-1 px-6 py-5 space-y-6">

          {/* Estado de carga mientras se obtiene el detalle completo */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-10 h-10 border-4 border-[#FDBA30] border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-400 text-sm">Cargando detalle de la sesión…</p>
            </div>
          )}

          {/* Contenido real: solo se renderiza cuando detail está disponible y no está cargando */}
          {!isLoading && detail && (
            <>
              {/* ── SECCIÓN 1: PERFIL DEL PACIENTE ─────────────────────── */}
              <section>
                <SectionTitle icon="👤" title="Perfil del Paciente" />

                <div className="card !p-4">
                  {/* Encabezado: avatar + nombre + sex */}
                  <div className="flex items-center gap-3 mb-4">
                    <InitialsAvatar name={detail.patient_profile?.name} />
                    <div>
                      <div className="font-bold text-[#1A1A1A] text-base">
                        {detail.patient_profile?.name}
                      </div>
                      <span className="badge-info capitalize">{detail.patient_profile?.sex}</span>
                    </div>
                  </div>

                  {/* Grid de datos demográficos */}
                  <div className="grid grid-cols-3 gap-2 text-center mb-4">
                    {[
                      { value: `${detail.patient_profile?.age} años`, label: 'Edad' },
                      { value: `${detail.patient_profile?.weight} kg`, label: 'Peso' },
                      { value: `${detail.patient_profile?.height} cm`, label: 'Talla' },
                    ].map(({ value, label }) => (
                      <div key={label} className="bg-gray-50 rounded-lg p-2">
                        <div className="font-semibold text-[#1A1A1A] text-sm">{value}</div>
                        <div className="text-xs text-gray-400">{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Historia clínica del paciente */}
                  <p className="text-sm text-gray-600 italic leading-relaxed border-t border-gray-100 pt-3">
                    "{detail.patient_profile?.backstory}"
                  </p>
                </div>
              </section>

              {/* ── SECCIÓN 2: CONVERSACIÓN ─────────────────────────────── */}
              <section>
                <SectionTitle icon="💬" title={`Anamnesis (${detail.conversation?.length / 2 | 0} intercambios)`} />

                {/* Contenedor de chat con altura máxima y scroll */}
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4
                                max-h-80 overflow-y-auto flex flex-col gap-3">

                  {/* Estado vacío: no hubo conversación */}
                  {(!detail.conversation || detail.conversation.length === 0) && (
                    <p className="text-gray-400 text-sm text-center py-6">
                      No hay mensajes registrados en esta sesión.
                    </p>
                  )}

                  {/* Burbujas de chat — mismo estilo que NewPatient etapa 1 */}
                  {(detail.conversation || []).map((msg, i) => (
                    <div
                      key={i}
                      className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {/* Avatar del paciente para mensajes del assistant */}
                      {msg.role === 'assistant' && (
                        <span className="text-xl self-end flex-shrink-0">
                          {detail.patient_profile?.sex === 'masculino' ? '👨' : '👩'}
                        </span>
                      )}

                      <div className={
                        `max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-relaxed ` +
                        (msg.role === 'user'
                          ? 'bg-[#FDBA30] text-[#1A1A1A] rounded-br-none'
                          : 'bg-[#F0F0F0] text-gray-800 rounded-bl-none')
                      }>
                        {msg.content}
                      </div>

                      {/* Avatar del estudiante para mensajes del user */}
                      {msg.role === 'user' && (
                        <span className="text-xl self-end flex-shrink-0">👨‍⚕️</span>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* ── SECCIÓN 3: RESULTADOS DE LABORATORIO ────────────────── */}
              {detail.lab_results && Object.keys(detail.lab_results).length > 0 && (
                <section>
                  <SectionTitle icon="🔬" title={`Laboratorios (${Object.keys(detail.lab_results).length} exámenes)`} />

                  <div className="card !p-0 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#1A1A1A] text-white">
                          <th className="text-left px-4 py-2.5 font-semibold">Examen</th>
                          <th className="text-left px-4 py-2.5 font-semibold">Resultado</th>
                          <th className="px-3 py-2.5 text-center font-semibold w-10">—</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(detail.lab_results).map(([test, result], index) => {
                          const abnormal = isAbnormal(result)
                          return (
                            <tr key={test} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-4 py-2.5 font-medium text-gray-700">{test}</td>
                              <td className={`px-4 py-2.5 ${abnormal ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                                {result}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {abnormal
                                  ? <span className="text-orange-500 font-bold text-xs">!</span>
                                  : <span className="text-green-500 text-xs">✓</span>
                                }
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* ── SECCIÓN 4: DIAGNÓSTICO DEL ESTUDIANTE ───────────────── */}
              <section>
                <SectionTitle icon="📝" title="Diagnóstico del Estudiante" />

                <div className="space-y-3">
                  {/* Comparativa: correcto vs. propuesto */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-[#FFF3CC] border border-[#FDBA30] rounded-xl p-3">
                      <div className="text-xs text-[#1A1A1A] font-semibold uppercase tracking-wide mb-1">
                        Diagnóstico Correcto
                      </div>
                      <div className="font-bold text-[#1A1A1A] text-sm">
                        {detail.score?.correct_diagnosis || detail.disease?.name || '—'}
                      </div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                      <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">
                        Tu Diagnóstico
                      </div>
                      <div className="font-bold text-gray-700 text-sm">
                        {detail.student_diagnosis || '—'}
                      </div>
                    </div>
                  </div>

                  {/* Razonamiento clínico */}
                  {detail.student_reasoning && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">
                        Razonamiento Clínico
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                        {detail.student_reasoning}
                      </p>
                    </div>
                  )}
                </div>
              </section>

              {/* ── SECCIÓN 5: EVALUACIÓN Y PUNTAJE ─────────────────────── */}
              {detail.score && (
                <section>
                  <SectionTitle icon="🏆" title="Evaluación Detallada" />

                  {/* Score total con barra de color */}
                  {(() => {
                    // IIFE (Immediately Invoked Function Expression): bloque de código
                    // que se ejecuta de inmediato dentro del JSX para poder usar variables.
                    // Patrón útil cuando necesitas lógica antes de retornar JSX sin
                    // crear una función separada.
                    // Analogía Python: (lambda: ...)()  — aunque rara vez se usa así.
                    const style = getScoreStyle(detail.score.total_score)
                    return (
                      <div className={`card border-2 ${style.border} ${style.bg} text-center mb-4 !py-4`}>
                        <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">
                          Puntaje Total
                        </div>
                        <div className={`text-5xl font-bold ${style.text}`}>
                          {detail.score.total_score}
                        </div>
                        <div className="text-gray-400 text-xs mt-0.5">de 100 puntos · {style.label}</div>
                        <div className="mt-3 h-2.5 bg-white/70 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${style.barColor} transition-all duration-700`}
                            style={{ width: `${detail.score.total_score}%` }}
                          />
                        </div>
                      </div>
                    )
                  })()}

                  {/* Barras de progreso por categoría */}
                  <div className="card space-y-5">
                    {scoreCategories.map(({ key, label, icon }) => {
                      const catData = detail.score.score_breakdown?.[key] || { score: 0, feedback: '—' }
                      const pct = (catData.score / 25) * 100
                      const barColor =
                        catData.score >= 20 ? 'bg-green-500' :
                        catData.score >= 15 ? 'bg-[#FDBA30]' :
                        catData.score >= 10 ? 'bg-orange-400' : 'bg-red-400'

                      return (
                        <div key={key}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium text-gray-700">
                              {icon} {label}
                            </span>
                            <span className="text-sm font-bold text-[#1A1A1A]">
                              {catData.score}
                              <span className="text-gray-400 font-normal">/25</span>
                            </span>
                          </div>
                          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                            <div
                              className={`h-full rounded-full ${barColor} transition-all duration-700`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 leading-relaxed pl-1">
                            {catData.feedback}
                          </p>
                        </div>
                      )
                    })}
                  </div>

                  {/* Feedback general */}
                  {detail.score.score_breakdown?.overall_feedback && (
                    <div className="card bg-[#FFF3CC] border border-[#FDBA30]/40 mt-4">
                      <h4 className="font-bold text-[#1A1A1A] mb-2 text-sm">💡 Retroalimentación General</h4>
                      <p className="text-sm text-[#555555] leading-relaxed">
                        {detail.score.score_breakdown.overall_feedback}
                      </p>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>{/* fin del contenido */}
      </div>{/* fin del panel */}
    </div>
  )
}


// =============================================================================
// MINI HELPER DE JSX: SectionTitle
// =============================================================================

/**
 * SectionTitle — Encabezado consistente para cada sección del modal.
 * Componente ultra-simple para evitar repetir el mismo patrón 5 veces.
 *
 * @param {string} icon  - Emoji del icono
 * @param {string} title - Texto del título
 */
function SectionTitle({ icon, title }) {
  return (
    <h3 className="flex items-center gap-2 font-bold text-[#1A1A1A] mb-3 text-base">
      <span>{icon}</span>
      {title}
    </h3>
  )
}


// =============================================================================
// COMPONENTE PRINCIPAL: History
// =============================================================================

/**
 * History — Página del historial de simulaciones completadas.
 *
 * Gestiona 3 piezas de estado:
 * 1. sessions:       lista resumida de todas las sesiones (del GET /history)
 * 2. selectedDetail: datos completos de la sesión abierta en el modal (del GET /session/{id})
 * 3. Estados de carga y error para UX adecuada
 */
function History() {
  // ── ESTADO ──────────────────────────────────────────────────────────────────

  /** Lista de sesiones resumidas. Empieza como array vacío (no null)
   *  para que el .map() no falle si la API no ha respondido aún. */
  const [sessions, setSessions] = useState([])

  /** Datos completos de la sesión seleccionada en el modal. null = modal cerrado. */
  const [selectedDetail, setSelectedDetail] = useState(null)

  /** true mientras se carga la lista inicial de sesiones */
  const [isLoading, setIsLoading] = useState(true)

  /** true mientras se carga el detalle de una sesión específica */
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)

  /** Mensaje de error (si existe) */
  const [error, setError] = useState(null)

  /** true cuando el modal debe estar visible (aunque los datos aún carguen) */
  const [isModalOpen, setIsModalOpen] = useState(false)


  // ── EFECTOS ─────────────────────────────────────────────────────────────────

  /**
   * Carga el historial al montar el componente.
   * [] vacío = solo se ejecuta una vez, al montarse (equivale a componentDidMount).
   */
  useEffect(() => {
    loadHistory()
  }, [])


  // ── FUNCIONES ────────────────────────────────────────────────────────────────

  /** Carga la lista de sesiones completadas desde el backend. */
  async function loadHistory() {
    setIsLoading(true)
    setError(null)
    try {
      // axios.get retorna una promesa que resuelve con { data, status, headers, ... }
      const response = await axios.get(`${API_URL}/history`)
      // El backend retorna { sessions: [...] }
      setSessions(response.data.sessions || [])
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al cargar el historial. ¿Está corriendo el backend?')
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Abre el modal y carga el detalle completo de una sesión.
   * Se usa useCallback para memorizar la función y evitar re-creaciones innecesarias.
   * (En este caso es un bonus de performance, no estrictamente necesario.)
   *
   * useCallback(fn, [deps]): memoriza la función entre renders.
   * Solo crea una nueva función si cambian las dependencias.
   * Analogía Python: @functools.lru_cache pero para funciones, no valores.
   *
   * @param {string} sessionId - UUID de la sesión a cargar
   */
  const openDetail = useCallback(async (sessionId) => {
    setIsModalOpen(true)       // Abrir el modal inmediatamente (mostrará spinner)
    setSelectedDetail(null)    // Limpiar el detalle anterior
    setIsLoadingDetail(true)

    try {
      // GET /session/{session_id} retorna TODOS los datos de la sesión
      // incluyendo disease (con diagnóstico correcto), conversación completa, etc.
      const response = await axios.get(`${API_URL}/session/${sessionId}`)
      setSelectedDetail(response.data)
    } catch (err) {
      // Si falla la carga del detalle, cerrar el modal y mostrar error
      setIsModalOpen(false)
      setError(`Error al cargar el detalle: ${err.response?.data?.detail || err.message}`)
    } finally {
      setIsLoadingDetail(false)
    }
  }, []) // [] porque no depende de ningún estado del componente

  /** Cierra el modal y limpia el estado de detalle. */
  const closeModal = useCallback(() => {
    setIsModalOpen(false)
    setSelectedDetail(null)
  }, [])


  // ── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── ENCABEZADO DE LA PÁGINA ──────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A] mb-1">
            Historial de Simulaciones
          </h1>
          <p className="text-gray-500 text-sm">
            {isLoading
              ? 'Cargando sesiones…'
              : sessions.length > 0
                ? `${sessions.length} sesión${sessions.length !== 1 ? 'es' : ''} completada${sessions.length !== 1 ? 's' : ''}`
                : 'Aún no has atendido pacientes'}
          </p>
        </div>

        {/* Botón para recargar el historial */}
        {!isLoading && (
          <button
            onClick={loadHistory}
            className="btn-secondary text-sm flex-shrink-0"
            title="Recargar historial"
          >
            ↻ Actualizar
          </button>
        )}
      </div>

      {/* ── ESTADO DE CARGA INICIAL ───────────────────────────────────────── */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 border-4 border-[#FDBA30] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Cargando historial…</p>
        </div>
      )}

      {/* ── MENSAJE DE ERROR ─────────────────────────────────────────────── */}
      {error && !isLoading && (
        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-start justify-between gap-3">
          <span>⚠️ {error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600 flex-shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── ESTADO VACÍO: no hay sesiones completadas ────────────────────── */}
      {/* Renderizado condicional con &&: solo renderiza si !isLoading Y sessions.length === 0 */}
      {!isLoading && sessions.length === 0 && !error && (
        <div className="card text-center py-16 max-w-md mx-auto">
          <div className="text-7xl mb-4">🏥</div>
          <h2 className="text-lg font-semibold text-gray-700 mb-2">
            Aún no has atendido pacientes
          </h2>
          <p className="text-gray-400 text-sm mb-6 max-w-xs mx-auto">
            Completa tu primera simulación clínica para ver tu historial de desempeño aquí.
          </p>
          {/* Link funciona como botón navegando a /new-patient sin recargar la página */}
          <Link to="/new-patient" className="btn-primary inline-block">
            ＋ Iniciar Primera Simulación
          </Link>
        </div>
      )}

      {/* ── GRILLA DE TARJETAS ───────────────────────────────────────────── */}
      {/* Solo se renderiza cuando tenemos sesiones (y no estamos cargando) */}
      {!isLoading && sessions.length > 0 && (
        <>
          {/* Estadísticas rápidas en fila antes de la grilla */}
          <QuickStats sessions={sessions} />

          {/* grid-cols-1: una columna en móvil
              sm:grid-cols-2: dos columnas en tablets
              lg:grid-cols-3: tres columnas en desktop
              gap-4: espacio entre tarjetas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* sessions.map(): transforma cada objeto de sesión en un componente JSX.
                La prop key es obligatoria — React la usa para identificar cada elemento
                de la lista y optimizar los re-renders. Usar session_id (único) es ideal.
                Analogía Python: [SessionCard(s) for s in sessions] */}
            {sessions.map(session => (
              <SessionCard
                key={session.session_id}
                session={session}
                onSelect={openDetail}  // Pasamos la función como prop (callback)
              />
            ))}
          </div>
        </>
      )}

      {/* ── MODAL DE DETALLE ─────────────────────────────────────────────── */}
      {/* El modal solo se monta en el DOM cuando isModalOpen es true.
          Esto es más eficiente que tenerlo siempre montado y oculto con CSS. */}
      {isModalOpen && (
        <SessionModal
          detail={selectedDetail}
          isLoading={isLoadingDetail}
          onClose={closeModal}
        />
      )}
    </div>
  )
}


// =============================================================================
// MINI COMPONENTE: QuickStats
// =============================================================================

/**
 * QuickStats — Fila de estadísticas resumidas sobre el historial.
 * Muestra promedio de puntuación, tasa de éxito y total de sesiones.
 *
 * @param {Array} sessions - Lista de sesiones del historial
 */
function QuickStats({ sessions }) {
  // Calcular estadísticas — lógica pura de JavaScript (como Python con listas)
  const withScores = sessions.filter(s => s.total_score !== null)

  // reduce() es como functools.reduce() en Python — acumula un valor
  const avgScore = withScores.length > 0
    ? Math.round(withScores.reduce((sum, s) => sum + s.total_score, 0) / withScores.length)
    : null

  const highScoreCount = withScores.filter(s => s.total_score >= 75).length

  const stats = [
    {
      label: 'Sesiones Totales',
      value: sessions.length,
      icon: '📋',
      sub: 'completadas',
    },
    {
      label: 'Promedio',
      value: avgScore !== null ? `${avgScore} pts` : '—',
      icon: '📊',
      sub: 'de 100 puntos',
    },
    {
      label: 'Excelentes',
      value: highScoreCount,
      icon: '🏆',
      sub: 'sesiones ≥ 75 pts',
    },
  ]

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      {stats.map(stat => (
        <div key={stat.label} className="card !p-4 text-center">
          <div className="text-2xl mb-1">{stat.icon}</div>
          <div className="font-bold text-[#1A1A1A] text-xl">{stat.value}</div>
          <div className="text-xs text-gray-400">{stat.sub}</div>
        </div>
      ))}
    </div>
  )
}


export default History
