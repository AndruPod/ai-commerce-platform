import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CLOCK, Clock } from '../common/clock';
import { fact, pickProvenance, toProvenance } from '../common/provenance/provenance';
import { ProductService } from '../product/product.service';
import { REFERENCE_DISPLAY_TIMEZONES } from './display-timezones';
import { evaluateDate, ExceptionsKnowledge, weekdayName } from './domain/evaluate-date';
import { ScheduleExceptionsDto, ScheduleResponseDto } from './dto/schedule.response';
import { ScheduleExceptionRow, ScheduleRepository, ScheduleRow } from './schedule.repository';

export interface ScheduleOptions {
  date?: string;
  tz?: string;
  count?: number;
}

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

@Injectable()
export class ScheduleService {
  constructor(
    private readonly repo: ScheduleRepository,
    private readonly products: ProductService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async getForSlug(slug: string, opts: ScheduleOptions): Promise<ScheduleResponseDto> {
    const ctx = await this.products.getContextOrThrow(slug);
    const view = await this.getForProduct(ctx.product.id, opts);
    if (!view) throw new NotFoundException(`No schedule is configured for product "${slug}"`);
    return { product: { slug: ctx.product.slug, name: ctx.product.name }, ...view };
  }

  /** Returns null when the product has no schedule. Never consults enrollment or checkout. */
  async getForProduct(productId: string, opts: ScheduleOptions): Promise<Omit<ScheduleResponseDto, 'product'> | null> {
    const found = await this.repo.findByProductId(productId);
    if (!found) return null;
    return buildScheduleView(found.schedule, found.exceptions, opts, this.clock.now());
  }
}

/** Pure mapping from stored schedule rows to the schedule view (exported for tests). */
export function buildScheduleView(
  s: ScheduleRow,
  exceptions: ScheduleExceptionRow[],
  opts: ScheduleOptions,
  now: Date,
): Omit<ScheduleResponseDto, 'product'> {
  const evaluation = evaluateDate({
    rule: {
      frequency: s.frequency,
      isoWeekday: s.isoWeekday,
      localStartTime: s.localStartTime,
      durationMinutes: s.durationMinutes,
      timezone: s.timezone,
    },
    exceptions: exceptions.map((e) => ({
      type: e.type,
      originalDate: e.originalDate,
      replacementDate: e.replacementDate,
      replacementStartTime: e.replacementStartTime,
      reason: e.reason,
      verificationStatus: e.verificationStatus,
    })),
    exceptionsConfirmedThrough: s.exceptionsConfirmedThrough,
    requestedDate: opts.date ?? null,
    viewerTimezone: opts.tz ?? null,
    displayTimezones: REFERENCE_DISPLAY_TIMEZONES,
    count: opts.count ?? 3,
    now,
  });

  return {
    recurrence: {
      frequency: s.frequency,
      weekday: weekdayName(s.isoWeekday),
      isoWeekday: s.isoWeekday,
      localStartTime: hhmm(s.localStartTime),
      durationMinutes: s.durationMinutes,
      provenance: toProvenance(s),
      canonicalTimezone: fact(s.timezone, pickProvenance(s, 'tz')),
      publishedTimeLabels: {
        labels: s.publishedTimeLabels,
        note: 'Published labels are source evidence only. Local times are computed per date from the canonical IANA timezone and can differ from these labels around daylight-saving transitions.',
      },
    },
    exceptions: {
      knowledge: { ...evaluation.exceptionsKnowledge, provenance: pickProvenance(s, 'exceptions') },
      items: exceptions.map((e) => ({
        type: e.type,
        originalDate: e.originalDate,
        replacementDate: e.replacementDate,
        replacementStartTime: hhmm(e.replacementStartTime),
        reason: e.reason,
        provenance: toProvenance(e),
      })),
      note: exceptionsNote(evaluation.exceptionsKnowledge, exceptions.length),
    },
    requestedDate: evaluation.requestedDate,
    nextCandidateOccurrences: evaluation.nextCandidateOccurrences,
    computation: evaluation.computable
      ? { computable: true, notComputableReason: null, referenceTimezone: evaluation.referenceTimezone }
      : { computable: false, notComputableReason: evaluation.notComputableReason, referenceTimezone: null },
  };
}

function exceptionsNote(k: ExceptionsKnowledge, count: number): ScheduleExceptionsDto['note'] {
  if (k.status === 'CONFIRMED_THROUGH') {
    return `The exception list is confirmed complete through ${k.confirmedThrough}. Dates after that may have exceptions that have not been provided.`;
  }
  return count === 0
    ? 'No schedule exceptions have been provided to this prototype. This does NOT mean there are no exceptions (holidays, breaks or cancellations may exist but are unknown).'
    : 'Only the listed exceptions have been provided; the list is not known to be complete.';
}
