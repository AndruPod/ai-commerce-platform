import type { EnrollmentViewDto } from '../../enrollment/dto/enrollment.response';
import type { ScheduleResponseDto } from '../../schedule/dto/schedule.response';

export type LimitationCode =
  | 'ENROLLMENT_AND_SCHEDULE_ARE_INDEPENDENT'
  | 'ENROLLMENT_STATUS_UNKNOWN'
  | 'ENROLLMENT_STATUS_UNCONFIRMED'
  | 'NO_SCHEDULE_CONFIGURED'
  | 'SCHEDULE_NOT_COMPUTABLE'
  | 'SCHEDULE_EXCEPTIONS_NOT_PROVIDED'
  | 'SCHEDULE_EXCEPTIONS_PARTIALLY_CONFIRMED'
  | 'SCHEDULE_TIMEZONE_ASSUMED';

export interface Limitation {
  code: LimitationCode;
  message: string;
}

type ScheduleView = Omit<ScheduleResponseDto, 'product'>;

/**
 * Lists what an assistant must NOT overstate when answering a date question.
 * Derived only from the separately computed enrollment and schedule views.
 */
export function buildDateCheckLimitations(enrollment: EnrollmentViewDto, schedule: ScheduleView | null): Limitation[] {
  const out: Limitation[] = [
    {
      code: 'ENROLLMENT_AND_SCHEDULE_ARE_INDEPENDENT',
      message: 'Enrollment status and class dates are evaluated independently. Being able to enroll on a date does not mean a class occurs on that date.',
    },
  ];

  if (enrollment.status === 'UNKNOWN') {
    out.push({ code: 'ENROLLMENT_STATUS_UNKNOWN', message: 'Enrollment availability for this date is unknown.' });
  } else if (enrollment.provenance && enrollment.provenance.verificationStatus !== 'CONFIRMED') {
    const p = enrollment.provenance;
    out.push({
      code: 'ENROLLMENT_STATUS_UNCONFIRMED',
      message: `Enrollment status ${enrollment.status} comes from ${p.sourceType ?? 'an unknown source'} and is ${p.verificationStatus}${p.sourceRef ? `: ${p.sourceRef}` : ''}.`,
    });
  }

  if (!schedule) {
    out.push({ code: 'NO_SCHEDULE_CONFIGURED', message: 'No class schedule is configured for this product.' });
    return out;
  }
  if (!schedule.computation.computable) {
    out.push({ code: 'SCHEDULE_NOT_COMPUTABLE', message: `Class occurrences cannot be computed: ${schedule.computation.notComputableReason}.` });
  }

  const k = schedule.exceptions.knowledge;
  if (k.status === 'NOT_PROVIDED') {
    out.push({
      code: 'SCHEDULE_EXCEPTIONS_NOT_PROVIDED',
      message: 'No schedule-exception data has been provided, so no class date can be stated as definitely taking place.',
    });
  } else if (schedule.nextCandidateOccurrences.some((o) => o.status === 'CANDIDATE_UNCONFIRMED')) {
    out.push({
      code: 'SCHEDULE_EXCEPTIONS_PARTIALLY_CONFIRMED',
      message: `Schedule exceptions are confirmed only through ${k.confirmedThrough}; later candidate dates are unconfirmed.`,
    });
  }

  const tz = schedule.recurrence.canonicalTimezone;
  if (tz.provenance.verificationStatus !== 'CONFIRMED') {
    out.push({
      code: 'SCHEDULE_TIMEZONE_ASSUMED',
      message: `The canonical schedule timezone ${tz.value ?? '(unknown)'} is ${tz.provenance.verificationStatus}${tz.provenance.sourceRef ? `: ${tz.provenance.sourceRef}` : ''}.`,
    });
  }
  return out;
}
