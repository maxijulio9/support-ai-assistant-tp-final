import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {
  MAX_EDITED_RESPONSE_LENGTH,
  dialogTitleWithIssueKey,
  isEditedResponseValid,
  resolveEditedResponse,
} from './review-actions';

export interface EditApproveDialogData {
  generatedResponse: string | null;
  issueKey: string | null;
  // Se usan al reabrir el dialogo despues de un error que no es 404 ni 409
  // (ver reviewActionErrorOutcome en review-actions.ts): initialText trae
  // lo que el usuario ya habia escrito, para no perderlo.
  initialText?: string;
  errorMessage?: string | null;
}

// Sin conectar: no inyecta ReviewService ni llama HTTP. Resuelve si el
// texto cuenta como edicion real (resolveEditedResponse) y cierra con el
// resultado; quien abre el dialogo decide que hacer (llamar a approve con
// edited_response, cuando exista el campo).
export type EditApproveDialogResult = { editedResponse: string | null } | undefined;

@Component({
  selector: 'app-edit-approve-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  templateUrl: './edit-approve-dialog.component.html',
  styleUrl: './edit-approve-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditApproveDialogComponent {
  private readonly data = inject<EditApproveDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<EditApproveDialogComponent, EditApproveDialogResult>);

  readonly title = dialogTitleWithIssueKey('Editar y aprobar', this.data.issueKey);
  readonly textControl = new FormControl(this.data.initialText ?? this.data.generatedResponse ?? '', {
    nonNullable: true,
  });
  readonly maxLength = MAX_EDITED_RESPONSE_LENGTH;
  readonly errorMessage = this.data.errorMessage ?? null;

  private readonly textValue = toSignal(this.textControl.valueChanges, {
    initialValue: this.textControl.value,
  });

  readonly textLength = computed(() => this.textValue().trim().length);
  readonly isValid = computed(() => isEditedResponseValid(this.textValue()));

  confirm(): void {
    if (!this.isValid()) return;
    const editedResponse = resolveEditedResponse(this.textValue(), this.data.generatedResponse);
    this.dialogRef.close({ editedResponse });
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }
}
