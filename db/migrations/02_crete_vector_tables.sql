CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS knowledge_chunk (
    id        UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    content   TEXT         NOT NULL,
    embedding VECTOR(1536) NOT NULL,
    source    VARCHAR(100),
    indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);