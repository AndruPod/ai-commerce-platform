import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from './ai/ai.module';
import { AvailabilityModule } from './availability/availability.module';
import { BusinessModule } from './business/business.module';
import { CheckoutModule } from './checkout/checkout.module';
import { ClockModule } from './common/clock';
import { validateEnv } from './config/env.validation';
import { DataQualityModule } from './data-quality/data-quality.module';
import { DatabaseModule } from './database/database.module';
import { EnrollmentModule } from './enrollment/enrollment.module';
import { ProductModule } from './product/product.module';
import { ScheduleModule } from './schedule/schedule.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    DatabaseModule,
    ClockModule,
    BusinessModule,
    ProductModule,
    ScheduleModule,
    EnrollmentModule,
    CheckoutModule,
    DataQualityModule,
    AvailabilityModule,
    AiModule,
  ],
})
export class AppModule {}
