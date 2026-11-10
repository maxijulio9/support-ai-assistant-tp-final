import { InteractionListItem } from '../../../api/models/interaction-list-item';
import {
  EXPORT_COLUMNS,
  EXPORT_ROW_LIMIT,
  ROW_LIMIT_NOTICE,
  pageLimitFor,
  EXPORT_PAGE_SIZE,
  buildCsv,
  buildExportRows,
  confidenceText,
  describeFilters,
  escapeCsvCell,
  exportDoneMessage,
  exportFileName,
  exportScopeNotice,
  formatExportDate,
  neutralizeFormula,
  planExportPages,
  truncateText,
} from './history-export';

function item(overrides: Partial<InteractionListItem> = {}): InteractionListItem {
  return {
    interaction_id: 'id-1',
    issue_key: 'TARG-1',
    summary: 'No anda la VPN',
    category: 'Red',
    priority: 'High',
    decision: 'AUTO_PUBLISH',
    system_decision: 'AUTO_PUBLISH',
    resolution_channel: 'AUTO',
    confidence_score: 0.846,
    ticket_url: null,
    was_edited: false,
    created_at: new Date(2026, 10, 5, 21, 57).toISOString(),
    responded_at: new Date(2026, 10, 5, 22, 3).toISOString(),
    ...overrides,
  };
}

describe('columnas', () => {
  it('tienen las etiquetas pedidas, en orden', () => {
    expect([...EXPORT_COLUMNS]).toEqual([
      'Ticket',
      'Fecha',
      'Decisión',
      'Categoría',
      'Prioridad',
      'Confianza',
      'Canal de resolución',
      'Editada',
      'Respuesta al cliente',
      'Resumen',
    ]);
  });
});

describe('formatExportDate', () => {
  it('usa dia/mes/año y hora de 24 h con ceros', () => {
    expect(formatExportDate(new Date(2026, 0, 5, 7, 4).toISOString())).toBe('05/01/2026 07:04');
    expect(formatExportDate(new Date(2025, 11, 31, 23, 59).toISOString())).toBe('31/12/2025 23:59');
  });

  it('sin fecha o ilegible queda vacia', () => {
    expect(formatExportDate(null)).toBe('');
    expect(formatExportDate(undefined)).toBe('');
    expect(formatExportDate('no es fecha')).toBe('');
  });
});

describe('confidenceText', () => {
  it('es un porcentaje entero acotado', () => {
    expect(confidenceText(0.846)).toBe('85%');
    expect(confidenceText(1.7)).toBe('100%');
    expect(confidenceText(-1)).toBe('0%');
    expect(confidenceText(0)).toBe('0%');
  });

  it('sin puntaje queda vacia', () => {
    expect(confidenceText(null)).toBe('');
    expect(confidenceText(NaN)).toBe('');
  });
});

describe('buildExportRows', () => {
  it('arma una fila por interaccion con las etiquetas legibles', () => {
    expect(buildExportRows([item()])).toEqual([
      ['TARG-1', '05/11/2026 21:57', 'Publicada', 'Red', 'High', '85%', 'Automática', 'No', '05/11/2026 22:03', 'No anda la VPN'],
    ]);
  });

  it('ordena de la mas reciente a la mas antigua, sin fecha al final', () => {
    const rows = buildExportRows([
      item({ issue_key: 'VIEJO', created_at: new Date(2026, 9, 1).toISOString() }),
      item({ issue_key: 'SIN-FECHA', created_at: null }),
      item({ issue_key: 'NUEVO', created_at: new Date(2026, 10, 1).toISOString() }),
    ]);

    expect(rows.map((row) => row[0])).toEqual(['NUEVO', 'VIEJO', 'SIN-FECHA']);
  });

  it('sin fecha de respuesta dice "No registrada", incluso pendiente de revision', () => {
    expect(buildExportRows([item({ responded_at: null })])[0][8]).toBe('No registrada');
    expect(buildExportRows([item({ responded_at: null, decision: 'NEEDS_REVIEW' })])[0][8]).toBe('No registrada');
  });

  it('la decision usa la etiqueta legible, tambien para fallidas, desconocidas y nulas', () => {
    const decision = (value: string | null) => buildExportRows([item({ decision: value })])[0][2];

    expect(decision('PUBLISH_FAILED')).toBe('Falló la publicación');
    expect(decision('ESCALATE')).toBe('Escalada');
    expect(decision('NUEVA_DECISION')).toBe('Nueva decision');
    expect(decision(null)).toBe('Sin decisión');
  });

  it('editada, canal y campos vacios', () => {
    const [row] = buildExportRows([item({ was_edited: true, resolution_channel: null, category: null, priority: null, summary: '', confidence_score: null })]);

    expect(row[3]).toBe('');
    expect(row[4]).toBe('');
    expect(row[5]).toBe('');
    expect(row[6]).toBe('Sin resolver');
    expect(row[7]).toBe('Sí');
    expect(row[9]).toBe('');
  });

  it('no modifica la lista original', () => {
    const items = [item({ issue_key: 'A', created_at: new Date(2026, 9, 1).toISOString() }), item({ issue_key: 'B' })];
    buildExportRows(items);

    expect(items.map((entry) => entry.issue_key)).toEqual(['A', 'B']);
  });
});

describe('neutralizeFormula', () => {
  it.each(['=1+1', '+54911', '-2+3', '@SUMA(A1)', '\tdato', '\rdato', '=HYPERLINK("http://x","clic")'])(
    'prefija con apostrofo %j',
    (value) => {
      expect(neutralizeFormula(value)).toBe(`'${value}`);
    },
  );

  it.each(['Hola', '85%', '05/11/2026 21:57', 'a=b', "'=ya con apostrofo", ' =con espacio', ''])('deja igual %j', (value) => {
    expect(neutralizeFormula(value)).toBe(value);
  });
});

describe('escapeCsvCell', () => {
  it('no toca el texto simple', () => {
    expect(escapeCsvCell('Hola mundo')).toBe('Hola mundo');
  });

  it('entrecomilla con punto y coma, comillas o saltos de linea, y duplica las comillas', () => {
    expect(escapeCsvCell('a;b')).toBe('"a;b"');
    expect(escapeCsvCell('dijo "hola"')).toBe('"dijo ""hola"""');
    expect(escapeCsvCell('uno\ndos')).toBe('"uno\ndos"');
    expect(escapeCsvCell('uno\r\ndos')).toBe('"uno\r\ndos"');
  });

  it('una coma sola no obliga a entrecomillar', () => {
    expect(escapeCsvCell('a,b')).toBe('a,b');
  });

  it('neutraliza la formula y despues escapa', () => {
    expect(escapeCsvCell('=HYPERLINK("http://x";"clic")')).toBe('"\'=HYPERLINK(""http://x"";""clic"")"');
  });
});

describe('buildCsv', () => {
  it('empieza con BOM, separa con punto y coma y termina cada linea con CRLF', () => {
    const csv = buildCsv(['A', 'B'], [['1', '2'], ['x;y', '=3']]);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1)).toBe('A;B\r\n1;2\r\n"x;y";\'=3\r\n');
  });

  it('con las columnas y las filas del Historial', () => {
    const csv = buildCsv(EXPORT_COLUMNS, buildExportRows([item({ summary: '=HYPERLINK("http://x";"a")' })]));
    const lines = csv.slice(1).split('\r\n');

    expect(lines[0]).toBe(EXPORT_COLUMNS.join(';'));
    expect(lines[1]).toContain(`"'=HYPERLINK(""http://x"";""a"")"`);
    expect(lines[2]).toBe('');
  });

  it('sin filas deja solo el encabezado', () => {
    expect(buildCsv(['A'], []).slice(1)).toBe('A\r\n');
  });
});

describe('planExportPages', () => {
  it('sin interacciones no hay pedidos', () => {
    expect(planExportPages(0)).toEqual({ offsets: [], target: 0, capped: false });
    expect(planExportPages(-5)).toEqual({ offsets: [], target: 0, capped: false });
    expect(planExportPages(NaN)).toEqual({ offsets: [], target: 0, capped: false });
  });

  it('una pagina si entra en una', () => {
    expect(planExportPages(37, 500)).toEqual({ offsets: [0], target: 37, capped: false });
    expect(planExportPages(500, 500).offsets).toEqual([0]);
  });

  it('una fila mas pide otra pagina', () => {
    expect(planExportPages(501, 500).offsets).toEqual([0, 500]);
  });

  it('pagina de a EXPORT_PAGE_SIZE hasta llegar al total', () => {
    expect(planExportPages(842).offsets).toEqual([0, 500]);
    expect(planExportPages(1342, 500, 5000).offsets).toEqual([0, 500, 1000]);
    expect(EXPORT_PAGE_SIZE).toBe(500);
  });

  it('con el total justo en el tope no avisa y pide solo las paginas necesarias', () => {
    const plan = planExportPages(EXPORT_ROW_LIMIT);

    expect(plan.capped).toBe(false);
    expect(plan.target).toBe(1000);
    expect(plan.offsets).toEqual([0, 500]);
  });

  it('una fila por encima del tope avisa y no pide una pagina de mas', () => {
    const plan = planExportPages(EXPORT_ROW_LIMIT + 1);

    expect(plan.capped).toBe(true);
    expect(plan.target).toBe(1000);
    expect(plan.offsets).toEqual([0, 500]);
  });

  it.each([1342, 6200, 12000])('con %i filas pide solo hasta el tope', (total) => {
    const plan = planExportPages(total);

    expect(plan.capped).toBe(true);
    expect(plan.target).toBe(EXPORT_ROW_LIMIT);
    expect(plan.offsets).toEqual([0, 500]);
  });

  it('el tope es una sola constante de 1000', () => {
    expect(EXPORT_ROW_LIMIT).toBe(1000);
  });

  it('con un tope que no es multiplo de la pagina, no pide de mas', () => {
    expect(planExportPages(5000, 400, 1000).offsets).toEqual([0, 400, 800]);
  });
});

describe('pageLimitFor', () => {
  it('pide la pagina entera salvo la ultima, que pide lo que falta', () => {
    expect(pageLimitFor(0, 1000, 500)).toBe(500);
    expect(pageLimitFor(500, 1000, 500)).toBe(500);
    expect(pageLimitFor(800, 1000, 400)).toBe(200);
    expect(pageLimitFor(0, 37, 500)).toBe(37);
  });

  it('nunca es negativo', () => {
    expect(pageLimitFor(1500, 1000, 500)).toBe(0);
  });
});

describe('exportFileName', () => {
  it('lleva la fecha con ceros y la extension', () => {
    expect(exportFileName('csv', new Date(2026, 0, 5))).toBe('historial-interacciones-2026-01-05.csv');
    expect(exportFileName('pdf', new Date(2026, 10, 25))).toBe('historial-interacciones-2026-11-25.pdf');
  });
});

describe('describeFilters', () => {
  it('sin filtros dice todos, sin rango y ninguna busqueda', () => {
    expect(describeFilters({ range: null, statusLabel: null, category: null, term: '  ' })).toEqual([
      'Rango: Todo el historial',
      'Estado: Todos',
      'Categoría: Todas',
      'Búsqueda: Ninguna',
    ]);
  });

  it('con filtros usa fechas argentinas y las etiquetas', () => {
    expect(
      describeFilters({ range: { from: '2026-11-05', to: '2026-11-09' }, statusLabel: 'Escalada', category: 'Red', term: ' vpn ' }),
    ).toEqual(['Rango: 05/11/2026 al 09/11/2026', 'Estado: Escalada', 'Categoría: Red', 'Búsqueda: vpn']);
  });
});

describe('truncateText', () => {
  it('no corta lo que entra', () => {
    expect(truncateText('corto', 10)).toBe('corto');
    expect(truncateText('1234567890', 10)).toBe('1234567890');
  });

  it('corta con elipsis sin pasar el largo', () => {
    const result = truncateText('abcdefghijklmnop', 10);

    expect(result).toBe('abcdefghi…');
    expect(result).toHaveLength(10);
  });
});

describe('avisos', () => {
  it('sin rango avisa que se exporta todo el historial y no habla de lo cargado', () => {
    const notice = exportScopeNotice(null, 300);

    expect(notice).toBe('Se exporta todo el historial con los filtros activos.');
    expect(notice).not.toContain('lo cargado');
    expect(notice).not.toContain('Sin rango de fechas');
  });

  it('con rango avisa del periodo completo', () => {
    expect(exportScopeNotice({ from: '2026-11-01', to: '2026-11-09' }, 300)).toBe('Se exporta el período completo con los filtros activos.');
  });

  it('por encima del tope avisa con o sin rango, y justo en el tope no', () => {
    const range = { from: '2026-11-01', to: '2026-11-09' };

    expect(exportScopeNotice(range, 1342)).toBe(ROW_LIMIT_NOTICE);
    expect(exportScopeNotice(null, 1342)).toBe(ROW_LIMIT_NOTICE);
    expect(exportScopeNotice(null, EXPORT_ROW_LIMIT)).toBe('Se exporta todo el historial con los filtros activos.');
  });

  it('el mensaje final dice cuantas se exportaron y si fue el tope', () => {
    expect(exportDoneMessage(37, 37, false)).toBe('Se exportaron 37 interacciones.');
    expect(exportDoneMessage(1, 1, false)).toBe('Se exportó 1 interacción.');
    expect(exportDoneMessage(EXPORT_ROW_LIMIT, 1342, true)).toBe(
      `Se exportaron las ${EXPORT_ROW_LIMIT} interacciones más recientes de 1342 que cumplen los filtros. Para ver más, acotá el rango de fechas.`,
    );
  });

  it('el aviso del tope usa la constante y el texto pedido', () => {
    expect(ROW_LIMIT_NOTICE).toBe('Se exportan las 1000 interacciones más recientes que cumplen los filtros. Para ver más, acotá el rango de fechas.');
  });

  it('ningun texto lleva em dash', () => {
    const all = [exportScopeNotice(null, 0), exportScopeNotice({ from: '2026-11-01', to: '2026-11-09' }, 9000), ROW_LIMIT_NOTICE, exportDoneMessage(5, 9, true), ...describeFilters({ range: null, statusLabel: null, category: null, term: '' })];
    for (const text of all) expect(text).not.toMatch(/—/);
  });
});
