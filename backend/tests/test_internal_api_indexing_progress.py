"""Tests unitarios para el progreso y el id de la corrida de indexacion.
Se mockean la base de datos, el worker de colas y JSM, sin tocar nada real."""

import pytest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch, MagicMock, AsyncMock, call
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.main import app as main_app
from app.modules.auth.dependencies import require_admin
from app.modules.internal_api.router import router
from app.modules.internal_api.repositories.kb_indexing_status_repository import KbIndexingStatusRepository
from app.modules.internal_api.services.indexer_trigger_service import IndexingTriggerService
from app.modules.event_pipeline.indexing_status_repository import IndexingStatusRepository
from app.modules.knowledge_indexer.service import KnowledgeIndexer

REPO_DB = "app.modules.event_pipeline.indexing_status_repository.get_db"
ENGINE = "app.modules.event_pipeline.indexing_status_repository._get_progress_engine"
INDEXER_DB = "app.modules.knowledge_indexer.service.get_db"
WORKER_REPO = "app.modules.event_pipeline.indexing_status_repository.IndexingStatusRepository"
WORKER_INDEXER = "app.modules.knowledge_indexer.service.KnowledgeIndexer"
TRIGGER_POOL = "app.modules.internal_api.services.indexer_trigger_service.get_arq_pool"
READER_DB = "app.modules.internal_api.repositories.kb_indexing_status_repository.get_db"
ROUTER_TRIGGER = "app.modules.internal_api.router._indexing_trigger_service"
ROUTER_STATUS_REPO = "app.modules.internal_api.router._kb_indexing_status_repository"
STARTED_AT = "2026-10-22T21:40:00+00:00"

app = FastAPI()
app.include_router(router)
client = TestClient(app)


# arma un indexador sin construir sus dependencias, con las paginas y los fragmentos simulados
def _indexer(pages, chunks_per_page=2):
    indexer = KnowledgeIndexer.__new__(KnowledgeIndexer)
    indexer.extract_pages = MagicMock(return_value=pages)
    indexer.chunker = MagicMock()
    indexer.chunker.chunk_text.return_value = ["fragmento"] * chunks_per_page
    indexer.embedding_client = MagicMock()
    indexer.embedding_client.generate_embedding.return_value = [0.1]
    indexer.storage = MagicMock()
    return indexer


# hace que el endpoint vea a un admin autenticado
def _as_admin():
    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")


# verifica que crear la corrida encolada inserta una fila queued y devuelve su id y el momento del pedido
@patch(REPO_DB)
def test_create_queued_job_inserts_a_queued_row_and_returns_its_id_and_start(mock_get_db):
    db = MagicMock()
    started = datetime(2026, 10, 22, 21, 40, tzinfo=timezone.utc)
    db.execute.return_value.fetchone.return_value = SimpleNamespace(id="run-1", started_at=started)
    mock_get_db.return_value = iter([db])

    result = IndexingStatusRepository().create_queued_job(["TA"])

    assert result == {"id": "run-1", "started_at": started.isoformat()}
    assert "'queued'" in str(db.execute.call_args[0][0])
    assert db.execute.call_args[0][1] == {"space_keys": ["TA"]}
    db.commit.assert_called_once()


# verifica que pasar la corrida a running reinicia el progreso y no toca started_at
@patch(REPO_DB)
def test_mark_running_resets_the_progress_and_keeps_started_at(mock_get_db):
    db = MagicMock()
    mock_get_db.return_value = iter([db])

    IndexingStatusRepository().mark_running("run-1")

    sql = str(db.execute.call_args[0][0])
    assert "status = 'running'" in sql
    assert "total_documents = NULL" in sql
    assert "documents_processed = 0" in sql
    assert "chunks_generated = 0" in sql
    assert "error_detail = NULL" in sql
    assert "started_at" not in sql
    assert db.execute.call_args[0][1] == {"id": "run-1"}
    db.commit.assert_called_once()


# verifica que actualizar el progreso manda solo los valores dados, conserva los demas y refresca updated_at
@patch(ENGINE)
def test_update_progress_writes_only_the_given_values_and_refreshes_updated_at(mock_get_engine):
    conn = mock_get_engine.return_value.connect.return_value.__enter__.return_value

    IndexingStatusRepository().update_progress("run-1", total_documents=7)

    sql = str(conn.execute.call_args[0][0])
    params = conn.execute.call_args[0][1]
    assert params == {"id": "run-1", "total_documents": 7, "documents_processed": None, "chunks_generated": None}
    assert "COALESCE(:total_documents, total_documents)" in sql
    assert "COALESCE(:documents_processed, documents_processed)" in sql
    assert "updated_at = NOW()" in sql


# verifica que el progreso solo toca corridas en running, para no pisar una que ya termino o fallo
@patch(ENGINE)
def test_update_progress_only_touches_running_rows(mock_get_engine):
    conn = mock_get_engine.return_value.connect.return_value.__enter__.return_value

    IndexingStatusRepository().update_progress("run-1", documents_processed=1, chunks_generated=3)

    assert "status = 'running'" in str(conn.execute.call_args[0][0])


# verifica que si la conexion falla la primera vez, reintenta una vez con una conexion nueva
@patch(ENGINE)
def test_update_progress_retries_once_after_a_connection_error(mock_get_engine):
    engine = mock_get_engine.return_value
    good_conn = MagicMock()
    good_context = MagicMock()
    good_context.__enter__.return_value = good_conn
    engine.connect.side_effect = [Exception("conexion cerrada"), good_context]

    IndexingStatusRepository().update_progress("run-1", documents_processed=3, chunks_generated=9)

    assert engine.connect.call_count == 2
    good_conn.execute.assert_called_once()


# verifica que si falla las dos veces se relanza el error, y que lo atrapa quien lo llama
@patch(ENGINE)
def test_update_progress_raises_after_two_failures(mock_get_engine):
    engine = mock_get_engine.return_value
    engine.connect.side_effect = Exception("sin conexion")

    with pytest.raises(Exception, match="sin conexion"):
        IndexingStatusRepository().update_progress("run-1", documents_processed=3)

    assert engine.connect.call_count == 2


# verifica que el indexador informa el total apenas termina la extraccion y despues el progreso de cada pagina
@patch(INDEXER_DB)
def test_index_spaces_reports_the_total_and_then_the_progress_of_each_page(mock_get_db):
    mock_get_db.return_value = iter([MagicMock()])
    pages = [SimpleNamespace(content="a"), SimpleNamespace(content="b")]
    callback = MagicMock()

    _indexer(pages).index_spaces(["TA"], on_progress=callback)

    assert callback.call_args_list == [
        call(total_documents=2),
        call(documents_processed=1, chunks_generated=2),
        call(documents_processed=2, chunks_generated=4),
    ]


# verifica que el indexador sigue funcionando igual sin aviso de progreso
@patch(INDEXER_DB)
def test_index_spaces_works_without_a_callback(mock_get_db):
    db = MagicMock()
    mock_get_db.return_value = iter([db])
    indexer = _indexer([SimpleNamespace(content="a"), SimpleNamespace(content="b")])

    indexer.index_spaces(["TA"])

    assert indexer.storage.save_chunk.call_count == 4
    db.commit.assert_called_once()


# verifica que un aviso de progreso que falla no interrumpe la indexacion
@patch(INDEXER_DB)
def test_a_failing_callback_does_not_interrupt_the_indexing(mock_get_db):
    db = MagicMock()
    mock_get_db.return_value = iter([db])
    indexer = _indexer([SimpleNamespace(content="a"), SimpleNamespace(content="b")])

    indexer.index_spaces(["TA"], on_progress=MagicMock(side_effect=Exception("falla de bd")))

    assert indexer.storage.save_chunk.call_count == 4
    db.commit.assert_called_once()


# verifica que con run_id la tarea pasa la fila a running y la reutiliza, sin crear otra
@patch(WORKER_INDEXER)
@patch(WORKER_REPO)
@pytest.mark.asyncio
async def test_worker_with_a_run_id_marks_it_running_and_reuses_the_row(mock_repo_class, mock_indexer_class):
    from app.modules.event_pipeline.worker import process_kb_indexing
    repo = mock_repo_class.return_value

    result = await process_kb_indexing({}, ["TA"], "run-1")

    repo.mark_running.assert_called_once_with("run-1")
    repo.create_job.assert_not_called()
    repo.mark_completed.assert_called_once_with("run-1")
    assert result == {"status": "completed", "space_keys": ["TA"]}


# verifica que sin run_id, como los trabajos encolados antes del cambio, la tarea crea la fila como antes
@patch(WORKER_INDEXER)
@patch(WORKER_REPO)
@pytest.mark.asyncio
async def test_worker_without_a_run_id_creates_the_row_like_before(mock_repo_class, mock_indexer_class):
    from app.modules.event_pipeline.worker import process_kb_indexing
    repo = mock_repo_class.return_value

    await process_kb_indexing({}, ["TA"])

    repo.create_job.assert_called_once_with(["TA"])
    repo.mark_running.assert_not_called()
    repo.mark_completed.assert_called_once_with(repo.create_job.return_value)


# verifica que la tarea le da al indexador un aviso que actualiza el progreso de la corrida
@patch(WORKER_INDEXER)
@patch(WORKER_REPO)
@pytest.mark.asyncio
async def test_worker_gives_the_indexer_a_callback_that_updates_the_progress(mock_repo_class, mock_indexer_class):
    from app.modules.event_pipeline.worker import process_kb_indexing
    repo = mock_repo_class.return_value
    indexer = mock_indexer_class.return_value

    await process_kb_indexing({}, ["TA"], "run-1")

    callback = indexer.index_spaces.call_args.kwargs["on_progress"]
    callback(documents_processed=2, chunks_generated=5)
    repo.update_progress.assert_called_once_with("run-1", documents_processed=2, chunks_generated=5)


# verifica que si el indexador falla la corrida queda failed con el detalle y el error se relanza
@patch(WORKER_INDEXER)
@patch(WORKER_REPO)
@pytest.mark.asyncio
async def test_worker_marks_the_run_failed_and_raises_when_the_indexer_fails(mock_repo_class, mock_indexer_class):
    from app.modules.event_pipeline.worker import process_kb_indexing
    repo = mock_repo_class.return_value
    mock_indexer_class.return_value.index_spaces.side_effect = Exception("falla de embeddings")

    with pytest.raises(Exception, match="falla de embeddings"):
        await process_kb_indexing({}, ["TA"], "run-1")

    repo.mark_failed.assert_called_once_with("run-1", "falla de embeddings")
    repo.mark_completed.assert_not_called()


# verifica que iniciar la indexacion crea la fila queued y encola la tarea con el id de la corrida
@patch(WORKER_REPO)
@patch(TRIGGER_POOL)
@pytest.mark.asyncio
async def test_start_indexing_creates_the_row_and_enqueues_it_with_its_id(mock_get_pool, mock_repo_class):
    repo = mock_repo_class.return_value
    repo.create_queued_job.return_value = {"id": "run-1", "started_at": STARTED_AT}
    pool = MagicMock()
    pool.enqueue_job = AsyncMock()
    mock_get_pool.return_value = pool

    result = await IndexingTriggerService().start_indexing(["TA"])

    assert result == {"id": "run-1", "started_at": STARTED_AT}
    repo.create_queued_job.assert_called_once_with(["TA"])
    enqueue = pool.enqueue_job.await_args
    assert enqueue.args == ("process_kb_indexing", ["TA"], "run-1")
    assert enqueue.kwargs == {"_queue_name": "kb_queue"}


# verifica que si no se puede encolar la fila queda failed con el motivo y el error se relanza
@patch(WORKER_REPO)
@patch(TRIGGER_POOL)
@pytest.mark.asyncio
async def test_start_indexing_marks_the_row_failed_when_the_enqueue_fails(mock_get_pool, mock_repo_class):
    repo = mock_repo_class.return_value
    repo.create_queued_job.return_value = {"id": "run-1", "started_at": STARTED_AT}
    pool = MagicMock()
    pool.enqueue_job = AsyncMock(side_effect=Exception("redis caido"))
    mock_get_pool.return_value = pool

    with pytest.raises(Exception, match="redis caido"):
        await IndexingTriggerService().start_indexing(["TA"])

    repo.mark_failed.assert_called_once()
    assert repo.mark_failed.call_args.args[0] == "run-1"
    assert "redis caido" in repo.mark_failed.call_args.args[1]


# verifica que el endpoint de inicio responde 202 con el estado, el id y el momento del pedido
@patch(ROUTER_TRIGGER)
def test_post_returns_202_with_the_id_and_the_start(mock_trigger):
    mock_trigger.start_indexing = AsyncMock(return_value={"id": "run-1", "started_at": STARTED_AT})
    _as_admin()

    response = client.post("/api/indexing/start", json={"space_keys": ["TA"]})

    app.dependency_overrides.clear()

    assert response.status_code == 202
    assert response.json() == {"status": "queued", "id": "run-1", "started_at": STARTED_AT}
    mock_trigger.start_indexing.assert_awaited_once_with(["TA"])


# verifica que el endpoint del estado devuelve el id de la corrida y acepta el estado queued
@patch(ROUTER_STATUS_REPO)
def test_get_status_returns_the_id(mock_repo):
    mock_repo.get_latest_status.return_value = {
        "id": "run-1", "space_keys": ["TA"], "status": "queued", "total_documents": None,
        "documents_processed": 0, "chunks_generated": 0, "error_detail": None,
        "started_at": STARTED_AT, "updated_at": STARTED_AT,
    }
    _as_admin()

    response = client.get("/api/indexing/status")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["id"] == "run-1"
    assert response.json()["status"] == "queued"


# verifica que el repositorio del estado trae el id de la corrida mas reciente
@patch(READER_DB)
def test_status_repository_returns_the_id(mock_get_db):
    db = MagicMock()
    moment = datetime(2026, 10, 22, 21, 40, tzinfo=timezone.utc)
    db.execute.return_value.fetchone.return_value = SimpleNamespace(
        id="run-1", space_keys=["TA"], status="running", total_documents=7, documents_processed=3,
        chunks_generated=9, error_detail=None, started_at=moment, updated_at=moment, is_stale=False,
    )
    mock_get_db.return_value = iter([db])

    result = KbIndexingStatusRepository().get_latest_status()

    assert result["id"] == "run-1"
    assert result["total_documents"] == 7
    assert "SELECT id," in " ".join(str(db.execute.call_args[0][0]).split())


# verifica en el contrato que el inicio devuelve id y started_at y que el estado trae el id, los tres obligatorios
def test_contract_declares_the_new_fields():
    schemas = main_app.openapi()["components"]["schemas"]

    assert "id" in schemas["StartIndexingResponse"]["required"]
    assert "started_at" in schemas["StartIndexingResponse"]["required"]
    assert "id" in schemas["IndexingStatusResponse"]["required"]
