import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProductSlugParamDto } from '../common/dto/params.dto';
import { EnrollmentQueryDto } from './dto/enrollment-query.dto';
import { EnrollmentResponseDto } from './dto/enrollment.response';
import { EnrollmentService } from './enrollment.service';

@Controller('products')
export class EnrollmentController {
  constructor(private readonly service: EnrollmentService) {}

  @Get(':slug/enrollment')
  get(@Param() params: ProductSlugParamDto, @Query() query: EnrollmentQueryDto): Promise<EnrollmentResponseDto> {
    return this.service.getForSlug(params.slug, query.date);
  }
}
