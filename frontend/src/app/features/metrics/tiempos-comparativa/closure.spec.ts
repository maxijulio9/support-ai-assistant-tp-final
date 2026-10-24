import { closureBasisText, closureNote, closurePlaceholder } from './closure';
import { buildStatsView } from './stats-view';
import { CohortResponseTimes } from '../../../api/models/cohort-response-times';
import { TimeStats } from '../../../api/models/time-stats';

function stats(count: number): TimeStats {
  return { count, mean_seconds: 10, p50_seconds: 10, p90_seconds: 20, within_target_rate: null };
}

function cohort(key: string, basis: string): CohortResponseTimes {
  return {
    cohort: key,
    first_response_kind: 'answer',
    closure_basis: basis,
    tickets: 1,
    first_response: stats(1),
    closure: stats(1),
    outcomes: [],
    by_category: [],
    daily: [],
    weekly: [],
  };
}

const FULL = [
  cohort('automatic', 'detected_confirmation'),
  cohort('reviewed', 'detected_confirmation'),
  cohort('escalated', 'detected_confirmation'),
  cohort('info_requested', 'detected_confirmation'),
  cohort('baseline', 'last_customer_comment'),
];

describe('closureBasisText', () => {
  it('atencion manual previa: ultimo comentario del cliente segun JSM', () => {
    expect(closureBasisText('last_customer_comment')).toContain('el último comentario del cliente según JSM');
  });

  it('sistema: confirmacion detectada con unos 30 s de espera', () => {
    expect(closureBasisText('detected_confirmation')).toContain('la confirmación detectada, que incluye unos 30 s de espera');
  });

  it('ambos avisan que no es estrictamente comparable', () => {
    expect(closureBasisText('last_customer_comment')).toContain('No es estrictamente comparable');
    expect(closureBasisText('detected_confirmation')).toContain('No es estrictamente comparable');
  });

  it('una base desconocida no lleva texto', () => {
    expect(closureBasisText('otra')).toBe('');
  });

  it('nunca llama "resolucion" a la metrica', () => {
    expect(closureBasisText('last_customer_comment').toLowerCase()).not.toContain('resoluci');
    expect(closureBasisText('detected_confirmation').toLowerCase()).not.toContain('resoluci');
  });
});

describe('closureNote', () => {
  it('con las dos formas de medir arma el texto completo aprobado', () => {
    expect(closureNote(FULL)).toBe(
      'En «Atención manual previa» el cierre es el último comentario del cliente según JSM. ' +
        'En el sistema es la confirmación detectada, que incluye unos 30 s de espera. ' +
        'Los valores no son estrictamente comparables.',
    );
  });

  it('decide por closure_basis de cada cohorte, no por su nombre', () => {
    const swapped = [cohort('automatic', 'last_customer_comment'), cohort('baseline', 'detected_confirmation')];

    expect(closureNote(swapped)).toContain('En «Automática» el cierre es el último comentario del cliente según JSM.');
  });

  it('con una sola forma de medir no dice que no son comparables', () => {
    const note = closureNote([cohort('automatic', 'detected_confirmation'), cohort('reviewed', 'detected_confirmation')]);

    expect(note).toBe('En el sistema el cierre es la confirmación detectada, que incluye unos 30 s de espera.');
  });

  it('sin cohortes o con bases desconocidas no hay texto', () => {
    expect(closureNote([])).toBe('');
    expect(closureNote([cohort('automatic', 'otra')])).toBe('');
  });

  it('nunca usa la palabra resolucion', () => {
    expect(closureNote(FULL).toLowerCase()).not.toContain('resoluci');
  });
});

describe('closurePlaceholder', () => {
  it('pocos cierres: n insuficiente', () => {
    expect(closurePlaceholder(buildStatsView(stats(3), 5), 10)).toBe('n insuficiente');
  });

  it('ningun cierre con tickets dice Sin cierres, y sin tickets dice Sin tickets', () => {
    expect(closurePlaceholder(buildStatsView(stats(0), 5), 4)).toBe('Sin cierres');
    expect(closurePlaceholder(buildStatsView(stats(0), 5), 0)).toBe('Sin tickets');
  });

  it('con datos suficientes no hay placeholder', () => {
    expect(closurePlaceholder(buildStatsView(stats(10), 5), 10)).toBeNull();
  });
});
