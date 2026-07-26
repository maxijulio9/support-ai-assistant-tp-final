-- crea las tablas que necesita el sistema para guardar tickets e interacciones
-- las tablas de configuracion del proyecto se crean cuando se implemente M7
-- las tablas de autenticacion se crean cuando se implemente M9

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- paises donde opera el negocio
CREATE TABLE IF NOT EXISTS country (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code            VARCHAR(10)  NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL
);

-- estados posibles de un ticket (abierto, en progreso, cerrado, etc)
CREATE TABLE IF NOT EXISTS ticket_status (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code            VARCHAR(50)  NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    is_terminal     BOOLEAN NOT NULL DEFAULT FALSE
);

-- categorias de soporte (seguridad_cuenta, acceso_autenticacion, etc)
CREATE TABLE IF NOT EXISTS ticket_category (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code            VARCHAR(50)  NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL
);

-- niveles de prioridad (Low, Medium, High, Highest)
CREATE TABLE IF NOT EXISTS ticket_priority (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code            VARCHAR(50)  NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    level           INTEGER NOT NULL
);

-- tipos de solicitud (portal, email, etc)
CREATE TABLE IF NOT EXISTS ticket_request_type (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code            VARCHAR(50)  NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL
);

-- tipos de sentimiento detectado en el mensaje del usuario
CREATE TABLE IF NOT EXISTS sentiment_typ (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code            VARCHAR(50)  NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    score_weight    FLOAT,
    triggers_alert  BOOLEAN NOT NULL DEFAULT FALSE
);

-- proyecto registrado en el sistema (ej: Tokenia Argentina, Tokenia Brasil)
CREATE TABLE IF NOT EXISTS project (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    country_id      UUID REFERENCES country(id),
    code            VARCHAR(50)  NOT NULL UNIQUE,
    name            VARCHAR(150) NOT NULL,
    platform        VARCHAR(50),
    kb_space_key    VARCHAR(50),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ticket procesado por el sistema
CREATE TABLE IF NOT EXISTS ticket (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID REFERENCES project(id),
    status_id           UUID REFERENCES ticket_status(id),
    priority_id         UUID REFERENCES ticket_priority(id),
    category_id         UUID REFERENCES ticket_category(id),
    request_type_id     UUID REFERENCES ticket_request_type(id),
    country_id          UUID REFERENCES country(id),
    issue_key           VARCHAR(50) NOT NULL,
    summary             VARCHAR(255),
    description         TEXT,
    reporter_account_id VARCHAR(128),
    assignee_account_id VARCHAR(128),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- evento recibido desde jsm via webhook
CREATE TABLE IF NOT EXISTS system_event (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id           UUID REFERENCES ticket(id),
    webhook_event       VARCHAR(50) NOT NULL,
    payload             JSON,
    processing_status   VARCHAR(20),
    received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- resultado de un ciclo de procesamiento completo del pipeline
CREATE TABLE IF NOT EXISTS interaction (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id               UUID REFERENCES ticket(id),
    system_event_id         UUID REFERENCES system_event(id),
    category_id             UUID REFERENCES ticket_category(id),
    priority_id             UUID REFERENCES ticket_priority(id),
    sentiment_id            UUID REFERENCES sentiment_typ(id),
    text_input              TEXT,
    detected_intent         VARCHAR(100),
    info_sufficient         BOOLEAN DEFAULT TRUE,
    generated_response      TEXT,
    confidence_score        FLOAT,
    decision                VARCHAR(50),
    processing_time_ms      INTEGER,
    chunks_retrieved_count  INTEGER DEFAULT 0,
    ragas_faithfulness      FLOAT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at             TIMESTAMPTZ
);

-- tabla para almacenar credenciales externas que van a estar encriptadas
-- las credenciales se encriptan usando APP_SECRET_KEY antes de guardarse
CREATE TABLE IF NOT EXISTS system_config (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    key             VARCHAR(100) UNIQUE NOT NULL,
    encrypted_value TEXT        NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);