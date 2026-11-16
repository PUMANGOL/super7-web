import { useQuery } from '@tanstack/react-query';
import { fetchSchoolClasses } from '../api/schoolClasses';

export function useSchoolClasses(educationLevelId: string) {
  return useQuery({
    queryKey: ['school-classes', educationLevelId],
    queryFn: () => fetchSchoolClasses(educationLevelId),
    enabled: Boolean(educationLevelId),
  });
}
