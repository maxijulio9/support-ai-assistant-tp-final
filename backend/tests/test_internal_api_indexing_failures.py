"""Tests unitarios para las fallas de la indexacion y las corridas abandonadas.
Se mockean la base de datos y el worker, sin tocar nada real."""

import pytest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch, MagicMock
from app.modules.internal_api.repositories.kb_indexing_status_repository import KbIndexingStatusRepository
from app.modules.event_pipeline.indexing_status_repository import (
    IndexingStatusRepository,
    STALE_AFTER_MINUTES,
    STALE_QUEUED_DETAIL,
    STALE_RUNNING_DETAIL,
    MAX_ERROR_DETAIL_LENGTH,
)
from app.modules.knowledge_indexer.service import KnowledgeIndexer

REPO_DB = "app.modules.event_pipeline.indexing_status_repository.get_db"
INDEXER_DB = "app.modules.knowledge_indexer.service.get_db"
READER_DB = "app.modules.internal_api.repositories.kb_indexing_status_repository.get_db"
WORKER_REPO = "app.modules.event_pipeline.indexing_status_repository.IndexingStatusRepository"
WORKER_INDEXER = "app.modules.knowledge_indexer.service.KnowledgeIndexer"
MOMENT = datetime(2026, 10, 22, 21, 40, tzinfo=timezone.utc)


# arma un indexador sin construir sus dependencias, con las paginas simuladas
def _indexer(pages):
    indexer = KnowledgeIndexer.__new__(KnowledgeIndexer)
    indexer.extract_pages = MagicMock(return_value=pages)
    indexer.chunker = MagicMock()
    indexer.chunker.chunk_text.return_value = ["fragmento"]
    indexer.embedding_client = MagicMock()
    indexer.embedding_client.generate_embedding.return_value = [0.1]
    indexer.storage = MagicMock()
    return indexer


# arma la fila del ultimo estado, con los campos que lee el repositorio
def _status_row(**overrides):
    values = {
        "id": "run-1", "space_keys": ["TA"], "status": "running", "total_documents": 7, "documents_processed": 3,
        "chunks_generated": 9, "error_detail": None, "started_at": MOMENT, "updated_at": MOMENT, "is_stale": False,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


# lee el ultimo estado con una fila simulada y devuelve el resultado junto con la base usada
def _read_status(row):
    db = MagicMock()
    db.execute.return_value.fetchone.return_value = row
    with patch(READER_DB) as mock_get_db:
        mock_get_db.return_value = iter([db])
        return KbIndexingStatusRepository().get_latest_status(), db


# verifica que si falla la generacion de embeddings se deshace la transaccion y el error se relanza
@patch(INDEXER_DB)
def test_index_spaces_rolls_back_and_raises_when_the_embeddings_fail(mock_get_db):
    db = MagicMock()
    mock_get_db.return_value = iter([db])
    indexer = _indexer([SimpleNamespace(content="a")])
    indexer.embedding_client.generate_embedding.side_effect = Exception("falla de embeddings")

    with pytest.raises(Exception, match="falla de embeddings"):
        indexer.index_spaces(["TA"])

    db.rollback.assert_called_once()
    db.commit.assert_not_called()
    db.close.assert_called_once()


# verifica que si falla el guardado de un fragmento se deshace la transaccion y el error se relanza
@patch(INDEXER_DB)
def test_index_spaces_rolls_back_and_raises_when_saving_fails(mock_get_db):
    db = MagicMock()
    mock_get_db.return_value = iter([db])
    indexer = _indexer([SimpleNamespace(content="a")])
    indexer.storage.save_chunk.side_effect = Exception("falla de bd")

    with pytest.raises(Exception, match="falla de bd"):
        indexer.index_spaces(["TA"])

    db.rollback.assert_called_once()
    db.commit.assert_not_called()


# verifica que la tarea del worker deja la corrida en failed, y no en completed, cuando falla el indexador real
@pytest.mark.asyncio
async def test_worker_marks_the_run_failed_when_the_real_indexer_fails():
    from app.modules.event_pipeline.worker import process_kb_indexing
    db = MagicMock()
    indexer = _indexer([SimpleNamespace(content="a")])
    indexer.embedding_client.generate_embedding.side_effect = Exception("falla de embeddings")

    with patch(WORKER_INDEXER, return_value=indexer), patch(WORKER_REPO) as mock_repo_class, patch(INDEXER_DB) as mock_get_db:
        mock_get_db.return_value = iter([db])
        repo = mock_repo_class.return_value

        with pytest.raises(Exception, match="falla de embeddings"):
            await process_kb_indexing({}, ["TA"], "run-1")

    repo.mark_failed.assert_called_once_with("run-1", "falla de embeddings")
    repo.mark_completed.assert_not_called()


# verifica que un error muy largo se recorta antes de guardarse
@patch(REPO_DB)
def test_mark_failed_truncates_a_very_long_error(mock_get_db):
    db = MagicMock()
    mock_get_db.return_value = iter([db])

    IndexingStatusRepository().mark_failed("run-1", "x" * (MAX_ERROR_DETAIL_LENGTH + 500))

    assert len(db.execute.call_args[0][1]["error_detail"]) == MAX_ERROR_DETAIL_LENGTH


# verifica que crear una corrida encolada cierra primero las abandonadas, en la misma transaccion que el insert
@patch(REPO_DB)
def test_create_queued_job_closes_stale_runs_before_inserting(mock_get_db):
    db = MagicMock()
    db.execute.return_value.fetchone.return_value = SimpleNamespace(id="run-1", started_at=MOMENT)
    mock_get_db.return_value = iter([db])

    IndexingStatusRepository().create_queued_job(["TA"])

    first, second = db.execute.call_args_list
    assert "SET status = 'failed'" in str(first[0][0])
    assert first[0][1]["minutes"] == STALE_AFTER_MINUTES
    assert first[0][1]["except_id"] is None
    assert "INSERT INTO kb_indexing_status" in str(second[0][0])
    db.commit.assert_called_once()


# verifica que crear una corrida directamente tambien cierra primero las abandonadas
@patch(REPO_DB)
def test_create_job_closes_stale_runs_before_inserting(mock_get_db):
    db = MagicMock()
    db.execute.return_value.fetchone.return_value = SimpleNamespace(id="run-1")
    mock_get_db.return_value = iter([db])

    IndexingStatusRepository().create_job(["TA"])

    first, second = db.execute.call_args_list
    assert "SET status = 'failed'" in str(first[0][0])
    assert "INSERT INTO kb_indexing_status" in str(second[0][0])
    db.commit.assert_called_once()


# verifica que al pasar una corrida a running se cierran las demas abandonadas, pero no la propia
@patch(REPO_DB)
def test_mark_running_closes_the_other_stale_runs_but_not_itself(mock_get_db):
    db = MagicMock()
    mock_get_db.return_value = iter([db])

    IndexingStatusRepository().mark_running("run-1")

    first, second = db.execute.call_args_list
    assert first[0][1]["except_id"] == "run-1"
    assert "SET status = 'running'" in str(second[0][0])
    db.commit.assert_called_once()


# verifica que una corrida en running sin actualizaciones se informa como fallida, con su explicacion
def test_status_reports_a_stale_running_run_as_failed():
    result, _ = _read_status(_status_row(status="running", is_stale=True))

    assert result["status"] == "failed"
    assert result["error_detail"] == STALE_RUNNING_DETAIL


# verifica que una corrida en queued sin actualizaciones se informa como fallida, con su propia explicacion
def test_status_reports_a_stale_queued_run_as_failed_with_its_own_detail():
    result, _ = _read_status(_status_row(status="queued", is_stale=True))

    assert result["status"] == "failed"
    assert result["error_detail"] == STALE_QUEUED_DETAIL


# verifica que una corrida en running que sigue avanzando se informa tal cual
def test_status_keeps_a_fresh_running_run_as_is():
    result, _ = _read_status(_status_row(status="running", is_stale=False))

    assert result["status"] == "running"
    assert result["error_detail"] is None


# verifica que una corrida fallida conserva su propio error
def test_status_keeps_the_error_of_a_failed_run():
    result, _ = _read_status(_status_row(status="failed", error_detail="falla de embeddings", is_stale=False))

    assert result["status"] == "failed"
    assert result["error_detail"] == "falla de embeddings"


# verifica que una corrida abandonada que ya tenia un error no lo pierde
def test_status_keeps_an_existing_error_on_a_stale_run():
    result, _ = _read_status(_status_row(status="running", error_detail="un error previo", is_stale=True))

    assert result["status"] == "failed"
    assert result["error_detail"] == "un error previo"


# verifica que la consulta calcula si la corrida esta abandonada con el umbral configurado
def test_status_query_uses_the_staleness_threshold():
    _, db = _read_status(_status_row())

    assert "is_stale" in str(db.execute.call_args[0][0])
    assert db.execute.call_args[0][1] == {"stale_minutes": STALE_AFTER_MINUTES}
