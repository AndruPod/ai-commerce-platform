import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProductSlugParamDto } from '../common/dto/params.dto';
import { ScheduleQueryDto } from './dto/schedule-query.dto';
import { ScheduleResponseDto } from './dto/schedule.response';
import { ScheduleService } from './schedule.service';

@Controller('products')
export class ScheduleController {
  constructor(private readonly service: ScheduleService) {}

  @Get(':slug/schedule')
  get(@Param() params: ProductSlugParamDto, @Query() query: ScheduleQueryDto): Promise<ScheduleResponseDto> {
    return this.service.getForSlug(params.slug, { date: query.date, tz: query.tz });
  }
}
