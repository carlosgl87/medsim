"""
MedSim Patient Agent
====================
Módulo responsable de todas las interacciones con la API de Claude.
Implementa al paciente virtual y el sistema de evaluación educativa.

Funciones principales:
  generate_patient_profile() - Crea un paciente ficticio coherente con la enfermedad
  chat_with_patient()        - Procesa una pregunta y retorna respuesta del paciente
  get_lab_results()          - Retorna resultados de laboratorio basados en la enfermedad
  score_session()            - Evalúa el desempeño diagnóstico del estudiante
"""

import os
import json
import random
import unicodedata
import re

import anthropic
from dotenv import load_dotenv

# Carga el .env por si este módulo es importado antes que main.py
# (doble carga es inofensiva, load_dotenv() ignora variables ya definidas)
load_dotenv()

# =============================================================================
# CLIENTE DE ANTHROPIC (ASYNC)
# =============================================================================

# Usamos AsyncAnthropic para compatibilidad con los endpoints async de FastAPI.
# Lee ANTHROPIC_API_KEY del entorno automáticamente (seteado por load_dotenv).
# Si la variable no está definida, las llamadas a la API fallarán con AuthenticationError.
client = anthropic.AsyncAnthropic()

# =============================================================================
# LISTAS DE NOMBRES PARA GENERAR PACIENTES FICTICIOS
# =============================================================================

# Nombres masculinos comunes en Latinoamérica
MALE_NAMES = [
    "Carlos", "Miguel", "José", "Luis", "Jorge", "Ricardo", "Fernando",
    "Roberto", "Eduardo", "Manuel", "Andrés", "Pedro", "Antonio", "Juan",
    "Diego", "Alejandro", "Víctor", "Héctor", "Raúl", "Gabriel"
]

# Nombres femeninos comunes en Latinoamérica
FEMALE_NAMES = [
    "María", "Ana", "Carmen", "Rosa", "Patricia", "Gloria", "Elena",
    "Sandra", "Claudia", "Lucía", "Isabel", "Sofía", "Valeria", "Gabriela",
    "Daniela", "Fernanda", "Mónica", "Lorena", "Beatriz", "Adriana"
]

# Apellidos comunes en Latinoamérica (se usan dos por paciente)
SURNAMES = [
    "García", "López", "Martínez", "Rodríguez", "Pérez", "González",
    "Sánchez", "Ramírez", "Torres", "Flores", "Rivera", "Vargas", "Morales",
    "Jiménez", "Mendoza", "Castro", "Herrera", "Rojas", "Ortiz", "Díaz"
]


# =============================================================================
# GENERACIÓN DE PERFIL DEL PACIENTE
# =============================================================================

async def generate_patient_profile(disease: dict) -> dict:
    """Genera un perfil completo de paciente ficticio coherente con la enfermedad.

    Crea características demográficas aleatorias (dentro de rangos realistas
    según sexo) y usa Claude para generar una historia de presentación que
    describa los síntomas sin revelar el diagnóstico.

    Args:
        disease: Diccionario de la enfermedad desde diseases.json, con campos:
                 name, symptoms, typical_lab_results, scoring_rubric, etc.

    Returns:
        Diccionario con:
        - name (str): Nombre completo ficticio (primer nombre + 2 apellidos)
        - age (int): Edad entre 18 y 70 años
        - sex (str): "masculino" o "femenino"
        - weight (int): Peso en kg (rangos realistas por sexo)
        - height (int): Talla en cm (rangos realistas por sexo)
        - backstory (str): Historia de presentación en lenguaje coloquial
    """
    # Seleccionar sexo aleatoriamente
    sex = random.choice(["masculino", "femenino"])

    # Edad en rango de adultos (18-70 años cubre la mayoría de patologías relevantes)
    age = random.randint(18, 70)

    # Talla y peso con rangos por sexo (aproximados para población latinoamericana)
    if sex == "masculino":
        height = random.randint(160, 188)   # cm
        weight = random.randint(60, 115)    # kg
    else:
        height = random.randint(150, 175)   # cm
        weight = random.randint(48, 98)     # kg

    # Generar nombre completo: primer nombre + apellido paterno + apellido materno
    first_names = MALE_NAMES if sex == "masculino" else FEMALE_NAMES
    name = (
        f"{random.choice(first_names)} "
        f"{random.choice(SURNAMES)} "
        f"{random.choice(SURNAMES)}"
    )

    # Prompt para que Claude genere una historia de presentación realista
    # Importante: se le pasa el diagnóstico como CONFIDENCIAL para que pueda
    # crear una historia coherente, pero se le pide que NO lo mencione.
    backstory_prompt = f"""Eres un generador de historias clínicas para un simulador médico educativo.

Crea una historia breve y realista para un paciente con estas características:
- Sexo: {sex}
- Edad: {age} años
- Peso: {weight} kg
- Talla: {height} cm
- Enfermedad que tiene (CONFIDENCIAL - NO la menciones directamente): {disease['name']}

La historia debe:
1. Tener 3-4 oraciones en lenguaje sencillo y coloquial (no médico)
2. Mencionar el motivo de consulta de forma vaga (ej: "lleva días sintiéndose mal")
3. Incluir 1-2 antecedentes familiares o hábitos de vida relevantes para la enfermedad
4. NO nombrar ni insinuar directamente el diagnóstico
5. Sonar como una persona real contando su situación

Responde ÚNICAMENTE con el texto de la historia, sin comentarios adicionales."""

    # Llamada a Claude para generar la historia (sin thinking, es una tarea simple)
    response = await client.messages.create(
        model="claude-opus-4-6",
        max_tokens=400,
        messages=[{"role": "user", "content": backstory_prompt}]
    )

    # Extraer el texto de la respuesta
    # Filtramos por type=="text" por si acaso hubiera otros tipos de bloques
    backstory = next(
        (b.text for b in response.content if b.type == "text"),
        "Paciente que acude a consulta por molestias que llevan varios días."
    )

    return {
        "name": name,
        "age": age,
        "sex": sex,
        "weight": weight,
        "height": height,
        "backstory": backstory.strip()
    }


# =============================================================================
# CONVERSACIÓN CON EL PACIENTE VIRTUAL
# =============================================================================

def _build_patient_system_prompt(session: dict) -> str:
    """Construye el system prompt que define la personalidad del paciente virtual.

    Este prompt es el "alma" del paciente: le dice a Claude quién es, qué siente
    y cómo debe comportarse durante la entrevista médica.

    Estrategia de confidencialidad: se le dan los síntomas pero NO el nombre
    de la enfermedad, para que el paciente pueda describir lo que siente sin
    "autodiagnosticarse".

    Args:
        session: Diccionario completo de la sesión con patient_profile y disease.

    Returns:
        String con el system prompt completo para Claude.
    """
    profile = session["patient_profile"]
    disease = session["disease"]

    # Solo usamos los primeros 6 síntomas para no sobrecargar el prompt
    # y mantener la ambigüedad diagnóstica apropiada para el ejercicio
    main_symptoms = disease["symptoms"][:6]

    return f"""Eres {profile['name']}, un paciente que acude a una consulta médica.
Debes mantenerte en el personaje durante toda la conversación.

DATOS PERSONALES:
- Edad: {profile['age']} años
- Sexo: {profile['sex']}
- Peso: {profile['weight']} kg
- Talla: {profile['height']} cm
- Historia: {profile['backstory']}

CONDICIÓN MÉDICA (ESTRICTAMENTE CONFIDENCIAL - NUNCA revelar el nombre):
Tienes síntomas de: {', '.join(main_symptoms)}.
No sabes qué enfermedad tienes. Describes cómo te sientes, no diagnósticos.

REGLAS DE COMPORTAMIENTO:
1. Habla en español coloquial latinoamericano (como habla la gente común)
2. Describe tus síntomas con palabras cotidianas, NO términos médicos
   - Di "me duele la barriga" en vez de "dolor abdominal"
   - Di "orino mucho" en vez de "poliuria"
   - Di "me cuesta respirar" en vez de "disnea"
3. Muéstrate ligeramente nervioso o preocupado, pero cooperativo
4. Responde SOLO lo que te preguntan, de forma natural y concisa
5. Si no te preguntan algo específico, no lo menciones voluntariamente
6. Si te preguntan qué enfermedad tienes: "No sé doctor/doctora, por eso vine"
7. NUNCA menciones el nombre de la enfermedad ni el diagnóstico
8. Mantén consistencia con tu historia y síntomas en toda la conversación

LONGITUD DE RESPUESTAS: 1-3 oraciones máximo. Eres un paciente, no un narrador."""


async def chat_with_patient(session: dict, user_message: str) -> str:
    """Genera la respuesta del paciente virtual a una pregunta del estudiante.

    Envía el historial completo de la conversación a Claude en cada llamada,
    ya que la API de Claude es sin estado (no recuerda conversaciones anteriores).
    El historial se recupera del archivo de sesión y se pasa como messages[].

    Args:
        session: Diccionario completo de la sesión (incluye conversation history).
        user_message: Pregunta o mensaje del estudiante al paciente.

    Returns:
        String con la respuesta del paciente en español coloquial.
    """
    # Construir el system prompt con la personalidad y datos del paciente
    system_prompt = _build_patient_system_prompt(session)

    # Recuperar el historial de conversación guardado en la sesión
    # Cada elemento es {"role": "user"/"assistant", "content": "..."}
    conversation = session.get("conversation", [])

    # Construir la lista completa de mensajes para esta llamada:
    # historial previo + nuevo mensaje del usuario
    # Claude usará esto para mantener coherencia en la conversación
    messages_to_send = conversation + [{"role": "user", "content": user_message}]

    # Llamar a Claude actuando como el paciente
    response = await client.messages.create(
        model="claude-opus-4-6",
        max_tokens=512,        # Respuestas cortas (1-3 oraciones del paciente)
        system=system_prompt,  # Define la personalidad del paciente
        messages=messages_to_send
    )

    # Extraer el texto de la respuesta del paciente
    patient_response = next(
        (b.text for b in response.content if b.type == "text"),
        "Disculpe doctor, ¿podría repetir la pregunta?"  # Fallback si algo falla
    )

    return patient_response.strip()


# =============================================================================
# RESULTADOS DE LABORATORIO
# =============================================================================

def _normalize_for_matching(text: str) -> str:
    """Normaliza un string para comparación insensible a mayúsculas/acentos.

    Convierte a minúsculas y elimina diacríticos (tildes, diéresis, etc.)
    para que "Glucosa" == "glucosa" y "Hemoglobina" == "Hemoglobína".

    Técnica: unicodedata.normalize('NFD') separa los caracteres base de sus
    diacríticos, luego filtramos los caracteres de categoría 'Mn' (Mark, Nonspacing).

    Args:
        text: String a normalizar.

    Returns:
        String en minúsculas sin diacríticos.

    Examples:
        "Glucosa en Ayunas" -> "glucosa en ayunas"
        "Hemoglobina Glicosilada (HbA1c)" -> "hemoglobina glicosilada (hba1c)"
    """
    text = text.lower().strip()
    return ''.join(
        c for c in unicodedata.normalize('NFD', text)
        if unicodedata.category(c) != 'Mn'
    )


def get_lab_results(disease: dict, requested_tests: list) -> dict:
    """Retorna resultados de laboratorio realistas para los exámenes solicitados.

    Para cada examen solicitado, intenta encontrar una coincidencia en los
    labs típicos de la enfermedad usando matching fuzzy (insensible a mayúsculas,
    acentos y coincidencia parcial de nombres).

    Lógica de matching:
    - "glucosa" en "Glucosa en ayunas" -> match -> valor anormal de la enfermedad
    - "TSH" en ningún lab de diabetes -> no match -> "Dentro de parámetros normales"

    Args:
        disease: Diccionario de la enfermedad con typical_lab_results.
        requested_tests: Lista de nombres de exámenes solicitados por el estudiante.

    Returns:
        Diccionario {nombre_examen_solicitado: resultado_con_unidades_y_referencia}.
        Los exámenes sin match retornan "Dentro de parámetros normales".
    """
    # Labs típicos de la enfermedad: dict {nombre_lab: valor_con_unidades}
    # Ej: {"Glucosa en ayunas": "138 mg/dL (elevada; normal: 70–99 mg/dL)"}
    typical_labs = disease.get("typical_lab_results", {})
    results = {}

    for requested_test in requested_tests:
        # Normalizar el nombre del examen solicitado por el estudiante
        req_norm = _normalize_for_matching(requested_test)
        matched = False

        # Buscar coincidencia con cada lab en el perfil de la enfermedad
        for lab_name, lab_value in typical_labs.items():
            lab_norm = _normalize_for_matching(lab_name)

            # Matching bidireccional: "glucosa" está en "glucosa en ayunas" (req en lab)
            # O "glucosa en ayunas" está en "glucosa en ayunas completo" (lab en req)
            if req_norm in lab_norm or lab_norm in req_norm:
                results[requested_test] = lab_value
                matched = True
                break  # Usar la primera coincidencia encontrada

        # Si no hay coincidencia, el examen es "normal" para este paciente
        if not matched:
            results[requested_test] = "Dentro de parámetros normales"

    return results


# =============================================================================
# EVALUACIÓN Y PUNTUACIÓN
# =============================================================================

async def score_session(session: dict, student_diagnosis: str, student_reasoning: str) -> dict:
    """Evalúa el desempeño diagnóstico del estudiante con Claude.

    Usa adaptive thinking para una evaluación profunda y matizada.
    La evaluación considera 4 dimensiones de competencia clínica (25 pts c/u):

    1. Historia clínica (25 pts): ¿Hizo las preguntas clave del rubric?
    2. Selección de laboratorios (25 pts): ¿Solicitó los labs diagnósticos clave?
    3. Diagnóstico (25 pts): ¿Acertó el diagnóstico correcto?
    4. Razonamiento (25 pts): ¿Justificó bien su diagnóstico con la evidencia?

    Técnica de extracción: Claude escribe el JSON dentro de tags <evaluation>
    para que podamos extraerlo con regex incluso si hay bloques de thinking
    antes del texto de respuesta.

    Args:
        session: Diccionario completo de la sesión finalizada.
        student_diagnosis: Diagnóstico propuesto por el estudiante.
        student_reasoning: Razonamiento clínico del estudiante.

    Returns:
        Diccionario con:
        - score_breakdown (dict): Puntuación y feedback por categoría
        - total_score (int): Suma total (0-100)
        - correct_diagnosis (str): Nombre del diagnóstico correcto
    """
    disease = session["disease"]
    rubric = disease["scoring_rubric"]

    # Extraer solo los mensajes del estudiante (role=="user") para evaluar historia
    student_questions = [
        msg["content"]
        for msg in session.get("conversation", [])
        if msg["role"] == "user"
    ]

    # Lista de exámenes solicitados durante la sesión
    labs_requested = session.get("labs_requested", [])

    # Prompt de evaluación con toda la información relevante para Claude
    # El rubric del JSON contiene: key_questions, key_labs, correct_diagnosis_criteria
    scoring_prompt = f"""Eres un evaluador experto en educación médica. Tu tarea es evaluar el desempeño de un estudiante de medicina en una simulación clínica.

INFORMACIÓN DE LA SESIÓN:
- Enfermedad real del paciente: {disease['name']}
- Preguntas clave que debería haber hecho (rubric): {json.dumps(rubric['key_questions'], ensure_ascii=False)}
- Exámenes de laboratorio clave (rubric): {json.dumps(rubric['key_labs'], ensure_ascii=False)}
- Criterios de diagnóstico correcto: {json.dumps(rubric['correct_diagnosis_criteria'], ensure_ascii=False)}

DESEMPEÑO DEL ESTUDIANTE:
- Preguntas realizadas al paciente: {json.dumps(student_questions, ensure_ascii=False)}
- Exámenes de laboratorio solicitados: {json.dumps(labs_requested, ensure_ascii=False)}
- Diagnóstico propuesto: {student_diagnosis}
- Razonamiento clínico: {student_reasoning}

INSTRUCCIONES DE EVALUACIÓN:
Evalúa al estudiante en 4 categorías de 0 a 25 puntos cada una:

1. HISTORIA CLÍNICA (0-25 pts): ¿Qué tan bien interrogó al paciente?
   - 25 pts: Cubrió la mayoría de preguntas clave del rubric con buena profundidad
   - 15-24 pts: Cubrió preguntas importantes pero faltaron algunas clave
   - 5-14 pts: Solo cubrió aspectos básicos, faltaron muchas preguntas esenciales
   - 0-4 pts: Interrogatorio muy deficiente o mínimo

2. SELECCIÓN DE LABORATORIOS (0-25 pts): ¿Pidió los exámenes correctos?
   - 25 pts: Solicitó los labs diagnósticos clave del rubric
   - 15-24 pts: Pidió algunos labs clave y otros relevantes
   - 5-14 pts: Solicitó pocos labs relevantes o muchos innecesarios
   - 0-4 pts: Labs solicitados no son pertinentes o no pidió ninguno

3. DIAGNÓSTICO (0-25 pts): ¿Acertó el diagnóstico?
   - 25 pts: Diagnóstico correcto o muy cercano (sinónimo aceptable)
   - 15-24 pts: Diagnóstico parcialmente correcto (tipo correcto pero subtipo incorrecto)
   - 5-14 pts: Diagnóstico incorrecto pero en el diferencial razonable
   - 0-4 pts: Diagnóstico completamente errado

4. RAZONAMIENTO (0-25 pts): ¿Justificó bien su diagnóstico?
   - 25 pts: Razonamiento sólido integrando síntomas, hallazgos y labs
   - 15-24 pts: Razonamiento aceptable con algunos elementos clave
   - 5-14 pts: Razonamiento superficial o con errores conceptuales
   - 0-4 pts: Sin razonamiento o completamente incorrecto

Escribe tu evaluación DENTRO de las etiquetas <evaluation> con exactamente este formato JSON:
<evaluation>
{{
  "history_taking": {{
    "score": <número entre 0 y 25>,
    "feedback": "<comentario específico sobre el interrogatorio del estudiante>"
  }},
  "lab_selection": {{
    "score": <número entre 0 y 25>,
    "feedback": "<comentario específico sobre los labs solicitados>"
  }},
  "diagnosis": {{
    "score": <número entre 0 y 25>,
    "feedback": "<comentario específico sobre el diagnóstico propuesto>"
  }},
  "reasoning": {{
    "score": <número entre 0 y 25>,
    "feedback": "<comentario específico sobre el razonamiento clínico>"
  }},
  "overall_feedback": "<resumen educativo de 2-3 oraciones con los puntos más importantes a mejorar>"
}}
</evaluation>"""

    # Llamar a Claude con adaptive thinking para evaluación profunda
    # Adaptive thinking permite que Claude "piense" internamente antes de responder,
    # lo que mejora la calidad de la evaluación para casos complejos.
    # IMPORTANTE: La respuesta puede contener bloques ThinkingBlock antes del TextBlock;
    # por eso filtramos explícitamente por type=="text".
    response = await client.messages.create(
        model="claude-opus-4-6",
        max_tokens=3000,
        thinking={"type": "adaptive"},   # Claude decide cuándo y cuánto pensar
        messages=[{"role": "user", "content": scoring_prompt}]
    )

    # Extraer solo el bloque de texto (ignorar bloques de thinking)
    response_text = next(
        (b.text for b in response.content if b.type == "text"),
        ""
    )

    # Extraer el JSON de la evaluación de las tags <evaluation>...</evaluation>
    # re.DOTALL permite que el punto (.) coincida con saltos de línea
    match = re.search(r'<evaluation>(.*?)</evaluation>', response_text, re.DOTALL)

    if match:
        try:
            scores = json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            # Si el JSON es inválido, usar puntuaciones por defecto
            scores = _default_scores("Error al procesar la evaluación automática.")
    else:
        # Si Claude no generó las tags esperadas, usar puntuaciones por defecto
        scores = _default_scores("No se encontró evaluación estructurada en la respuesta.")

    # Calcular la puntuación total sumando las 4 categorías
    total_score = sum([
        scores.get(category, {}).get("score", 0)
        for category in ["history_taking", "lab_selection", "diagnosis", "reasoning"]
    ])

    # Asegurar que el total no supere 100 por errores de Claude
    total_score = min(100, max(0, total_score))

    return {
        "score_breakdown": scores,
        "total_score": total_score,
        "correct_diagnosis": rubric["correct_diagnosis_criteria"]["diagnosis_name"]
    }


def _default_scores(error_message: str) -> dict:
    """Genera puntuaciones por defecto cuando ocurre un error en la evaluación.

    Se usa como fallback cuando Claude no genera la respuesta en el formato
    esperado o cuando hay un error de parseo del JSON.

    Args:
        error_message: Descripción del error ocurrido para incluir en el feedback.

    Returns:
        Diccionario con todas las categorías en 0 y el mensaje de error como feedback.
    """
    return {
        "history_taking": {
            "score": 0,
            "feedback": f"Error en evaluación: {error_message}"
        },
        "lab_selection": {
            "score": 0,
            "feedback": f"Error en evaluación: {error_message}"
        },
        "diagnosis": {
            "score": 0,
            "feedback": f"Error en evaluación: {error_message}"
        },
        "reasoning": {
            "score": 0,
            "feedback": f"Error en evaluación: {error_message}"
        },
        "overall_feedback": (
            f"Hubo un error técnico al procesar tu evaluación: {error_message} "
            f"Por favor, contacta al administrador del sistema."
        )
    }
