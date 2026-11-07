CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS knowledge_chunk (
    id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    content      TEXT         NOT NULL,
    embedding    VECTOR(1536) NOT NULL,
    source       VARCHAR(100),
    space_key    VARCHAR(50),
    page_id      VARCHAR(100),
    page_title   VARCHAR(255),
    doc_type     VARCHAR(50),
    category     VARCHAR(150),
    country      VARCHAR(10),
    chunk_index  INTEGER,
    total_chunks INTEGER,
    indexed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ,
    UNIQUE (page_id, chunk_index)
);


-- fragmentos que uso cada interaccion para responder, en el orden en que se recuperaron
CREATE TABLE IF NOT EXISTS retrieved_chunk (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interaction_id    UUID REFERENCES interaction(id),
    chunk_id          UUID,  -- sin llave foranea a proposito, los chunks se borran al reindexar y la interaccion los conserva como historial
    page_title        VARCHAR(255),
    rank_position     INTEGER,
    similarity_score  FLOAT
);
