import { IsOptional } from 'class-validator';
import { IsCalendarDate } from '../../common/dto/validators';

export class EnrollmentQueryDto {
  /** Calendar date "YYYY-MM-DD"; defaults to today (UTC). */
  @IsOptional()
  @IsCalendarDate()
  date?: string;
}
