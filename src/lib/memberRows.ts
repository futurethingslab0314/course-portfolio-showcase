import { StudentWork } from '../types';

export function memberRows(work: StudentWork): Array<{ name: string; studentId?: string }> {
  return work.members.map((name, index) => ({
    name,
    studentId: work.studentIds?.[index] || undefined,
  }));
}
