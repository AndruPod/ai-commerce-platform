import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AvailabilityModule } from '../availability/availability.module';
import { CheckoutModule } from '../checkout/checkout.module';
import { DataQualityModule } from '../data-quality/data-quality.module';
import { EnrollmentModule } from '../enrollment/enrollment.module';
import { ProductModule } from '../product/product.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { AI_CONFIG, AiConfig, ChatClient, DEFAULT_MAX_TOOL_ITERATIONS, DEFAULT_OPENAI_MODEL, OPENAI_CLIENT } from './ai.config';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { CheckDateTool } from './tools/check-date.tool';
import { GetCheckoutTool } from './tools/get-checkout.tool';
import { GetEnrollmentTool } from './tools/get-enrollment.tool';
import { GetProductTool } from './tools/get-product.tool';
import { SearchProductsTool } from './tools/search-products.tool';
import { ToolExecutor } from './tools/tool-executor';

@Module({
  imports: [ProductModule, ScheduleModule, EnrollmentModule, CheckoutModule, DataQualityModule, AvailabilityModule],
  controllers: [AiController],
  providers: [
    SearchProductsTool,
    GetProductTool,
    CheckDateTool,
    GetEnrollmentTool,
    GetCheckoutTool,
    ToolExecutor,
    AiService,
    {
      provide: OPENAI_CLIENT,
      inject: [ConfigService],
      // Null when no key is configured: the rest of the API keeps working and /ai/chat returns 503.
      useFactory: (config: ConfigService): ChatClient | null => {
        const apiKey = config.get<string>('OPENAI_API_KEY');
        return apiKey ? new OpenAI({ apiKey }) : null;
      },
    },
    {
      provide: AI_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService): AiConfig => ({
        model: config.get<string>('OPENAI_MODEL') || DEFAULT_OPENAI_MODEL,
        maxToolIterations: Number(config.get('AI_MAX_TOOL_ITERATIONS') ?? DEFAULT_MAX_TOOL_ITERATIONS),
      }),
    },
  ],
  exports: [AiService],
})
export class AiModule {}
