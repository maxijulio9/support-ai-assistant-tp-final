-- datos universalesº
-- se cargan al inicializar el sistema, independiente de la organizacion que lo use

-- paises frecuentes en LATAM y globales
INSERT INTO country (code, name) VALUES
    ('AR', 'Argentina'),
    ('BR', 'Brasil'),
    ('UY', 'Uruguay'),
    ('CL', 'Chile'),
    ('MX', 'Mexico'),
    ('CO', 'Colombia'),
    ('PE', 'Peru'),
    ('VE', 'Venezuela'),
    ('EC', 'Ecuador'),
    ('BO', 'Bolivia'),
    ('PY', 'Paraguay'),
    ('US', 'Estados Unidos'),
    ('ES', 'España'),
    ('CA', 'Canada'),
    ('MX', 'Mexico')
ON CONFLICT (code) DO NOTHING;

-- tipos de sentimiento detectados por el LLM en cada interaccion
INSERT INTO sentiment_typ (code, name, score_weight, triggers_alert) VALUES
    ('positivo', 'Positivo', 1.0, FALSE),
    ('neutro',   'Neutro',   0.5, FALSE),
    ('negativo', 'Negativo', 0.0, TRUE)
ON CONFLICT (code) DO NOTHING;