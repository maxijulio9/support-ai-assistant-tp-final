import {
  formatIndexingTimestamp,
  indexingLastRunLabel,
  indexingStatusLabel,
  indexingStatusTone,
  isOrphanedIndexingStatus,
  ORPHAN_RUN_THRESHOLD_MS,
} from './indexing-status-display';
import { IndexingStatusResponse } from '../../api/models/indexing-status-response';

function statusResponse(overrides: Partial<IndexingStatusResponse> = {}): IndexingStatusResponse {
  return {
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

describe('indexing-status-display', () => {
  describe('indexingStatusLabel', () => {
    it('rotula "Sin corridas" cuando no hay estado', () => {
      expect(indexingStatusLabel(null)).toBe('Sin corridas');
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
  });

  describe('indexingStatusTone', () => {
    it('es neutro cuando no hay estado', () => {
      expect(indexingStatusTone(null)).toBe('neutral');
    });

    it('es progress para running', () => {
      expect(indexingStatusTone(statusResponse({ status: 'running' }))).toBe('progress');
    });

    it('es neutro para completed, no de exito', () => {
      expect(indexingStatusTone(statusResponse({ status: 'completed' }))).toBe('neutral');
    });

    it('es error para failed', () => {
      expect(indexingStatusTone(statusResponse({ status: 'failed' }))).toBe('error');
    });
  });

  describe('isOrphanedIndexingStatus', () => {
    it('no es huerfana si no esta running', () => {
      const status = statusResponse({ status: 'completed', started_at: '2000-01-01T00:00:00Z' });
      expect(isOrphanedIndexingStatus(status, Date.now())).toBe(false);
    });

    it('es huerfana si running lleva mas del umbral', () => {
      const now = Date.now();
      const status = statusResponse({
        status: 'running',
        started_at: new Date(now - ORPHAN_RUN_THRESHOLD_MS - 1000).toISOString(),
      });
      expect(isOrphanedIndexingStatus(status, now)).toBe(true);
    });

    it('no es huerfana si running todavia esta dentro del umbral', () => {
      const now = Date.now();
      const status = statusResponse({
        status: 'running',
        started_at: new Date(now - 1000).toISOString(),
      });
      expect(isOrphanedIndexingStatus(status, now)).toBe(false);
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
});
