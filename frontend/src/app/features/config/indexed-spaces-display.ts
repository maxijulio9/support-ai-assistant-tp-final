import { formatIndexingTimestamp } from './indexing-status-display';

// Mismas cadenas que ya usa project-spaces.component.html para country_code
// y language_code nulos, para no inventar un texto distinto para el mismo
// caso en otra pantalla.
export function indexedSpaceCountryLabel(countryCode: string | null): string {
  return countryCode ?? 'Sin país';
}

export function indexedSpaceLanguageLabel(languageCode: string | null): string {
  return languageCode ?? 'Sin idioma';
}

export function indexedSpaceDescriptionLabel(description: string | null): string {
  return description ?? 'Sin descripción';
}

// last_updated_at es null si el espacio nunca se indexo (documents y chunks
// vienen en 0 en ese caso, un dato valido, no "sin datos").
export function indexedSpaceLastUpdatedLabel(lastUpdatedAt: string | null): string {
  return lastUpdatedAt === null ? 'Nunca' : formatIndexingTimestamp(lastUpdatedAt);
}
