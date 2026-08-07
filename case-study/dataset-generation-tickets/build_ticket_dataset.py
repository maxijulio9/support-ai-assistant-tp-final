# arma tickets llamando a la api de openai para cada uno, usando las variantes
# ya generadas como contexto/inspiracion, no como pool fijo

import os
import csv
import json
import random
import time
from datetime import datetime, timedelta
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
MODEL = "gpt-4o-mini"

VARIANTES_PATH = "variantes_por_categoria.json"
OUTPUT_PATH = "tokenia_tickets_generados.csv"
TOTAL_TICKETS = 1000
SLEEP_BETWEEN_CALLS = 2 

AGENTS = [
    {"nombre": "Tomás Monetta Franzini",   "email": "maxyjulio18@gmail.com"},
    {"nombre": "Ana González",             "email": "maxi220julio@gmail.com"},
    {"nombre": "Maximiliano Javier Julio", "email": "maximilianojavierjulio@gmail.com"},
]

CUSTOMERS = [
    {"nombre": "Natalia Vargas",        "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:54e0a821-80de-475f-9ddc-36c025d2c2ad"},
    {"nombre": "Paola Delgado",         "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:31728e74-ad5e-486c-8fea-2c3dfe341408"},
    {"nombre": "Micaela Silva",         "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:f6265e73-c077-4093-9441-1f20cbfeaf40"},
    {"nombre": "Ignacio Ramos",         "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:af30ed9d-7e74-4e4e-8304-5e91abcd1392"},
    {"nombre": "Marcos Ferreyra",       "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:1979be20-22df-4ea9-a264-020aef7b27f7"},
    {"nombre": "Pablo Reyes",           "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:e34f737c-f7d6-4402-906c-c89d3851033f"},
    {"nombre": "Florencia Romero",      "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:58c8f6de-b191-481c-b086-3ad59825148f"},
    {"nombre": "Julieta Ruiz",          "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:e370d25e-5cfb-48c6-9833-7546b43b5f6f"},
    {"nombre": "Melina Quiroga",        "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:7df2247b-a9d7-446f-9908-5e1029612e5c"},
    {"nombre": "Tomás Díaz",            "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:64cb148f-e970-4d60-b1d5-b8f416b8022f"},
    {"nombre": "Claudio Villalba",      "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:10fce4eb-6818-4f3a-bd6d-35cfa471b0ac"},
    {"nombre": "Sebastián Acosta",      "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:9b001302-64de-4529-89e2-79e3b221b797"},
    {"nombre": "Romina Ortiz",          "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:0df99cfc-26bd-40c6-8e90-a343fc8c2ef8"},
    {"nombre": "Leandro Jiménez",       "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:d2644145-7b97-47e1-82a6-cfb0dcd7ac06"},
    {"nombre": "Alejandro Cabrera",     "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:100cf02a-d965-49dc-a96c-a17602637b44"},
    {"nombre": "Carolina Herrera",      "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:9700668d-bb18-4ce6-a136-d0d4eac1741d"},
    {"nombre": "Gonzalo Flores",        "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:f87f83b8-9b00-4e13-b8fe-ebe6628388e7"},
    {"nombre": "Fernando Molina",       "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:62830fe6-8218-47cb-b71b-65c6cccd540a"},
    {"nombre": "Agustina Suárez",       "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:743e4c73-9f65-4707-867d-362ed5c61c85"},
    {"nombre": "Bruno Escobar",         "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:b930251b-8e9d-4251-b2fe-30e4c9544346"},
    {"nombre": "Matías Rodríguez",      "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:ee06dc2e-01ac-4e74-a12d-b46b4e7bb996"},
    {"nombre": "Noelia Peralta",        "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:4235ad96-3f14-454f-99c2-e6a737d2ebcb"},
    {"nombre": "Ailén Sosa",            "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:d0de7e09-4c5e-463c-9d38-74616182f078"},
    {"nombre": "Rodrigo Ponce",         "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:674ac83f-1d63-434a-8866-f6dd4341d356"},
    {"nombre": "Camila González",       "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:ef0b6aae-d68d-4334-a61f-95c3b62988e2"},
    {"nombre": "Maximiliano Aguirre",   "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:8f54090f-7904-47c1-a169-777fc6d2704a"},
    {"nombre": "Walter Godoy",          "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:59252f93-ef1e-4477-9c17-be2742a566e2"},
    {"nombre": "Emilia Rojas",          "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:474abcb9-0c93-42b3-ad19-185467bf0daf"},
    {"nombre": "Cristian Vega",         "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:e1ec8af6-b713-442c-a841-58d7d71b1c58"},
    {"nombre": "Joaquín Mendoza",       "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:dac60d3e-f27a-4686-80f6-92944511c469"},
    {"nombre": "Hernán Ibáñez",         "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:a5143b7f-6e1e-46f4-b12b-a399e68ad117"},
    {"nombre": "Nicolás Pérez",         "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:33cc9396-5d04-4365-9342-7e7873e36c3d"},
    {"nombre": "Ariel Maldonado",       "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:3d798707-4bb8-413e-a607-86b6366d584d"},
    {"nombre": "Agustín Martínez",      "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:de0d6cf7-b049-41d4-8412-41e6f9a97992"},
    {"nombre": "Vanesa Luna",           "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:2d6d7e33-c1c9-48e1-b5bc-7f83ed940fbd"},
    {"nombre": "Antonella Morales",     "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:38db461d-acf4-4174-9229-abec66530d80"},
    {"nombre": "Aldana Cáceres",        "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:11bcee9e-5c21-4a2b-9982-9c4869410e51"},
    {"nombre": "Diego Castro",          "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:18f50c0f-dfaf-4c48-b4f7-e1a3b581b478"},
    {"nombre": "Sofía García",          "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:55278bb1-8664-4ce5-821e-0ccc583ba623"},
    {"nombre": "Milagros Torres",       "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:27688d60-4eb7-4c49-a534-a6d78f6fddb8"},
    {"nombre": "Karina Mansilla",       "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:6829bfc5-d867-4e24-aeac-e948f6fe1b23"},
    {"nombre": "Ezequiel Álvarez",      "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:2cc33309-869f-4207-ba0a-d00e2c5d79b9"},
    {"nombre": "Facundo Sánchez",       "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:bac4fff3-b55b-446d-8297-e90cf54f15ee"},
    {"nombre": "Valentina López",       "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:1777a0ba-d198-44c3-908f-eb26c7d492f5"},
    {"nombre": "Silvana Carrizo",       "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:61a723ec-a2c5-4d6b-9a2b-3b24f12b4fba"},
    {"nombre": "Ramiro Medina",         "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:fc0d1ff2-2855-492b-96b5-6013d0097f09"},
    {"nombre": "Daniela Ríos",          "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:95463f26-5824-48f4-b647-470bb9c86423"},
    {"nombre": "Luciana Benítez",       "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:52b9c06a-5595-4581-95ec-9cac2fa1ea04"},
    {"nombre": "Lucía Fernández",       "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:e47a2d76-f372-4142-897f-eca911b6a07f"},
    {"nombre": "Brenda Núñez",          "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:523b7784-4b02-4405-a351-8ddea820c049"},
]

CATEGORIES = [
    "Acceso y autenticación",
    "Operaciones de compra/venta crypto",
    "Operaciones de compra/venta fiat",
    "Depósitos y retiros",
    "Seguridad de la cuenta",
    "Billetera y direcciones",
    "Información y consultas generales",
    "Tarifas y comisiones",
    "Problemas técnicos de la app/web",
    "Límites y restricciones",
    "Verificación de identidad",
]

REQUEST_TYPES = ["Portal Tokenia", "Tokenia App", "Tokenia Email", "Tokenia Web"]

STATUS_POOL = (
    ["Resolved"] * 68 + ["Escalated"] * 10 + ["Canceled"] * 5 +
    ["Work in Progress"] * 9 + ["Waiting for Customer"] * 5 + ["Waiting for Agent"] * 3
)
PRIORITY_POOL = (
    ["Low"] * 20 + ["Medium"] * 45 + ["High"] * 25 + ["Highest"] * 10
)

DATE_START = datetime(2025, 4, 1)
DATE_END = datetime(2026, 4, 11)


def get_issue_type(request_type):
    return "General request" if request_type == "Tokenia Email" else "Service Request"


def fecha_random():
    delta = DATE_END - DATE_START
    return DATE_START + timedelta(seconds=random.randint(0, int(delta.total_seconds())))


def fmt_fecha(dt):
    return dt.strftime("%-d/%b/%y %-I:%M %p")


def armar_comentario(dt, autor, texto):
    limpio = texto.replace(";", ",").replace("\n", " ").strip()
    return f"{fmt_fecha(dt)};{autor};{limpio}"


def cargar_variantes():
    with open(VARIANTES_PATH, encoding="utf-8") as f:
        return json.load(f)


def armar_prompt_ticket(categoria, variantes_cat):
    # le paso un par de ejemplos de la categoria como referencia de estilo
    # y contenido, pero le pido que genere un ticket NUEVO, no que elija uno
    ejemplo_summary = random.choice(variantes_cat["summaries"])
    ejemplo_description = random.choice(variantes_cat["descriptions"])
    ejemplo_resolucion = random.choice(variantes_cat["agent_resolutions"])

    return f"""Sos el redactor de datos sinteticos para un dataset de entrenamiento de un sistema de soporte tecnico de Tokenia, un exchange cripto argentino ficticio.

Categoria del ticket: {categoria}

Como referencia de estilo y contenido de esta categoria (no los repitas literal, son solo ejemplo):

Summary de referencia: "{ejemplo_summary}"
Description de referencia: "{ejemplo_description}"
Resolucion de referencia: "{ejemplo_resolucion}"

Generame UN ticket nuevo de esta misma categoria, con un problema similar en tipo pero no identico en los detalles (podes cambiar montos, tiempos, la variante especifica del problema, etc, siempre que siga siendo coherente con la categoria).

El summary y la description los escribe un cliente argentino: voseo o tuteo indistinto, minusculas, puede tener algun error de tipeo, jerga de apps, nada de sonar como IA.

La resolucion la escribe un agente de soporte: registro profesional pero cercano, voseo argentino, ni acartonado ni de chat entre amigos. Ejemplo del punto justo: "Suspendimos tu cuenta de forma preventiva para proteger tus fondos. Para levantar la suspensión necesitamos verificar tu identidad." Prohibido vocabulario corporativo ("proceder a", "titular", "activos digitales") y prohibido vocabulario de chat informal ("al toque", "posta", "che" del lado del agente).

Devolveme SOLO este json, sin texto extra, sin markdown:
{{
  "summary": "...",
  "description": "...",
  "agent_resolution": "..."
}}"""


def pedir_ticket(categoria, variantes_cat):
    prompt = armar_prompt_ticket(categoria, variantes_cat)
    for intento in range(3):
        try:
            resp = client.chat.completions.create(
                model=MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=1.0,  #un poco de variedad entre tickets de la misma categoria
            )
            texto = resp.choices[0].message.content.strip()
            if texto.startswith("```"):
                texto = texto.strip("`")
                if texto.startswith("json"):
                    texto = texto[4:]
            data = json.loads(texto)
            if data.get("summary") and data.get("description") and data.get("agent_resolution"):
                return data
        except Exception as e:
            print("fallo un intento:", e)
            time.sleep(SLEEP_BETWEEN_CALLS * (intento + 1)) 
    return None


def contar_tickets_existentes():
    # cuenta cuantas filas de datos ya tiene el csv (sin contar el header)
    if not os.path.exists(OUTPUT_PATH):
        return 0
    
    with open(OUTPUT_PATH, encoding="utf-8") as f:
        return sum(1 for _ in f) - 1

def calcular_demora_inicial(prioridad):
    # cuanto tarda el agente en responder por primera vez, segun la prioridad
    # el 12% de las veces se demora igual, sin importar la prioridad
    # (agente saturado, fuera de horario, cola de espera con congestion)
    medianas = {"Highest": 15, "High": 45, "Medium": 120, "Low": 240}  # minutos
    mediana = medianas[prioridad]

    if random.random() < 0.12:
        minutos = random.randint(360, 2880)  # entre 6 y 48 horas
    else:
        minutos = max(5, int(mediana * random.lognormvariate(mu=0, sigma=0.7)))

    return timedelta(minutes=minutos)

def generar_ticket_completo(categoria, variantes_cat):
    data = pedir_ticket(categoria, variantes_cat)
    if data is None:
        return None

    cliente = random.choice(CUSTOMERS)
    agente = random.choice(AGENTS)
    estado = random.choice(STATUS_POOL)
    prioridad = random.choice(PRIORITY_POOL)
    canal = random.choice(REQUEST_TYPES)

    creado = fecha_random()
    demora_inicial = calcular_demora_inicial(prioridad)
    fecha_comentario = creado + demora_inicial

    comentarios = [armar_comentario(fecha_comentario, agente["email"], data["agent_resolution"])]

    if estado in ("Resolved", "Canceled"):
        fecha_comentario += timedelta(minutes=random.randint(10, 90))
        cierre = random.choice([
            "gracias, ya se solucionó",
            "perfecto, ya lo pude resolver",
            "listo, funciono. gracias",
            "genial, muchas gracias por la ayuda",
        ])
        comentarios.append(armar_comentario(fecha_comentario, cliente["account_id"], cierre))

    return {
        "Summary": data["summary"],
        "Description": data["description"],
        "Priority": prioridad,
        "Status": estado,
        "Reporter": cliente["account_id"],
        "Assignee": agente["email"],
        "Request type": canal,
        "Issue Type": get_issue_type(canal),
        "Categoría": categoria,
        "Date Created": fmt_fecha(creado),
        "comentarios": comentarios,
    }


def main():
    variantes = cargar_variantes()
    ya_generados = contar_tickets_existentes()
    faltan = TOTAL_TICKETS - ya_generados

    if faltan <= 0:
        print(f"ya hay {ya_generados} tickets en {OUTPUT_PATH}, no hace falta generar mas")
        return

    print(f"ya hay {ya_generados} tickets, faltan {faltan} para llegar a {TOTAL_TICKETS}")

    archivo_nuevo = not os.path.exists(OUTPUT_PATH)
    modo = "a" if not archivo_nuevo else "w"

    with open(OUTPUT_PATH, modo, newline="", encoding="utf-8") as f:
        writer = csv.writer(f, quoting=csv.QUOTE_ALL)
        if archivo_nuevo:
            # dejo 2 columnas de comentario, si hace falta mas se ajusta despues
            writer.writerow(["Summary", "Description", "Priority", "Status", "Reporter",
                              "Assignee", "Request type", "Issue Type", "Categoría",
                              "Date Created", "Comment", "Comment"])

        generados = 0
        fallos_seguidos = 0
        while generados < faltan:
            categoria = random.choice(CATEGORIES)
            ticket = generar_ticket_completo(categoria, variantes[categoria])

            if ticket is None:
                fallos_seguidos += 1
                print("no se pudo generar un ticket de:", categoria)
                if fallos_seguidos >= 5:
                    print("van 5 fallos seguidos, corto la ejec")
                    break
                continue

            fallos_seguidos = 0
            fila = [ticket["Summary"], ticket["Description"], ticket["Priority"], ticket["Status"],
                    ticket["Reporter"], ticket["Assignee"], ticket["Request type"], ticket["Issue Type"],
                    ticket["Categoría"], ticket["Date Created"]]
            fila += ticket["comentarios"]
            fila += [""] * (2 - len(ticket["comentarios"]))
            writer.writerow(fila)
            f.flush()  # guardo ya mismo por si se corta a mitad de camino

            generados += 1
            if generados % 25 == 0:
                print(f"van {generados} de {faltan} generados en esta corrida")
            time.sleep(SLEEP_BETWEEN_CALLS)

    print(f"listo, generados {generados} tickets nuevos en {OUTPUT_PATH}")


if __name__ == "__main__":
    main()