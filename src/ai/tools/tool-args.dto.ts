import { IsDefined, IsOptional, Matches, MaxLength } from 'class-validator';
import { IsCalendarDate, IsIanaTimezone } from '../../common/dto/validators';

// Argument DTOs for model-produced tool calls. They reuse the same validators as
// the REST layer, so the model can't pass anything the API would reject.

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class ProductSlugArgs {
  @IsDefined()
  @Matches(SLUG, { message: 'productSlug must be a lower-case kebab-case slug returned by search_products' })
  @MaxLength(120)
  productSlug: string;
}

export class CheckDateArgs extends ProductSlugArgs {
  @IsDefined()
  @IsCalendarDate()
  date: string;

  @IsOptional()
  @IsIanaTimezone()
  timezone?: string;
}

export class GetEnrollmentArgs extends ProductSlugArgs {
  @IsOptional()
  @IsCalendarDate()
  date?: string;
}
