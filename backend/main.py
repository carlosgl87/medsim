"""
MedSim FastAPI Backend
======================
API REST para el simulador de casos clínicos médicos.
Gestiona sesiones, conversación con el paciente virtual,
solicitud de exámenes de laboratorio y evaluación diagnóstica.

Endpoints:
  POST /session/start    - Inicia una nueva sesión con paciente aleatorio
  POST /session/chat     - Conversa con el paciente virtual
  POST /session/labs     - Solicita exámenes de laboratorio
  POST /session/diagnose - Envía diagnóstico y recibe puntuación
  GET  /history          - Lista todas las sesiones completadas
  GET  /session/{id}     - Obtiene datos completos de una sesión
"""

import os
import json
import uuid
import random
from datetime import datetime
from pathlib import Path
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Carga las variables de entorno del archivo .env antes de cualquier otra cosa.
# Esto asegura que ANTHROPIC_API_KEY esté disponible para el módulo patient_agent.
load_dotenv()

# Importamos las funciones del agente después de cargar dotenv
from patient_agent import (
    generate_patient_profile,
    chat_with_patient,
    get_lab_results,
    score_session,
)

# =============================================================================
# CONFIGURACIÓN DE RUTAS
# =============================================================================

# Directorio base del backend (donde vive este archivo)
BASE_DIR = Path(__file__).parent

# Directorio donde se guardan las sesiones como archivos JSON
SESSIONS_DIR = BASE_DIR / "sessions"

# Archivo JSON con la lista de enfermedades y sus datos
DISEASES_FILE = BASE_DIR / "diseases.json"

# Crea el directorio de sesiones si no existe
SESSIONS_DIR.mkdir(exist_ok=True)

# =============================================================================
# INICIALIZACIÓN DE LA APLICACIÓN FASTAPI
# =============================================================================

app = FastAPI(
    title="MedSim API",
    description="API para simulador de casos clínicos médicos con IA",
    version="1.0.0",
)

# Configuración de CORS (Cross-Origin Resource Sharing)
# Permite que el frontend React (en otro puerto) llame a esta API.
# En producción, cambia allow_origins a la URL específica del frontend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # Permite cualquier origen (desarrollo)
    allow_credentials=True,
    allow_methods=["*"],          # Permite GET, POST, PUT, DELETE, etc.
    allow_headers=["*"],          # Permite todos los headers
)

# =============================================================================
# MODELOS PYDANTIC (VALIDACIÓN DE REQUESTS)
# =============================================================================

class ChatRequest(BaseModel):
    """Modelo para la solicitud de chat con el paciente virtual.

    FastAPI valida automáticamente que el JSON entrante tenga estos campos
    con los tipos correctos antes de ejecutar la función del endpoint.
    """
    session_id: str   # UUID de la sesión activa
    message: str      # Mensaje/pregunta del estudiante al paciente


class LabRequest(BaseModel):
    """Modelo para la solicitud de exámenes de laboratorio."""
    session_id: str              # UUID de la sesión activa
    requested_tests: List[str]   # Lista de nombres de exámenes solicitados


class DiagnoseRequest(BaseModel):
    """Modelo para el envío del diagnóstico final del estudiante."""
    session_id: str    # UUID de la sesión activa
    diagnosis: str     # Diagnóstico propuesto por el estudiante
    reasoning: str     # Razonamiento clínico del estudiante


# =============================================================================
# FUNCIONES AUXILIARES DE SESIÓN
# =============================================================================

def load_diseases() -> list:
    """Carga y retorna la lista de enfermedades desde el archivo JSON.

    Returns:
        Lista de diccionarios, cada uno representando una enfermedad
        con sus síntomas, labs típicos y rubrica de evaluación.

    Raises:
        FileNotFoundError: Si diseases.json no existe en la ruta esperada.
    """
    with open(DISEASES_FILE, encoding="utf-8") as f:
        return json.load(f)


def get_session_path(session_id: str) -> Path:
    """Construye la ruta completa del archivo JSON de una sesión.

    Args:
        session_id: UUID de la sesión como string.

    Returns:
        Path al archivo {session_id}.json en el directorio de sesiones.
    """
    return SESSIONS_DIR / f"{session_id}.json"


def load_session(session_id: str) -> dict:
    """Carga los datos de una sesión desde su archivo JSON.

    Args:
        session_id: UUID de la sesión a cargar.

    Returns:
        Diccionario con todos los datos de la sesión.

    Raises:
        HTTPException(404): Si no existe una sesión con ese ID.
    """
    path = get_session_path(session_id)
    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Sesión '{session_id}' no encontrada. Verifica el session_id."
        )
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_session(session_id: str, data: dict) -> None:
    """Guarda los datos de una sesión en su archivo JSON.

    Usa indent=2 para legibilidad y ensure_ascii=False para preservar
    caracteres especiales del español (tildes, ñ, etc.).

    Args:
        session_id: UUID de la sesión.
        data: Diccionario con todos los datos a guardar.
    """
    path = get_session_path(session_id)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# =============================================================================
# ENDPOINTS DE LA API
# =============================================================================

@app.post("/session/start")
async def start_session():
    """Inicia una nueva sesión de simulación clínica.

    Flujo:
    1. Carga todas las enfermedades disponibles
    2. Selecciona una enfermedad al azar
    3. Genera un perfil de paciente ficticio coherente con la enfermedad
    4. Crea y persiste la sesión con un UUID único
    5. Retorna el session_id y el perfil del paciente (sin diagnóstico)

    Returns:
        JSON con session_id (str) y patient (dict con name, age, sex, weight,
        height, backstory). El diagnóstico NO se revela al estudiante.
    """
    # Cargar enfermedades y seleccionar una al azar
    diseases = load_diseases()
    disease = random.choice(diseases)

    # Generar perfil del paciente con Claude (llamada async a la API)
    # Esta función crea nombre, edad, peso, talla y una historia de presentación
    patient_profile = await generate_patient_profile(disease)

    # Crear identificador único para esta sesión
    session_id = str(uuid.uuid4())

    # Estructura completa de datos de la sesión
    session_data = {
        "session_id": session_id,
        "disease": disease,                    # Datos completos de la enfermedad (confidencial)
        "patient_profile": patient_profile,    # Perfil visible al estudiante
        "conversation": [],                    # Historial de mensajes [{"role": "user/assistant", "content": "..."}]
        "labs_requested": [],                  # Lista de nombres de exámenes pedidos
        "lab_results": {},                     # Dict {nombre_examen: resultado}
        "diagnosis_submitted": False,          # Bandera: ¿ya envió diagnóstico?
        "score": None,                         # Resultado de evaluación (se llena al diagnosticar)
        "student_diagnosis": None,             # Diagnóstico propuesto por el estudiante
        "student_reasoning": None,             # Razonamiento del estudiante
        "created_at": datetime.now().isoformat(),
        "completed_at": None,
        "status": "active"                     # "active" o "completed"
    }

    # Persistir la sesión en disco
    save_session(session_id, session_data)

    # Retornar solo lo que el estudiante debe ver (NO el diagnóstico)
    return {
        "session_id": session_id,
        "patient": patient_profile
    }


@app.post("/session/chat")
async def chat(request: ChatRequest):
    """Procesa un mensaje del estudiante y retorna la respuesta del paciente.

    El historial completo de la conversación se guarda en el archivo de sesión
    y se envía a Claude en cada llamada (la API es sin estado, no tiene memoria).

    Args:
        request: ChatRequest con session_id y message del estudiante.

    Returns:
        JSON con response (str): respuesta del paciente virtual en español coloquial.

    Raises:
        HTTPException(404): Si la sesión no existe.
        HTTPException(400): Si la sesión ya fue completada.
    """
    # Cargar la sesión desde disco
    session = load_session(request.session_id)

    # No permitir más mensajes si la sesión ya terminó
    if session["status"] == "completed":
        raise HTTPException(
            status_code=400,
            detail="Esta sesión ya fue completada. Inicia una nueva sesión para seguir practicando."
        )

    # Obtener respuesta del paciente virtual via Claude
    # La función recibe el historial completo de conversación para mantener contexto
    patient_response = await chat_with_patient(session, request.message)

    # Agregar el nuevo intercambio al historial de conversación
    # Importante: primero el mensaje del usuario, luego la respuesta del asistente
    session["conversation"].append({
        "role": "user",
        "content": request.message
    })
    session["conversation"].append({
        "role": "assistant",
        "content": patient_response
    })

    # Guardar la sesión actualizada con el nuevo historial
    save_session(request.session_id, session)

    return {"response": patient_response}


@app.post("/session/labs")
async def request_labs(request: LabRequest):
    """Procesa la solicitud de exámenes de laboratorio del estudiante.

    Retorna resultados realistas basados en la enfermedad del paciente:
    - Tests relevantes para la enfermedad: valores anormales con rangos normales
    - Tests no relacionados: resultado "Dentro de parámetros normales"

    El matching es fuzzy: "glucosa" coincide con "Glucosa en ayunas" en diseases.json.

    Args:
        request: LabRequest con session_id y lista de requested_tests.

    Returns:
        JSON con lab_results (dict {nombre_examen: resultado_con_unidades}).

    Raises:
        HTTPException(404): Si la sesión no existe.
        HTTPException(400): Si la sesión ya completada o lista de exámenes vacía.
    """
    # Cargar la sesión desde disco
    session = load_session(request.session_id)

    # No permitir más exámenes si la sesión ya terminó
    if session["status"] == "completed":
        raise HTTPException(
            status_code=400,
            detail="Esta sesión ya fue completada. No puedes solicitar más exámenes."
        )

    # Validar que se solicitó al menos un examen
    if not request.requested_tests:
        raise HTTPException(
            status_code=400,
            detail="Debes solicitar al menos un examen de laboratorio."
        )

    # Obtener resultados según la enfermedad del paciente (función sincrónica, sin IA)
    results = get_lab_results(session["disease"], request.requested_tests)

    # Actualizar el historial de exámenes en la sesión
    # extend() agrega los nuevos tests a la lista existente
    session["labs_requested"].extend(request.requested_tests)
    # update() agrega/sobreescribe los nuevos resultados en el dict existente
    session["lab_results"].update(results)

    # Guardar la sesión actualizada
    save_session(request.session_id, session)

    return {"lab_results": results}


@app.post("/session/diagnose")
async def diagnose(request: DiagnoseRequest):
    """Evalúa el diagnóstico del estudiante y retorna la puntuación detallada.

    Usa Claude con adaptive thinking para evaluar 4 categorías (0-25 pts cada una):
    - Historia clínica (25 pts): calidad de las preguntas realizadas al paciente
    - Selección de laboratorios (25 pts): pertinencia de los exámenes solicitados
    - Diagnóstico (25 pts): corrección del diagnóstico propuesto
    - Razonamiento (25 pts): calidad del razonamiento clínico

    Total máximo: 100 puntos.

    Solo se puede diagnosticar una vez por sesión.

    Args:
        request: DiagnoseRequest con session_id, diagnosis y reasoning.

    Returns:
        JSON con score_breakdown (dict), total_score (int),
        correct_diagnosis (str) y feedback (str).

    Raises:
        HTTPException(404): Si la sesión no existe.
        HTTPException(400): Si ya se envió un diagnóstico para esta sesión.
    """
    # Cargar la sesión desde disco
    session = load_session(request.session_id)

    # Verificar que no se haya enviado diagnóstico previamente
    # Solo se permite un intento por sesión para mantener la integridad educativa
    if session["diagnosis_submitted"]:
        raise HTTPException(
            status_code=400,
            detail="Ya enviaste un diagnóstico para esta sesión. Solo se permite un intento."
        )

    # Llamar a Claude para evaluar el desempeño del estudiante
    # Esta es la operación más costosa (usa adaptive thinking)
    score_result = await score_session(session, request.diagnosis, request.reasoning)

    # Marcar la sesión como completada y guardar todos los datos
    session["diagnosis_submitted"] = True
    session["status"] = "completed"
    session["completed_at"] = datetime.now().isoformat()
    session["student_diagnosis"] = request.diagnosis
    session["student_reasoning"] = request.reasoning
    session["score"] = score_result

    # Persistir la sesión finalizada
    save_session(request.session_id, session)

    # Retornar el resultado de la evaluación
    return {
        "score_breakdown": score_result["score_breakdown"],
        "total_score": score_result["total_score"],
        "correct_diagnosis": score_result["correct_diagnosis"],
        "feedback": score_result["score_breakdown"].get("overall_feedback", "")
    }


@app.get("/history")
async def get_history():
    """Retorna la lista de todas las sesiones completadas.

    Escanea el directorio de sesiones y filtra solo las completadas.
    Útil para mostrar el historial de desempeño del estudiante.

    Returns:
        JSON con sessions (list): lista de sesiones completadas ordenadas
        por fecha (más reciente primero). Cada sesión incluye:
        session_id, patient_name, date, total_score, correct_diagnosis,
        student_diagnosis, disease_category.
    """
    sessions = []

    # Iterar sobre todos los archivos JSON en el directorio de sesiones
    for session_file in SESSIONS_DIR.glob("*.json"):
        try:
            with open(session_file, encoding="utf-8") as f:
                session = json.load(f)

            # Solo incluir sesiones completadas (que tienen diagnóstico evaluado)
            if session.get("status") == "completed":
                sessions.append({
                    "session_id": session["session_id"],
                    "patient_name": session["patient_profile"]["name"],
                    # Usar completed_at si existe, si no created_at como fallback
                    "date": session.get("completed_at", session["created_at"]),
                    "total_score": session["score"]["total_score"] if session["score"] else None,
                    "correct_diagnosis": session["score"]["correct_diagnosis"] if session["score"] else None,
                    "student_diagnosis": session.get("student_diagnosis", ""),
                    "disease_category": session["disease"]["category"],
                })

        except (json.JSONDecodeError, KeyError):
            # Ignorar archivos corruptos o con estructura inesperada
            continue

    # Ordenar por fecha descendente (sesión más reciente primero)
    sessions.sort(key=lambda x: x["date"], reverse=True)

    return {"sessions": sessions}


@app.get("/session/{session_id}")
async def get_session(session_id: str):
    """Retorna todos los datos completos de una sesión específica.

    Incluye perfil del paciente, historial de conversación, resultados
    de laboratorio, diagnóstico del estudiante y puntuación (si está completada).

    NOTA: Este endpoint también revela la enfermedad real del paciente.
    Úsalo solo para revisión post-sesión, no durante la simulación.

    Args:
        session_id: UUID de la sesión (path parameter).

    Returns:
        Diccionario completo con todos los datos de la sesión.

    Raises:
        HTTPException(404): Si la sesión no existe.
    """
    # load_session ya lanza HTTPException(404) si no existe
    session = load_session(session_id)
    return session
