import { Controller, Get, Param } from '@nestjs/common';
import { ProductSlugParamDto } from '../common/dto/params.dto';
import { DataQualityService } from './data-quality.service';
import { DataQualityResponseDto } from './dto/data-quality.response';

@Controller('products')
export class DataQualityController {
  constructor(private readonly service: DataQualityService) {}

  @Get(':slug/data-quality')
  get(@Param() params: ProductSlugParamDto): Promise<DataQualityResponseDto> {
    return this.service.getForSlug(params.slug);
  }
}
