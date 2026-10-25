import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { REGENERATE_DIALOG } from './webhook-secret-messages';

// Solo pide la confirmacion: no hace el pedido ni recibe el secreto. Cierra con
// true al confirmar y sin resultado al cancelar, para que el secreto nuevo
// nunca pase por el resultado del dialogo.
export type RegenerateSecretDialogResult = true | undefined;

@Component({
  selector: 'app-regenerate-secret-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './regenerate-secret-dialog.component.html',
  styleUrl: './regenerate-secret-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegenerateSecretDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<RegenerateSecretDialogComponent, RegenerateSecretDialogResult>);

  readonly texts = REGENERATE_DIALOG;

  // Un doble clic en "Regenerar" no confirma dos veces
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
