# M2 TicketAnalyzer: descarga las imagenes adjuntas de un ticket y las prepara para que el modelo las lea
# es parte del analisis de adjuntos, opcional por proyecto y apagado por defecto
# lo que no cumple los topes se ignora, y un fallo al descargar nunca corta el procesamiento

import base64
import logging

logger = logging.getLogger(__name__)

# topes del analisis de adjuntos, mas imagenes o mas peso suman latencia y costo
MAX_IMAGES = 3
MAX_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_TYPES = ("image/png", "image/jpeg")


# baja las imagenes permitidas del ticket y las devuelve como data urls, en el orden en que vinieron
# el ejecutor de jsm descarga con las credenciales ya configuradas
async def fetch_images(jsm_executor, attachments: list[dict]) -> list[str]:
    images = []

    for item in attachments:
        if len(images) >= MAX_IMAGES:
            break

        mime_type = (item.get("mime_type") or "").lower()
        size = item.get("size") or 0
        content_url = item.get("content_url")

        if mime_type not in ALLOWED_IMAGE_TYPES or size > MAX_IMAGE_BYTES or not content_url:
            logger.info(f"adjunto '{item.get('filename')}' ignorado, tipo {mime_type or 'desconocido'} y peso {size}")
            continue

        try:
            content = await jsm_executor.download_attachment(content_url)
        except Exception as e:
            logger.error(f"no se pudo descargar el adjunto '{item.get('filename')}': {type(e).__name__}: {e}")
            continue

        # el peso que informa jira puede no coincidir con lo descargdo, se controla de nuevo
        if len(content) > MAX_IMAGE_BYTES:
            continue

        images.append(f"data:{mime_type};base64,{base64.b64encode(content).decode()}")

    return images
