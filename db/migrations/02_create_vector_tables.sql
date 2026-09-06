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