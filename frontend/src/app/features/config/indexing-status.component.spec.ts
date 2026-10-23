import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { IndexingStatusComponent } from './indexing-status.component';
import { ConfigService } from './config.service';
import { ERROR_DETAIL_PREVIEW_LENGTH } from './indexing-status-display';
import { IndexingStatusResponse } from '../../api/models/indexing-status-response';

function statusResponse(overrides: Partial<IndexingStatusResponse> = {}): IndexingStatusResponse {
  const now = new Date().toISOString();
  return {
    id: 'run-1',
    space_keys: ['TA'],
    status: 'running',
    total_documents: null,
    documents_processed: 0,
    chunks_generated: 0,
    error_detail: null,
    started_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe('IndexingStatusComponent', () => {
  let fixture: ComponentFixture<IndexingStatusComponent>;
  let getIndexingStatus: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    getIndexingStatus = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function createComponent(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [IndexingStatusComponent],
      providers: [{ provide: ConfigService, useValue: { getIndexingStatus } }],
    }).compileComponents();
    fixture = TestBed.createComponent(IndexingStatusComponent);
    fixture.detectChanges();
  }

  it('arranca a pollear cuando el estado es running', async () => {
    getIndexingStatus.mockReturnValue(of(statusResponse({ status: 'running' })));
    await createComponent();

    expect(getIndexingStatus).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(3000);
    expect(getIndexingStatus).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(3000);
    expect(getIndexingStatus).toHaveBeenCalledTimes(3);
  });

  it('queued cuenta como en progreso y pollea igual que running', async () => {
    getIndexingStatus.mockReturnValue(of(statusResponse({ status: 'queued' })));
    await createComponent();

    expect(fixture.componentInstance.isInProgress()).toBe(true);
    expect(getIndexingStatus).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(3000);
    expect(getIndexingStatus).toHaveBeenCalledTimes(2);
  });

  it('se detiene al llegar a un estado terminal', async () => {
    let call = 0;
    getIndexingStatus.mockImplementation(() => {
      call++;
      return of(statusResponse({ status: call === 1 ? 'running' : 'completed' }));
    });
    await createComponent();

    expect(getIndexingStatus).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(3000);
    expect(getIndexingStatus).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.isInProgress()).toBe(false);

    // no debe haber un tercer llamado: el polling ya se detuvo
    vi.advanceTimersByTime(3000);
    expect(getIndexingStatus).toHaveBeenCalledTimes(2);
  });

  it('respeta el tope de 5 minutos si nunca llega a un estado terminal, y despues el boton de actualizar sigue disponible', async () => {
    getIndexingStatus.mockReturnValue(of(statusResponse({ status: 'running' })));
    await createComponent();

    vi.advanceTimersByTime(5 * 60 * 1000);
    fixture.detectChanges();

    expect(fixture.componentInstance.pollingTimedOut()).toBe(true);

    const callsAtTimeout = getIndexingStatus.mock.calls.length;
    vi.advanceTimersByTime(3000);
    expect(getIndexingStatus).toHaveBeenCalledTimes(callsAtTimeout);

    const refreshButtons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const refreshButton = refreshButtons.find((button) => button.textContent?.includes('Actualizar estado'));
    expect(refreshButton).toBeTruthy();

    refreshButton?.click();
    expect(getIndexingStatus).toHaveBeenCalledTimes(callsAtTimeout + 1);
  });

  it('corta el polling al destruir el componente', async () => {
    getIndexingStatus.mockReturnValue(of(statusResponse({ status: 'running' })));
    await createComponent();

    const callsBeforeDestroy = getIndexingStatus.mock.calls.length;
    fixture.destroy();

    vi.advanceTimersByTime(10000);
    expect(getIndexingStatus).toHaveBeenCalledTimes(callsBeforeDestroy);
  });

  it('trata el 404 como un estado vacio, no como un error', async () => {
    getIndexingStatus.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    await createComponent();

    expect(fixture.componentInstance.state()).toBe('empty');
    expect(fixture.componentInstance.loadErrorMessage()).toBeNull();
  });

  it('no vuelve a estado de carga en los ciclos de polling posteriores al primero', async () => {
    // Un Subject nuevo por llamada (en vez de of(...), que resuelve en el
    // mismo tick) permite inspeccionar el estado ANTES de que la respuesta
    // de ese ciclo llegue, que es exactamente cuando un ciclo no
    // silencioso pasaria por 'loading'.
    let latestSubject!: Subject<IndexingStatusResponse>;
    getIndexingStatus.mockImplementation(() => {
      latestSubject = new Subject<IndexingStatusResponse>();
      return latestSubject.asObservable();
    });

    await createComponent();
    latestSubject.next(statusResponse({ status: 'running' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.state()).toBe('loaded');

    // dispara el primer ciclo de polling, todavia sin resolver su respuesta
    vi.advanceTimersByTime(3000);
    fixture.detectChanges();
    expect(fixture.componentInstance.state()).toBe('loaded');

    latestSubject.next(statusResponse({ status: 'running' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.state()).toBe('loaded');
  });

  it('muestra "Sin datos" cuando el estado es completed y los contadores vienen en 0 con total null', async () => {
    getIndexingStatus.mockReturnValue(
      of(statusResponse({ status: 'completed', documents_processed: 0, chunks_generated: 0, total_documents: null })),
    );
    await createComponent();

    expect(fixture.componentInstance.showNoDataLabel()).toBe(true);

    const rows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.indexing-status-row'));
    const processedRow = rows.find((row) => row.textContent?.includes('Documentos procesados'));
    const chunksRow = rows.find((row) => row.textContent?.includes('Fragmentos generados'));

    expect(processedRow?.querySelector('dd')?.textContent?.trim()).toBe('Sin datos');
    expect(chunksRow?.querySelector('dd')?.textContent?.trim()).toBe('Sin datos');
  });

  it('"Sin datos" tambien aplica a una corrida failed vieja, sin contadores registrados', async () => {
    getIndexingStatus.mockReturnValue(
      of(statusResponse({ status: 'failed', documents_processed: 0, chunks_generated: 0, total_documents: null })),
    );
    await createComponent();

    expect(fixture.componentInstance.showNoDataLabel()).toBe(true);
  });

  it('no muestra "Sin datos" si completed trae algun contador distinto de 0', async () => {
    getIndexingStatus.mockReturnValue(
      of(statusResponse({ status: 'completed', documents_processed: 5, chunks_generated: 12 })),
    );
    await createComponent();

    expect(fixture.componentInstance.showNoDataLabel()).toBe(false);

    const rows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.indexing-status-row'));
    const processedRow = rows.find((row) => row.textContent?.includes('Documentos procesados'));

    expect(processedRow?.querySelector('dd')?.textContent?.trim()).toContain('5');
  });

  it('muestra la nota de contadores en failed cuando hay valores', async () => {
    getIndexingStatus.mockReturnValue(
      of(statusResponse({ status: 'failed', documents_processed: 3, chunks_generated: 7, total_documents: 10 })),
    );
    await createComponent();

    expect(fixture.componentInstance.showFailedCountersNote()).toBe(true);

    const notes: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.indexing-status-note'));
    expect(notes.some((note) => note.textContent?.includes('hasta dónde llegó la corrida'))).toBe(true);
  });

  it('no muestra la nota de contadores en failed si se esta mostrando "Sin datos"', async () => {
    getIndexingStatus.mockReturnValue(
      of(statusResponse({ status: 'failed', documents_processed: 0, chunks_generated: 0, total_documents: null })),
    );
    await createComponent();

    expect(fixture.componentInstance.showFailedCountersNote()).toBe(false);

    const notes: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.indexing-status-note'));
    expect(notes.some((note) => note.textContent?.includes('hasta dónde llegó la corrida'))).toBe(false);
  });

  it('muestra el error_detail corto completo, sin boton de expandir', async () => {
    getIndexingStatus.mockReturnValue(
      of(statusResponse({ status: 'failed', error_detail: 'No se pudo conectar a Confluence' })),
    );
    await createComponent();

    const alert: HTMLElement = fixture.nativeElement.querySelector('.indexing-status-alert');
    expect(alert).toBeTruthy();
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.textContent).toContain('No se pudo conectar a Confluence');
    expect(alert.querySelector('.indexing-status-error-toggle')).toBeNull();
  });

  it('un error_detail largo se muestra truncado, con boton para expandir y volver a recortar', async () => {
    const longDetail = 'x'.repeat(ERROR_DETAIL_PREVIEW_LENGTH + 50);
    getIndexingStatus.mockReturnValue(of(statusResponse({ status: 'failed', error_detail: longDetail })));
    await createComponent();

    let alert: HTMLElement = fixture.nativeElement.querySelector('.indexing-status-alert');
    expect(alert.textContent).not.toContain(longDetail);

    const toggle = () => fixture.nativeElement.querySelector('.indexing-status-error-toggle') as HTMLButtonElement;
    expect(toggle().textContent?.trim()).toBe('Ver más');

    toggle().click();
    fixture.detectChanges();

    alert = fixture.nativeElement.querySelector('.indexing-status-alert');
    expect(alert.textContent).toContain(longDetail);
    expect(toggle().textContent?.trim()).toBe('Ver menos');

    toggle().click();
    fixture.detectChanges();

    alert = fixture.nativeElement.querySelector('.indexing-status-alert');
    expect(alert.textContent).not.toContain(longDetail);
  });

  it('la expansion del error_detail se reinicia cuando cambia el id de la corrida mostrada', async () => {
    const longDetail = 'x'.repeat(ERROR_DETAIL_PREVIEW_LENGTH + 50);
    getIndexingStatus.mockReturnValue(
      of(statusResponse({ status: 'failed', id: 'run-1', error_detail: longDetail })),
    );
    await createComponent();

    fixture.componentInstance.toggleErrorExpanded();
    fixture.detectChanges();
    expect(fixture.componentInstance.errorExpanded()).toBe(true);

    getIndexingStatus.mockReturnValue(
      of(statusResponse({ status: 'failed', id: 'run-2', error_detail: longDetail })),
    );
    fixture.componentInstance.refresh();
    fixture.detectChanges();

    expect(fixture.componentInstance.errorExpanded()).toBe(false);
  });

  it('no muestra el aviso de error cuando error_detail es null', async () => {
    getIndexingStatus.mockReturnValue(of(statusResponse({ status: 'running', error_detail: null })));
    await createComponent();

    expect(fixture.nativeElement.querySelector('.indexing-status-alert')).toBeNull();
  });

  it('rotula completed como "Finalizada" con tono neutro, no de exito', async () => {
    getIndexingStatus.mockReturnValue(of(statusResponse({ status: 'completed' })));
    await createComponent();

    const chip: HTMLElement = fixture.nativeElement.querySelector('.indexing-status-chip');
    expect(chip.textContent?.trim()).toBe('Finalizada');
    expect(chip.classList.contains('indexing-status-chip--neutral')).toBe(true);

    const note: HTMLElement = fixture.nativeElement.querySelector('.indexing-status-note');
    expect(note?.textContent).toContain('Finalizada. El resultado todavía no se verifica.');
  });

  it('no muestra "Actualizado" mientras esta running, y lo rotula "Finalizó" al terminar', async () => {
    getIndexingStatus.mockReturnValue(of(statusResponse({ status: 'running' })));
    await createComponent();

    const rows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.indexing-status-row'));
    const updatedRow = rows.find((row) => row.querySelector('dt')?.textContent?.trim() === 'Actualizado');
    expect(updatedRow?.querySelector('dd')?.textContent?.trim()).toBe('-');

    getIndexingStatus.mockReturnValue(of(statusResponse({ status: 'completed' })));
    vi.advanceTimersByTime(3000);
    fixture.detectChanges();

    const rowsAfter: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.indexing-status-row'));
    const finishedRow = rowsAfter.find((row) => row.querySelector('dt')?.textContent?.trim() === 'Finalizó');
    expect(finishedRow).toBeTruthy();
  });

  it('notifyStarted muestra el estado del POST (queued, con su id y espacios) antes de que llegue el GET', async () => {
    getIndexingStatus.mockReturnValue(of(statusResponse({ status: 'completed', id: 'run-old' })));
    await createComponent();

    let pending!: Subject<IndexingStatusResponse>;
    getIndexingStatus.mockImplementation(() => {
      pending = new Subject<IndexingStatusResponse>();
      return pending.asObservable();
    });

    fixture.componentInstance.notifyStarted(
      { id: 'run-new', started_at: '2024-03-01T00:00:00Z', status: 'queued' },
      ['TA', 'DEV'],
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.status()?.id).toBe('run-new');
    expect(fixture.componentInstance.statusLabel()).toBe('En cola');
    expect(fixture.componentInstance.status()?.space_keys).toEqual(['TA', 'DEV']);
    expect(fixture.componentInstance.isInProgress()).toBe(true);

    pending.next(statusResponse({ id: 'run-new', status: 'queued', space_keys: ['TA', 'DEV'] }));
    fixture.detectChanges();
    expect(fixture.componentInstance.isInProgress()).toBe(true);
  });

  it('el GET siempre manda: si devuelve un id distinto al del POST, se muestra lo que trae el GET', async () => {
    getIndexingStatus.mockReturnValue(of(statusResponse({ status: 'completed', id: 'run-old' })));
    await createComponent();

    getIndexingStatus.mockReturnValue(
      of(statusResponse({ id: 'run-even-mas-nueva', status: 'running', space_keys: ['OTRO'] })),
    );
    fixture.componentInstance.notifyStarted(
      { id: 'run-mia', started_at: '2024-03-01T00:00:00Z', status: 'queued' },
      ['TA'],
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.status()?.id).toBe('run-even-mas-nueva');
    expect(fixture.componentInstance.status()?.space_keys).toEqual(['OTRO']);
  });
});
