# arma tickets llamando a la api de openai para cada uno, usando las variantes
# ya generadas como contexto/inspiracion, no como pool fijo
# version brasil: prompt en portugues, moneda BRL/PIX, clientes de brasil

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

VARIANTES_PATH = "variantes_por_categoria_br.json"
OUTPUT_PATH = "tokenia_tickets_generados_br.csv"
TOTAL_TICKETS = 450
SLEEP_BETWEEN_CALLS = 2

AGENTS = [
    {"nombre": "Tomás Monetta Franzini",   "email": "maxyjulio18@gmail.com"},
    {"nombre": "Ana González",             "email": "maxi220julio@gmail.com"},
    {"nombre": "Maximiliano Javier Julio", "email": "maximilianojavierjulio@gmail.com"},
]

CUSTOMERS = [
    {"nombre": "Carolina Nunes",       "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:bc0cf60c-4d7c-44c5-b1c0-9ddfc9a18eb2"},
    {"nombre": "Leonardo Cavalcanti",  "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:dcd8d81d-4933-40c2-b3f2-7d9c8757ab99"},
    {"nombre": "Fabio Castro",         "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:e6f6df0e-e5ea-45cc-b313-3724b1a6b631"},
    {"nombre": "Priscila Rocha",       "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:74b34d2b-8c7a-4390-a0d5-6fe51576bcc9"},
    {"nombre": "Bruno Carvalho",       "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:82ce44fa-76c2-43f3-bf42-64a209d1fd28"},
    {"nombre": "Juliana Ferreira",     "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:e145fbce-fd98-4ca0-8b5b-23769ae5f2ad"},
    {"nombre": "Larissa Souza",        "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:9c34e718-8ff6-4bf1-b378-04f3dfd6d4b6"},
    {"nombre": "Diego Martins",        "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:8a99a275-7ced-4af7-bae8-9d134b24be3e"},
    {"nombre": "Andre Moraes",         "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:9e1ed28d-2f8a-4bda-a163-752da5ee08d8"},
    {"nombre": "Mariana Araujo",       "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:3aac0f08-6d3d-4bb7-adb0-090a0412c60a"},
    {"nombre": "Renata Freitas",       "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:ebdc7d4f-7a89-4bb1-a131-b652ee3ba99b"},
    {"nombre": "Lucas Pereira",        "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:ed04d6ae-f36e-4f44-ba75-dad36ede95b7"},
    {"nombre": "Tatiana Vieira",       "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:b12e56d5-73d2-49e3-b5e3-60b23bef9f3b"},
    {"nombre": "Eduardo Melo",         "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:806cb782-ea88-4c57-b1ad-9d5a2e5efab3"},
    {"nombre": "Gabriel Oliveira",     "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:1c6c8f3c-0b42-4193-b8f6-814150c2f7da"},
    {"nombre": "Felipe Ribeiro",       "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:3b3304dc-2f4a-4a0c-94fd-cfc9d201d002"},
    {"nombre": "Aline Correia",        "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:90ddc072-98d5-472a-8bd1-0e91d161e3ed"},
    {"nombre": "Vivian Monteiro",      "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:7c253ab9-2d35-4a94-8bdc-a3901c3156f8"},
    {"nombre": "Rafael Almeida",       "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:ab026cd4-acd4-434b-90e5-109ffdddfa44"},
    {"nombre": "Rodrigo Teixeira",     "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:eb9cbe24-105c-40ed-844a-c2c2ea40c29f"},
    {"nombre": "Beatriz Santos",       "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:1007ee5e-c272-40ae-811d-eed78b3d4e7c"},
    {"nombre": "Fernanda Gomes",       "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:cf6bd68c-2cf4-4fa6-93ba-fc96a0e57143"},
    {"nombre": "Rogerio Batista",      "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:8a0ee7d5-029c-4a08-a42f-b06768b64927"},
    {"nombre": "Amanda Costa",         "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:79582374-52c1-48cf-9693-7f7e4f450adc"},
    {"nombre": "Patricia Barbosa",     "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:98550bc5-9bb9-469f-b7d4-4756a5f09e88"},
    {"nombre": "Thiago Rodrigues",     "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:4d958f1b-e893-41fe-b2c5-f0f6163cdd67"},
    {"nombre": "Gustavo Nascimento",   "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:b7a06e76-4e6b-48b6-a6c2-1f5297504226"},
    {"nombre": "Marcelo Dias",         "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:5705c77d-869a-4f2d-b789-7fe84a892889"},
    {"nombre": "Camila Lima",          "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:b9908a88-c7cb-48d9-b10c-f21b473a87ee"},
    {"nombre": "Vanessa Cardoso",      "account_id": "qm:96e3bf0d-beea-4cd2-bca9-568ee30412d2:c76e25ce-1103-4288-a853-a756f7dcaabf"},
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

# seeds base por categoria en portugues, sirven de referencia de estilo
# para que openai genere contenido nuevo pero coherente. la categoria fiat
# ya menciona pix y reales para que quede anclado al contexto de brasil
SEEDS = {
    "Acceso y autenticación": {
        "summary": "nao consigo entrar na minha conta",
        "description": "oi, nao consigo entrar na tokenia. coloco meu email e senha e diz que ta errado mas tenho certeza que sao os mesmos dados de sempre",
        "resolution": "Oi, para recuperar o acesso, entra no app e clica em 'Esqueci minha senha'. Vamos pedir um vídeo selfie rápido para confirmar sua identidade, com boa luz e sem acessórios.",
    },
    "Operaciones de compra/venta crypto": {
        "summary": "comprei ETH e nao aparece na minha carteira",
        "description": "comprei eth ha umas 2 horas, recebi a confirmacao mas na carteira nao aparece nada. o dinheiro foi descontado sim",
        "resolution": "Oi, as compras de cripto podem demorar até 30 minutos para aparecer na sua carteira, dependendo da rede. Se passar esse tempo, precisamos do número da operação para rastrear.",
    },
    "Operaciones de compra/venta fiat": {
        "summary": "fiz um pix e nao caiu na conta",
        "description": "fiz um pix de 500 reais para a tokenia ha 3 horas e nao caiu nada na minha conta. tenho o comprovante do pix",
        "resolution": "Oi, os depósitos via PIX costumam cair em minutos, mas em alguns casos pode levar até algumas horas. Para verificar, precisamos do comprovante do PIX ou o código da transação.",
    },
    "Depósitos y retiros": {
        "summary": "depositei ETH e nao aparece na minha conta",
        "description": "mandei 0.05 eth da minha carteira externa pra tokenia. ja tem mais de 15 confirmacoes no etherscan mas nao aparece na minha conta",
        "resolution": "Oi, para rastrear seu depósito precisamos do hash da transação (TxID). Você encontra na carteira que usou para enviar.",
    },
    "Seguridad de la cuenta": {
        "summary": "tem movimentacoes que eu nao reconheco",
        "description": "olhei minhas movimentacoes e tem uma venda de btc de ontem a noite que eu nao fiz. preciso bloquear minha conta ja",
        "resolution": "Oi, diante dessa situação vamos suspender sua conta imediatamente como medida preventiva. Para confirmar a suspensão, precisamos verificar sua identidade.",
    },
    "Billetera y direcciones": {
        "summary": "nao consigo gerar um endereco de deposito",
        "description": "nao encontro onde ver meu endereco de carteira pra receber btc. entro em receber e da erro",
        "resolution": "Oi, na Tokenia os endereços de depósito podem ser atualizados periodicamente por segurança, mas todos os endereços anteriores continuam válidos.",
    },
    "Información y consultas generales": {
        "summary": "como funciona a tokenia",
        "description": "sou novo por aqui e quero entender como funciona. preciso verificar minha identidade primeiro ou ja posso operar direto?",
        "resolution": "Oi, bem-vindo à Tokenia! Primeiro você se cadastra, depois verifica sua identidade enviando documento e selfie. Após aprovado, já pode depositar e operar.",
    },
    "Tarifas y comisiones": {
        "summary": "quanto e a taxa por comprar BTC",
        "description": "quero saber exatamente quanto cobram de taxa quando compro btc com reais. vi algo de 1% mas nao sei se tem custo adicional",
        "resolution": "Oi, o custo total tem dois componentes: a taxa da plataforma (1% sobre o valor) e o spread de mercado, que é a diferença entre preço de compra e venda naquele momento.",
    },
    "Problemas técnicos de la app/web": {
        "summary": "o app fecha sozinho quando abro o mercado",
        "description": "atualizei o app e agora fecha sozinho toda vez que entro na secao de mercados. tenho um samsung galaxy s21 com android 13",
        "resolution": "Oi, estamos cientes de um problema com a última atualização do app no Android. Nossa equipe já está trabalhando na correção. Enquanto isso, acesse pelo navegador.",
    },
    "Límites y restricciones": {
        "summary": "qual e o limite de saque diario",
        "description": "tentei sacar 3000 reais e disse que ultrapassei o limite diario. qual e o limite e como aumento?",
        "resolution": "Oi, os limites dependem do nível de verificação. Com verificação básica, o saque diário é de R$ 1.000. Com verificação completa, sobe para R$ 5.000.",
    },
    "Verificación de identidad": {
        "summary": "minha verificacao foi recusada e nao sei o motivo",
        "description": "tentei completar a verificacao de identidade mas o sistema recusou meu documento. o documento esta em bom estado e as fotos sao claras",
        "resolution": "Oi, as recusas costumam acontecer por foto desfocada, reflexo no documento ou imagem cortada. Recomendamos boa iluminação natural e garantir que o documento esteja totalmente visível.",
    },
}


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

def calcular_demora_inicial(prioridad):
    medianas = {"Highest": 15, "High": 45, "Medium": 120, "Low": 240}
    mediana = medianas[prioridad]
    if random.random() < 0.12:
        minutos = random.randint(360, 2880)
    else:
        minutos = max(5, int(mediana * random.lognormvariate(mu=0, sigma=0.7)))
    return timedelta(minutes=minutos)


def armar_prompt_ticket(categoria, seed):
    return f"""Você é o redator de dados sintéticos para um dataset de treinamento de um sistema de suporte técnico da Tokenia, uma exchange de criptomoedas fictícia que opera no Brasil.

Categoria do ticket: {categoria}

Como referência de estilo e conteúdo desta categoria (não repita literalmente, é só um exemplo):

Summary de referência: "{seed['summary']}"
Description de referência: "{seed['description']}"
Resolução de referência: "{seed['resolution']}"

Gere UM ticket novo dessa mesma categoria, com um problema parecido mas não idêntico nos detalhes (pode mudar valores, tempos, a variante específica do problema, sempre que continue coerente com a categoria). Se a categoria envolver pagamentos em reais, use PIX e valores em R$ (reais), não use CBU nem pesos argentinos.

O summary e a description são escritos por um cliente brasileiro: informal, minúsculas, pode ter algum erro de digitação, gíria de app, nada de soar como texto gerado por IA.

A resolução é escrita por um agente de suporte: registro profissional mas próximo, trata o cliente por "você", nem robótico nem gíria de chat entre amigos. Proibido vocabulário corporativo ("proceder a", "titular") e proibido gíria informal exagerada ("mano", "cara", "beleza" do lado do agente).

Devolva SOMENTE este json, sem texto extra, sem markdown:
{{
  "summary": "...",
  "description": "...",
  "agent_resolution": "..."
}}"""


def pedir_ticket(categoria, seed):
    prompt = armar_prompt_ticket(categoria, seed)
    for intento in range(3):
        try:
            resp = client.chat.completions.create(
                model=MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=1.0,
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
    if not os.path.exists(OUTPUT_PATH):
        return 0
    with open(OUTPUT_PATH, encoding="utf-8") as f:
        return sum(1 for _ in f) - 1


def generar_ticket_completo(categoria):
    data = pedir_ticket(categoria, SEEDS[categoria])
    if data is None:
        return None

    cliente = random.choice(CUSTOMERS)
    agente = random.choice(AGENTS)
    estado = random.choice(STATUS_POOL)
    prioridad = random.choice(PRIORITY_POOL)
    canal = random.choice(REQUEST_TYPES)

    creado = fecha_random()
    fecha_comentario = creado + calcular_demora_inicial(prioridad)

    comentarios = [armar_comentario(fecha_comentario, agente["email"], data["agent_resolution"])]

    if estado in ("Resolved", "Canceled"):
        fecha_comentario += timedelta(minutes=random.randint(10, 90))
        cierre = random.choice([
            "obrigado, ja resolveu",
            "perfeito, consegui resolver",
            "beleza, deu certo. obrigado",
            "otimo, muito obrigado pela ajuda",
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
            writer.writerow(["Summary", "Description", "Priority", "Status", "Reporter",
                              "Assignee", "Request type", "Issue Type", "Categoría",
                              "Date Created", "Comment", "Comment"])

        generados = 0
        fallos_seguidos = 0
        while generados < faltan:
            categoria = random.choice(CATEGORIES)
            ticket = generar_ticket_completo(categoria)

            if ticket is None:
                fallos_seguidos += 1
                print("no se pudo generar un ticket de:", categoria)
                if fallos_seguidos >= 5:
                    print("van 5 fallos seguidos, corto la ejecucion para revisar que esta pasando")
                    break
                continue

            fallos_seguidos = 0
            fila = [ticket["Summary"], ticket["Description"], ticket["Priority"], ticket["Status"],
                    ticket["Reporter"], ticket["Assignee"], ticket["Request type"], ticket["Issue Type"],
                    ticket["Categoría"], ticket["Date Created"]]
            fila += ticket["comentarios"]
            fila += [""] * (2 - len(ticket["comentarios"]))
            writer.writerow(fila)
            f.flush()

            generados += 1
            if generados % 25 == 0:
                print(f"van {generados} de {faltan} generados en esta corrida")
            time.sleep(SLEEP_BETWEEN_CALLS)

    print(f"listo, generados {generados} tickets nuevos en {OUTPUT_PATH}")


if __name__ == "__main__":
    main()