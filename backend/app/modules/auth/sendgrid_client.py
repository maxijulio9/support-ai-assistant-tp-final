# M9 AuthModule cliente de SendGrid para el envio de emails transaccionales
# usado por el flujo de restablecimiento de contraseña

import httpx
from app.core.config import settings


class SendGridClient:

    def __init__(self):
        self.base_url = "https://api.sendgrid.com/v3"
        self.from_email = settings.sendgrid_from_email
        self._headers = {
            "Authorization": f"Bearer {settings.sendgrid_api_key}",
            "Content-Type": "application/json",
        }
        self._client = httpx.AsyncClient(headers=self._headers)

    # manda un email de texto plano a un destinatario
    async def send_email(self, to_email: str, subject: str, body: str) -> bool:
        url = f"{self.base_url}/mail/send"
        payload = {
            "personalizations": [{"to": [{"email": to_email}]}],
            "from": {"email": self.from_email},
            "subject": subject,
            "content": [{"type": "text/plain", "value": body}],
            "tracking_settings": {"click_tracking": {"enable": False}},

        }
        response = await self._client.post(url, json=payload)
        response.raise_for_status()
        return response.status_code == 202

    async def close(self):
        await self._client.aclose()