import { Controller, Get, Param } from '@nestjs/common';
import { BusinessIdentifierParamDto } from '../common/dto/params.dto';
import { BusinessService } from './business.service';
import { BusinessResponseDto } from './dto/business.response';

@Controller('businesses')
export class BusinessController {
  constructor(private readonly service: BusinessService) {}

  /** `:slug` also accepts the canonical name or a public alias, e.g. /businesses/VSA. */
  @Get(':slug')
  get(@Param() params: BusinessIdentifierParamDto): Promise<BusinessResponseDto> {
    return this.service.get(params.slug);
  }
}
