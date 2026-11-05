import { IsOptional } from 'class-validator';
import { IsCalendarDate, IsIanaTimezone } from '../../common/dto/validators';

export class ScheduleQueryDto {
  /** Calendar date "YYYY-MM-DD" to evaluate against the recurrence. */
  @IsOptional()
  @IsCalendarDate()
  date?: string;

  /** Caller's IANA timezone used to interpret `date`; defaults to the schedule's canonical timezone. */
  @IsOptional()
  @IsIanaTimezone()
  tz?: string;
}
