import { Module } from '@nestjs/common';
import { ProductModule } from '../product/product.module';
import { EnrollmentController } from './enrollment.controller';
import { EnrollmentRepository } from './enrollment.repository';
import { EnrollmentService } from './enrollment.service';

@Module({
  imports: [ProductModule],
  controllers: [EnrollmentController],
  providers: [EnrollmentRepository, EnrollmentService],
  exports: [EnrollmentService],
})
export class EnrollmentModule {}
