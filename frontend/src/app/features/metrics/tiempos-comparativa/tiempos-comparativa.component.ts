import { ChangeDetectionStrategy, Component } from '@angular/core';

// Pestaña sin datos del backend: ni timestamps de primera respuesta ni de
// resolucion, ni conteo por canal. Por eso no inyecta ningun servicio ni
// hace pedidos HTTP, solo estructura.
@Component({
  selector: 'app-metrics-tiempos-comparativa',
  standalone: true,
  templateUrl: './tiempos-comparativa.component.html',
  styleUrl: './tiempos-comparativa.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TiemposComparativaComponent {
  readonly comparisonRows = ['Tiempo medio de resolución', 'Volumen de la cohorte'];
}
