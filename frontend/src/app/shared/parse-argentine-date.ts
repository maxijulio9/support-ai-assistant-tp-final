const DAY_FIRST = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/;
const YEAR_FIRST = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

function buildDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day);
  // Rechaza fechas que Date "arreglaria", como el 30 de febrero
  const isReal = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return isReal ? date : null;
}

// Lee un dia escrito a mano: dia/mes/año ("3/11/2026", "03-11-2026") o
// AAAA-MM-DD. Date.parse lee "3/11/2026" como mes/dia (formato de Estados
// Unidos), asi que el 3 de noviembre quedaria como el 11 de marzo. Devuelve
// null si no es un dia calendario real.
export function parseArgentineDate(value: string): Date | null {
  const text = value.trim();
  const dayFirst = DAY_FIRST.exec(text);
  if (dayFirst) return buildDate(Number(dayFirst[3]), Number(dayFirst[2]), Number(dayFirst[1]));
  const yearFirst = YEAR_FIRST.exec(text);
  if (yearFirst) return buildDate(Number(yearFirst[1]), Number(yearFirst[2]), Number(yearFirst[3]));
  return null;
}
