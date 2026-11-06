import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, computed, inject, input, signal } from '@angular/core';
import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { MatIconModule } from '@angular/material/icon';
import { infoHintLabel } from './info-hint';

let nextInstanceId = 0;

// Separacion entre el icono y el popup: el popup nunca tapa al icono
const OFFSET = 8;

// Arriba, abajo, derecha e izquierda: el overlay prueba en este orden y se
// queda con la primera que entra en pantalla.
const POSITIONS: ConnectedPosition[] = [
  { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -OFFSET },
  { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: OFFSET },
  { originX: 'end', originY: 'center', overlayX: 'start', overlayY: 'center', offsetX: OFFSET },
  { originX: 'start', originY: 'center', overlayX: 'end', overlayY: 'center', offsetX: -OFFSET },
];

// Tiempo para que el mouse pase del icono al popup sin que se cierre
const CLOSE_DELAY_MS = 200;

// Icono de informacion con un popup de ayuda en una capa superpuesta, para que
// ningun contenedor lo recorte. Se abre con el mouse o el foco, se cierra al
// salir, con Escape o al tocar afuera; un toque o clic lo deja fijo.
@Component({
  selector: 'app-info-hint',
  standalone: true,
  imports: [OverlayModule, MatIconModule],
  templateUrl: './info-hint.component.html',
  styleUrl: './info-hint.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'close()' },
})
export class InfoHintComponent implements OnDestroy {
  readonly title = input.required<string>();
  readonly text = input.required<string>();

  readonly origin = inject(ElementRef);
  readonly positions = POSITIONS;
  readonly popupId = `info-hint-${nextInstanceId++}`;
  readonly buttonLabel = computed(() => infoHintLabel(this.title()));

  readonly open = signal(false);
  private pinned = false;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  show(): void {
    this.cancelClose();
    this.open.set(true);
  }

  // Salir del icono o del popup cierra, con una espera para poder pasar de
  // uno al otro. Si quedo fijo por un clic, solo lo cierra Escape, el foco
  // que se va o tocar afuera.
  scheduleClose(): void {
    if (this.pinned) return;
    this.cancelClose();
    this.closeTimer = setTimeout(() => this.close(), CLOSE_DELAY_MS);
  }

  // Un clic fija el popup abierto; otro clic lo cierra
  onClick(): void {
    if (this.open() && this.pinned) {
      this.close();
      return;
    }
    this.pinned = true;
    this.show();
  }

  close(): void {
    this.cancelClose();
    this.pinned = false;
    this.open.set(false);
  }

  ngOnDestroy(): void {
    this.cancelClose();
  }

  private cancelClose(): void {
    if (this.closeTimer !== null) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }
}
