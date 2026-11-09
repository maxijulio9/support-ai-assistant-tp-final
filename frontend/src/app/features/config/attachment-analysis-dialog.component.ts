import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import {
  ATTACHMENT_ANALYSIS_DIALOG,
  ATTACHMENT_ANALYSIS_PARAGRAPHS,
  ATTACHMENT_ANALYSIS_TITLE,
  attachmentAnalysisDialogProjectLine,
} from './attachment-analysis';

export interface AttachmentAnalysisDialogData {
  projectName: string;
}

// Solo pide la confirmacion: el pedido lo hace quien abre el dialogo. Cierra
// con true al confirmar y sin resultado al cancelar.
export type AttachmentAnalysisDialogResult = true | undefined;

@Component({
  selector: 'app-attachment-analysis-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './attachment-analysis-dialog.component.html',
  styleUrl: './attachment-analysis-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttachmentAnalysisDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<AttachmentAnalysisDialogComponent, AttachmentAnalysisDialogResult>);
  private readonly data = inject<AttachmentAnalysisDialogData>(MAT_DIALOG_DATA);

  readonly title = ATTACHMENT_ANALYSIS_TITLE;
  readonly projectLine = attachmentAnalysisDialogProjectLine(this.data.projectName);
  readonly paragraphs = ATTACHMENT_ANALYSIS_PARAGRAPHS;
  readonly texts = ATTACHMENT_ANALYSIS_DIALOG;

  // Un doble clic en "Encender" no confirma dos veces
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
