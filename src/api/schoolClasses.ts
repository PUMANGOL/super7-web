import { apiClient, unwrap } from './client';
import type { ApiResponse, SchoolClass } from '../types/api';

export async function fetchSchoolClasses(educationLevelId: string): Promise<SchoolClass[]> {
  const { data } = await apiClient.get<ApiResponse<SchoolClass[]>>('/school-class', {
    params: { educationLevelId },
  });
  const classes = unwrap(data) ?? [];
  return [...classes].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}
