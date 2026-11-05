import { Module } from '@nestjs/common';
import { ProductModule } from '../product/product.module';
import { DataQualityController } from './data-quality.controller';
import { DataQualityRepository } from './data-quality.repository';
import { DataQualityService } from './data-quality.service';

@Module({
  imports: [ProductModule],
  controllers: [DataQualityController],
  providers: [DataQualityRepository, DataQualityService],
  exports: [DataQualityService],
})
export class DataQualityModule {}
