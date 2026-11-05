import { Injectable } from '@nestjs/common';
import { DELIVERY_MODES, DISCIPLINES, EXPERIENCE_LEVELS } from '../../common/enums';
import { ProductListQueryDto } from '../../product/dto/product-query.dto';
import { ProductService } from '../../product/product.service';
import { resolveSearch } from '../domain/search-resolution';
import { CommerceTool, functionTool } from './tool.types';

const ONLY_IF_STATED = 'Set only if the user stated or clearly implied it (or it was established earlier); otherwise omit.';

@Injectable()
export class SearchProductsTool implements CommerceTool<ProductListQueryDto> {
  readonly name = 'search_products';
  readonly argsClass = ProductListQueryDto;
  readonly definition = functionTool(
    this.name,
    'Find active products. Every filter is optional. Pass only constraints the user actually expressed; calling with no filters lists the whole catalog, which is the right first step when the user did not name a product. The result includes "resolution" with the next step to take.',
    {
      business: { type: 'string', description: `One business name or alias exactly as the user wrote it (one name only; the system resolves aliases). ${ONLY_IF_STATED}` },
      discipline: { type: 'string', enum: [...DISCIPLINES], description: ONLY_IF_STATED },
      deliveryMode: { type: 'string', enum: [...DELIVERY_MODES], description: `E.g. "online"/"from home" -> ONLINE_LIVE. ${ONLY_IF_STATED}` },
      level: { type: 'string', enum: [...EXPERIENCE_LEVELS], description: `Experience level the product must support. ${ONLY_IF_STATED}` },
      durationMonths: { type: 'integer', minimum: 1, description: `Program length in months (e.g. "year-long" -> 12). ${ONLY_IF_STATED}` },
      q: { type: 'string', description: 'Literal text that appears in a product or business name. Not for concepts such as "annual" or "beginner"; use the structured filters for those. Usually omit.' },
    },
    [],
  );

  constructor(private readonly products: ProductService) {}

  async execute(args: ProductListQueryDto) {
    const result = await this.products.list(args);
    const usedArgs = Object.fromEntries(Object.entries(args).filter(([, v]) => v !== undefined));
    return { ...result, resolution: resolveSearch(result, usedArgs) };
  }
}
