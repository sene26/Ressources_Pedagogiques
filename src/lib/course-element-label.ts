/** Libellé d'un EC avec sa formation et son semestre, ex. « Optimisation linéaire — M-MIO · S1 ». */
export function courseElementLabel(ec: {
  title: string;
  teachingUnit: { semester: { number: number; program: { code: string } } };
}): string {
  return `${ec.title} — ${ec.teachingUnit.semester.program.code} · S${ec.teachingUnit.semester.number}`;
}
