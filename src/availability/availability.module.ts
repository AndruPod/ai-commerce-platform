import { Module } from '@nestjs/common';
import { EnrollmentModule } from '../enrollment/enrollment.module';
import { ProductModule } from '../product/product.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { DateCheckController } from './date-check.controller';
import { DateCheckService } from './date-check.service';

@Module({
  imports: [ProductModule, EnrollmentModule, ScheduleModule],
  controllers: [DateCheckController],
  providers: [DateCheckService],
  exports: [DateCheckService],
})
export class AvailabilityModule {}
