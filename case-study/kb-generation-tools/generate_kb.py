# genera los articulos de la kb y los guarda como .md para revisar antes de publicar
import csv
import os
import time
from pathlib import Path

from dotenv import load_dotenv
from google import genai

load_dotenv()


client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

CANON_PATH = "tokenia_reference.md"
MATRIZ_PATH = "tokenia_kb_matriz.csv"
OUTPUT_DIR = "kb_generado"
MODEL = "gemini-2.5-flash"

# free tier permite 15 rpm con este modelo, con 5s
SLEEP_BETWEEN_REQUESTS = 5


def cargar_canon():
    with open(CANON_PATH, "r", encoding="utf-8") as f:
        return f.read()


def cargar_matriz():
    with open(MATRIZ_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader)


def armar_prompt(canon, fila):
    doc_type = fila["doc_type"]
    scope = fila["scope"]
    categoria = fila["category"]
    tema = fila["topic"]

    if doc_type == "requirements":
        instruccion = (
            "Escribi un articulo breve que liste los datos obligatorios y opcionales "
            "que un agente de soporte necesita para gestionar una solicitud de esta categoria. "
            "No expliques como resolver el problema, solo que informacion hace falta pedirle al usuario."
        )
    else:
        instruccion = (
            "Escribi un articulo de resolucion claro y directo, como los que tendria un help center real. "
            "Explica el procedimiento paso a paso cuando corresponda."
        )

    contexto_pais = ""
    if scope == "AR":
        contexto_pais = "Este articulo aplica especificamente a usuarios de Argentina."
    elif scope == "BR":
        contexto_pais = "Este articulo aplica especificamente a usuarios de Brasil."

    prompt = f"""Sos redactor de contenido de soporte para Tokenia, un exchange de criptomonedas ficticio.

Datos de referencia de Tokenia (no los repitas textual, usalos como contexto):
{canon}

Categoria: {categoria}
Tema del articulo: {tema}
{contexto_pais}

{instruccion}

Extension: entre 150 y 300 palabras. Tono profesional pero cercano.
Si el articulo es para Brasil, escribilo en portugues. En cualquier otro caso, en espanol rioplatense.
Devolve solo el contenido del articulo, sin titulo ni encabezados markdown."""

    return prompt


def generar_articulo(prompt):
    response = client.models.generate_content(model=MODEL, contents=prompt)
    return response.text.strip()


def formatear_nombre(texto):
    return (
        texto.lower()
        .replace(" ", "-")
        .replace("/", "-")
        .replace("(", "")
        .replace(")", "")
    )


def guardar_articulo(fila, contenido, idx):
    Path(OUTPUT_DIR).mkdir(exist_ok=True)
    nombre = f"{idx:03d}-{formatear_nombre(fila['category'])}-{formatear_nombre(fila['doc_type'])}-{formatear_nombre(fila['scope'])}.md"
    filepath = os.path.join(OUTPUT_DIR, nombre)

    # front matter con los metadatos que usa publish_kb.py despues
    frontmatter = (
        f"---\n"
        f"category: {fila['category']}\n"
        f"doc_type: {fila['doc_type']}\n"
        f"scope: {fila['scope']}\n"
        f"space_key: {fila['space_key']}\n"
        f"topic: {fila['topic']}\n"
        f"---\n\n"
    )

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(frontmatter + contenido)

    return filepath


def main():
    canon = cargar_canon()
    filas = cargar_matriz()

    print(f"generando articulos con {MODEL}...")
    
    # para prueba, usar solo los primeros 3 articulos
    #

    # produccion, genera los 61 articulos
    for idx, fila in enumerate(filas[:3], start=1):
    # for idx, fila in enumerate(filas, start=1):
        prompt = armar_prompt(canon, fila)
        try:
            contenido = generar_articulo(prompt)
        except Exception as e:
            print(f"[{idx}/{len(filas)}] error en '{fila['topic']}': {e}")
            time.sleep(SLEEP_BETWEEN_REQUESTS)
            continue

        filepath = guardar_articulo(fila, contenido, idx)
        print(f"[{idx}/{len(filas)}] {filepath}")

        # no hace falta esperar en el ultimo
        if idx < len(filas):
            time.sleep(SLEEP_BETWEEN_REQUESTS)

    print("\nlistorti")


if __name__ == "__main__":
    main()