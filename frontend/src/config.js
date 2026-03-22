/**
 * config.js — Configuración centralizada de la aplicación
 * =========================================================
 * Centralizar la URL del backend en un solo archivo tiene varias ventajas:
 * 1. Si cambias el puerto o el host del backend, solo lo cambias aquí
 * 2. En producción puedes usar variables de entorno de Vite (import.meta.env.VITE_API_URL)
 * 3. Es fácil de encontrar para cualquier desarrollador nuevo en el proyecto
 *
 * Analogía Python: equivale a tener un settings.py o config.py centralizado.
 *
 * Uso en otros archivos:
 *   import { API_URL } from '../config.js'
 *   const response = await axios.post(`${API_URL}/session/start`)
 *
 * Para producción, cambia la URL al dominio real del backend:
 *   export const API_URL = "https://api.medsim.edu.pe"
 *
 * O mejor aún, usa una variable de entorno de Vite:
 *   export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"
 * Y define VITE_API_URL=https://api.medsim.edu.pe en el archivo .env.production
 */

// URL base del backend FastAPI
// Debe coincidir con el puerto donde corre uvicorn (por defecto 8000)
export const API_URL = "http://localhost:8000"
