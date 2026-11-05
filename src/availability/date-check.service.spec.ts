import type { Clock } from '../common/clock';
import { EnrollmentRepository, EnrollmentRow } from '../enrollment/enrollment.repository';
import { EnrollmentService } from '../enrollment/enrollment.service';
import type { ProductService } from '../product/product.service';
import { ScheduleExceptionRow, ScheduleRepository } from '../schedule/schedule.repository';
import { ScheduleService } from '../schedule/schedule.service';
import { cancelledException, enrollmentRow, scheduleRow } from '../testing/fixtures';
import { DateCheckService } from './date-check.service';

const clock: Clock = { now: () => new Date('2026-10-03T12:00:00Z') };
const productCtx = {
  product: { id: 'product-1', slug: '1-year-online-ballet-club', name: '1-Year Online Ballet Club', productType: 'GROUP_PROGRAM' },
  business: { slug: 'victory-skating-academy', canonicalName: 'Victory Skating Academy' },
  program: null,
};

function build(enrollment: EnrollmentRow[], exceptions: ScheduleExceptionRow[] = [], schedule = scheduleRow()) {
  const products = { getContextOrThrow: async () => productCtx } as unknown as ProductService;
  const enrollmentRepo = { findByProductId: async () => enrollment } as unknown as EnrollmentRepository;
  const scheduleRepo = { findByProductId: async () => ({ schedule, exceptions }) } as unknown as ScheduleRepository;
  return new DateCheckService(
    products,
    new EnrollmentService(enrollmentRepo, products, clock),
    new ScheduleService(scheduleRepo, products, clock),
  );
}

const scheduleParts = (r: Awaited<ReturnType<DateCheckService['check']>>) => ({
  requestedDate: r.requestedDate,
  schedule: r.schedule,
  nextCandidateOccurrences: r.nextCandidateOccurrences,
});

describe('DateCheckService', () => {
  it('answers the 2026-11-06 question in separate sections without a combined "available" flag', async () => {
    const r = await build([enrollmentRow()]).check('1-year-online-ballet-club', '2026-11-06');
    expect(Object.keys(r).sort()).toEqual(['enrollment', 'limitations', 'nextCandidateOccurrences', 'product', 'requestedDate', 'schedule']);
    expect(r).not.toHaveProperty('available');
    expect(r.enrollment).toMatchObject({ status: 'OPEN', provenance: { sourceType: 'PROTOTYPE_CONFIG', verificationStatus: 'UNCONFIRMED' } });
    expect(r.requestedDate).toMatchObject({ weekday: 'FRIDAY', matchesRecurrence: false });
    expect(r.nextCandidateOccurrences[0]).toMatchObject({ scheduleLocalDate: '2026-11-07', status: 'CANDIDATE_UNCONFIRMED', startsAtUtc: '2026-11-07T19:00:00Z' });
    expect(r.limitations.map((l) => l.code)).toEqual([
      'ENROLLMENT_AND_SCHEDULE_ARE_INDEPENDENT',
      'ENROLLMENT_STATUS_UNCONFIRMED',
      'SCHEDULE_EXCEPTIONS_NOT_PROVIDED',
      'SCHEDULE_TIMEZONE_ASSUMED',
    ]);
  });

  it('changing enrollment from OPEN to CLOSED does NOT change schedule results', async () => {
    const open = await build([enrollmentRow({ status: 'OPEN' })]).check('x', '2026-11-06');
    const closed = await build([enrollmentRow({ status: 'CLOSED' })]).check('x', '2026-11-06');
    expect(open.enrollment.status).toBe('OPEN');
    expect(closed.enrollment.status).toBe('CLOSED');
    expect(scheduleParts(closed)).toEqual(scheduleParts(open));
  });

  it('removing enrollment configuration entirely does NOT change schedule results', async () => {
    const none = await build([]).check('x', '2026-11-06');
    const open = await build([enrollmentRow()]).check('x', '2026-11-06');
    expect(none.enrollment.status).toBe('UNKNOWN');
    expect(scheduleParts(none)).toEqual(scheduleParts(open));
  });

  it('changing schedule exceptions or exception coverage does NOT change enrollment results', async () => {
    const base = await build([enrollmentRow()]).check('x', '2026-11-07');
    const cancelled = await build([enrollmentRow()], [cancelledException('2026-11-07')]).check('x', '2026-11-07');
    const covered = await build([enrollmentRow()], [], scheduleRow({ exceptionsConfirmedThrough: '2026-12-31' })).check('x', '2026-11-07');

    expect(cancelled.requestedDate?.occurrencesOnDate[0].status).toBe('CANCELLED');
    expect(covered.requestedDate?.occurrencesOnDate[0].status).toBe('SCHEDULED_CONFIRMED');
    expect(cancelled.enrollment).toEqual(base.enrollment);
    expect(covered.enrollment).toEqual(base.enrollment);
  });

  it('passes the viewer timezone to the schedule only', async () => {
    const r = await build([enrollmentRow()]).check('x', '2026-11-08', 'Asia/Tokyo');
    expect(r.requestedDate).toMatchObject({ interpretedInTimezone: 'Asia/Tokyo', matchesRecurrence: true });
    expect(r.enrollment.evaluatedForDate).toBe('2026-11-08');
  });
});
