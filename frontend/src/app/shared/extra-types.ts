// Tipos manuales para campos que el contrato declara como objeto generico
// (additionalProperties: true), fuera de src/app/api para que no los borre
// la regeneracion del cliente (removeStaleFiles). Formas inferidas de la
// descripcion de cada schema en openapi/openapi.json, no verificadas contra
// datos reales del backend.

// De CountriesResponse.countries
export interface Country {
  code: string;
  name: string;
}

// De AvailableProjectsResponse.projects
export interface AvailableProject {
  key: string;
  name: string;
}

// De AvailableSpacesResponse.spaces
export interface AvailableSpace {
  key: string;
  name: string;
}

// De ProjectStatusesResponse.statuses
export interface ProjectStatus {
  id: string;
  name: string;
}

// De SelectFieldsResponse.fields
export interface SelectField {
  id: string;
  name: string;
}

// De PrioritiesWithSuggestionResponse.priorities
export interface PriorityItem {
  id: string;
  name: string;
}

// De PrioritiesWithSuggestionResponse.suggestions: mapeo de nombre de
// prioridad real a un nivel universal (Highest, High, Medium, Low)
export interface PrioritySuggestions {
  [priorityName: string]: string;
}
