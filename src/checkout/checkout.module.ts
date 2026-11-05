import { Module } from '@nestjs/common';
import { ProductModule } from '../product/product.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutRepository } from './checkout.repository';
import { CheckoutService } from './checkout.service';

@Module({
  imports: [ProductModule],
  controllers: [CheckoutController],
  providers: [CheckoutRepository, CheckoutService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
