import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { OnboardedProject } from '../../api/models/onboarded-project';
import {
  EditThresholdsDialogComponent,
  EditThresholdsDialogData,
  EditThresholdsDialogResult,
} from './edit-thresholds-dialog.component';
import { formatFirstResponseTarget } from './first-response-target';

@Component({
  selector: 'app-project-thresholds',
  standalone: true,
  imports: [MatButtonModule],
  templateUrl: './project-thresholds.component.html',
  styleUrl: './project-thresholds.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectThresholdsComponent {
  private readonly dialog = inject(MatDialog);

  readonly projects = input.required<OnboardedProject[]>();
  readonly selectedProjectKey = input<string | null>(null);

  readonly formatFirstResponseTarget = formatFirstResponseTarget;

  readonly viewStatuses = output<string>();
  readonly thresholdsSaved = output<void>();

  openEditThresholds(project: OnboardedProject): void {
    const dialogRef = this.dialog.open<EditThresholdsDialogComponent, EditThresholdsDialogData, EditThresholdsDialogResult>(
      EditThresholdsDialogComponent,
      { data: { project }, disableClose: true, width: '640px', maxWidth: '92vw' },
    );

    dialogRef.afterClosed().subscribe((saved) => {
      if (!saved) return;
      this.thresholdsSaved.emit();
    });
  }
}
