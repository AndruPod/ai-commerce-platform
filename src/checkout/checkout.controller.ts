import { Controller, Get, Param } from '@nestjs/common';
import { ProductSlugParamDto } from '../common/dto/params.dto';
import { CheckoutService } from './checkout.service';
import { CheckoutResponseDto } from './dto/checkout.response';

@Controller('products')
export class CheckoutController {
  constructor(private readonly service: CheckoutService) {}

  @Get(':slug/checkout')
  get(@Param() params: ProductSlugParamDto): Promise<CheckoutResponseDto> {
    return this.service.getForSlug(params.slug);
  }
}
