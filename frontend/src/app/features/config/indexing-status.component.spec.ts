import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { IndexingStatusComponent } from './indexing-status.component';
import { ConfigService } from './config.service';
import { IndexingStatusResponse } from '../../api/models/indexing-status-response';

function statusResponse(overrides: Partial<IndexingStatusResponse> = {}): IndexingStatusResponse {
  return {
    space_keys: ['TA'],
    status: 'running',
    total_documents: null,
    documents_processed: 0,
    chunks_generated: 0,
    error_detail: null,
    started_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
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

  it('arranca a pollear cuando el estado es queued o running', async () => {
    getIndexingStatus.mockReturnValue(of(statusResponse({ status: 'queued' })));
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
});
