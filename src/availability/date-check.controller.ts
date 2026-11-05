import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProductSlugParamDto } from '../common/dto/params.dto';
import { DateCheckService } from './date-check.service';
import { DateCheckQueryDto } from './dto/date-check-query.dto';
import { DateCheckResponseDto } from './dto/date-check.response';

@Controller('products')
export class DateCheckController {
  constructor(private readonly service: DateCheckService) {}

  /** "Can I join around this date, and when is the next class?" — answered as separate sections. */
  @Get(':slug/date-check')
  check(@Param() params: ProductSlugParamDto, @Query() query: DateCheckQueryDto): Promise<DateCheckResponseDto> {
    return this.service.check(params.slug, query.date, query.tz);
  }
}
