import type { ProductStatus, ProductType } from '../../common/enums';
import type { BusinessMatch } from '../business.repository';

export interface BusinessRefDto {
  slug: string;
  canonicalName: string;
  aliases: string[];
}

export interface BusinessResponseDto extends BusinessRefDto {
  resolution: { requested: string; matchedBy: BusinessMatch; matchedValue: string };
  products: { slug: string; name: string; productType: ProductType; status: ProductStatus }[];
}
