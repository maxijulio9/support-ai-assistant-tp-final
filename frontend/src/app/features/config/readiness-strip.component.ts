import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ReadinessSection, ReadinessState, readinessHeadline, summarizeReadiness } from './config-readiness';

const STATE_ICON: Record<ReadinessState, string> = {
  ready: 'check_circle',
  pending: 'schedule',
  unset: 'remove',
  error: 'error',
};

// Franja "Preparación del asistente" del centro de Configuracion. Puramente
// presentacional: recibe las secciones ya resueltas (ver config-readiness.ts
// y config-status.service.ts) y solo las dibuja.
@Component({
  selector: 'app-readiness-strip',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './readiness-strip.component.html',
  styleUrl: './readiness-strip.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReadinessStripComponent {
  readonly sections = input.required<ReadinessSection[]>();
  readonly loading = input(false);

  readonly summary = computed(() => summarizeReadiness(this.sections()));
  readonly headline = computed(() => readinessHeadline(this.summary()));

  iconFor(state: ReadinessState): string {
    return STATE_ICON[state];
  }
}
