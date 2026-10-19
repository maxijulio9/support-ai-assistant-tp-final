import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { JsmConnectionComponent } from './jsm-connection.component';
import { ProjectsTabComponent } from './projects-tab.component';

@Component({
  selector: 'app-config',
  standalone: true,
  imports: [MatTabsModule, JsmConnectionComponent, ProjectsTabComponent],
  templateUrl: './config.component.html',
  styleUrl: './config.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigComponent {}
