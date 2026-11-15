import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { InteractionDetailResponse } from '../../../api/models/interaction-detail-response';
import { ANALYSIS_TITLE, analysisRows, confidencePercent, hasAnalysis } from '../system-analysis';

// Lo que el sistema determino de la solicitud; solo las filas que tienen dato
@Component({
  selector: 'app-system-analysis',
  standalone: true,
  templateUrl: './system-analysis.component.html',
  styleUrl: './system-analysis.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SystemAnalysisComponent {
  readonly data = input.required<InteractionDetailResponse>();

  readonly title = ANALYSIS_TITLE;
  readonly visible = computed(() => hasAnalysis(this.data()));
  readonly rows = computed(() => analysisRows(this.data()));
  readonly confidence = computed(() => confidencePercent(this.data().confidence_score));
}
