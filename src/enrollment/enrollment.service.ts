import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, Clock, utcDate } from '../common/clock';
import { toProvenance } from '../common/provenance/provenance';
import { ProductService } from '../product/product.service';
import { AvailabilityResolution, AvailabilityWindow, resolveAvailability } from './domain/resolve-availability';
import { EnrollmentResponseDto, EnrollmentViewDto } from './dto/enrollment.response';
import { EnrollmentRepository, EnrollmentRow } from './enrollment.repository';

export const ENROLLMENT_INDEPENDENT_OF = ['classSchedule', 'scheduleExceptions', 'accessPeriod', 'checkoutLink', 'promotionalDates'];

@Injectable()
export class EnrollmentService {
  constructor(
    private readonly repo: EnrollmentRepository,
    private readonly products: ProductService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async getForSlug(slug: string, date?: string): Promise<EnrollmentResponseDto> {
    const ctx = await this.products.getContextOrThrow(slug);
    return { product: { slug: ctx.product.slug, name: ctx.product.name }, ...(await this.getForProduct(ctx.product.id, date)) };
  }

  /** Reads only enrollment configuration; never schedule, checkout or promotional data. */
  async getForProduct(productId: string, date?: string): Promise<EnrollmentViewDto> {
    const rows = await this.repo.findByProductId(productId);
    return buildEnrollmentView(rows, date, this.clock.now());
  }
}

export function toWindow(r: EnrollmentRow): AvailabilityWindow {
  return {
    status: r.status,
    effectiveFrom: r.effectiveFrom,
    effectiveUntil: r.effectiveUntil,
    notes: r.notes,
    provenance: toProvenance(r),
    configuredAt: r.createdAt.toISOString(),
  };
}

/** Pure mapping (exported for tests). */
export function buildEnrollmentView(rows: EnrollmentRow[], date: string | undefined, now: Date): EnrollmentViewDto {
  const today = utcDate(now);
  const res = resolveAvailability(rows.map(toWindow), date ?? today, today);
  const w = res.window;
  return {
    status: res.status,
    evaluatedForDate: res.evaluatedForDate,
    evaluatedAt: now.toISOString(),
    basis: res.basis,
    basisNote: basisNote(res),
    window: w
      ? {
          kind: w.effectiveFrom === null ? (w.effectiveUntil === null ? 'OPEN_ENDED' : 'ENDS_ON') : w.effectiveUntil === null ? 'STARTS_ON' : 'BOUNDED',
          effectiveFrom: w.effectiveFrom,
          effectiveUntil: w.effectiveUntil,
          notes: w.notes,
          configuredAt: w.configuredAt,
        }
      : null,
    provenance: w?.provenance ?? null,
    independentOf: ENROLLMENT_INDEPENDENT_OF,
  };
}

function basisNote(res: AvailabilityResolution): string {
  switch (res.basis) {
    case 'NO_CONFIGURATION':
      return 'No enrollment availability has been configured for this date, so the status is UNKNOWN.';
    case 'PAST_DATE':
      return 'The date is in the past; the status reflects currently stored configuration, which is not a full history.';
    case 'CURRENT_CONFIGURATION': {
      const p = res.window!.provenance;
      return `Reflects the enrollment configuration as it stands now (source: ${p.sourceType ?? 'unknown'}, verification: ${p.verificationStatus}). No change has been configured for this date.`;
    }
  }
}
