# M7 InternalAPI: sugiere el mapeo automatico entre prioridades universales y las reales de una instancia
# el admin puede aceptar la sugerencia o ajustarla manualmente antes de confirmar

import re
import unicodedata

PRIORITY_SYNONYMS = {
    "Highest": ["highest", "critical", "critico", "urgente", "urgent", "p1", "muy alta", "muy alto"],
    "High": ["high", "alta", "alto", "importante", "p2"],
    "Medium": ["medium", "media", "medio", "middle", "normal", "p3"],
    "Low": ["low", "baja", "bajo", "minor", "p4", "trivial"],
}


class PriorityMappingSuggester:

    # sugiere que prioridad real de jsm corresponde a cada universal
    def suggest(self, real_priorities: list[dict]) -> dict:
        suggestions = {}
        for universal, synonyms in PRIORITY_SYNONYMS.items():
            candidates = []
            for index, rp in enumerate(real_priorities):
                normalized = self._normalize(rp["name"])
                if normalized in synonyms:
                    candidates.append((0, index, rp["id"]))
                elif any(syn in normalized for syn in synonyms):
                    candidates.append((1, index, rp["id"]))

            if candidates:
                candidates.sort(key=lambda c: (c[0], c[1]))
                suggestions[universal] = candidates[0][2]
            else:
                suggestions[universal] = None

        return suggestions

    def _normalize(self, name: str) -> str:
        sin_tildes = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
        return re.sub(r"[^a-z0-9]+", " ", sin_tildes.lower()).strip()