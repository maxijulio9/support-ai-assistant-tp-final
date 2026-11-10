import { DailyMetric } from '../../api/models/daily-metric';
import {
  buildEvolutionPoints,
  dayTooltip,
  evolutionHeadline,
  evolutionPeriod,
  evolutionRange,
  evolutionSummary,
  hasEvolutionData,
} from './auto-publish-evolution';

function day(date: string, autoPublish: number, total: number): DailyMetric {
  return {
    date,
    auto_publish_count: autoPublish,
    total_interactions: total,
    avg_confidence_score: null,
    discarded_count: 0,
    escalate_count: 0,
    needs_review_count: 0,
    publish_failed_count: 0,
    request_info_count: 0,
    resolved_count: 0,
    resolved_externally_count: 0,
  };
}

describe('evolutionRange', () => {
  it('7 dias incluye hoy y los seis anteriores', () => {
    expect(evolutionRange(7, new Date(2026, 10, 5))).toEqual({ from: '2026-10-30', to: '2026-11-05' });
  });

  it('30 dias cruza el cambio de mes y de anio', () => {
    expect(evolutionRange(30, new Date(2026, 0, 10))).toEqual({ from: '2025-12-12', to: '2026-01-10' });
  });
});

describe('buildEvolutionPoints', () => {
  const range = { from: '2026-11-01', to: '2026-11-04' };

  it('arma un punto por dia del rango con los dos segmentos y el porcentaje entero', () => {
    const points = buildEvolutionPoints(range, [day('2026-11-01', 1, 3), day('2026-11-02', 2, 4)]);
    expect(points.map((point) => point.date)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']);
    expect(points[0]).toMatchObject({ autoPublish: 1, rest: 2, total: 3, percent: 33 });
    expect(points[1]).toMatchObject({ autoPublish: 2, rest: 2, total: 4, percent: 50 });
  });

  it('un dia sin fila o sin solicitudes queda sin dato, no en 0 %', () => {
    const points = buildEvolutionPoints(range, [day('2026-11-02', 0, 0), day('2026-11-04', 0, 5)]);
    expect(points[0].percent).toBeNull();
    expect(points[1].percent).toBeNull();
    expect(points[2]).toMatchObject({ total: 0, rest: 0, percent: null });
    expect(points[3]).toMatchObject({ rest: 5, percent: 0 });
  });

  it('ignora filas fuera del rango', () => {
    const points = buildEvolutionPoints(range, [day('2026-10-31', 1, 1)]);
    expect(hasEvolutionData(points)).toBe(false);
  });

  it('el resto nunca es negativo aunque el contrato venga inconsistente', () => {
    const points = buildEvolutionPoints(range, [day('2026-11-01', 5, 3)]);
    expect(points[0].rest).toBe(0);
  });
});

describe('evolutionPeriod y evolutionHeadline', () => {
  const range = { from: '2026-11-01', to: '2026-11-03' };

  it('el porcentaje sale de los totales y no del promedio de los dias', () => {
    const points = buildEvolutionPoints(range, [day('2026-11-01', 1, 1), day('2026-11-02', 1, 9)]);
    expect(evolutionPeriod(points)).toEqual({ autoPublish: 2, total: 10, percent: 20 });
  });

  it('arma el dato clave y la aclaracion', () => {
    const points = buildEvolutionPoints(range, [day('2026-11-01', 6, 8)]);
    expect(evolutionHeadline(evolutionPeriod(points), 7)).toEqual({
      main: '75 % resuelto automáticamente',
      detail: '(6 de 8 solicitudes en los últimos 7 días)',
    });
  });

  it('sin solicitudes no hay porcentaje ni aclaracion', () => {
    const points = buildEvolutionPoints(range, []);
    expect(evolutionHeadline(evolutionPeriod(points), 30)).toEqual({
      main: 'Sin solicitudes en este período',
      detail: null,
    });
  });
});

describe('dayTooltip', () => {
  const range = { from: '2026-11-01', to: '2026-11-02' };

  it('muestra resueltas, total y porcentaje', () => {
    const [point] = buildEvolutionPoints(range, [day('2026-11-01', 2, 3)]);
    expect(dayTooltip(point)).toBe(`${point.label}: 2 de 3 resueltas automáticamente (67 %)`);
  });

  it('un dia sin solicitudes lo dice', () => {
    const [, point] = buildEvolutionPoints(range, [day('2026-11-01', 2, 3)]);
    expect(dayTooltip(point)).toBe(`${point.label}: Sin solicitudes`);
  });
});

describe('evolutionSummary', () => {
  const range = { from: '2026-11-01', to: '2026-11-05' };

  it('describe periodo, dia con mas solicitudes y dias sin solicitudes', () => {
    const points = buildEvolutionPoints(range, [
      day('2026-11-01', 1, 4),
      day('2026-11-02', 3, 8),
      day('2026-11-04', 2, 4),
    ]);
    const text = evolutionSummary(points);
    expect(text).toContain('se resolvió automáticamente el 38 %, 6 de 16 solicitudes');
    expect(text).toContain(`Día con más solicitudes: ${points[1].label}, con 8.`);
    expect(text).toContain('2 días sin solicitudes.');
  });

  it('sin ninguna solicitud lo dice en vez de inventar valores', () => {
    expect(evolutionSummary(buildEvolutionPoints(range, []))).toMatch(/^Sin solicitudes del /);
  });

  it('lista vacia', () => {
    expect(evolutionSummary([])).toBe('Sin datos en el rango.');
  });
});
