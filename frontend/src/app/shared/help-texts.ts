// Textos de ayuda de los graficos (popup del icono de informacion). Cada uno
// tiene un titulo corto, que es el del grafico, y un texto en una o varias
// frases.
export interface HelpText {
  title: string;
  text: string;
}

// Tarjetas de Metricas, Resumen
export const KPI_HELP = {
  autoPublish: {
    title: 'Resolución automática',
    text: 'Porcentaje de solicitudes que el sistema resolvió solo, sin intervención de una persona. La línea muestra el valor de cada día; los días sin solicitudes no tienen punto. Con pocas solicitudes en un día, el porcentaje de ese día puede variar mucho: el detalle aparece al pasar el mouse sobre cada punto. El cambio contra el período anterior se expresa en puntos porcentuales (pp): pasar de 20 % a 25 % es +5 pp.',
  },
  escalate: {
    title: 'Escalamiento',
    text: 'Porcentaje de solicitudes que el sistema derivó a una persona. Un valor más bajo es mejor. La línea muestra el valor de cada día; los días sin solicitudes no tienen punto. El cambio contra el período anterior se expresa en puntos porcentuales (pp).',
  },
  total: {
    title: 'Total de solicitudes',
    text: 'Cantidad de solicitudes recibidas en el período elegido. La línea muestra cuántas llegaron cada día. El cambio contra el período anterior se expresa en porcentaje.',
  },
  confidence: {
    title: 'Confianza media',
    text: 'Promedio de la confianza (de 0 a 1) con la que el sistema evaluó sus respuestas. Cuanto más alta, más seguro estaba. La línea muestra el promedio de cada día; los días sin solicitudes no tienen punto. El cambio contra el período anterior es la diferencia entre promedios.',
  },
} satisfies Record<string, HelpText>;

// Resto de los graficos con titulo en Metricas
export const METRICS_CHART_HELP = {
  categories: {
    title: 'Solicitudes por categoría',
    text: 'Cantidad de solicitudes del período agrupadas por categoría, de la que más tiene a la que menos. El porcentaje es la parte que cada categoría representa del total. Con el interruptor podés verlas como tabla.',
  },
  dailyDecisions: {
    title: 'Solicitudes por día y decisión',
    text: 'Cuántas solicitudes llegaron cada día, apiladas según la decisión que tomó el sistema. Al pasar el mouse sobre una barra ves el detalle de ese día.',
  },
  heatmap: {
    title: 'Mapa de calor de actividad',
    text: 'Cuántas solicitudes llegaron según el día de la semana y la hora. Cuanto más intenso el color, más solicitudes. Sirve para ver en qué momentos hay más carga.',
  },
  decisionShare: {
    title: 'Distribución de decisiones',
    text: 'Qué parte del total corresponde a cada decisión del sistema. Los tramos muy angostos no muestran el porcentaje adentro: lo encontrás en la leyenda de abajo.',
  },
  confidenceDistribution: {
    title: 'Distribución de confianza',
    text: 'Cuántas solicitudes cayeron en cada intervalo de confianza, de 0 a 1. Las líneas de referencia marcan los umbrales vigentes para publicar automáticamente y para pedir revisión. Las solicitudes sin puntaje no se incluyen.',
  },
  confidenceByCategory: {
    title: 'Confianza media por categoría',
    text: 'Promedio de confianza de las solicitudes de cada categoría, de 0 a 1. Una barra más larga indica que, en promedio, el sistema estaba más seguro de sus respuestas en esa categoría.',
  },
  firstResponse: {
    title: 'Primera respuesta por tipo de atención',
    text: 'Cuánto tarda en llegar la primera respuesta pública a un ticket, según el tipo de atención: automática, con revisión o atención manual previa. Se muestra la mediana, que no se deja llevar por unos pocos casos extremos.',
  },
  categoryComparison: {
    title: 'Comparativa por categoría',
    text: 'Compara, categoría por categoría, el tiempo de primera respuesta de la atención automática con el de la atención manual previa. Con pocos tickets no se calcula el tiempo.',
  },
  firstResponseTrend: {
    title: 'Evolución de la primera respuesta',
    text: 'Cómo cambió el tiempo de primera respuesta a lo largo del período. La mediana muestra el caso típico y el P90 el límite que cumplen nueve de cada diez tickets.',
  },
  reviewOutcomes: {
    title: 'Cómo terminaron los tickets con revisión',
    text: 'Resultado de los tickets en que el sistema sugirió una respuesta y una persona resolvió: aprobada, editada, regenerada, escalada, descartada o resuelta por fuera del sistema. Junto a cada resultado figura la mediana de primera respuesta.',
  },
  nonResolvingResponses: {
    title: 'Respuestas que no resuelven el ticket',
    text: 'Tiempos de los avisos que el sistema envía sin resolver: el acuse de recibo y el pedido de más información. No se comparan con la atención manual porque no son una respuesta que resuelve.',
  },
} satisfies Record<string, HelpText>;

// Graficos de Inicio
export const DASHBOARD_CHART_HELP = {
  autoPublishEvolution: {
    title: 'Evolución de la resolución automática',
    text: 'Solicitudes de cada día y cuántas resolvió el sistema solo, sin intervención de una persona. Los días sin solicitudes quedan en blanco. Podés alternar entre los últimos 7 y 30 días.',
  },
  decisions: {
    title: 'Distribución de decisiones',
    text: 'Cómo se reparten las solicitudes del período según la decisión del sistema: publicada, pendiente de revisión, escalada u otra. Al pasar el mouse sobre una porción ves su cantidad.',
  },
  categories: {
    title: 'Solicitudes por categoría',
    text: 'Las categorías con más solicitudes del período, de mayor a menor. La barra y el porcentaje muestran qué parte del total representa cada una.',
  },
} satisfies Record<string, HelpText>;
