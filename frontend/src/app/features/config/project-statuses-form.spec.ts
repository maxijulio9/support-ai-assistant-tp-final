import { JsmStatus } from '../../api/models/jsm-status';
import { OnboardedProject } from '../../api/models/onboarded-project';
import { ProjectStatusMappingItem } from '../../api/models/project-status-mapping-item';
import { StatusActionItem } from '../../api/models/status-action-item';
import {
  DUPLICATE_ACTION_MESSAGE,
  INVALID_ACTION_MESSAGE,
  NO_ESCALATE_WARNING,
  StatusMappingRow,
  buildStatusMappingRows,
  buildStatusMappingsPayload,
  canSaveStatusMappings,
  statusMappingsHaveChanges,
  thresholdsFromProject,
  validateStatusMappings,
} from './project-statuses-form';

const ACTIONS: StatusActionItem[] = [
  { value: 'initial', description: 'Estado inicial' },
  { value: 'awaiting_customer', description: 'Esperando al cliente' },
  { value: 'escalate', description: 'Escalar' },
  { value: 'resolved', description: 'Resuelto' },
];

function jsmStatus(statusId: string, name = `Estado ${statusId}`): JsmStatus {
  return { id: `jsm-${statusId}`, name, status_id: statusId };
}

function saved(statusId: string, systemAction: string | null, isActive = true): ProjectStatusMappingItem {
  return { status_id: statusId, status_name: `Estado ${statusId}`, system_action: systemAction, is_active: isActive };
}

function row(statusId: string, savedAction: string | null, action: string | null = savedAction): StatusMappingRow {
  return { statusId, name: `Estado ${statusId}`, savedAction, action };
}

describe('buildStatusMappingRows', () => {
  it('une cada estado de JSM con su mapeo guardado por status_id', () => {
    const rows = buildStatusMappingRows([jsmStatus('s1'), jsmStatus('s2')], [saved('s2', 'escalate')]);

    expect(rows).toEqual([
      { statusId: 's1', name: 'Estado s1', savedAction: null, action: null },
      { statusId: 's2', name: 'Estado s2', savedAction: 'escalate', action: 'escalate' },
    ]);
  });

  it('un mapeo guardado cuyo estado ya no existe en JSM no genera fila', () => {
    const rows = buildStatusMappingRows([jsmStatus('s1')], [saved('s1', 'initial'), saved('huerfano', 'resolved')]);

    expect(rows.map((item) => item.statusId)).toEqual(['s1']);
  });

  it('un mapeo guardado inactivo se muestra sin accion', () => {
    const [item] = buildStatusMappingRows([jsmStatus('s1')], [saved('s1', 'resolved', false)]);

    expect(item.savedAction).toBeNull();
    expect(item.action).toBeNull();
  });

  it('conserva el orden de los estados que devuelve JSM', () => {
    const rows = buildStatusMappingRows([jsmStatus('b'), jsmStatus('a')], []);

    expect(rows.map((item) => item.statusId)).toEqual(['b', 'a']);
  });
});

describe('buildStatusMappingsPayload', () => {
  it('una fila nunca mapeada y sin tocar no se envia', () => {
    expect(buildStatusMappingsPayload([row('s1', null)])).toEqual([]);
  });

  it('una fila guardada sin cambios no se envia', () => {
    expect(buildStatusMappingsPayload([row('s1', 'initial')])).toEqual([]);
  });

  it('una fila nunca mapeada y modificada se envia completa con is_active true', () => {
    expect(buildStatusMappingsPayload([row('s1', null, 'escalate')])).toEqual([
      { status_id: 's1', system_action: 'escalate', is_active: true },
    ]);
  });

  it('una fila guardada que cambia de accion se envia con is_active true', () => {
    expect(buildStatusMappingsPayload([row('s1', 'initial', 'resolved')])).toEqual([
      { status_id: 's1', system_action: 'resolved', is_active: true },
    ]);
  });

  it('una fila guardada que pasa a Sin accion se envia con null explicito', () => {
    expect(buildStatusMappingsPayload([row('s1', 'resolved', null)])).toEqual([
      { status_id: 's1', system_action: null, is_active: true },
    ]);
  });

  it('una fila inactiva guardada que se vuelve a elegir se reactiva', () => {
    const [item] = buildStatusMappingRows([jsmStatus('s1')], [saved('s1', 'resolved', false)]);

    expect(buildStatusMappingsPayload([{ ...item, action: 'resolved' }])).toEqual([
      { status_id: 's1', system_action: 'resolved', is_active: true },
    ]);
  });

  it('una fila que se cambia y se vuelve al valor original no se envia', () => {
    expect(buildStatusMappingsPayload([row('s1', 'initial', 'initial')])).toEqual([]);
  });

  it('solo viajan las filas modificadas, el resto no', () => {
    const payload = buildStatusMappingsPayload([row('s1', 'initial'), row('s2', null, 'escalate'), row('s3', null)]);

    expect(payload.map((item) => item.status_id)).toEqual(['s2']);
  });
});

describe('statusMappingsHaveChanges', () => {
  it('false cuando ninguna fila cambio', () => {
    expect(statusMappingsHaveChanges([row('s1', 'initial'), row('s2', null)])).toBe(false);
  });

  it('true cuando alguna fila cambio', () => {
    expect(statusMappingsHaveChanges([row('s1', 'initial'), row('s2', null, 'resolved')])).toBe(true);
  });
});

describe('validateStatusMappings', () => {
  it('sin conflictos y con escalate presente no hay errores ni avisos', () => {
    const result = validateStatusMappings([row('s1', 'initial'), row('s2', 'escalate')], ACTIONS);

    expect(result).toEqual({ rowErrors: {}, warnings: [] });
  });

  it('initial puede repetirse', () => {
    const result = validateStatusMappings([row('s1', 'initial'), row('s2', 'initial'), row('s3', 'escalate')], ACTIONS);

    expect(result.rowErrors).toEqual({});
  });

  it.each(['escalate', 'awaiting_customer', 'resolved'])('%s repetida bloquea las filas afectadas', (action) => {
    const result = validateStatusMappings([row('s1', null, action), row('s2', null, action), row('s3', 'initial')], ACTIONS);

    expect(result.rowErrors).toEqual({ s1: DUPLICATE_ACTION_MESSAGE, s2: DUPLICATE_ACTION_MESSAGE });
  });

  it('una fila guardada inactiva no cuenta para el conflicto', () => {
    const rows = buildStatusMappingRows(
      [jsmStatus('s1'), jsmStatus('s2')],
      [saved('s1', 'resolved', false), saved('s2', 'resolved')],
    );

    expect(validateStatusMappings(rows, ACTIONS).rowErrors).toEqual({});
  });

  it('una accion guardada que ya no esta en la lista queda marcada como invalida', () => {
    const result = validateStatusMappings([row('s1', 'vieja'), row('s2', 'escalate')], ACTIONS);

    expect(result.rowErrors).toEqual({ s1: INVALID_ACTION_MESSAGE });
  });

  it('avisa sin bloquear cuando ninguna fila activa tiene escalate', () => {
    const rows = [row('s1', 'initial'), row('s2', 'resolved')];
    const result = validateStatusMappings(rows, ACTIONS);

    expect(result.warnings).toEqual([NO_ESCALATE_WARNING]);
    expect(result.rowErrors).toEqual({});
    expect(canSaveStatusMappings([row('s1', 'initial', 'resolved'), row('s2', 'resolved')], result)).toBe(true);
  });

  it('una fila guardada inactiva con escalate no evita el aviso', () => {
    const rows = buildStatusMappingRows([jsmStatus('s1')], [saved('s1', 'escalate', false)]);

    expect(validateStatusMappings(rows, ACTIONS).warnings).toEqual([NO_ESCALATE_WARNING]);
  });

  it('sin filas no hay aviso', () => {
    expect(validateStatusMappings([], ACTIONS).warnings).toEqual([]);
  });

  it('si la API no ofrece escalate no hay aviso', () => {
    const withoutEscalate = ACTIONS.filter((action) => action.value !== 'escalate');

    expect(validateStatusMappings([row('s1', 'initial')], withoutEscalate).warnings).toEqual([]);
  });
});

describe('canSaveStatusMappings', () => {
  const noValidation = { rowErrors: {}, warnings: [] };

  it('false sin cambios', () => {
    expect(canSaveStatusMappings([row('s1', 'initial')], noValidation)).toBe(false);
  });

  it('true con cambios y sin errores', () => {
    expect(canSaveStatusMappings([row('s1', null, 'initial')], noValidation)).toBe(true);
  });

  it('false con cambios pero con un error de fila', () => {
    expect(canSaveStatusMappings([row('s1', null, 'initial')], { rowErrors: { s1: 'x' }, warnings: [] })).toBe(false);
  });
});

describe('thresholdsFromProject', () => {
  const project: OnboardedProject = {
    country_code: 'AR',
    is_active: true,
    key: 'TARG',
    language_code: 'es',
    name: 'Proyecto',
    project_id: 'p1',
    similarity_threshold: 0.35,
    threshold_auto_publish: 0.85,
    threshold_needs_review: 0.6,
    first_response_target_seconds: 30,
  };

  it('devuelve siempre los tres umbrales guardados del proyecto', () => {
    expect(thresholdsFromProject(project)).toEqual({
      similarity_threshold: 0.35,
      threshold_auto_publish: 0.85,
      threshold_needs_review: 0.6,
    });
  });

  it('un borrador distinto sin guardar no influye porque la funcion solo recibe el proyecto guardado', () => {
    const unsavedDraft = { similarity_threshold: 0.9, threshold_auto_publish: 0.99, threshold_needs_review: 0.1 };

    expect(thresholdsFromProject(project)).not.toEqual(unsavedDraft);
    expect(thresholdsFromProject(project).threshold_auto_publish).toBe(project.threshold_auto_publish);
  });
});
