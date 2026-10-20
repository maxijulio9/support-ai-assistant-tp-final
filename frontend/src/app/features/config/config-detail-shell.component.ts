import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ConfigStatusService, LoadableSectionId } from './config-status.service';
import {
  SectionCardChip,
  SectionCardLoadState,
  connectionCardChip,
  projectsCardChip,
  toSectionCardLoadState,
} from './config-readiness';
import { ConfigSectionPath } from './config-tabs';
import { indexingStatusLabel, indexingStatusTone } from './indexing-status-display';

interface DetailNavItem {
  path: ConfigSectionPath | null;
  label: string;
  icon: string;
  disabled: boolean;
}

// Mismo orden que el Figma: las conexiones primero (con el LLM, deshabilitado,
// intercalado despues de Confluence), despues Proyectos y Campos y
// categorías, despues Indexación.
const DETAIL_NAV_ITEMS: DetailNavItem[] = [
  { path: 'jsm', label: 'Jira Service Management', icon: 'hub', disabled: false },
  { path: 'confluence', label: 'Confluence', icon: 'link', disabled: false },
  { path: null, label: 'Modelo de lenguaje', icon: 'memory', disabled: true },
  { path: 'proyectos', label: 'Proyectos', icon: 'grid_view', disabled: false },
  { path: 'campos', label: 'Campos y categorías', icon: 'list_alt', disabled: false },
  { path: 'indexacion', label: 'Indexación', icon: 'layers', disabled: false },
];

const PATH_TO_SECTION_ID: Partial<Record<ConfigSectionPath, LoadableSectionId>> = {
  jsm: 'jsm',
  confluence: 'confluence',
  proyectos: 'projects',
  indexacion: 'indexing',
};

// Shell montado una sola vez para todas las secciones de detalle (jsm,
// proyectos, campos, confluence, indexacion), que se renderizan via
// router-outlet como hijas de esta misma ruta. Pone las migas, el
// encabezado con el chip de estado y la navegacion secundaria; el
// contenido de cada seccion sigue siendo el componente que ya existia, sin
// cambios.
@Component({
  selector: 'app-config-detail-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, MatIconModule, MatFormFieldModule, MatSelectModule],
  templateUrl: './config-detail-shell.component.html',
  styleUrl: './config-detail-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigDetailShellComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly status = inject(ConfigStatusService);

  readonly navItems = DETAIL_NAV_ITEMS;

  private readonly activePath = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.readActivePath()),
    ),
    { initialValue: this.readActivePath() },
  );

  readonly activeItem = computed(() => this.navItems.find((item) => item.path === this.activePath()) ?? null);

  readonly headerLoadState = computed<SectionCardLoadState>(() => {
    const id = this.activeSectionId();
    if (!id) return 'loaded';
    return toSectionCardLoadState(this.status[id]().state);
  });

  readonly headerChip = computed<SectionCardChip | null>(() => {
    if (this.headerLoadState() === 'loading') return null;
    if (this.headerLoadState() === 'error') return { label: 'No se pudo cargar', tone: 'error' };

    switch (this.activePath()) {
      case 'jsm':
        return connectionCardChip(this.status.jsm().data);
      case 'confluence':
        return connectionCardChip(this.status.confluence().data);
      case 'proyectos':
        return projectsCardChip(this.status.projects().data);
      case 'campos':
        return { label: 'Por proyecto', tone: 'neutral' };
      case 'indexacion': {
        const data = this.status.indexing().data;
        return { label: indexingStatusLabel(data), tone: indexingStatusTone(data) };
      }
      default:
        return null;
    }
  });

  constructor() {
    effect(() => {
      const id = this.activeSectionId();
      if (id) this.status.ensureLoaded(id);
    });
  }

  selectSection(path: ConfigSectionPath): void {
    this.router.navigate(['/config', path]);
  }

  private activeSectionId(): LoadableSectionId | null {
    const path = this.activePath();
    return path ? (PATH_TO_SECTION_ID[path] ?? null) : null;
  }

  private readActivePath(): ConfigSectionPath | null {
    return (this.route.snapshot.firstChild?.url[0]?.path as ConfigSectionPath | undefined) ?? null;
  }
}
