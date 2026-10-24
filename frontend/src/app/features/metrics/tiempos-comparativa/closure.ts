import { cohortLabel } from './response-times-format';
import { CohortResponseTimes } from '../../../api/models/cohort-response-times';
import { StatsView } from './stats-view';

const LAST_CUSTOMER_COMMENT = 'last_customer_comment';
const DETECTED_CONFIRMATION = 'detected_confirmation';

const NOT_COMPARABLE = 'Los valores no son estrictamente comparables.';

// Frase del cierre de una cohorte segun como se mide, para ponerla pegada a
// sus cifras. La base viene del contrato en cada cohorte; una base que no se
// conoce no lleva texto.
export function closureBasisText(basis: string): string {
  if (basis === LAST_CUSTOMER_COMMENT) {
    return 'El cierre es el último comentario del cliente según JSM. No es estrictamente comparable con el de otra atención.';
  }
  if (basis === DETECTED_CONFIRMATION) {
    return 'El cierre es la confirmación detectada, que incluye unos 30 s de espera. No es estrictamente comparable con el de otra atención.';
  }
  return '';
}

// Aclaracion de toda la seccion de cierre. Arma una frase por cada forma de
// medirlo que hay en las cohortes y, si hay mas de una, avisa que no son
// estrictamente comparables.
export function closureNote(cohorts: CohortResponseTimes[]): string {
  const sentences: string[] = [];

  const customerLabels = cohorts.filter((cohort) => cohort.closure_basis === LAST_CUSTOMER_COMMENT).map((cohort) => cohortLabel(cohort.cohort));
  if (customerLabels.length > 0) {
    const subject = customerLabels.map((label) => `«${label}»`).join(', ');
    sentences.push(`En ${subject} el cierre es el último comentario del cliente según JSM.`);
  }

  if (cohorts.some((cohort) => cohort.closure_basis === DETECTED_CONFIRMATION)) {
    sentences.push(
      sentences.length > 0
        ? 'En el sistema es la confirmación detectada, que incluye unos 30 s de espera.'
        : 'En el sistema el cierre es la confirmación detectada, que incluye unos 30 s de espera.',
    );
  }

  if (sentences.length > 1) sentences.push(NOT_COMPARABLE);
  return sentences.join(' ');
}

// Texto de una celda de cierre sin cifras. Sin cierres no es lo mismo que sin
// tickets: puede haber tickets que todavia no se cerraron.
export function closurePlaceholder(view: StatsView, ticketsOnSide: number): string | null {
  if (view.state === 'insufficient') return 'n insuficiente';
  if (view.state === 'empty') return ticketsOnSide > 0 ? 'Sin cierres' : 'Sin tickets';
  return null;
}
