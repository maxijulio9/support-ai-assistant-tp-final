import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { IndexingStatusComponent } from './indexing-status.component';
import { ConfigService } from './config.service';
import { IndexingStatusResponse } from '../../api/models/indexing-status-response';

function statusResponse(overrides: Partial<IndexingStatusResponse> = {}): IndexingStatusResponse {
  const now = new Date().toISOString();
  return {
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

  it('respeta el tope de 5 minutos si nunca llega a un estado terminal', async () => {
    getIndexingStatus.mockReturnValue(of(statusResponse({ status: 'running' })));
    await createComponent();

    vi.advanceTimersByTime(5 * 60 * 1000);
    fixture.detectChanges();

    expect(fixture.componentInstance.pollingTimedOut()).toBe(true);

    const callsAtTimeout = getIndexingStatus.mock.calls.length;
    vi.advanceTimersByTime(3000);
    expect(getIndexingStatus).toHaveBeenCalledTimes(callsAtTimeout);
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

  it('muestra los contadores con un guion cuando el estado es completed y ambos vienen en 0', async () => {
    getIndexingStatus.mockReturnValue(
      of(statusResponse({ status: 'completed', documents_processed: 0, chunks_generated: 0 })),
    );
    await createComponent();

    expect(fixture.componentInstance.showCountersAsDash()).toBe(true);

    const rows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.indexing-status-row'));
    const processedRow = rows.find((row) => row.textContent?.includes('Documentos procesados'));
    const chunksRow = rows.find((row) => row.textContent?.includes('Fragmentos generados'));

    expect(processedRow?.querySelector('dd')?.textContent?.trim()).toBe('-');
    expect(chunksRow?.querySelector('dd')?.textContent?.trim()).toBe('-');
  });

  it('no muestra un guion si completed trae algun contador distinto de 0', async () => {
    getIndexingStatus.mockReturnValue(
      of(statusResponse({ status: 'completed', documents_processed: 5, chunks_generated: 12 })),
    );
    await createComponent();

    expect(fixture.componentInstance.showCountersAsDash()).toBe(false);

    const rows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.indexing-status-row'));
    const processedRow = rows.find((row) => row.textContent?.includes('Documentos procesados'));

    expect(processedRow?.querySelector('dd')?.textContent?.trim()).toContain('5');
  });

  it('muestra el error_detail como aviso con el token de error del tema', async () => {
    getIndexingStatus.mockReturnValue(
      of(statusResponse({ status: 'failed', error_detail: 'No se pudo conectar a Confluence' })),
    );
    await createComponent();

    const alert: HTMLElement = fixture.nativeElement.querySelector('.indexing-status-alert');
    expect(alert).toBeTruthy();
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.textContent).toContain('No se pudo conectar a Confluence');
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

  it('(a) tras notifyStarted, un GET que devuelve la corrida vieja terminada no detiene el polling', async () => {
    const oldStatus = statusResponse({ status: 'completed', started_at: '2024-01-01T00:00:00Z' });
    getIndexingStatus.mockReturnValue(of(oldStatus));
    await createComponent();

    expect(fixture.componentInstance.isInProgress()).toBe(false);

    fixture.componentInstance.notifyStarted();
    fixture.detectChanges();
    expect(fixture.componentInstance.awaitingNewRun()).toBe(true);
    expect(getIndexingStatus).toHaveBeenCalledTimes(2);

    // el GET sigue devolviendo la corrida vieja, ya terminada: no debe cortar el polling
    vi.advanceTimersByTime(3000);
    expect(getIndexingStatus).toHaveBeenCalledTimes(3);
    expect(fixture.componentInstance.awaitingNewRun()).toBe(true);

    vi.advanceTimersByTime(3000);
    expect(getIndexingStatus).toHaveBeenCalledTimes(4);
  });

  it('(b) cuando llega un started_at mas nuevo que el guardado, se adopta y sigue segun su propio estado', async () => {
    const oldStartedAt = '2024-01-01T00:00:00Z';
    // Reciente respecto del reloj de la prueba: no debe contarse como huerfana.
    const newStartedAt = new Date().toISOString();
    let call = 0;
    getIndexingStatus.mockImplementation(() => {
      call++;
      if (call <= 2) return of(statusResponse({ status: 'completed', started_at: oldStartedAt }));
      return of(statusResponse({ status: 'running', started_at: newStartedAt }));
    });
    await createComponent();

    fixture.componentInstance.notifyStarted();
    fixture.detectChanges();
    expect(getIndexingStatus).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.awaitingNewRun()).toBe(true);

    // 3er llamado: aparece la corrida nueva, running
    vi.advanceTimersByTime(3000);
    fixture.detectChanges();
    expect(getIndexingStatus).toHaveBeenCalledTimes(3);
    expect(fixture.componentInstance.awaitingNewRun()).toBe(false);
    expect(fixture.componentInstance.isInProgress()).toBe(true);
    expect(fixture.componentInstance.status()?.started_at).toBe(newStartedAt);

    // sigue polleando porque la corrida nueva esta running
    vi.advanceTimersByTime(3000);
    expect(getIndexingStatus).toHaveBeenCalledTimes(4);
  });

  it('(c) respeta el tope de 5 minutos si nunca se detecta la corrida nueva', async () => {
    getIndexingStatus.mockReturnValue(
      of(statusResponse({ status: 'completed', started_at: '2024-01-01T00:00:00Z' })),
    );
    await createComponent();

    fixture.componentInstance.notifyStarted();
    fixture.detectChanges();

    vi.advanceTimersByTime(5 * 60 * 1000);
    fixture.detectChanges();

    expect(fixture.componentInstance.awaitingTimedOut()).toBe(true);
    expect(fixture.componentInstance.awaitingNewRun()).toBe(true);

    const callsAtTimeout = getIndexingStatus.mock.calls.length;
    vi.advanceTimersByTime(3000);
    expect(getIndexingStatus).toHaveBeenCalledTimes(callsAtTimeout);
  });

  it('(d) running con started_at de mas de 1 hora se trata como huerfana: sin polling y sin bloquear el boton', async () => {
    const oldStartedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    getIndexingStatus.mockReturnValue(of(statusResponse({ status: 'running', started_at: oldStartedAt })));
    await createComponent();

    expect(fixture.componentInstance.isOrphaned()).toBe(true);
    expect(fixture.componentInstance.isInProgress()).toBe(false);

    const note: HTMLElement = fixture.nativeElement.querySelector('.indexing-status-note--warning');
    expect(note).toBeTruthy();

    vi.advanceTimersByTime(10000);
    expect(getIndexingStatus).toHaveBeenCalledTimes(1);
  });

  it('(e) completed se rotula "Finalizada"', async () => {
    getIndexingStatus.mockReturnValue(of(statusResponse({ status: 'completed' })));
    await createComponent();

    expect(fixture.componentInstance.statusLabel()).toBe('Finalizada');
  });
});
