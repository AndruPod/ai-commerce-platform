import type { ProductType } from '../../common/enums';
import type { EnrollmentViewDto } from '../../enrollment/dto/enrollment.response';
import type { Occurrence, RequestedDateResult } from '../../schedule/domain/evaluate-date';
import type { ScheduleResponseDto } from '../../schedule/dto/schedule.response';
import type { Limitation } from '../domain/limitations';

/**
 * Deliberately has no single "available" boolean: enrollment and class
 * scheduling are separate answers.
 */
export interface DateCheckResponseDto {
  product: { slug: string; name: string; productType: ProductType; business: { slug: string; canonicalName: string } };
  enrollment: EnrollmentViewDto;
  requestedDate: RequestedDateResult | null;
  schedule: Pick<ScheduleResponseDto, 'recurrence' | 'exceptions' | 'computation'> | null;
  nextCandidateOccurrences: Occurrence[];
  limitations: Limitation[];
}
