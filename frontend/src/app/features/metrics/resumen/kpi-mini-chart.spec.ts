import { EvolutionPoint } from '../../dashboard/auto-publish-evolution';
import { buildMiniChart, miniTooltip, paddedRange } from './kpi-mini-chart';

function day(label: string, total: number, autoPublish: number, escalate: number, avgConfidence: number | null): EvolutionPoint {
  return {
    date: label,
    label,
    total,
    autoPublish,
    escalate,
    avgConfidence,
    rest: Math.max(0, total - autoPublish),
    percent: total === 0 ? null : Math.round((autoPublish / total) * 100),
  };
}

const POINTS = [
  day('1 nov', 10, 4, 1, 0.8),
  day('2 nov', 0, 0, 0, null),
  day('3 nov', 40, 30, 5, 0.9),
  day('4 nov', 0, 0, 0, null),
  day('5 nov', 8, 2, 3, 0.75),
];

const values = (metric: Parameters<typeof buildMiniChart>[0]) => buildMiniChart(metric, POINTS)!.points.map((point) => point.value);

describe('buildMiniChart', () => {
  it('sin ningun dia con datos no hay grafico', () => {
    expect(buildMiniChart('total', [day('1 nov', 0, 0, 0, null)])).toBeNull();
    expect(buildMiniChart('total', [])).toBeNull();
  });

  it('un dia sin solicitudes no tiene valor (null), no cero', () => {
    expect(values('total')).toEqual([10, null, 40, null, 8]);
    expect(values('auto-publish')).toEqual([40, null, 75, null, 25]);
    expect(values('escalate')).toEqual([10, null, 13, null, 38]);
  });

  it('confianza: el promedio del dia, null si no hay puntaje', () => {
    expect(values('confidence')).toEqual([0.8, null, 0.9, null, 0.75]);
  });

  it('un dia con solicitudes pero sin puntaje no tiene punto de confianza', () => {
    const chart = buildMiniChart('confidence', [POINTS[0], day('2 nov', 5, 0, 0, null)])!;
    expect(chart.points.map((point) => point.value)).toEqual([0.8, null]);
  });

  it('el centro de la linea de texto es el maximo del periodo', () => {
    expect(buildMiniChart('total', POINTS)!.maxText).toBe('máx. 40 por día');
    expect(buildMiniChart('auto-publish', POINTS)!.maxText).toBe('máx. 75 %');
    expect(buildMiniChart('auto-publish', [day('1 nov', 3, 3, 0, null)])!.maxText).toBe('máx. 100 %');
    expect(buildMiniChart('confidence', POINTS)!.maxText).toBe('máx. 0,90');
  });

  it('el rango del eje abarca los datos con margen', () => {
    const chart = buildMiniChart('total', POINTS)!;
    expect(chart.yMin).toBeLessThan(8);
    expect(chart.yMax).toBeGreaterThan(40);
  });

  it('el resumen accesible dice rango, maximo y ultimo valor', () => {
    expect(buildMiniChart('total', POINTS)!.summary).toBe(
      'Total de solicitudes, del 1 nov al 5 nov. Máximo: 40, el 3 nov. Último valor, 5 nov: 8 solicitudes.',
    );
    expect(buildMiniChart('auto-publish', POINTS)!.summary).toBe(
      'Resolución automática, del 1 nov al 5 nov. Máximo: 75 %, el 3 nov. Último valor, 5 nov: 25 % (2 de 8 solicitudes).',
    );
    expect(buildMiniChart('confidence', POINTS)!.summary).toContain('Máximo: 0,90, el 3 nov.');
  });

  it('rango de 30 o mas dias: un punto por dia, sin perder el rango', () => {
    const many = Array.from({ length: 45 }, (_, i) => day(`d${i}`, i % 3 === 0 ? 0 : i, 1, 0, null));
    const chart = buildMiniChart('total', many)!;
    expect(chart.points).toHaveLength(45);
    expect(chart.startLabel).toBe('d0');
    expect(chart.endLabel).toBe('d44');
  });
});

describe('miniTooltip', () => {
  it('porcentaje: valor y cuantas solicitudes hay detras', () => {
    expect(miniTooltip(buildMiniChart('auto-publish', [day('6 nov', 10, 3, 0, null)])!, 0)).toBe(
      '6 nov: 30 % (3 de 10 solicitudes)',
    );
    expect(miniTooltip(buildMiniChart('escalate', POINTS)!, 4)).toBe('5 nov: 38 % (3 de 8 solicitudes)');
  });

  it('un dia con una sola solicitud va en singular', () => {
    expect(miniTooltip(buildMiniChart('auto-publish', [day('6 nov', 1, 1, 0, null)])!, 0)).toBe(
      '6 nov: 100 % (1 de 1 solicitud)',
    );
  });

  it('total: singular y plural', () => {
    const chart = buildMiniChart('total', [day('1 nov', 1, 0, 0, null), day('2 nov', 3, 0, 0, null)])!;
    expect(miniTooltip(chart, 0)).toBe('1 nov: 1 solicitud');
    expect(miniTooltip(chart, 1)).toBe('2 nov: 3 solicitudes');
  });

  it('confianza: con coma decimal', () => {
    expect(miniTooltip(buildMiniChart('confidence', POINTS)!, 2)).toBe('3 nov: 0,90');
  });

  it('dia vacio: sin solicitudes; con solicitudes pero sin puntaje: lo dice', () => {
    expect(miniTooltip(buildMiniChart('total', POINTS)!, 1)).toBe('2 nov: sin solicitudes');
    const chart = buildMiniChart('confidence', [POINTS[0], day('2 nov', 5, 0, 0, null)])!;
    expect(miniTooltip(chart, 1)).toBe('2 nov: sin puntaje de confianza');
  });

  it('indice fuera de rango: texto vacio', () => {
    expect(miniTooltip(buildMiniChart('total', POINTS)!, 99)).toBe('');
  });
});

describe('paddedRange', () => {
  it('agrega un margen proporcional al rango', () => {
    const range = paddedRange([10, 20]);
    expect(range.min).toBeCloseTo(8.5);
    expect(range.max).toBeCloseTo(21.5);
  });

  it('con un solo valor distinto de cero, el margen sale del valor', () => {
    const range = paddedRange([50, 50]);
    expect(range.min).toBeCloseTo(45);
    expect(range.max).toBeCloseTo(55);
  });

  it('con un valor cero igual deja un margen minimo', () => {
    const range = paddedRange([0]);
    expect(range.min).toBeLessThan(0);
    expect(range.max).toBeGreaterThan(0);
  });
});
