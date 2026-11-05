import { Injectable } from '@nestjs/common';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { ProductService } from '../product/product.service';
import { ScheduleService } from '../schedule/schedule.service';
import { buildDateCheckLimitations } from './domain/limitations';
import { DateCheckResponseDto } from './dto/date-check.response';

/**
 * Composes two independently computed answers. Enrollment and schedule logic
 * are not merged: each service is called on its own and neither sees the
 * other's result.
 */
@Injectable()
export class DateCheckService {
  constructor(
    private readonly products: ProductService,
    private readonly enrollment: EnrollmentService,
    private readonly schedule: ScheduleService,
  ) {}

  async check(slug: string, date: string, tz?: string): Promise<DateCheckResponseDto> {
    const { product, business } = await this.products.getContextOrThrow(slug);
    const [enrollment, schedule] = await Promise.all([
      this.enrollment.getForProduct(product.id, date),
      this.schedule.getForProduct(product.id, { date, tz }),
    ]);
    return {
      product: {
        slug: product.slug,
        name: product.name,
        productType: product.productType,
        business: { slug: business.slug, canonicalName: business.canonicalName },
      },
      enrollment,
      requestedDate: schedule?.requestedDate ?? null,
      schedule: schedule ? { recurrence: schedule.recurrence, exceptions: schedule.exceptions, computation: schedule.computation } : null,
      nextCandidateOccurrences: schedule?.nextCandidateOccurrences ?? [],
      limitations: buildDateCheckLimitations(enrollment, schedule),
    };
  }
}
