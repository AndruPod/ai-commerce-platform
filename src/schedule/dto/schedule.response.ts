import type { ScheduleExceptionType, Weekday } from '../../common/enums';
import type { Fact, Provenance } from '../../common/provenance/provenance';
import type { ExceptionsKnowledge, Occurrence, RequestedDateResult } from '../domain/evaluate-date';

export interface RecurrenceDto {
  frequency: 'WEEKLY';
  weekday: Weekday;
  isoWeekday: number;
  localStartTime: string | null;
  durationMinutes: number;
  provenance: Provenance;
  canonicalTimezone: Fact<string>;
  publishedTimeLabels: { labels: string[]; note: string };
}

export interface ScheduleExceptionsDto {
  knowledge: ExceptionsKnowledge & { provenance: Provenance };
  items: {
    type: ScheduleExceptionType;
    originalDate: string | null;
    replacementDate: string | null;
    replacementStartTime: string | null;
    reason: string | null;
    provenance: Provenance;
  }[];
  note: string;
}

export interface ScheduleComputationDto {
  computable: boolean;
  notComputableReason: string | null;
  referenceTimezone: string | null;
}

export interface ScheduleResponseDto {
  product: { slug: string; name: string };
  recurrence: RecurrenceDto;
  exceptions: ScheduleExceptionsDto;
  requestedDate: RequestedDateResult | null;
  nextCandidateOccurrences: Occurrence[];
  computation: ScheduleComputationDto;
}
