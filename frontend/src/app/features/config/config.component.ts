import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { MatTabsModule } from '@angular/material/tabs';
import { JsmConnectionComponent } from './jsm-connection.component';
import { ProjectsTabComponent } from './projects-tab.component';
import { FieldsCategoriesTabComponent } from './fields-categories-tab.component';
import { ConfluenceTabComponent } from './confluence-tab.component';
import { configTabKeyForIndex, resolveConfigTabIndex } from './config-tabs';

@Component({
  selector: 'app-config',
  standalone: true,
  imports: [
    MatTabsModule,
    JsmConnectionComponent,
    ProjectsTabComponent,
    FieldsCategoriesTabComponent,
    ConfluenceTabComponent,
  ],
  templateUrl: './config.component.html',
  styleUrl: './config.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  // Reactivo a la URL (no solo leido una vez al montar), para que el boton
  // atras/adelante del navegador tambien cambie la pestaña mostrada.
  private readonly tabParam = toSignal(this.route.queryParamMap.pipe(map((params) => params.get('tab'))), {
    initialValue: this.route.snapshot.queryParamMap.get('tab'),
  });

  readonly selectedTabIndex = computed(() => resolveConfigTabIndex(this.tabParam()));

  onTabChange(index: number): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: configTabKeyForIndex(index) },
      queryParamsHandling: 'merge',
    });
  }
}
