import type { SessionUser } from './types';

/**
 * Synthetic demo students for mock-SSO login (API Contract v1.1 §3.1: use
 * synthetic identities only). Offering fixed personas instead of a free form
 * means nobody types a real name, number or e-mail into the demo. Two
 * personas make the "one student cannot see another's schedule" check
 * (Acceptance Tests AC-04.8) easy to run.
 */
export interface DemoPersona extends SessionUser {
  id: string;
  label: string;
}

export const DEMO_PERSONAS: readonly DemoPersona[] = [
  {
    id: 'demo-1',
    label: 'Demo Öğrenci 1',
    studentId: 'demo-student-01',
    name: 'Demo Öğrenci 1',
    email: 'demo1@example.test',
    role: 'STUDENT',
  },
  {
    id: 'demo-2',
    label: 'Demo Öğrenci 2',
    studentId: 'demo-student-02',
    name: 'Demo Öğrenci 2',
    email: 'demo2@example.test',
    role: 'STUDENT',
  },
];

export function findPersona(id: string): DemoPersona | undefined {
  return DEMO_PERSONAS.find((persona) => persona.id === id);
}
