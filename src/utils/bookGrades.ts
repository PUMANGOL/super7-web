export function formatBookGradeNames(grades: { name: string }[] | null | undefined): string {
  if (!grades?.length) return '—';
  return grades.map((grade) => grade.name).join(', ');
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Nomes dos níveis de ensino das classes do livro. Conforme o registo, a API devolve em
 * `educationLevelId` o ID do nível (procurado em `levelNames`) ou já o nome ("Ensino Primário").
 */
export function formatBookEducationLevels(
  grades: { educationLevelId: string }[] | null | undefined,
  levelNames: Map<string, string>,
): string {
  if (!grades?.length) return '—';

  const names = [
    ...new Set(
      grades
        .map((grade) => grade.educationLevelId?.trim() ?? '')
        .map((value) => levelNames.get(value) ?? (UUID_PATTERN.test(value) ? '' : value))
        .filter(Boolean),
    ),
  ];
  return names.length > 0 ? names.join(', ') : '—';
}
