import { Module } from '@nestjs/common';
import { ProductModule } from '../product/product.module';
import { ScheduleController } from './schedule.controller';
import { ScheduleRepository } from './schedule.repository';
import { ScheduleService } from './schedule.service';

@Module({
  imports: [ProductModule],
  controllers: [ScheduleController],
  providers: [ScheduleRepository, ScheduleService],
  exports: [ScheduleService],
})
export class ScheduleModule {}
