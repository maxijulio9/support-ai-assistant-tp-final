# M7 InternalAPI
# arma las fuentes de conocimiento que se muestran en el detalle de una interaccion, una por pagina de confluence

from urllib.parse import quote

# largo maximo del fragmento de cada fuente, incluido el punto suspensivo final cuando se recorta
MAX_FRAGMENT_LENGTH = 600
ELLIPSIS = "…"


# arma el enlace a una pagina de confluence cloud, o none si falta algun dato para armarlo
# la url base puede venir con o sin el segmento wiki y no se duplica
def build_page_url(base_url: str | None, space_key: str | None, page_id: str | None) -> str | None:
    if not base_url or not space_key or not page_id:
        return None

    base = base_url.strip().rstrip("/")
    if not base.endswith("/wiki"):
        base = f"{base}/wiki"

    space = quote(str(space_key), safe="~")
    page = quote(str(page_id), safe="")
    return f"{base}/spaces/{space}/pages/{page}"


# deja el texto en una sola linea y lo recorta en el limite de una palabra si pasa el maximo
# el resultado nunca supera MAX_FRAGMENT_LENGTH caracteres, contando el punto suspensivo
def make_fragment(content: str | None, max_length: int = MAX_FRAGMENT_LENGTH) -> str | None:
    if not content:
        return None

    collapsed = " ".join(content.split())
    if not collapsed:
        return None

    if len(collapsed) <= max_length:
        return collapsed

    cut = collapsed[:max_length - 1]
    if collapsed[max_length - 1] != " ":
        last_space = cut.rfind(" ")
        if last_space > 0:
            cut = cut[:last_space]

    return cut.rstrip() + ELLIPSIS


# arma la lista de fuentes a partir de los fragmentos recuperados, ordenados por relevancia
# una entrada por pagina, con el fragmento mejor posicionado, y se descartan los que no tienen ni titulo ni pagina
# el titulo guardado al responder tiene prioridad sobre el actual, y si la pagina ya no esta en la base queda solo el titulo
def build_sources(rows: list[dict], confluence_base_url: str | None) -> list[dict]:
    sources = []
    seen = set()

    for row in rows:
        title = row.get("page_title") or row.get("current_title")
        page_id = row.get("page_id")

        if not title and not page_id:
            continue

        key = page_id or title
        if key in seen:
            continue
        seen.add(key)

        sources.append({
            "page_title": title or "Sin título",
            "space_key": row.get("space_key"),
            "url": build_page_url(confluence_base_url, row.get("space_key"), page_id),
            "fragment": make_fragment(row.get("content")),
        })

    return sources
