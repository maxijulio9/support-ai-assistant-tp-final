import { Injectable, Signal, WritableSignal, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';
import { classifyFormError } from '../../shared/form-error';
import { SectionSlot, idleSlot } from './config-readiness';
import { ConnectionStatusResponse } from '../../api/models/connection-status-response';
import { OnboardedProject } from '../../api/models/onboarded-project';
import { IndexingStatusResponse } from '../../api/models/indexing-status-response';

export type LoadableSectionId = 'jsm' | 'confluence' | 'projects' | 'indexing';

const GENERIC_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intentá de nuevo.';

// Estado compartido entre el centro de Configuracion y cada pantalla de
// detalle: una seccion se carga una sola vez (ensureLoaded, para el acceso
// directo a /config/<seccion>) y se puede refrescar despues (refresh, usado
// por el centro al volver, y por cada pantalla tras guardar con exito via
// los setters). Vive en 'root' porque sobrevive a la navegacion entre
// pantallas: es el mecanismo que evita volver a pedir todo de nuevo.
@Injectable({ providedIn: 'root' })
export class ConfigStatusService {
  private readonly configService = inject(ConfigService);

  private readonly jsmSlot = signal<SectionSlot<ConnectionStatusResponse>>(idleSlot());
  private readonly confluenceSlot = signal<SectionSlot<ConnectionStatusResponse>>(idleSlot());
  private readonly projectsSlot = signal<SectionSlot<OnboardedProject[]>>(idleSlot());
  private readonly indexingSlot = signal<SectionSlot<IndexingStatusResponse>>(idleSlot());

  readonly jsm: Signal<SectionSlot<ConnectionStatusResponse>> = this.jsmSlot;
  readonly confluence: Signal<SectionSlot<ConnectionStatusResponse>> = this.confluenceSlot;
  readonly projects: Signal<SectionSlot<OnboardedProject[]>> = this.projectsSlot;
  readonly indexing: Signal<SectionSlot<IndexingStatusResponse>> = this.indexingSlot;

  // Para el acceso directo a una seccion (por ejemplo /config/confluence):
  // carga solo si todavia no se pidio nada, sin tocar las demas.
  ensureLoaded(id: LoadableSectionId): void {
    if (this.slotOf(id)().state !== 'idle') return;
    this.load(id, false);
  }

  // Para el centro al montar: si ya hay datos, los deja visibles y refresca
  // en segundo plano (silent); si no, carga normal con esqueleto.
  refresh(id: LoadableSectionId): void {
    const current = this.slotOf(id)();
    if (current.state === 'loading') return;
    this.load(id, current.state === 'loaded');
  }

  setJsmConnected(data: ConnectionStatusResponse): void {
    this.jsmSlot.set({ state: 'loaded', data, errorMessage: null });
  }

  setConfluenceConnected(data: ConnectionStatusResponse): void {
    this.confluenceSlot.set({ state: 'loaded', data, errorMessage: null });
  }

  setProjectsLoaded(data: OnboardedProject[]): void {
    this.projectsSlot.set({ state: 'loaded', data, errorMessage: null });
  }

  // Para el boton "Reintentar" de una tarjeta en error: a diferencia de
  // ensureLoaded, fuerza la carga aunque el estado ya no sea 'idle'.
  retry(id: LoadableSectionId): void {
    if (this.slotOf(id)().state === 'loading') return;
    this.load(id, false);
  }

  private slotOf(id: LoadableSectionId): Signal<SectionSlot<unknown>> {
    switch (id) {
      case 'jsm':
        return this.jsmSlot;
      case 'confluence':
        return this.confluenceSlot;
      case 'projects':
        return this.projectsSlot;
      case 'indexing':
        return this.indexingSlot;
    }
  }

  private load(id: LoadableSectionId, silent: boolean): void {
    switch (id) {
      case 'jsm':
        this.run(this.jsmSlot, silent, this.configService.getItsmConnection());
        return;
      case 'confluence':
        this.run(this.confluenceSlot, silent, this.configService.getConfluenceConnection());
        return;
      case 'projects':
        this.run(this.projectsSlot, silent, this.configService.listOnboardedProjects());
        return;
      case 'indexing':
        this.runIndexing(silent);
        return;
    }
  }

  private run<T>(slot: WritableSignal<SectionSlot<T>>, silent: boolean, request: Observable<T>): void {
    if (!silent) slot.set({ state: 'loading', data: slot().data, errorMessage: null });

    request.subscribe({
      next: (data) => slot.set({ state: 'loaded', data, errorMessage: null }),
      error: (error: unknown) => {
        // un ciclo silencioso que falla conserva lo ultimo bueno: no tiene
        // sentido tapar una tarjeta ya cargada por un refresco fallido.
        if (silent) return;
        const result = classifyFormError(error);
        slot.set({ state: 'error', data: null, errorMessage: result.message ?? GENERIC_ERROR_MESSAGE });
      },
    });
  }

  // El 404 (nunca se disparo una indexacion) es un resultado valido, no un
  // error: se guarda como 'loaded' con data null, igual que hace la pantalla
  // de detalle de Indexacion.
  private runIndexing(silent: boolean): void {
    if (!silent) this.indexingSlot.set({ state: 'loading', data: this.indexingSlot().data, errorMessage: null });

    this.configService.getIndexingStatus().subscribe({
      next: (data) => this.indexingSlot.set({ state: 'loaded', data, errorMessage: null }),
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 404) {
          this.indexingSlot.set({ state: 'loaded', data: null, errorMessage: null });
          return;
        }
        if (silent) return;
        const result = classifyFormError(error);
        this.indexingSlot.set({ state: 'error', data: null, errorMessage: result.message ?? GENERIC_ERROR_MESSAGE });
      },
    });
  }
}
