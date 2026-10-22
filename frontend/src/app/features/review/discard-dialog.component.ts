import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { dialogTitleWithIssueKey } from './review-actions';

export interface DiscardDialogData {
  issueKey: string | null;
}

// Sin conectar: no inyecta ReviewService ni llama HTTP. Solo junta el
// motivo opcional y cierra con el resultado; quien abre el dialogo decide
// que hacer con el (llamar a discard, cuando exista el endpoint).
export type DiscardDialogResult = { rejectionReason: string | undefined } | undefined;

const REASON_MAX_LENGTH = 500;

@Component({
  selector: 'app-discard-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  templateUrl: './discard-dialog.component.html',
  styleUrl: './discard-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscardDialogComponent {
  private readonly data = inject<DiscardDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<DiscardDialogComponent, DiscardDialogResult>);

  readonly title = dialogTitleWithIssueKey('Descartar respuesta', this.data.issueKey);
  readonly reasonControl = new FormControl('', { nonNullable: true });
  readonly reasonMaxLength = REASON_MAX_LENGTH;

  confirm(): void {
    const trimmed = this.reasonControl.value.trim();
    this.dialogRef.close({ rejectionReason: trimmed ? trimmed : undefined });
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }
}
