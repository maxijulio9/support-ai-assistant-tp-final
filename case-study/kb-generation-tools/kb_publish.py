# publica los articulos generados en kb_generado/ a Confluence via API REST
import os
import re
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()

CONFLUENCE_URL = os.getenv("CONFLUENCE_URL")
CONFLUENCE_EMAIL = os.getenv("CONFLUENCE_EMAIL")
CONFLUENCE_TOKEN = os.getenv("CONFLUENCE_TOKEN")
INPUT_DIR = "kb_generado"


def leer_frontmatter(filepath):

    #lee los metadatos del bloque --- al inicio del archivo md
    with open(filepath, "r", encoding="utf-8") as f:
        contenido = f.read()

    match = re.match(r"^---\n(.*?)\n---\n\n(.*)", contenido, re.DOTALL)
    if not match:
        raise ValueError(f"front matter invalido en {filepath}")

    metadatos = {}
    for linea in match.group(1).splitlines():
        clave, valor = linea.split(": ", 1)
        metadatos[clave.strip()] = valor.strip()

    cuerpo = match.group(2).strip()
    return metadatos, cuerpo

def markdown_a_wiki(texto):
    # negrita
    texto = re.sub(r"\*\*(.+?)\*\*", r"*\1*", texto)
    # items de lista con guion
    texto = re.sub(r"^- (.+)$", r"* \1", texto, flags=re.MULTILINE)
    # items numerados
    texto = re.sub(r"^\d+\. (.+)$", r"# \1", texto, flags=re.MULTILINE)
    return texto
# def markdown_a_storage(texto):
#     # conversion basica de markdown a storage format de confluence
#     # listas con guion
#     texto = re.sub(r"^- (.+)$", r"<li>\1</li>", texto, flags=re.MULTILINE)
#     texto = re.sub(r"(<li>.*</li>)", r"<ul>\1</ul>", texto, flags=re.DOTALL)

#     # listas numeradas
#     texto = re.sub(r"^\d+\. (.+)$", r"<li>\1</li>", texto, flags=re.MULTILINE)

#     # negrita
#     texto = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", texto)

#     # parrafos
#     parrafos = texto.split("\n\n")
#     resultado = ""
#     for p in parrafos:
#         p = p.strip()
#         if not p:
#             continue
#         if p.startswith("<ul>") or p.startswith("<ol>"):
#             resultado += p
#         else:
#             resultado += f"<p>{p}</p>"

#     return resultado


# def crear_pagina(space_key, titulo, contenido_storage):
#     url = f"{CONFLUENCE_URL}/rest/api/content"
#     payload = {
#         "type": "page",
#         "title": titulo,
#         "space": {"key": space_key},
#         "body": {
#             "storage": {
#                 "value": contenido_storage,
#                 "representation": "storage",
#             }
#         },
#     }
#     resp = requests.post(
#         url,
#         json=payload,
#         auth=(CONFLUENCE_EMAIL, CONFLUENCE_TOKEN),
#         timeout=30,
#     )
#     resp.raise_for_status()
#     return resp.json()["id"]
def crear_pagina(space_key, titulo, contenido_wiki):

    url_space = f"{CONFLUENCE_URL}/api/v2/spaces"
    resp = requests.get(
        url_space,
        params={"keys": space_key},
        auth=(CONFLUENCE_EMAIL, CONFLUENCE_TOKEN),
        timeout=30,
    )
    resp.raise_for_status()
    space_id = resp.json()["results"][0]["id"]

    url = f"{CONFLUENCE_URL}/api/v2/pages"
    payload = {
        "spaceId": space_id,
        "status": "current",
        "title": titulo,
        "body": {
            "representation": "wiki",
            "value": contenido_wiki,
        },
    }
    resp = requests.post(
        url,
        json=payload,
        auth=(CONFLUENCE_EMAIL, CONFLUENCE_TOKEN),
        timeout=30,
    )
    print(resp.json())
    resp.raise_for_status()
    return resp.json()["id"]



def agregar_labels(page_id, category, doc_type):
    url = f"{CONFLUENCE_URL}/rest/api/content/{page_id}/label"
    labels = [
        {"name": f"cat-{category.lower().replace(' ', '-').replace('/', '-')}"},
        {"name": f"type-{doc_type}"},
    ]
    resp = requests.post(
        url,
        json=labels,
        auth=(CONFLUENCE_EMAIL, CONFLUENCE_TOKEN),
        timeout=30,
    )
    resp.raise_for_status()


def main():
    #archivos = sorted(Path(INPUT_DIR).glob("*.md"))
    archivos = [Path(INPUT_DIR) / "01-acceso-y-autenticación-requirements-transversal.md"]

    if not archivos:
        print("no hay archivos en carp kb_generado ")
        return

    print(f"publicando {len(archivos)} articulos en conf\n")

    ok = 0
    errores = 0

    for filepath in archivos:
        try:
            metadatos, cuerpo = leer_frontmatter(filepath)
            space_key = metadatos["space_key"]
            titulo = metadatos["topic"]
            category = metadatos["category"]
            doc_type = metadatos["doc_type"]

            contenido_wiki = markdown_a_wiki(cuerpo)
            page_id = crear_pagina(space_key, titulo, contenido_wiki)
            agregar_labels(page_id, category, doc_type)

            print(f"[OK] {filepath.name} -> {space_key} (page_id: {page_id})")
            ok += 1

        except Exception as e:
            print(f"ERROR!! {filepath.name}: {e}")
            errores += 1

    print(f"\nlisto. {ok} publicados, {errores} errores")


if __name__ == "__main__":
    main()