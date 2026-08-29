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
CREATE TABLE IF NOT EXISTS sentiment_type (
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
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    threshold_auto_publish NUMERIC(4,3) DEFAULT 0.85,
    threshold_needs_review NUMERIC(4,3) DEFAULT 0.60,
    similarity_threshold    NUMERIC(4,3) DEFAULT 0.40
);

-- categorias de soporte que usa cada proyecto/organizacion
-- resuelve que categorias tiene habilitadas cada proyecto, sin acoplar el sistema
-- al vocabulario de negocio de una organizacion en particular
CREATE TABLE IF NOT EXISTS project_category (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id  UUID NOT NULL REFERENCES project(id),
    category_id UUID NOT NULL REFERENCES ticket_category(id),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (project_id, category_id)
);

-- mapeo de acciones del sistema a estados reales de jsm, configurable por proyecto
-- una fila por combinacion proyecto + estado generico (referencia a ticket_status)
CREATE TABLE IF NOT EXISTS project_config (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES project(id),
    status_id       UUID NOT NULL REFERENCES ticket_status(id),
    system_action   VARCHAR(50),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (project_id, status_id)
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



-- tabla que representa cada space de confluence que se usa para indexar
CREATE TABLE IF NOT EXISTS kb_spaces (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    space_key       VARCHAR(50)  UNIQUE NOT NULL,
    country_id      UUID         REFERENCES country(id),
    description     VARCHAR(200),
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    last_indexed_at TIMESTAMPTZ
);

-- tabla intermedia que asocia proyectos con spaces
-- un proyecto puede tener multiples spaces
CREATE TABLE IF NOT EXISTS project_space (
    id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id  UUID    NOT NULL REFERENCES project(id),
    space_id    UUID    NOT NULL REFERENCES kb_spaces(id),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (project_id, space_id)
);