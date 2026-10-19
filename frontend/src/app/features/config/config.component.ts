import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { JsmConnectionComponent } from './jsm-connection.component';
import { ProjectsTabComponent } from './projects-tab.component';
import { FieldsCategoriesTabComponent } from './fields-categories-tab.component';
import { ConfluenceTabComponent } from './confluence-tab.component';

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
export class ConfigComponent {}
