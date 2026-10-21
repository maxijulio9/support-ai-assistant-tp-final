import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { safeTicketUrl } from '../../shared/safe-ticket-url';

export interface DiscardSuccessDialogData {
  issueKey: string;
  ticketUrl: string | null;
}

// Sin conectar: solo muestra datos que ya le llegan armados. Se abre sin
// disableClose (a diferencia de RegenerateDialogComponent) para que clic
// afuera y Escape tambien cierren, ademas del boton de cerrar explicito.
@Component({
  selector: 'app-discard-success-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './discard-success-dialog.component.html',
  styleUrl: './discard-success-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscardSuccessDialogComponent {
  private readonly data = inject<DiscardSuccessDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<DiscardSuccessDialogComponent>);

  readonly issueKey = this.data.issueKey;
  readonly ticketUrl = safeTicketUrl(this.data.ticketUrl);

  close(): void {
    this.dialogRef.close();
  }
}
