import { PENDING_OUTCOME_LABEL, buildOutcomeRows } from './outcomes-breakdown';
import { OutcomeLike, StatsLike } from './response-times.types';

function stats(count: number, p50: number | null = null): StatsLike {
  return { count, mean_seconds: p50, p50_seconds: p50, p90_seconds: p50, within_target_rate: null };
}

function outcome(channel: string | null, tickets: number, firstResponse = stats(tickets, 20)): OutcomeLike {
  return { resolution_channel: channel, tickets, first_response: firstResponse };
}

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

  it('null se rotula como pendiente y conserva primera respuesta', () => {
    const [row] = buildOutcomeRows([outcome(null, 8)], 5);

    expect(row.label).toBe(PENDING_OUTCOME_LABEL);
    expect(row.hasFirstResponse).toBe(true);
    expect(row.firstResponse?.state).toBe('ok');
  });

  it.each(['ESCALATED_BY_HUMAN', 'DISCARDED_BY_HUMAN'])('%s no tiene primera respuesta', (channel) => {
    const [row] = buildOutcomeRows([outcome(channel, 3, stats(0))], 5);

    expect(row.hasFirstResponse).toBe(false);
    expect(row.firstResponse).toBeNull();
    expect(row.tickets).toBe(3);
  });

  it('un canal con pocos tickets queda como n insuficiente', () => {
    const [row] = buildOutcomeRows([outcome('REVIEWED_APPROVED', 2, stats(2))], 5);

    expect(row.firstResponse).toMatchObject({ state: 'insufficient', n: 2 });
  });

  it('un canal desconocido se muestra con su valor y va antes de los pendientes', () => {
    const rows = buildOutcomeRows([outcome(null, 1), outcome('NUEVO_CANAL', 1), outcome('REVIEWED_APPROVED', 1)], 5);

    expect(rows.map((row) => row.label)).toEqual(['Aprobada', 'NUEVO_CANAL', PENDING_OUTCOME_LABEL]);
  });

  it('sin tickets en total la proporcion es 0 y no NaN', () => {
    expect(buildOutcomeRows([outcome('REVIEWED_APPROVED', 0, stats(0))], 5)[0].share).toBe(0);
  });
});
