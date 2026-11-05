import type { EnrollmentView } from '@/lib/api/types';
import { enrollmentLabel, provenanceNote } from '@/lib/labels';
import { Badge, Card, Note } from './ui';

export function EnrollmentCard({ enrollment, businessName }: { enrollment: EnrollmentView; businessName: string }) {
  const note = enrollment.status === 'UNKNOWN' ? 'Enrollment availability is not specified.' : provenanceNote(enrollment.provenance, businessName);
  const tone = enrollment.status === 'OPEN' ? 'ok' : enrollment.status === 'CLOSED' ? 'neutral' : 'info';
  return (
    <Card title="Enrollment" aside={<Badge tone={tone}>{enrollmentLabel(enrollment.status)}{note ? '*' : ''}</Badge>}>
      <p className="text-base font-semibold text-slate-900">
        {enrollmentLabel(enrollment.status)}
        {note ? '*' : ''}
      </p>
      {note && <Note>* {note}</Note>}
      <Note>Enrollment availability is shown separately from class dates and payment.</Note>
    </Card>
  );
}
