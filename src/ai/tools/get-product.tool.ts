import { Injectable, NotFoundException } from '@nestjs/common';
import { DataQualityService } from '../../data-quality/data-quality.service';
import { ProductService } from '../../product/product.service';
import { ScheduleService } from '../../schedule/schedule.service';
import { ProductSlugArgs } from './tool-args.dto';
import { CommerceTool, functionTool, PRODUCT_SLUG_PROPERTY } from './tool.types';

/**
 * Product detail for the model, composed from existing services:
 * - the product (minus REST navigation `links`, which the model misread as checkout links);
 * - the recurring schedule rule and exception knowledge (no computed dates; those come
 *   from check_date), so the confirmed schedule is visible next to schedule-related warnings;
 * - OPEN data-quality warnings, so conflicting claims travel with the authoritative data.
 */
@Injectable()
export class GetProductTool implements CommerceTool<ProductSlugArgs> {
  readonly name = 'get_product';
  readonly argsClass = ProductSlugArgs;
  readonly definition = functionTool(
    this.name,
    'Use once the product is identified (from search_products or earlier in the conversation). Authoritative product detail: name, business, type, delivery mode, offers (price, pricing basis, payment schedule), program (duration, included classes, class length), coaches, audience levels, access policy, requirements knowledge and the recurring schedule rule, each with provenance. For specific dates use check_date. Also returns open dataQualityWarnings: raw source claims that are NOT authoritative.',
    { productSlug: PRODUCT_SLUG_PROPERTY },
    ['productSlug'],
  );

  constructor(
    private readonly products: ProductService,
    private readonly dataQuality: DataQualityService,
    private readonly schedule: ScheduleService,
  ) {}

  async execute({ productSlug }: ProductSlugArgs) {
    const { links, ...product } = await this.products.detail(productSlug);
    const [dq, schedule] = await Promise.all([this.dataQuality.getForSlug(productSlug), this.scheduleSummary(productSlug)]);
    return {
      product,
      schedule,
      dataQualityWarnings: {
        note: dq.note,
        issues: dq.issues.filter((i) => i.status === 'OPEN'),
      },
    };
  }

  private async scheduleSummary(productSlug: string) {
    try {
      const { recurrence, exceptions } = await this.schedule.getForSlug(productSlug, {});
      return { recurrence, exceptions };
    } catch (err) {
      if (err instanceof NotFoundException) return null; // product has no schedule
      throw err;
    }
  }
}
