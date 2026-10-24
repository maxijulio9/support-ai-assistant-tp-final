import { NO_MEASURED_FIRST_RESPONSE_TEXT, PENDING_OUTCOME_LABEL, buildOutcomeRows } from './outcomes-breakdown';
import { OutcomeResponseTimes } from '../../../api/models/outcome-response-times';
import { TimeStats } from '../../../api/models/time-stats';

function stats(count: number, p50: number | null = null): TimeStats {
  return { count, mean_seconds: p50, p50_seconds: p50, p90_seconds: p50, within_target_rate: null };
}

function outcome(channel: string | null, tickets: number, firstResponse = stats(tickets, 20)): OutcomeResponseTimes {
  return { resolution_channel: channel, tickets, first_response: firstResponse };
}

const ALL_CHANNELS = [
  'REVIEWED_APPROVED',
  'REVIEWED_EDITED',
  'REVIEWED_REGENERATED',
  'ESCALATED_BY_HUMAN',
  'DISCARDED_BY_HUMAN',
  'RESOLVED_EXTERNALLY',
  'CANAL_FUTURO',
  null,
];

describe('buildOutcomeRows', () => {
  it('lista vacia no genera filas', () => {
    expect(buildOutcomeRows([], 5)).toEqual([]);
  });

  it('rotula cada canal conocido y calcula la proporcion sobre el total', () => {
    const rows = buildOutcomeRows([outcome('REVIEWED_APPROVED', 6), outcome('REVIEWED_EDITED', 2), outcome('REVIEWED_REGENERATED', 2)], 5);

    expect(rows.map((row) => row.label)).toEqual(['Aprobada', 'Editada y aprobada', 'Regenerada']);
    expect(rows.map((row) => row.share)).toEqual([0.6, 0.2, 0.2]);
  });

  it('ordena los canales conocidos en orden fijo y deja los pendientes al final', () => {
    const rows = buildOutcomeRows(
      [outcome(null, 1), outcome('DISCARDED_BY_HUMAN', 1), outcome('REVIEWED_EDITED', 1), outcome('REVIEWED_APPROVED', 1)],
      5,
    );

    expect(rows.map((row) => row.channel)).toEqual(['REVIEWED_APPROVED', 'REVIEWED_EDITED', 'DISCARDED_BY_HUMAN', null]);
  });

  it('sin tickets en total la proporcion es 0 y no NaN', () => {
    expect(buildOutcomeRows([outcome('REVIEWED_APPROVED', 0, stats(0))], 5)[0].share).toBe(0);
  });

  it('el texto de tickets va en singular con 1 y la proporcion en porcentaje entero', () => {
    const rows = buildOutcomeRows([outcome('REVIEWED_APPROVED', 1, stats(1)), outcome('REVIEWED_EDITED', 2, stats(2))], 5);

    expect(rows.map((row) => row.ticketsText)).toEqual(['1 ticket', '2 tickets']);
    expect(rows.map((row) => row.shareText)).toEqual(['33%', '67%']);
  });

  describe('primera respuesta segun first_response.count, sin depender del canal', () => {
    it.each(ALL_CHANNELS)('count 0 en %s muestra "Sin primera respuesta medida" aunque haya tickets', (channel) => {
      const [row] = buildOutcomeRows([outcome(channel, 4, stats(0))], 5);

      expect(row.firstResponse.state).toBe('empty');
      expect(row.firstResponseText).toBe(NO_MEASURED_FIRST_RESPONSE_TEXT);
      expect(row.tickets).toBe(4);
    });

    it.each(ALL_CHANNELS)('count entre 1 y min_sample menos 1 en %s muestra n insuficiente con el n', (channel) => {
      const rows = buildOutcomeRows([outcome(channel, 9, stats(1)), outcome(channel, 9, stats(4))], 5);

      expect(rows.map((row) => row.firstResponseText)).toEqual(['n insuficiente (1 ticket)', 'n insuficiente (4 tickets)']);
    });

    it.each(ALL_CHANNELS)('count desde min_sample en %s muestra la mediana', (channel) => {
      const [row] = buildOutcomeRows([outcome(channel, 9, stats(5, 125))], 5);

      expect(row.firstResponse.state).toBe('ok');
      expect(row.firstResponseText).toBe('Mediana 2 min 5 s');
    });

    it('usa el min_sample recibido', () => {
      const [row] = buildOutcomeRows([outcome('REVIEWED_APPROVED', 9, stats(7, 30))], 10);

      expect(row.firstResponseText).toBe('n insuficiente (7 tickets)');
    });

    it('un canal que antes se trataba como sin primera respuesta ahora muestra la mediana si tiene datos', () => {
      const [row] = buildOutcomeRows([outcome('DISCARDED_BY_HUMAN', 8, stats(8, 40))], 5);

      expect(row.firstResponseText).toBe('Mediana 40 s');
    });

    it('un canal de la revision sin datos medidos tampoco se trata distinto', () => {
      const [row] = buildOutcomeRows([outcome('REVIEWED_REGENERATED', 2, stats(0))], 5);

      expect(row.firstResponseText).toBe(NO_MEASURED_FIRST_RESPONSE_TEXT);
    });

    it('el canal null (pendientes) pasa por la misma regla', () => {
      const rows = buildOutcomeRows([outcome(null, 8, stats(8, 20)), outcome(null, 2, stats(0))], 5);

      expect(rows.map((row) => row.label)).toEqual([PENDING_OUTCOME_LABEL, PENDING_OUTCOME_LABEL]);
      expect(rows.map((row) => row.firstResponseText)).toEqual(['Mediana 20 s', NO_MEASURED_FIRST_RESPONSE_TEXT]);
    });
  });

  it('rotula RESOLVED_EXTERNALLY como resuelta por fuera del sistema', () => {
    const [row] = buildOutcomeRows([outcome('RESOLVED_EXTERNALLY', 6, stats(0))], 5);

    expect(row.label).toBe('Resuelta por fuera del sistema');
    expect(row.firstResponseText).toBe(NO_MEASURED_FIRST_RESPONSE_TEXT);
  });

  it('RESOLVED_EXTERNALLY va despues de los canales de la revision y antes de los pendientes', () => {
    const rows = buildOutcomeRows(
      [outcome(null, 1), outcome('RESOLVED_EXTERNALLY', 1), outcome('DISCARDED_BY_HUMAN', 1, stats(0)), outcome('REVIEWED_APPROVED', 1)],
      5,
    );

    expect(rows.map((row) => row.channel)).toEqual(['REVIEWED_APPROVED', 'DISCARDED_BY_HUMAN', 'RESOLVED_EXTERNALLY', null]);
  });

  it('un canal desconocido se muestra con su valor tal cual, va antes de los pendientes y usa la misma regla', () => {
    const rows = buildOutcomeRows(
      [outcome(null, 1), outcome('CANAL_FUTURO', 2, stats(0)), outcome('NUEVO_CANAL', 8, stats(8, 20)), outcome('REVIEWED_EDITED', 1)],
      5,
    );

    expect(rows.map((row) => row.label)).toEqual(['Editada y aprobada', 'CANAL_FUTURO', 'NUEVO_CANAL', PENDING_OUTCOME_LABEL]);
    expect(rows[1].firstResponseText).toBe(NO_MEASURED_FIRST_RESPONSE_TEXT);
    expect(rows[2].firstResponseText).toBe('Mediana 20 s');
  });
});
