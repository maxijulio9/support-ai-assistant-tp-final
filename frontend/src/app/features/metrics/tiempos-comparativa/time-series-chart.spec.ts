import {
  LOG_RATIO_THRESHOLD,
  LOG_SCALE_NOTE,
  SeriesChartColors,
  buildSeriesChartOptions,
  chooseYAxisScale,
  formatSeriesLabel,
  resolveSeriesScale,
  seriesTooltipLines,
} from './time-series-chart';
import { SeriesPoint } from './time-series';

const COLORS: SeriesChartColors = { line: '#line', target: '#target', text: '#text', grid: '#grid', surface: '#surface' };

function point(key: string, count: number, p50: number | null, p90: number | null, minSample = 5): SeriesPoint {
  return { key, count, p50, p90, lowSample: count > 0 && count < minSample };
}

function build(points: SeriesPoint[], targetSeconds: number | null = null, granularity: 'daily' | 'weekly' = 'weekly') {
  return buildSeriesChartOptions({ points, granularity, minSample: 5, targetSeconds, colors: COLORS }) as any;
}

describe('formatSeriesLabel', () => {
  it('diario: dia y mes abreviado', () => {
    expect(formatSeriesLabel('2026-10-24', 'daily')).toBe('24 oct');
  });

  it('semanal: "Semana del" con el lunes', () => {
    expect(formatSeriesLabel('2026-10-19', 'weekly')).toBe('Semana del 19 oct');
  });

  it('sin punto en el mes abreviado', () => {
    expect(formatSeriesLabel('2026-09-01', 'daily')).not.toContain('.');
  });
});

describe('seriesTooltipLines', () => {
  it('punto con muestra suficiente: titulo, mediana, p90 y tickets', () => {
    expect(seriesTooltipLines(point('2026-10-19', 12, 90, 300), 'weekly', 5)).toEqual([
      'Semana del 19 oct',
      'Mediana: 1 min 30 s',
      'P90: 5 min',
      'Tickets: 12',
    ]);
  });

  it('punto con pocos tickets agrega "n insuficiente" con el n y el minimo, y conserva los valores', () => {
    const lines = seriesTooltipLines(point('2026-10-24', 3, 20, 40), 'daily', 5);

    expect(lines).toContain('Mediana: 20 s');
    expect(lines).toContain('n insuficiente: 3 tickets, el mínimo es 5');
  });

  it('con 1 ticket va en singular', () => {
    expect(seriesTooltipLines(point('2026-10-24', 1, 20, 20), 'daily', 5)).toContain('n insuficiente: 1 ticket, el mínimo es 5');
  });

  it('punto sin tickets lo dice segun la granularidad', () => {
    expect(seriesTooltipLines(point('2026-10-20', 0, null, null), 'daily', 5)).toEqual(['20 oct', 'Sin tickets este día']);
    expect(seriesTooltipLines(point('2026-10-19', 0, null, null), 'weekly', 5)).toEqual(['Semana del 19 oct', 'Sin tickets esta semana']);
  });
});

describe('chooseYAxisScale', () => {
  it('sin valores usa un eje lineal por defecto', () => {
    expect(chooseYAxisScale([])).toEqual({ kind: 'linear', max: 60, interval: 10, note: null });
  });

  it('valores parecidos: eje lineal con saltos legibles y holgura', () => {
    const scale = chooseYAxisScale([22, 41, 30]);

    expect(scale.kind).toBe('linear');
    if (scale.kind === 'linear') {
      expect(scale.interval).toBe(10);
      expect(scale.max).toBeGreaterThan(41);
      expect(scale.max % scale.interval).toBe(0);
    }
  });

  it('valores en minutos eligen un salto de minutos, no de 100 s', () => {
    const scale = chooseYAxisScale([110, 320, 60]);

    expect(scale.kind).toBe('linear');
    if (scale.kind === 'linear') expect(scale.interval % 60).toBe(0);
  });

  it('decenas de segundos contra horas pasa a escala logaritmica que incluye todos los valores', () => {
    const scale = chooseYAxisScale([30, 45, 14400]);

    expect(scale.kind).toBe('log');
    if (scale.kind === 'log') {
      expect(scale.min).toBeLessThanOrEqual(30);
      expect(scale.max).toBeGreaterThan(14400);
    }
  });

  it('el objetivo cuenta para decidir: valores altos con un objetivo bajo usan log y lo dejan visible', () => {
    const scale = chooseYAxisScale([3600, 7200, 30]);

    expect(scale.kind).toBe('log');
    if (scale.kind === 'log') expect(scale.min).toBeLessThanOrEqual(30);
  });

  it('justo por debajo del umbral sigue siendo lineal y desde el umbral es log', () => {
    expect(chooseYAxisScale([10, 10 * (LOG_RATIO_THRESHOLD - 1)]).kind).toBe('linear');
    expect(chooseYAxisScale([10, 10 * LOG_RATIO_THRESHOLD]).kind).toBe('log');
  });

  it('la nota existe solo con escala logaritmica y es el texto aprobado', () => {
    expect(chooseYAxisScale([30, 45, 14400]).note).toBe(LOG_SCALE_NOTE);
    expect(LOG_SCALE_NOTE).toBe(
      'Escala logarítmica: las diferencias entre valores chicos y grandes se muestran en proporción, no en tamaño absoluto.',
    );
    expect(chooseYAxisScale([22, 41, 30]).note).toBeNull();
    expect(chooseYAxisScale([]).note).toBeNull();
  });

  it('ignora los ceros', () => {
    expect(chooseYAxisScale([0, 0, 30]).kind).toBe('linear');
  });
});

describe('buildSeriesChartOptions', () => {
  const points = [
    point('2026-10-12', 2, 24, 31),
    point('2026-10-19', 0, null, null),
    point('2026-10-26', 10, 22, 41),
  ];

  it('dos series: mediana solida y p90 punteada con el color de la cohorte', () => {
    const options = build(points);
    const [median, p90] = options.series;

    expect(median.name).toBe('Mediana');
    expect(median.lineStyle).toMatchObject({ type: 'solid', color: '#line' });
    expect(p90.name).toBe('P90');
    expect(p90.lineStyle).toMatchObject({ type: 'dashed', color: '#line' });
  });

  it('los puntos con count 0 se omiten (null) y la linea no se conecta', () => {
    const [median, p90] = build(points).series;

    expect(median.data[1]).toBeNull();
    expect(p90.data[1]).toBeNull();
    expect(median.connectNulls).toBe(false);
  });

  it('un punto con pocos tickets lleva marcador hueco y uno con muestra suficiente, relleno', () => {
    const [median, p90] = build(points).series;

    expect(median.data[0].itemStyle).toEqual({ color: '#surface', borderColor: '#line', borderWidth: 2 });
    expect(median.data[2].itemStyle).toEqual({ color: '#line' });
    expect(p90.data[0].itemStyle.color).toBe('#surface');
  });

  it('el valor de cada punto es la mediana y el p90 correspondientes', () => {
    const [median, p90] = build(points).series;

    expect(median.data[2].value).toBe(22);
    expect(p90.data[2].value).toBe(41);
  });

  it('con objetivo agrega la linea horizontal con su rotulo', () => {
    const [median] = build(points, 30).series;

    expect(median.markLine.data).toEqual([{ yAxis: 30 }]);
    expect(median.markLine.label.formatter).toBe('Objetivo: 30 s');
    expect(median.markLine.label.fontSize).toBeGreaterThanOrEqual(14);
  });

  it('sin objetivo no hay linea horizontal', () => {
    const [median, p90] = build(points, null).series;

    expect(median.markLine).toBeUndefined();
    expect(p90.markLine).toBeUndefined();
  });

  it('el rotulo del objetivo usa el formato de duracion', () => {
    expect(build(points, 90).series[0].markLine.label.formatter).toBe('Objetivo: 1 min 30 s');
  });

  it('las etiquetas del eje X salen del formato de fechas segun la granularidad', () => {
    expect(build(points).xAxis.data).toEqual(['Semana del 12 oct', 'Semana del 19 oct', 'Semana del 26 oct']);
    expect(build([point('2026-10-24', 5, 1, 2)], null, 'daily').xAxis.data).toEqual(['24 oct']);
  });

  it('las etiquetas del eje Y usan formatDuration', () => {
    const formatter = build(points).yAxis.axisLabel.formatter;

    expect(formatter(30)).toBe('30 s');
    expect(formatter(90)).toBe('1 min 30 s');
    expect(formatter(3600)).toBe('1 h');
  });

  it('usa escala logaritmica con valores muy distintos y deja el objetivo dentro del eje', () => {
    const wide = [point('2026-10-12', 8, 3600, 14400), point('2026-10-19', 8, 5400, 20000)];
    const options = build(wide, 30);

    expect(options.yAxis.type).toBe('log');
    expect(options.yAxis.min).toBeLessThanOrEqual(30);
  });

  it('el tooltip arma el texto del punto bajo el cursor', () => {
    const tooltip = build(points).tooltip.formatter([{ dataIndex: 0 }]);

    expect(tooltip).toContain('Semana del 12 oct');
    expect(tooltip).toContain('n insuficiente: 2 tickets, el mínimo es 5');
  });

  it('todo el texto del grafico es de 14 px o mas', () => {
    const options = build(points, 30);
    const sizes = [
      options.tooltip.textStyle.fontSize,
      options.legend.textStyle.fontSize,
      options.xAxis.axisLabel.fontSize,
      options.yAxis.axisLabel.fontSize,
      options.series[0].markLine.label.fontSize,
    ];

    for (const size of sizes) expect(size).toBeGreaterThanOrEqual(14);
  });

  it('usa solo los colores recibidos, sin valores propios', () => {
    const json = JSON.stringify(build(points, 30), (_key, value) => (typeof value === 'function' ? undefined : value));

    expect(json).not.toMatch(/#[0-9a-fA-F]{3,6}"/);
    expect(json).toContain('#line');
    expect(json).toContain('#target');
  });
});

describe('resolveSeriesScale', () => {
  const small = [point('2026-10-12', 8, 22, 41), point('2026-10-19', 8, 25, 44)];
  const wide = [point('2026-10-12', 8, 25, 14400), point('2026-10-19', 8, 30, 10800)];

  it('valores parecidos: lineal y sin nota', () => {
    const scale = resolveSeriesScale(small, 30);

    expect(scale.kind).toBe('linear');
    expect(scale.note).toBeNull();
  });

  it('mediana en segundos y p90 en horas: logaritmica con nota', () => {
    const scale = resolveSeriesScale(wide, null);

    expect(scale.kind).toBe('log');
    expect(scale.note).toBe(LOG_SCALE_NOTE);
  });

  it('el objetivo cuenta: valores altos con un objetivo bajo activan la nota', () => {
    const high = [point('2026-10-12', 8, 3600, 7200)];

    expect(resolveSeriesScale(high, null).note).toBeNull();
    expect(resolveSeriesScale(high, 30).note).toBe(LOG_SCALE_NOTE);
  });

  it('ignora los puntos sin datos', () => {
    expect(resolveSeriesScale([point('2026-10-12', 0, null, null)], null).note).toBeNull();
  });

  it('el grafico usa el mismo tipo de eje que la nota anuncia', () => {
    expect(build(wide).yAxis.type).toBe(resolveSeriesScale(wide, null).kind === 'log' ? 'log' : 'value');
    expect(build(small, 30).yAxis.type).toBe('value');
    expect(resolveSeriesScale(small, 30).note).toBeNull();
  });
});
