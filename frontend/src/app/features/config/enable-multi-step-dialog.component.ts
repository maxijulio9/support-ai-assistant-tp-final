import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import {
  MULTI_STEP_DIALOG,
  MULTI_STEP_HELP_PARAGRAPHS,
  MULTI_STEP_TITLE,
  multiStepDialogProjectLine,
} from './multi-step-transitions';

export interface EnableMultiStepDialogData {
  projectName: string;
}

// Solo pide la confirmacion: el pedido lo hace quien abre el dialogo. Cierra
// con true al confirmar y sin resultado al cancelar.
export type EnableMultiStepDialogResult = true | undefined;

@Component({
  selector: 'app-enable-multi-step-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './enable-multi-step-dialog.component.html',
  styleUrl: './enable-multi-step-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnableMultiStepDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<EnableMultiStepDialogComponent, EnableMultiStepDialogResult>);
  private readonly data = inject<EnableMultiStepDialogData>(MAT_DIALOG_DATA);

  readonly title = MULTI_STEP_TITLE;
  readonly projectLine = multiStepDialogProjectLine(this.data.projectName);
  readonly paragraphs = MULTI_STEP_HELP_PARAGRAPHS;
  readonly texts = MULTI_STEP_DIALOG;

  // Un doble clic en "Permitir" no confirma dos veces
  private closed = false;

  confirm(): void {
    if (this.closed) return;
    this.closed = true;
    this.dialogRef.close(true);
  }

  cancel(): void {
    if (this.closed) return;
    this.closed = true;
    this.dialogRef.close(undefined);
  }
}
