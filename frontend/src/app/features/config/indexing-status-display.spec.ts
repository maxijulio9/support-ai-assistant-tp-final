import {
  ERROR_DETAIL_PREVIEW_LENGTH,
  buildOptimisticIndexingStatus,
  formatIndexingTimestamp,
  hasNoIndexingData,
  indexingLastRunLabel,
  indexingStatusLabel,
  indexingStatusTone,
  justFinishedIndexing,
  truncatedErrorDetail,
} from './indexing-status-display';
import { IndexingStatusResponse } from '../../api/models/indexing-status-response';
import { StartIndexingResponse } from '../../api/models/start-indexing-response';

function statusResponse(overrides: Partial<IndexingStatusResponse> = {}): IndexingStatusResponse {
  return {
    id: 'run-1',
    space_keys: ['TA'],
    status: 'running',
    total_documents: null,
    documents_processed: 0,
    chunks_generated: 0,
    error_detail: null,
    started_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('indexingStatusLabel', () => {
  it('rotula "Sin corridas" cuando no hay estado', () => {
    expect(indexingStatusLabel(null)).toBe('Sin corridas');
  });

  it('rotula "En cola" para queued', () => {
    expect(indexingStatusLabel(statusResponse({ status: 'queued' }))).toBe('En cola');
  });

  it('rotula "En curso" para running', () => {
    expect(indexingStatusLabel(statusResponse({ status: 'running' }))).toBe('En curso');
  });

  it('rotula "Finalizada" para completed', () => {
    expect(indexingStatusLabel(statusResponse({ status: 'completed' }))).toBe('Finalizada');
  });

  it('rotula "Fallida" para failed', () => {
    expect(indexingStatusLabel(statusResponse({ status: 'failed' }))).toBe('Fallida');
  });

  it('una decision desconocida se muestra con su valor crudo, sin romper', () => {
    expect(indexingStatusLabel(statusResponse({ status: 'archived' }))).toBe('archived');
  });
});

describe('indexingStatusTone', () => {
  it('es neutro cuando no hay estado', () => {
    expect(indexingStatusTone(null)).toBe('neutral');
  });

  it('es progress para queued', () => {
    expect(indexingStatusTone(statusResponse({ status: 'queued' }))).toBe('progress');
  });

  it('es progress para running', () => {
    expect(indexingStatusTone(statusResponse({ status: 'running' }))).toBe('progress');
  });

  it('es success para completed', () => {
    expect(indexingStatusTone(statusResponse({ status: 'completed' }))).toBe('success');
  });

  it('es error para failed', () => {
    expect(indexingStatusTone(statusResponse({ status: 'failed' }))).toBe('error');
  });

  it('un valor desconocido no rompe, se muestra neutro', () => {
    expect(indexingStatusTone(statusResponse({ status: 'archived' }))).toBe('neutral');
  });
});

describe('indexingLastRunLabel', () => {
  it('es null cuando nunca hubo una corrida', () => {
    expect(indexingLastRunLabel(null)).toBeNull();
  });

  it('incluye la fecha formateada de started_at cuando hay una corrida', () => {
    const status = statusResponse({ started_at: '2024-01-01T00:00:00Z' });
    expect(indexingLastRunLabel(status)).toBe(`Última corrida: ${formatIndexingTimestamp(status.started_at)}`);
  });
});

describe('hasNoIndexingData', () => {
  it('true para completed con los dos contadores en 0 y total null', () => {
    const status = statusResponse({
      status: 'completed',
      documents_processed: 0,
      chunks_generated: 0,
      total_documents: null,
    });
    expect(hasNoIndexingData(status)).toBe(true);
  });

  it('true para failed con los dos contadores en 0 y total null', () => {
    const status = statusResponse({
      status: 'failed',
      documents_processed: 0,
      chunks_generated: 0,
      total_documents: null,
    });
    expect(hasNoIndexingData(status)).toBe(true);
  });

  it('false para completed si algun contador no es 0', () => {
    const status = statusResponse({
      status: 'completed',
      documents_processed: 5,
      chunks_generated: 0,
      total_documents: null,
    });
    expect(hasNoIndexingData(status)).toBe(false);
  });

  it('false para completed si total_documents no es null', () => {
    const status = statusResponse({
      status: 'completed',
      documents_processed: 0,
      chunks_generated: 0,
      total_documents: 10,
    });
    expect(hasNoIndexingData(status)).toBe(false);
  });

  it('false para running aunque los contadores esten en 0 y total en null: todavia no tuvo tiempo', () => {
    const status = statusResponse({
      status: 'running',
      documents_processed: 0,
      chunks_generated: 0,
      total_documents: null,
    });
    expect(hasNoIndexingData(status)).toBe(false);
  });

  it('false para queued aunque los contadores esten en 0 y total en null', () => {
    const status = statusResponse({
      status: 'queued',
      documents_processed: 0,
      chunks_generated: 0,
      total_documents: null,
    });
    expect(hasNoIndexingData(status)).toBe(false);
  });
});

describe('buildOptimisticIndexingStatus', () => {
  it('completa el estado a partir de la respuesta del POST y los espacios enviados', () => {
    const response: StartIndexingResponse = {
      id: 'run-2',
      started_at: '2024-02-01T00:00:00Z',
      status: 'queued',
    };
    const result = buildOptimisticIndexingStatus(response, ['TA', 'DEV']);

    expect(result).toEqual({
      id: 'run-2',
      status: 'queued',
      started_at: '2024-02-01T00:00:00Z',
      updated_at: '2024-02-01T00:00:00Z',
      space_keys: ['TA', 'DEV'],
      documents_processed: 0,
      chunks_generated: 0,
      total_documents: null,
      error_detail: null,
    });
  });
});

describe('truncatedErrorDetail', () => {
  it('texto corto: no se trunca', () => {
    const result = truncatedErrorDetail('Error breve');
    expect(result).toEqual({ preview: 'Error breve', isTruncated: false });
  });

  it('texto exactamente en el limite: no se trunca', () => {
    const detail = 'a'.repeat(ERROR_DETAIL_PREVIEW_LENGTH);
    const result = truncatedErrorDetail(detail);
    expect(result).toEqual({ preview: detail, isTruncated: false });
  });

  it('texto largo: se trunca con elipsis', () => {
    const detail = 'a'.repeat(ERROR_DETAIL_PREVIEW_LENGTH + 50);
    const result = truncatedErrorDetail(detail);
    expect(result.isTruncated).toBe(true);
    expect(result.preview).toBe(`${'a'.repeat(ERROR_DETAIL_PREVIEW_LENGTH)}…`);
  });

  it('acepta un maxLength distinto del default', () => {
    const result = truncatedErrorDetail('0123456789', 5);
    expect(result).toEqual({ preview: '01234…', isTruncated: true });
  });
});

describe('justFinishedIndexing', () => {
  it('false en la primera carga, sin estado anterior, aunque el actual ya sea terminal', () => {
    expect(justFinishedIndexing(null, 'completed')).toBe(false);
    expect(justFinishedIndexing(null, 'failed')).toBe(false);
  });

  it('false en la primera carga sin ningun estado', () => {
    expect(justFinishedIndexing(null, null)).toBe(false);
  });

  it('true cuando pasa de running a completed', () => {
    expect(justFinishedIndexing('running', 'completed')).toBe(true);
  });

  it('true cuando pasa de queued a failed', () => {
    expect(justFinishedIndexing('queued', 'failed')).toBe(true);
  });

  it('false cuando sigue en curso (running a running, o queued a running)', () => {
    expect(justFinishedIndexing('running', 'running')).toBe(false);
    expect(justFinishedIndexing('queued', 'running')).toBe(false);
  });

  it('false cuando ya estaba en un estado terminal (no es una transicion nueva)', () => {
    expect(justFinishedIndexing('completed', 'completed')).toBe(false);
    expect(justFinishedIndexing('failed', 'failed')).toBe(false);
  });

  it('false cuando el anterior terminal arranca una corrida nueva (failed a queued)', () => {
    expect(justFinishedIndexing('failed', 'queued')).toBe(false);
  });

  it('false si el anterior es un valor desconocido, no cuenta como en curso', () => {
    expect(justFinishedIndexing('archived', 'completed')).toBe(false);
  });
});
