import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { DEACTIVATE_DIALOG, deactivateDialogTitle } from './project-activation';

export interface DeactivateProjectDialogData {
  projectName: string;
}

// Solo pide la confirmacion: el pedido lo hace quien abre el dialogo. Cierra
// con true al confirmar y sin resultado al cancelar.
export type DeactivateProjectDialogResult = true | undefined;

@Component({
  selector: 'app-deactivate-project-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './deactivate-project-dialog.component.html',
  styleUrl: './deactivate-project-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeactivateProjectDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<DeactivateProjectDialogComponent, DeactivateProjectDialogResult>);
  private readonly data = inject<DeactivateProjectDialogData>(MAT_DIALOG_DATA);

  readonly title = deactivateDialogTitle(this.data.projectName);
  readonly texts = DEACTIVATE_DIALOG;

  // Un doble clic en "Desactivar" no confirma dos veces
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
