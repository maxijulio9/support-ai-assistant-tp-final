# genera variantes de texto para los tickets usando gemini
# la idea es tener varias formas distintas de decir lo mismo para que el dataset
#no sea siempre el mismo texto repetido con otro nombre

import os
import json
import time
from google import genai
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
MODEL = "gemini-2.5-flash"

OUTPUT_PATH = "variantes_por_categoria.json"
VARIANTS_PER_SEED = 4  # cuantas variantes por cada texto base
SLEEP_BETWEEN_CALLS = 15  

# contenido base por categoria, plantilla base para qie
# despues gemini genera variaciones de cada uno de estos textos
SEEDS = {
    "Acceso y autenticación": {
        "summaries": ["no puedo entrar a mi cuenta", "olvide mi contraseña y no me llega el mail", "me bloquearon la cuenta"],
        "descriptions": [
            "hola buen dia, no puedo entrar a tokenia. pongo el mail y la clave y me dice que son incorrectos pero estoy seguro que son los que use cuando me registre",
            "olvide mi contraseña y hago clic en 'olvide mi clave' pero el mail para resetearla no me llega nunca, ya revise el spam",
        ],
        "agent_resolutions": [
            "Para recuperar el acceso, seleccioná 'Olvidé mi clave' en la pantalla de inicio de la app. Vas a necesitar grabar un video selfie para validar tu identidad, con buena luz y sin accesorios. Una vez validado, te enviamos los pasos para crear una nueva clave al mail registrado.",
        ],
    },
    "Operaciones de compra/venta crypto": {
        "summaries": ["quiero comprar BTC pero me da error", "hice una compra de ETH y no aparece en mi billetera", "no puedo vender mis USDT"],
        "descriptions": [
            "quise comprar 0.01 btc, confirme todo y me dijo que la operacion fallo pero me descontaron la plata igual. ya paso una hora y no aparece nada",
            "hice una compra de eth hace como 2 horas, me llego la confirmacion pero en la billetera no aparece nada. el dinero si se desconto",
        ],
        "agent_resolutions": [
            "Las compras de crypto pueden demorar hasta 30 minutos en verse reflejadas en la billetera dependiendo de la congestión de la red. Si pasado ese tiempo no aparece el saldo, necesitamos el número de la transacción para rastrearlo.",
        ],
    },
    "Operaciones de compra/venta fiat": {
        "summaries": ["hice una transferencia y no se acreditó", "quiero saber cuanto tarda en llegar mi depósito en pesos", "no me llega el dinero del retiro a mi cuenta bancaria"],
        "descriptions": [
            "hice una transferencia desde galicia de $80000 hace 4 horas y no se acredito nada en tokenia. tengo el comprobante",
            "solicite un retiro de $45000 a mi cbu de santander hace 2 dias y no recibi nada. en la app dice 'en proceso'",
        ],
        "agent_resolutions": [
            "Los depósitos por transferencia bancaria se acreditan en un plazo de hasta 2 horas hábiles en la mayoría de los casos. Para rastrear tu transferencia necesitamos el número de operación o comprobante.",
        ],
    },
    "Depósitos y retiros": {
        "summaries": ["deposite ETH y no aparece en mi cuenta", "mande cripto a la dirección equivocada", "el retiro de BTC no llegó a mi billetera externa"],
        "descriptions": [
            "mande 0.05 eth desde mi billetera externa a tokenia. ya tiene mas de 15 confirmaciones en etherscan pero no aparece en mi cuenta",
            "por error mande usdt a la red bsc en lugar de erc20. el monto era de 300 usdt. se puede recuperar?",
        ],
        "agent_resolutions": [
            "Para rastrear tu depósito necesitamos el hash de la transacción (TxID). Lo podés obtener desde la billetera que usaste para enviar o buscando tu dirección en el explorador de la red correspondiente.",
        ],
    },
    "Seguridad de la cuenta": {
        "summaries": ["hay movimientos que no reconozco", "creo que me hackearon la cuenta", "me llegó un mail raro supuestamente de tokenia"],
        "descriptions": [
            "revise mis movimientos y hay una venta de btc de anoche que yo no hice. ademas un retiro de 0.5 eth que tampoco reconozco. necesito que bloqueen mi cuenta ya",
            "recibi un mail que dice ser de tokenia pidiendo que ingrese mis datos en un link. el mail viene de soporte-tokenia@gmail.com. es real?",
        ],
        "agent_resolutions": [
            "Ante esta situación procedemos a suspender tu cuenta de forma inmediata como medida preventiva. Para confirmar la suspensión y proteger tus fondos necesitamos verificar tu identidad.",
        ],
    },
    "Billetera y direcciones": {
        "summaries": ["no puedo generar una dirección de depósito", "para qué sirve el memo en XRP", "mande crypto a una dirección de tokenia vieja"],
        "descriptions": [
            "no encuentro donde ver mi dirección de billetera para recibir btc. entro a recibir y me da un error",
            "me dieron una dirección de tokenia de hace 2 meses para mandarle plata a alguien, sigue siendo valida?",
        ],
        "agent_resolutions": [
            "En Tokenia las direcciones de depósito pueden actualizarse periódicamente por razones de seguridad. Sin embargo, todas las direcciones anteriores siguen siendo válidas y los fondos enviados se acreditan correctamente.",
        ],
    },
    "Información y consultas generales": {
        "summaries": ["como funciona tokenia", "que criptos puedo comprar", "tienen programa de referidos"],
        "descriptions": [
            "quiero empezar a usar tokenia pero no entiendo bien como funciona. tengo que verificar mi identidad primero o puedo operar directo?",
            "que criptomonedas tienen disponibles? hay bitcoin, ethereum, solana? y stablecoins como usdt o usdc?",
        ],
        "agent_resolutions": [
            "Para empezar a operar el proceso es el siguiente: primero completás el registro con tu mail y creás una contraseña, después verificás tu identidad subiendo tu DNI y una selfie, una vez aprobado podés cargar fondos y operar.",
        ],
    },
    "Tarifas y comisiones": {
        "summaries": ["cuanto me cobran de comision por comprar BTC", "me cobraron mas de lo que esperaba", "que es el spread en tokenia"],
        "descriptions": [
            "quiero saber exactamente cuanto me cobran de comision cuando compro btc con pesos. vi algo de 1% pero no se si hay costos adicionales",
            "compre $10000 en eth y el total que me cobraron fue $10650. de donde sale esa diferencia?",
        ],
        "agent_resolutions": [
            "El costo total de operar en Tokenia tiene dos componentes: la comisión de plataforma (1% sobre el monto de la operación) y el spread de mercado, que es la diferencia entre el precio de compra y venta del mercado.",
        ],
    },
    "Problemas técnicos de la app/web": {
        "summaries": ["la app se cierra sola cuando abro el mercado", "la web tarda mucho en cargar", "no me deja subir el documento para el KYC"],
        "descriptions": [
            "actualice la app y ahora se cierra sola cada vez que entro a la seccion de mercados. tengo un samsung galaxy s21 con android 13",
            "intento subir mi dni para el kyc y me dice que el archivo es muy grande pero es un jpg de 1.5mb",
        ],
        "agent_resolutions": [
            "Estamos al tanto de un problema con la última actualización de la app en Android. Nuestro equipo técnico ya está trabajando en el fix. Como solución temporal podés acceder desde el navegador de tu celular.",
        ],
    },
    "Límites y restricciones": {
        "summaries": ["cual es el limite de retiro diario", "como aumento mis limites de operacion", "me dice que supere el limite mensual"],
        "descriptions": [
            "intente retirar $300000 y me dice que supere el limite diario. cual es el limite y como lo puedo aumentar?",
            "quiero operar con montos mas grandes pero hay un tope de $100000 por operacion. como hago para subir ese limite?",
        ],
        "agent_resolutions": [
            "Los límites en Tokenia dependen del nivel de verificación de tu cuenta. Con verificación básica el retiro diario es de $100.000 ARS. Con verificación completa el límite sube a $500.000 ARS.",
        ],
    },
    "Verificación de identidad": {
        "summaries": ["me rechazaron el KYC y no sé por qué", "cuanto tarda la verificacion", "no puedo sacar la selfie en el proceso de kyc"],
        "descriptions": [
            "intente completar el proceso de verificacion de identidad pero el sistema rechazó mi DNI. el documento esta en buen estado y las fotos son claras",
            "complete el proceso de verificacion hace 5 dias y aun aparece como 'en revision'. cuanto tiempo mas puede tardar?",
        ],
        "agent_resolutions": [
            "Los rechazos en el proceso de verificación suelen ocurrir por imagen borrosa, documento con reflejos de luz o partes del documento cortadas. Te recomendamos usar buena iluminación natural y asegurarte de que los 4 bordes sean visibles.",
        ],
    },
}


def armar_prompt(categoria, seeds, n):

    summaries_txt = "\n".join(f'- "{s}"' for s in seeds["summaries"])
    descriptions_txt = "\n".join(f'- "{d}"' for d in seeds["descriptions"])
    resolutions_txt = "\n".join(f'- "{r}"' for r in seeds["agent_resolutions"])

    return f"""Sos un generador de datos sinteticos para un dataset de tickets de soporte de un exchange de criptomonedas argentino ficticio llamado Tokenia.

Categoria: {categoria}

Tengo estos summaries (titulos cortos escritos por clientes):
{summaries_txt}

Estas descriptions (descripciones largas escritas por clientes):
{descriptions_txt}

Y estas resoluciones (respuestas escritas por un agente de soporte):
{resolutions_txt}

Necesito que generes variantes de cada uno:

Para los summaries y descriptions, generame {n} variantes de CADA UNO que mantengan el mismo problema pero con vocabulario y forma de escribir distinta entre si, jerga argentina como escribe la gente en apps (no formal), algunas mas cortas otras mas largas, algun error de tipeo natural en algunas (no todas), sin mayuscula al inicio siempre. Que no suene a texto armado por IA.

Para las resoluciones, generame {n} variantes de CADA UNA que mantengan el mismo contenido factual (mismos pasos, plazos, montos) pero con otras palabras y otro orden de oraciones, sin calcar frases del original, tono formal de agente. Es importante que no repitan las palabras clave del texto de referencia.

Devolveme SOLO un json con esta forma exacta, sin texto extra, sin markdown:
{{
  "summaries": ["variante1", "variante2", ...],
  "descriptions": ["variante1", "variante2", ...],
  "agent_resolutions": ["variante1", "variante2", ...]
}}"""


def pedir_variantes_categoria(categoria, seeds):
    # una sola llamada para toda la categoria, para no pasar el rate lmimit 
    prompt = armar_prompt(categoria, seeds, VARIANTS_PER_SEED)
    for intento in range(3):
        try:
            resp = client.models.generate_content(model=MODEL, contents=prompt)
            texto = resp.text.strip()
            if texto.startswith("```"):
                texto = texto.strip("`")
                if texto.startswith("json"):
                    texto = texto[4:]
            data = json.loads(texto)
            if data.get("summaries") and data.get("descriptions") and data.get("agent_resolutions"):
                return data
        except Exception as e:
            print("fallo un intento:", e)
            if "429" in str(e):
                print("parece rate limit.")
                time.sleep(60)
            else:
                time.sleep(SLEEP_BETWEEN_CALLS)
    return None


def cargar_progreso():
    # si ya venia corriendo antes y se corto por el rate limit, retoma de aca
    if os.path.exists(OUTPUT_PATH):
        with open(OUTPUT_PATH, encoding="utf-8") as f:
            return json.load(f)
    return {}


def guardar(data):
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def main():
    resultado = cargar_progreso()

    for categoria, seeds in SEEDS.items():
        # si la categoria ya quedo cargada de una ejec anterior, la salteo
        if categoria in resultado:
            print("categoria ya creaa, salteadda:", categoria)
            continue

        print("categoria:", categoria)
        data = pedir_variantes_categoria(categoria, seeds)

        if data is None:
            print("no se pudo generar esta categoria, se corta la ejecucion")
            break

        resultado[categoria] = data
        guardar(resultado)
        time.sleep(SLEEP_BETWEEN_CALLS)

    print("listo por ahora, guardado en", OUTPUT_PATH)


if __name__ == "__main__":
    main()