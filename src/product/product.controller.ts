import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProductSlugParamDto } from '../common/dto/params.dto';
import { ProductListQueryDto } from './dto/product-query.dto';
import { ProductDetailDto, ProductListResponseDto } from './dto/product.response';
import { ProductService } from './product.service';

@Controller('products')
export class ProductController {
  constructor(private readonly service: ProductService) {}

  @Get()
  list(@Query() query: ProductListQueryDto): Promise<ProductListResponseDto> {
    return this.service.list(query);
  }

  @Get(':slug')
  detail(@Param() params: ProductSlugParamDto): Promise<ProductDetailDto> {
    return this.service.detail(params.slug);
  }
}
