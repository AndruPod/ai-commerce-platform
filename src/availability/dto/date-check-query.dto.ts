import { IsDefined, IsOptional } from 'class-validator';
import { IsCalendarDate, IsIanaTimezone } from '../../common/dto/validators';

export class DateCheckQueryDto {
  @IsDefined({ message: 'date is required (YYYY-MM-DD)' })
  @IsCalendarDate()
  date: string;

  @IsOptional()
  @IsIanaTimezone()
  tz?: string;
}
