import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConfigService } from '../config.service';
import { ConfigStatusService } from '../config-status.service';
import {
  CLIPBOARD_NOTE,
  CONFLUENCE_HELP,
  COPIED_MESSAGE,
  COPY_FAILED_MESSAGE,
  FULL_NOTE,
  GENERATED_MESSAGE,
  JIRA_HELP,
  MASKED_NOTE,
  NO_SECRET_TEXT,
  REGENERATED_MESSAGE,
  webhookSecretError,
} from './webhook-secret-messages';
import {
  INITIAL_SECRET_STATE,
  SecretAction,
  SecretEvent,
  reduceSecret,
  secretDisplay,
} from './webhook-secret-state';
import { RegenerateSecretDialogComponent, RegenerateSecretDialogResult } from './regenerate-secret-dialog.component';
import { webhookSecretBlockView } from './webhook-secret-view';

export type WebhookSecretBlockState = 'loading' | 'error' | 'hidden' | 'no-secret' | 'has-secret';

const SNACKBAR_MS = 3000;

// El secreto vive solo en el estado de este componente (secretState), nunca
// en un servicio, en el almacenamiento del navegador, en la consola ni en un
// mensaje de error. Al cargar la pantalla llega enmascarado; el valor completo
// solo aparece al generar o regenerar y se pierde al salir. La logica esta en
// reduceSecret.
@Component({
  selector: 'app-webhook-secret',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './webhook-secret.component.html',
  styleUrl: './webhook-secret.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebhookSecretComponent {
  private readonly configService = inject(ConfigService);
  private readonly status = inject(ConfigStatusService);
  private readonly clipboard = inject(Clipboard);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly noSecretText = NO_SECRET_TEXT;
  readonly jiraHelp = JIRA_HELP;
  readonly confluenceHelp = CONFLUENCE_HELP;
  readonly clipboardNote = CLIPBOARD_NOTE;
  readonly regeneratedMessage = REGENERATED_MESSAGE;
  readonly maskedNote = MASKED_NOTE;
  readonly fullNote = FULL_NOTE;

  // Unico lugar donde puede estar el secreto
  private readonly secretState = signal(INITIAL_SECRET_STATE);

  // El pedido de ver o copiar respondio 404
  private readonly notFound = signal(false);
  readonly errorMessage = signal<string | null>(null);
  // Recordatorio de actualizar Jira y Confluence despues de regenerar: se
  // queda hasta pedir otra regeneracion o salir de la pantalla
  readonly regeneratedNote = signal(false);

  readonly pending = computed(() => this.secretState().pending);
  readonly display = computed(() => secretDisplay(this.secretState()));

  readonly blockState = computed<WebhookSecretBlockState>(() => {
    const slot = this.status.jsm();
    if (slot.state === 'idle' || slot.state === 'loading') return 'loading';
    if (slot.state === 'error') return 'error';
    return webhookSecretBlockView({
      connectionConfigured: slot.data?.configured ?? false,
      secretConfigured: slot.data?.webhook_secret_configured ?? false,
      notFound: this.notFound(),
    });
  });

  readonly slotErrorMessage = computed(() => this.status.jsm().errorMessage);

  constructor() {
    // Si el estado de la conexion cambia (por ejemplo, tras guardarla), un 404
    // anterior ya no vale
    effect(() => {
      this.status.jsm();
      untracked(() => this.notFound.set(false));
    });

    // Con el secreto ya generado se pide su version enmascarada para mostrarla
    effect(() => {
      if (this.blockState() === 'has-secret') {
        untracked(() => this.load());
      }
    });

    this.destroyRef.onDestroy(() => this.apply({ type: 'destroy' }));
  }

  load(): void {
    this.errorMessage.set(null);
    this.apply({ type: 'request', action: 'load' });
  }

  // Solo el valor completo (recien regenerado) se puede copiar
  copy(): void {
    const { canCopy, text } = this.display();
    if (!canCopy) return;
    this.errorMessage.set(null);
    this.copyToClipboard(text);
  }

  // Regenerar cuando ya hay uno: pide confirmacion, porque el anterior deja de
  // valer al instante.
  openRegenerateDialog(): void {
    if (this.pending() !== null) return;

    this.dialog
      .open<RegenerateSecretDialogComponent, void, RegenerateSecretDialogResult>(RegenerateSecretDialogComponent, {
        width: '440px',
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (confirmed === true) this.regenerate();
      });
  }

  // Generar el primero (sin confirmacion) o regenerar (despues de confirmar)
  regenerate(): void {
    this.errorMessage.set(null);
    this.regeneratedNote.set(false);
    this.apply({ type: 'request', action: 'regenerate' });
  }

  retryStatus(): void {
    this.status.retry('jsm');
  }

  private apply(event: SecretEvent): void {
    const transition = reduceSecret(this.secretState(), event);
    this.secretState.set(transition.state);

    if (transition.fetch !== null) this.fetchSecret(transition.fetch);
  }

  private copyToClipboard(text: string): void {
    if (this.clipboard.copy(text)) {
      this.snackBar.open(COPIED_MESSAGE, undefined, { duration: SNACKBAR_MS });
    } else {
      this.errorMessage.set(COPY_FAILED_MESSAGE);
    }
  }

  private fetchSecret(action: SecretAction): void {
    const hadSecret = this.blockState() === 'has-secret';
    const request$ = action === 'regenerate' ? this.configService.regenerateWebhookSecret() : this.configService.getWebhookSecret();

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (secret) => {
        this.apply({ type: 'received', action, secret });
        this.notFound.set(false);
        if (action === 'regenerate') this.afterRegenerate(hadSecret);
      },
      error: (error: unknown) => {
        this.apply({ type: 'failed', action });
        const result = webhookSecretError(error, action, hadSecret);
        if (result.kind === 'not-configured') {
          this.notFound.set(true);
        } else {
          this.errorMessage.set(result.message);
        }
      },
    });
  }

  private afterRegenerate(hadSecret: boolean): void {
    if (hadSecret) {
      this.regeneratedNote.set(true);
    } else {
      this.snackBar.open(GENERATED_MESSAGE, 'Cerrar', { duration: SNACKBAR_MS * 2 });
    }

    // Ahora hay secreto: se refleja en el estado compartido de la conexion
    const data = this.status.jsm().data;
    if (data && !data.webhook_secret_configured) {
      this.status.setJsmConnected({ ...data, webhook_secret_configured: true });
    }
  }
}
