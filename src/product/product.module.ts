import { Module } from '@nestjs/common';
import { BusinessModule } from '../business/business.module';
import { ProductController } from './product.controller';
import { ProductRepository } from './product.repository';
import { ProductService } from './product.service';

@Module({
  imports: [BusinessModule],
  controllers: [ProductController],
  providers: [ProductRepository, ProductService],
  exports: [ProductService, ProductRepository],
})
export class ProductModule {}
