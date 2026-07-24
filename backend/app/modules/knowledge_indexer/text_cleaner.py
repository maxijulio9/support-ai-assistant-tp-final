# limpia el html/markup de confluence y lo convierte a texto plano

from bs4 import BeautifulSoup


class TextCleaner:

    # convierte el html de confluence a texto plano legible
    def clean_html(self, html: str) -> str:
        soup = BeautifulSoup(html, "html.parser")
        texto = soup.get_text(separator=" ", strip=True)

        texto = " ".join(texto.split())
        return texto