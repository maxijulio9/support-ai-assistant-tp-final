import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ConfigStatusService } from './config-status.service';
import { SectionCardComponent } from './section-card.component';
import { ReadinessStripComponent } from './readiness-strip.component';
import {
  ReadinessSection,
  connectionCardChip,
  llmReadinessState,
  projectsCardChip,
  projectsReadinessState,
  sectionReadinessState,
  summarizeReadiness,
  toSectionCardLoadState,
} from './config-readiness';
import { indexingLastRunLabel, indexingStatusLabel, indexingStatusTone } from './indexing-status-display';

@Component({
  selector: 'app-config-center',
  standalone: true,
  imports: [SectionCardComponent, ReadinessStripComponent, MatIconModule],
  templateUrl: './config-center.component.html',
  styleUrl: './config-center.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigCenterComponent {
  readonly status = inject(ConfigStatusService);

  readonly readinessSections = computed<ReadinessSection[]>(() => [
    {
      id: 'jsm',
      label: 'Jira Service Management',
      state: sectionReadinessState(this.status.jsm(), (data) => data.configured),
      counts: true,
    },
    {
      id: 'confluence',
      label: 'Confluence',
      state: sectionReadinessState(this.status.confluence(), (data) => data.configured),
      counts: true,
    },
    { id: 'projects', label: 'Proyectos', state: projectsReadinessState(this.status.projects()), counts: true },
    // Cuenta en el total (4 secciones) aunque todavia no exista el
    // backend: llmReadinessState() la fuerza a 'unset' hasta entonces, ver
    // LLM_SECTION_HAS_BACKEND en config-readiness.ts.
    { id: 'llm', label: 'Modelo de lenguaje', state: llmReadinessState(), counts: true },
  ]);

  readonly readinessSummary = computed(() => summarizeReadiness(this.readinessSections()));

  // Mientras alguna de las 3 secciones con backend hoy todavia no
  // resolvio (ni cargada ni en error), la franja muestra su propio
  // esqueleto en lugar de un resumen a medio calcular. El LLM no participa
  // de este chequeo: su estado es fijo (llmReadinessState()), nunca esta
  // "cargando".
  readonly readinessLoading = computed(() =>
    [this.status.jsm().state, this.status.confluence().state, this.status.projects().state].some(
      (state) => state === 'idle' || state === 'loading',
    ),
  );

  readonly subtitle = computed(() =>
    this.readinessSummary().showWelcome
      ? 'Configurá las conexiones y herramientas necesarias para poner en marcha el asistente.'
      : 'Conectá las herramientas y definí cómo trabaja el asistente.',
  );

  readonly jsmLoadState = computed(() => toSectionCardLoadState(this.status.jsm().state));
  readonly jsmChip = computed(() => connectionCardChip(this.status.jsm().data));

  readonly confluenceLoadState = computed(() => toSectionCardLoadState(this.status.confluence().state));
  readonly confluenceChip = computed(() => connectionCardChip(this.status.confluence().data));

  readonly projectsLoadState = computed(() => toSectionCardLoadState(this.status.projects().state));
  readonly projectsChip = computed(() => projectsCardChip(this.status.projects().data));

  readonly indexingLoadState = computed(() => toSectionCardLoadState(this.status.indexing().state));
  readonly indexingChipLabel = computed(() => indexingStatusLabel(this.status.indexing().data));
  readonly indexingChipTone = computed(() => indexingStatusTone(this.status.indexing().data));
  readonly indexingLastRun = computed(() => indexingLastRunLabel(this.status.indexing().data));

  constructor() {
    this.status.refresh('jsm');
    this.status.refresh('confluence');
    this.status.refresh('projects');
    this.status.refresh('indexing');
  }

  retryJsm(): void {
    this.status.retry('jsm');
  }

  retryConfluence(): void {
    this.status.retry('confluence');
  }

  retryProjects(): void {
    this.status.retry('projects');
  }

  retryIndexing(): void {
    this.status.retry('indexing');
  }
}
